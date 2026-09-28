// #138: the 戰報 (battle report). What a finished game's export is reduced to
// before a model writes a report from it, and the per-year boards the report
// page draws. Shared: the browser (the report page, its maps) and the Worker
// (src/report.js, the store and the model call) load it as is. DOM-free, no
// dependencies beyond the engine.
//
//   reportKey(exp)        -> Promise<hex>  SHA-256 of the game itself: final.seed,
//                                          game.options and final.actions. Nothing
//                                          about the viewer, the names, the language
//                                          or the export time, so every seat's and
//                                          every spectator's export of one game has
//                                          one key.
//   turnEnds(exp)         -> [{turn, state}] the raw engine state at the end of each
//                                          year played (1..result.turn); the last is
//                                          the final state.
//   buildDigest(exp)      -> the language-neutral digest (ids, not names).
//   digestText(d, lang)   -> the digest as plain text for the model, names resolved,
//                                          in historical wording ("zh" or "en").
//
// Everything is rebuilt from the recorded actions with `E.replay`'s own steps,
// never read from the export's `log` or `final` board: a client can send any
// log it likes. An export that does not replay to a finished game, or whose
// `result` is not the replay's result, is refused (throws).
//
// The digest is deterministic: the same game gives the same digest byte for
// byte, whoever exported it. No prompt text lives here (src/report-skill/*.md).
import * as E from "./engine.js";

const { QIN, CHU, SPACE, STATES, REGIONS, SCORED_REGIONS, CARD, JIUDING, REFORM } = E;
const SIDE = ["qin", "chu"];
export const DIGEST_VERSION = 1;
// A body larger than this is not a game (the longest bot game records ~450).
export const MAX_ACTIONS = 5000;

// ---------- the key ----------
// Canonical JSON: keys sorted at every level, undefined dropped, so two copies
// of one object serialise alike however they were built.
function canon(x) {
  if (Array.isArray(x)) return "[" + x.map((v) => (v === undefined ? "null" : canon(v))).join(",") + "]";
  if (x && typeof x === "object") {
    return "{" + Object.keys(x).sort().filter((k) => x[k] !== undefined).map((k) => JSON.stringify(k) + ":" + canon(x[k])).join(",") + "}";
  }
  return JSON.stringify(x === undefined ? null : x);
}
function gameOf(exp) {
  if (!exp || typeof exp !== "object") throw new Error("report: not an export");
  if (exp.format !== "zongheng-log" || exp.version !== 1) throw new Error("report: not a zongheng-log version 1 export");
  const f = exp.final, g = exp.game;
  if (!g || typeof g !== "object" || !g.options || typeof g.options !== "object" || Array.isArray(g.options)) throw new Error("report: no game options");
  if (!f || typeof f !== "object") throw new Error("report: the game is not over");
  if (!Array.isArray(f.actions)) throw new Error("report: the game has no recorded actions");
  if (f.actions.length > MAX_ACTIONS) throw new Error("report: too many actions");
  const seed = f.seed ?? 0;
  if (!Number.isInteger(seed)) throw new Error("report: bad seed");
  return { seed, options: g.options, actions: f.actions };
}
export async function reportKey(exp) {
  const { seed, options, actions } = gameOf(exp);
  const text = "zongheng-report-key/1\n" + canon({ seed, options, actions });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- the replay ----------
// The game again, action by action: E.replay's own steps (the initial state
// is `replay` with no actions), plus what the digest needs on the way -- the
// board after every action (to check the digest's own bookkeeping against the
// engine) and the state at the end of each year (engine `probe.turnEnd`).
function walk(exp) {
  const { seed, options, actions } = gameOf(exp);
  let st = E.replay(seed, options, []);
  const initial = E.clone(st);
  const marks = []; // [logLength, inf] after each action
  const ends = {};
  const prev = E.probe.turnEnd;
  E.probe.turnEnd = (s) => { ends[s.turn] = E.clone(s); };
  try {
    for (const a of actions) {
      if (st.winner != null) throw new Error("report: actions after the end of the game");
      st = E.apply(st, a);
      marks.push([st.log.length, st.inf]);
    }
  } finally { E.probe.turnEnd = prev; }
  if (st.winner == null) throw new Error("report: the actions do not finish the game");
  const r = exp.result;
  const mine = { winner: st.winner, reason: st.reason, turn: st.turn, mandate: st.mandate };
  if (!r || typeof r !== "object" || ["winner", "reason", "turn", "mandate"].some((k) => r[k] !== mine[k])) {
    throw new Error("report: the export's result is not the replay's result");
  }
  ends[st.turn] = st;
  for (let t = 1; t <= st.turn; t++) if (!ends[t]) throw new Error(`report: no end of year ${t}`);
  return { st, initial, marks, ends };
}

export function turnEnds(exp) {
  const { st, ends } = walk(exp);
  const out = [];
  for (let t = 1; t <= st.turn; t++) out.push({ turn: t, state: E.clone(ends[t]) });
  return out;
}

// ---------- the digest ----------
const DISASTER = { daji: "famine", huanghe: "flood", yili: "pestilence", tiangou: "eclipse" };
// Heaven's Mandate as a direction, never a number. 20 wins outright.
export const LEAN_STRONG = 10, SHIFT_STRONG = 5;
function lean(m) { return m === 0 ? { toward: null } : { toward: m > 0 ? "qin" : "chu", strength: Math.abs(m) >= LEAN_STRONG ? "strongly" : "slightly" }; }
function shift(d) { return d === 0 ? { toward: null } : { toward: d > 0 ? "qin" : "chu", strength: Math.abs(d) >= SHIFT_STRONG ? "strongly" : "slightly" }; }
const ctlName = (c) => (c == null ? null : SIDE[c]);

export function buildDigest(exp) {
  const { st, initial, marks, ends } = walk(exp);
  const log = st.log;
  log.forEach((l, k) => { if (l.i !== k + 1) throw new Error("report: the log is not whole"); });

  // The board as the log tells it, entry by entry, checked against the engine's
  // own board at every action boundary where no event is half done.
  const board = { inf: E.clone(initial.inf) };
  const infAt = (id) => board.inf[id] || [0, 0];
  const bump = (id, side, n) => { if (!board.inf[id]) board.inf[id] = [0, 0]; board.inf[id][side] += n; };
  const ctl = (id) => E.controller(board, id);
  const same = (a, b) => {
    for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[id] || [0, 0], y = b[id] || [0, 0];
      if (x[0] !== y[0] || x[1] !== y[1]) return false;
    }
    return true;
  };
  let markAt = 0, openEvents = 0;
  const capitals = { qin: E.HOME_CAPITAL[QIN], chu: E.HOME_CAPITAL[CHU] };
  const capStatus = (side) => { const c = ctl(capitals[SIDE[side]]); return c === side ? "secure" : c === E.other(side) ? "taken" : "threatened"; };
  const capNow = [capStatus(QIN), capStatus(CHU)];

  const opening = { qin: {}, chu: {}, farStart: (st.options.qinFarStart || 0) > 0 };
  const turns = [];
  let year = null, cur = null, lastItem = null, inHeadline = false, finalReckoning = false;
  const eventStack = []; // open events: { item, campaigns: [[id, dq, dc]] }
  const reformAt = [0, 0];
  let lobbyItem = null;

  // Apply deltas, return the control changes they caused.
  function change(deltas) {
    const before = {};
    for (const [id] of deltas) if (!(id in before)) before[id] = ctl(id);
    for (const [id, dq, dc] of deltas) { if (dq) bump(id, QIN, dq); if (dc) bump(id, CHU, dc); }
    const out = [];
    for (const id of Object.keys(before)) { const a = ctl(id); if (a !== before[id]) out.push([id, ctlName(before[id]), ctlName(a)]); }
    return out;
  }
  const before = []; // anything the setup itself set off (none today)
  function push(item) { (cur ? cur.events : before).push(item); lastItem = item; return item; }
  function capitalWatch() {
    for (const side of [QIN, CHU]) {
      const s = capStatus(side);
      if (s !== capNow[side]) { push({ type: "capital", whose: SIDE[side], capital: capitals[SIDE[side]], status: s, was: capNow[side] }); capNow[side] = s; }
    }
  }
  function addControl(item, c) { if (c.length) item.control = (item.control || []).concat(c); }
  function yearEnd(t) {
    const s = ends[t];
    const regions = {};
    for (const r of SCORED_REGIONS) { const [q, c] = E.regionTally(s, r); regions[r] = [q.level, c.level]; }
    const start = t === 1 ? 0 : ends[t - 1].mandate;
    return {
      type: "yearEnd", regions, luoyi: ctlName(E.controller(s, "luoyi")),
      mandate: lean(s.mandate), shift: shift(s.mandate - start),
      weariness: s.weariness, seals: Object.keys(s.seals).sort(), fallen: Object.keys(s.mie).sort(),
      reform: s.reform.slice(), cauldrons: SIDE[s.jiuding.holder],
    };
  }
  function closeYear() {
    if (!cur) return;
    const seen = new Set();
    for (const l of log) if (l.t === cur.turn && l.card && !seen.has(l.card)) seen.add(l.card);
    cur.cards = [...seen];
    cur.events.push(yearEnd(cur.turn));
  }

  for (let k = 0; k < log.length; k++) {
    const l = log[k];
    if (l.t >= 1 && l.t !== year) {
      closeYear();
      year = l.t;
      cur = { turn: year, cards: [], events: [] };
      turns.push(cur);
      inHeadline = false;
    }
    switch (l.type) {
      case "setup": {
        const o = opening[SIDE[l.side]];
        for (const id of l.points) { o[id] = (o[id] || 0) + 1; bump(id, l.side, 1); }
        break;
      }
      case "era": push({ type: "era", era: l.era }); break;
      case "headline":
        inHeadline = true;
        push({ type: "headline", cards: l.cards.slice(), first: l.first == null ? null : SIDE[l.first] });
        break;
      case "play": {
        inHeadline = false;
        const it = { type: "play", side: SIDE[l.side], card: l.card, use: l.use };
        if (l.pair) it.pair = l.pair;
        push(it);
        break;
      }
      case "bog": inHeadline = false; push({ type: "bogged", side: SIDE[l.side], card: l.card }); break;
      case "event": {
        const it = { type: "event", card: l.card, owner: SIDE[l.side], by: SIDE[l.by] };
        if (inHeadline) it.headline = true;
        if (DISASTER[l.card]) it.disaster = DISASTER[l.card];
        push(it);
        eventStack.push({ item: it, campaigns: [] });
        openEvents++;
        break;
      }
      case "eventEnd": {
        const open = eventStack.pop();
        openEvents--;
        if (!open || open.item.card !== l.card) throw new Error("report: an event's end without its start");
        const it = open.item;
        it.effect = !!l.effect;
        // The event's own change: its diff less the campaigns it launched (those
        // were applied, and are told, at their own entries).
        const net = {};
        for (const [id, dq, dc] of l.inf || []) net[id] = [dq, dc];
        for (const [id, dq, dc] of open.campaigns) { const x = net[id] || [0, 0]; net[id] = [x[0] - dq, x[1] - dc]; }
        const deltas = Object.entries(net).filter(([, d]) => d[0] || d[1]).map(([id, d]) => [id, d[0], d[1]]);
        const gains = [], losses = [];
        for (const [id, dq, dc] of deltas) {
          if (dq > 0) gains.push([id, "qin", dq]); if (dq < 0) losses.push([id, "qin", -dq]);
          if (dc > 0) gains.push([id, "chu", dc]); if (dc < 0) losses.push([id, "chu", -dc]);
        }
        if (gains.length) it.gains = gains;
        if (losses.length) it.losses = losses;
        addControl(it, change(deltas));
        if (l.fx && l.fx.add.length) it.lasting = true;
        if (l.fx && l.fx.rm.length) it.ends = l.fx.rm.slice();
        if (l.hands) it.hands = l.hands.slice();
        if (l.recover) it.easedTo = l.recover;
        if (l.card === "miezhou") it.cauldronsTo = "qin";
        lastItem = it;
        capitalWatch();
        break;
      }
      case "place": {
        const spaces = {};
        for (const id of l.points) spaces[id] = (spaces[id] || 0) + 1;
        const it = push({ type: "place", side: SIDE[l.side], spaces: Object.entries(spaces) });
        addControl(it, change(Object.entries(spaces).map(([id, n]) => (l.side === QIN ? [id, n, 0] : [id, 0, n]))));
        capitalWatch();
        break;
      }
      case "campaign": {
        const d = l.side === QIN ? [l.target, l.placed, -l.removed] : [l.target, -l.removed, l.placed];
        const it = { type: "campaign", side: SIDE[l.side], target: l.target, removed: l.removed, placed: l.placed };
        if (eventStack.length) { it.card = eventStack[eventStack.length - 1].item.card; eventStack[eventStack.length - 1].campaigns.push(d); }
        push(it);
        addControl(it, change([d]));
        capitalWatch();
        break;
      }
      case "lobby": {
        if (eventStack.length) break; // 縱橫家遊說's event: its change is the event's
        const it = { type: "lobby", side: SIDE[l.side], target: l.target };
        if (l.mode) { it.driven = l.removed || 0; it.lost = l.lost || 0; lobbyItem = it; }
        else {
          it.driven = l.removed || 0; it.lost = 0;
          addControl(it, change([l.side === QIN ? [l.target, 0, -it.driven] : [l.target, -it.driven, 0]]));
          lobbyItem = null;
        }
        push(it);
        capitalWatch();
        break;
      }
      case "realign": {
        const d = [l.target, 0, 0];
        if (l.lose != null && l.n) d[1 + l.lose] = -l.n;
        const c = change([d]);
        if (lobbyItem) addControl(lobbyItem, c);
        capitalWatch();
        break;
      }
      case "lobbyStop": if (lobbyItem) lobbyItem.stopped = true; break;
      case "jiuding": push({ type: "cauldrons", to: SIDE[l.to] }); break;
      case "reform": {
        reformAt[l.side] = l.box;
        const it = { type: "reform", side: SIDE[l.side], box: l.box, first: reformAt[E.other(l.side)] < l.box };
        push(it);
        if (l.box === 6) {
          const next = log[k + 1];
          it.emperor = next && next.type === "over" && next.reason === "emperor" ? "won" : it.first ? "notLeading" : "second";
        }
        break;
      }
      case "seal": push({ type: "seal", state: l.state, to: "chu" }); break;
      case "unseal": push({ type: "unseal", state: l.state }); break;
      case "mie": push({ type: "fall", state: l.state }); break;
      case "restore": push({ type: "restore", state: l.state }); break;
      case "score": {
        const toward = l.qin.total > l.chu.total ? "qin" : l.chu.total > l.qin.total ? "chu" : null;
        const it = { type: "reckoning", region: l.region, levels: [l.qin.level, l.chu.level], toward };
        if (finalReckoning) it.final = true;
        push(it);
        break;
      }
      case "vp": {
        const next = log[k + 1], prev = log[k - 1];
        const d = l.side === QIN ? l.n : -l.n;
        const favour = { toward: d > 0 ? "qin" : "chu", strength: Math.abs(d) >= 3 ? "strongly" : "slightly" };
        if (prev && ["score", "mie", "seal", "reform", "capitalMoves"].includes(prev.type)) break;
        if (next && next.type === "endTurn") push({ type: "zhou", ...favour });
        else if (eventStack.length) eventStack[eventStack.length - 1].item.heaven = favour;
        // Otherwise the Mandate moved with a reckoning, a seal, a fall, a reform
        // or a moved capital, each told at its own entry.
        break;
      }
      case "tire": {
        const it = { type: "weariness", level: l.to, by: SIDE[l.by] };
        if (lastItem && (lastItem.type === "campaign" || lastItem.type === "event")) lastItem.wearied = l.to;
        else push(it);
        break;
      }
      case "discard": {
        if (eventStack.length) { const it = eventStack[eventStack.length - 1].item; it.setAside = (it.setAside || []).concat(l.card); }
        break;
      }
      case "capitalCheck":
        if (l.result === "fallen") push({ type: "capitalFell", whose: SIDE[l.whose], capital: l.capital });
        break;
      case "capitalMoves":
        capitals[SIDE[l.whose]] = l.to;
        push({ type: "capitalMoved", whose: SIDE[l.whose], from: l.from, to: l.to });
        capNow[l.whose] = capStatus(l.whose);
        break;
      case "endTurn":
        if (l.turn >= st.options.turns) finalReckoning = true;
        break;
      case "over": push({ type: "end", winner: SIDE[l.winner], reason: l.reason }); break;
      default: break; // turn, skip, reshuffle, opsLost, discard of 明法令 ...: nothing to tell
    }
    // The bookkeeping against the engine, at the end of every action.
    while (markAt < marks.length && marks[markAt][0] <= k + 1) {
      if (marks[markAt][0] === k + 1 && !openEvents && !same(board.inf, marks[markAt][1])) {
        throw new Error(`report: the digest lost track of the board at entry ${l.i}`);
      }
      markAt++;
    }
  }
  closeYear();
  if (!same(board.inf, st.inf)) throw new Error("report: the digest lost track of the board");
  if (turns.length !== st.turn) throw new Error("report: a year has no entries");

  const toPairs = (o) => Object.entries(o);
  return {
    version: DIGEST_VERSION,
    winner: st.winner, reason: st.reason, years: st.turn,
    mandate: lean(st.mandate),
    rules: { seals: st.options.seals, mie: st.options.mie, turns: st.options.turns, emperor: st.options.emperor ?? "vp", homeFall: st.options.homeFall ?? "none" },
    opening: { qin: toPairs(opening.qin), chu: toPairs(opening.chu), farStart: opening.farStart, events: before },
    turns,
  };
}

// ---------- the text for the model ----------
// Every id becomes its name; the wording is the history's, not the game's,
// because the model copies what it reads. None of the report's banned words
// (src/report-check.js) may appear here.
//
// The shape (#138 round 2): a one-line arc of the whole contest, the opening,
// then per year 「本年要事」 -- at most five items, ranked, each with the
// episodes behind it -- before 「詳細經過」, the full record, and the year's end.
// The ranking (the orchestrator's brief, #138 round 2):
//   1 the end of the contest, or a claim to be Emperor
//   2 a capital taken, threatened or retaken
//   3 a state destroyed or restored
//   4 a seal given or taken back
//   5 a region changing hands at the year's end
//   6 a step of reform
//   7 Heaven's Mandate, if it swung strongly this year
//   8 a large event and what it did
// A year with none of these still gets one item: its hardest-fought ground.
const REFORM_EN = ["Moving the Pole", "Ending the Well-Field", "Ranks for Merit in War", "The County System", "Clear Laws", "Proclaiming an Emperor"];
// The realm's weariness as words that stand alone (zh after 「天下」, en as a clause).
const WEARY = {
  zh: { 5: "承平無事", 4: "兵連不息", 3: "兵連禍結", 2: "民困已極", 1: "土崩瓦解" },
  en: { 5: "the realm was at peace", 4: "war followed war", 3: "calamity followed calamity", 2: "the people were exhausted", 1: "the realm was falling apart" },
};
const LEVEL = {
  zh: { presence: "有立足之地", domination: "佔上風", control: "盡得其地", none: "無一席之地" },
  en: { presence: "a foothold", domination: "the upper hand", control: "the whole region", none: "nothing" },
};
const NUM_ZH = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
const NUM_EN = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const numZh = (n) => (n === 2 ? "兩" : NUM_ZH[n] ?? String(n));
const numEn = (n) => NUM_EN[n] ?? String(n);
const L = {
  zh: {
    side: ["秦", "楚"], year: (t) => `第${NUM_ZH[t] ?? t}年`, yearShort: (t) => `第${NUM_ZH[t] ?? t}年`,
    space: (id) => SPACE[id].zh, state: (id) => STATES[id].zh, region: (r) => REGIONS[r].zh,
    card: (id) => (id === JIUDING ? "九鼎" : CARD[id].zh), era: (e) => E.ERAS.find((x) => x.id === e).zh,
    box: (b) => REFORM[b - 1].zh, list: (a) => a.join("、"), sep: ";", end: "。",
  },
  en: {
    side: ["Qin", "Chu"], year: (t) => `Year ${t}`, yearShort: (t) => `Year ${t}`,
    space: (id) => SPACE[id].en, state: (id) => STATES[id].en, region: (r) => REGIONS[r].en,
    card: (id) => (id === JIUDING ? "the Nine Cauldrons" : CARD[id].en), era: (e) => E.ERAS.find((x) => x.id === e).en,
    box: (b) => REFORM_EN[b - 1], list: (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]), sep: "; ", end: ".",
  },
};
// Natural or fated happenings (#138 round 3). Of the 67 cards that are not a
// region's council, these four are the ones whose event is weather, harvest,
// sickness or an omen -- nothing a court does (cards.js): 大饑 (the harvest
// fails), 黃河決口 (the river floods), 疫癘 (sickness), 天狗食日 (an eclipse).
// Every other card is a man, a battle, a policy, an embassy, a ruse, a trade or
// a gift, something someone does. The same four as `DISASTER` in buildDigest.
// Told as what befell the realm that year, never as a side's deed: whoever
// played the card only chose the moment (a headline says so), and a card of
// these used for its means, not its event, did not happen at all.
const NATURAL = {
  daji: { zh: "天降大饑", zhAt: "饑荒之機", en: "famine came upon the land", enAt: "the famine" },
  huanghe: { zh: "黃河決口,洪水氾濫", zhAt: "河患之機", en: "the Yellow River broke its banks and flooded the plain", enAt: "the flood" },
  yili: { zh: "疫癘流行", zhAt: "疫病流行之機", en: "pestilence spread through the land", enAt: "the pestilence" },
  tiangou: { zh: "天狗食日,人心惶惶", zhAt: "天象示警之機", en: "the sun was eaten in the sky, and men were afraid", enAt: "the omen in the sky" },
};
const isNatural = (c) => Object.prototype.hasOwnProperty.call(NATURAL, c);
const sideIx = (s) => (s === "qin" ? QIN : CHU);
const otherSide = (s) => (s === "qin" ? "chu" : "qin");
const isScoring = (c) => !!(CARD[c] && CARD[c].scoring);

// Control changes as sentences.
function ctlText(c, lang) {
  const T = L[lang], zh = lang === "zh", S = (s) => T.side[sideIx(s)], sp = T.space;
  return c.map(([id, from, to]) => (to
    ? (zh ? `${sp(id)}遂歸${S(to)}掌握` : `${sp(id)} went over to ${S(to)}`)
    : (zh ? `${S(from)}失去對${sp(id)}的掌握` : `${S(from)} lost its hold on ${sp(id)}`)));
}
// Gains or losses of supporters, grouped: one clause per side and size.
function movesText(arr, up, lang) {
  const T = L[lang], zh = lang === "zh", S = (s) => T.side[sideIx(s)];
  const groups = [];
  for (const [id, s, n] of arr) {
    let g = groups.find((x) => x.s === s && x.n === n);
    if (!g) groups.push((g = { s, n, ids: [] }));
    g.ids.push(id);
  }
  return groups.map(({ s, n, ids }) => {
    const where = T.list(ids.map(T.space)), many = ids.length > 1;
    if (zh) return up ? `${S(s)}在${where}${many ? "各" : ""}添了${numZh(n)}批親附者` : `${S(s)}在${where}的親附者${many ? "各" : ""}散去${numZh(n)}批`;
    const what = `${numEn(n)} ${n > 1 ? "groups" : "group"} of supporters`;
    return many ? `in each of ${where}, ${S(s)} ${up ? "won over" : "lost"} ${what}` : `in ${where}, ${S(s)} ${up ? "won over" : "lost"} ${what}`;
  });
}
function wearyText(level, lang, eased) {
  const zh = lang === "zh", w = WEARY[lang][level];
  if (eased) return zh ? (level === 5 ? "天下稍得喘息,復歸承平" : `天下稍得喘息,只是依舊${w}`) : (level === 5 ? "the realm found relief, and peace returned" : `the realm found a little relief, though ${w}`);
  return zh ? `戰火愈烈,天下${w}` : `the realm grew wearier: ${w}`;
}

// One item of the record as a clause. `k` varies the wording so that no one
// phrase becomes a refrain; `cont` is set when the item only continues the
// play just told (the event of a card its player set in motion).
function describe(it, lang, k = 0, cont = false) {
  const T = L[lang], zh = lang === "zh";
  const S = (s) => T.side[sideIx(s)];
  const q = (id) => (zh ? `「${T.card(id)}」` : T.card(id));
  const sp = T.space;
  const reckon = (region) => (zh ? `${T.region(region)}諸國權衡秦楚向背` : `the states of ${T.region(region)} weighed Qin against Chu`);
  switch (it.type) {
    case "era": return zh ? `${T.era(it.era)}開始,新的人物與時勢登場` : `The ${T.era(it.era)} began; new men and new circumstances came onto the stage`;
    case "headline": {
      const one = (s, then) => {
        const c = it.cards[s], court = zh ? `${T.side[s]}廷${then ? "則" : ""}` : `the court of ${T.side[s]}`;
        if (c == null) return zh ? `${court}未有定議` : `${court} settled on no plan`;
        if (isScoring(c)) return zh ? `${court}議定召${T.region(CARD[c].scoring)}諸國會盟表態` : `${court} resolved to summon the states of ${T.region(CARD[c].scoring)} to declare themselves`;
        // A side chooses only the moment of a natural happening, never the happening.
        if (isNatural(c)) return zh ? `${court}欲趁${NATURAL[c].zhAt}行事` : `${court} meant to seize the moment of ${NATURAL[c].enAt}`;
        return zh ? `${court}議定以${q(c)}為急務` : `${court} resolved to make ${T.card(c)} its first concern`;
      };
      const first = it.first ? (zh ? `;${S(it.first)}搶先一步` : `; ${S(it.first)} moved first`) : "";
      return zh ? `年初,${one(QIN)},${one(CHU, true)}${first}` : `At the start of the year ${one(QIN)}, and ${one(CHU)}${first}`;
    }
    case "play": {
      const c = CARD[it.card];
      if (c && c.scoring) return zh ? `${S(it.side)}召${T.region(c.scoring)}諸國會盟表態` : `${S(it.side)} summoned the states of ${T.region(c.scoring)} to declare themselves`;
      const enemy = c && c.side != null && SIDE[c.side] !== it.side;
      if (isNatural(it.card)) {
        // The happening is told by its event; nobody's deed. Used for its means, it never happened.
        if (it.use === "event") return "";
        if (it.use === "reform") return zh ? `${S(it.side)}王專心推行變法` : `the King of ${S(it.side)} pressed on with his reforms`;
        if (["place", "campaign", "lobby"].includes(it.use)) return "";
      }
      switch (it.use) {
        case "event": return enemy ? (zh ? `${S(it.side)}聽任${q(it.card)}一事發生` : `${S(it.side)} stood aside and let ${T.card(it.card)} run its course`) : (zh ? `${S(it.side)}行${q(it.card)}之事` : `${S(it.side)} set ${T.card(it.card)} in motion`);
        case "reform": return zh ? `${S(it.side)}王擱下${q(it.card)}一事,專心推行變法` : `the King of ${S(it.side)} set aside the matter of ${T.card(it.card)} and pressed on with his reforms`;
        case "place": case "campaign": case "lobby": {
          if (it.pair) return zh ? `${S(it.side)}遣說客周旋,使${q(it.pair)}之事未成,反為己用` : `${S(it.side)} sent a persuader, who kept ${T.card(it.pair)} from happening and turned its means to ${S(it.side)}'s own ends`;
          if (it.card === JIUDING) return zh ? "挾九鼎之威," : "With the Nine Cauldrons in hand,";
          return ""; // the card is told at the end of the line: the deed comes first
        }
        default: return zh ? `${S(it.side)}有所舉措` : `${S(it.side)} acted`;
      }
    }
    case "bogged":
      if (isNatural(it.card)) return zh ? `${S(it.side)}軍頓兵堅城之下,一時無所作為` : `${S(it.side)}'s army was held up before the walls and could do nothing`;
      return zh ?`${S(it.side)}軍頓兵堅城之下,只得放棄${q(it.card)}之謀` : `${S(it.side)}'s army was held up before the walls and had to give up ${T.card(it.card)}`;
    case "event": {
      const parts = [];
      const favours = it.owner !== it.by;
      const fav = favours ? (zh ? `,於${S(it.owner)}有利` : `, which favoured ${S(it.owner)}`) : "";
      // A natural happening is told as what befell the realm that year (its name is in the words).
      if (isNatural(it.card)) parts.push((zh ? `是年${NATURAL[it.card].zh}` : `that year ${NATURAL[it.card].en}`) + fav);
      else if (!cont) parts.push(zh ? `${q(it.card)}一事既起${fav}` : `then came ${T.card(it.card)}${fav}`);
      if (it.gains) parts.push(...movesText(it.gains, true, lang));
      if (it.losses) parts.push(...movesText(it.losses, false, lang));
      if (it.control) parts.push(...ctlText(it.control, lang));
      if (it.heaven) parts.push(zh ? `天命${it.heaven.strength === "strongly" ? "大" : "稍"}向${S(it.heaven.toward)}傾斜` : `Heaven's Mandate leaned ${it.heaven.strength} toward ${S(it.heaven.toward)}`);
      if (it.lasting) parts.push(zh ? "其影響延續下去" : "its influence would last");
      if (it.ends) parts.push(zh ? `${it.ends.map(q).join("、")}的影響就此消散` : `the influence of ${T.list(it.ends.map(T.card))} came to an end`);
      if (it.hands) it.hands.forEach((n, s) => { if (n > 0) parts.push(zh ? `${T.side[s]}得到新的謀略` : `${T.side[s]} gained new counsel`); });
      // A natural card set aside was never anyone's plan: it is left out.
      const aside = (it.setAside || []).filter((c) => !isNatural(c));
      if (aside.length) parts.push(zh ? `${aside.map(q).join("、")}之謀遂被擱置` : `the plan of ${T.list(aside.map(T.card))} was set aside`);
      if (it.easedTo) parts.push(wearyText(it.easedTo, lang, true));
      if (it.cauldronsTo) parts.push(zh ? `九鼎歸${S(it.cauldronsTo)}` : `the Nine Cauldrons passed to ${S(it.cauldronsTo)}`);
      if (it.wearied) parts.push(wearyText(it.wearied, lang));
      if (it.effect === false) parts.push(zh ? "然而並未改變甚麼" : "but it changed nothing");
      return parts.join(T.sep);
    }
    case "place": {
      const where = it.spaces.map(([id, n]) => (n > 1 && zh ? `${sp(id)}(${numZh(n)}批)` : sp(id)));
      const s = it.side === "qin" ? S("qin") : S("chu");
      let text;
      if (zh) text = `${s}遣人入${T.list(where)}` + ["結交豪傑,廣收黨羽", "延攬士人,收攏人心", "結納當地大族,培植親附者", "廣布耳目,招徠黨羽"][k % 4];
      else {
        const strong = it.spaces.filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
        const most = strong.length && (strong.length === 1 || strong[0][1] > strong[1][1]) ? strong[0][0] : null;
        const w = T.list(where);
        text = [`${s} sent agents into ${w} to gather supporters`, `${s} cultivated the leading families of ${w}`, `${s}'s agents went among the people of ${w}, buying loyalty`, `${s} built a following in ${w}`][k % 4];
        if (most) text += it.spaces.length > 1 ? `, above all in ${sp(most)}` : ", in strength";
      }
      return [text, ...ctlText(it.control || [], lang)].join(T.sep);
    }
    case "campaign": {
      const opp = otherSide(it.side);
      const by = it.card ? (zh ? `(因${q(it.card)})` : ` as part of ${T.card(it.card)}`) : "";
      const parts = [zh
        ? `${S(it.side)}發兵攻${sp(it.target)}${by},逐走${S(opp)}的人馬${numZh(it.removed)}批${it.placed ? `,留下${numZh(it.placed)}批自家人馬駐守` : ""}`
        : `${S(it.side)} marched on ${sp(it.target)}${by} and drove out ${numEn(it.removed)} ${it.removed > 1 ? "bands" : "band"} of ${S(opp)}'s men${it.placed ? `, leaving ${numEn(it.placed)} of its own to hold it` : ""}`];
      parts.push(...ctlText(it.control || [], lang));
      if (it.wearied) parts.push(wearyText(it.wearied, lang));
      return parts.join(T.sep);
    }
    case "lobby": {
      const opp = otherSide(it.side);
      if (zh) {
        const r = [];
        if (it.driven) r.push(`說動當地士人,親${S(opp)}的人心去了${numZh(it.driven)}批`);
        if (it.lost) r.push(`卻也折損了自家${numZh(it.lost)}批人`);
        if (!it.driven && !it.lost) r.push("雙方僵持,無功而返");
        if (it.stopped) r.push("見好就收");
        return [`${S(it.side)}的使者前往${sp(it.target)}遊說,` + r.join(","), ...ctlText(it.control || [], lang)].join(T.sep);
      }
      const r = [];
      if (it.driven) r.push(`talked ${numEn(it.driven)} ${it.driven > 1 ? "groups" : "group"} of ${S(opp)}'s supporters into leaving`);
      if (it.lost) r.push(`${it.driven ? "but " : ""}lost ${numEn(it.lost)} ${it.lost > 1 ? "groups" : "group"} of their own`);
      if (!it.driven && !it.lost) r.push("came back with nothing");
      let s = `${S(it.side)}'s envoys went to ${sp(it.target)} and ` + (r.length > 1 ? r.slice(0, -1).join(", ") + (r[r.length - 1].startsWith("but ") ? ", " : " and ") + r[r.length - 1] : r[0]);
      if (it.stopped) s += ", and then wisely stopped";
      return [s, ...ctlText(it.control || [], lang)].join(T.sep);
    }
    case "cauldrons": return zh ? `九鼎易手,歸於${S(it.to)}(暫且蒙塵)` : `the Nine Cauldrons passed into ${S(it.to)}'s keeping, though they could not yet be used`;
    case "reform": {
      let s = zh ? `${S(it.side)}變法進至「${T.box(it.box)}」` : `${S(it.side)}'s reforms advanced to "${T.box(it.box)}"`;
      if (it.box < 6 && it.first) s += zh ? ",天下首創" : ", the first in the realm to do so";
      if (it.emperor === "won") s += zh ? `,${S(it.side)}王登基稱帝,天下莫敢不從` : `; the King of ${S(it.side)} proclaimed himself Emperor and none dared refuse him`;
      else if (it.emperor === "notLeading") s += zh ? `,${S(it.side)}王欲稱帝,然天命未歸,諸侯不服,只得虛名` : `; the King of ${S(it.side)} proclaimed himself Emperor, but Heaven had not turned to him and the lords would not bow`;
      else if (it.emperor === "second") s += zh ? `,${S(it.side)}王亦稱帝,然已落人之後` : `; the King of ${S(it.side)} too took the imperial title, but only after his rival`;
      return s;
    }
    case "seal": return zh ? `${T.state(it.state)}國將相印交給楚,加入合縱` : `the state of ${T.state(it.state)} gave its seal of office to Chu and joined the Vertical Alliance`;
    case "unseal": return zh ? `${T.state(it.state)}國收回給楚的相印` : `the state of ${T.state(it.state)} took back the seal it had given Chu`;
    case "fall": return zh ? `秦滅${T.state(it.state)}` : `Qin destroyed the state of ${T.state(it.state)}`;
    case "restore": return zh ? `${T.state(it.state)}國復國,擺脫秦的統治` : `the state of ${T.state(it.state)} rose again and threw off Qin`;
    case "capital": {
      const c = sp(it.capital), w = S(it.whose), o = S(otherSide(it.whose));
      if (it.status === "taken") return zh ? `${w}都${c}落入${o}之手` : `${w}'s capital ${c} fell into ${o}'s hands`;
      if (it.status === "threatened") return it.was === "taken" ? (zh ? `${o}在${w}都${c}的掌握動搖` : `${o}'s grip on ${w}'s capital ${c} loosened`) : (zh ? `${w}都${c}告急` : `${w}'s capital ${c} was threatened`);
      return zh ? `${w}重新穩住國都${c}` : `${w} made its capital ${c} secure again`;
    }
    case "capitalFell": return zh ? `年終${S(it.whose)}仍未奪回國都${sp(it.capital)},國都陷落` : `at the year's end ${S(it.whose)} had still not won back its capital ${sp(it.capital)}, and the capital was lost`;
    case "capitalMoved": return zh ? `${S(it.whose)}遷都,自${sp(it.from)}遷往${sp(it.to)}` : `${S(it.whose)} moved its capital from ${sp(it.from)} to ${sp(it.to)}`;
    case "reckoning": {
      const [a, b] = it.levels;
      const lv = zh ? `秦${LEVEL.zh[a]},楚${LEVEL.zh[b]}` : `Qin held ${LEVEL.en[a]}, Chu ${LEVEL.en[b]}`;
      const tw = it.toward ? (zh ? `,人心向${S(it.toward)}` : `; hearts turned toward ${S(it.toward)}`) : (zh ? ",兩不相讓" : "; neither prevailed");
      return (it.final ? (zh ? "終局之時," : "At the end, ") : "") + (zh ? `${reckon(it.region)}:${lv}${tw}` : `${reckon(it.region)}: ${lv}${tw}`);
    }
    case "zhou": return zh ? `周天子在洛邑賜福於${S(it.toward)}` : `the Zhou king at Luoyi bestowed his favour on ${S(it.toward)}`;
    case "weariness": return wearyText(it.level, lang);
    case "end": return endText(it, lang);
    default: return null;
  }
}

function endText(it, lang) {
  const T = L[lang], zh = lang === "zh", w = T.side[sideIx(it.winner)], o = T.side[1 - sideIx(it.winner)];
  const R = {
    mandate: zh ? `天命盡歸${w},${w}得天下` : `Heaven's Mandate passed wholly to ${w}, and ${w} won`,
    unification: zh ? `秦連滅諸國,一統之勢已成,秦勝` : `Qin had destroyed state after state; unification was at hand, and Qin won`,
    alliance: zh ? `諸國相印盡歸楚,合縱大成,楚勝` : `the seals of the states were all in Chu's hands; the Vertical Alliance was complete, and Chu won`,
    collapse: zh ? `天下土崩,罪在${o},${w}勝` : `the realm collapsed, the blame fell on ${o}, and ${w} won`,
    homeFall: zh ? `${o}國都陷落,${w}勝` : `${o}'s capital was lost, and ${w} won`,
    emperor: zh ? `${w}王稱帝,${w}勝` : `the King of ${w} was Emperor, and ${w} won`,
    final: zh ? `歲月已盡,諸國權衡向背,天命歸${w},${w}勝` : `the years ran out; the states weighed their loyalties, Heaven's Mandate rested with ${w}, and ${w} won`,
    tie: zh ? `歲月已盡,天命不偏不倚,依古例歸${w},${w}勝` : `the years ran out with Heaven's Mandate even; by old custom it went to ${w}, and ${w} won`,
    scoring: zh ? `${o}失信於諸侯,誤了會盟之期,${w}勝` : `${o} broke faith with the lords and missed the appointed council, and ${w} won`,
    scoringBoth: zh ? `兩國皆失信於諸侯,依古例${w}勝` : `both courts broke faith with the lords; by old custom ${w} won`,
  };
  return R[it.reason] || (zh ? `${w}勝` : `${w} won`);
}

function leanText(m, lang, kind) {
  const zh = lang === "zh", S = L[lang].side;
  if (!m.toward) return zh ? (kind === "shift" ? "天命今年未見偏移" : "天命不偏不倚") : (kind === "shift" ? "Heaven's Mandate did not move this year" : "Heaven's Mandate stood even");
  const s = S[sideIx(m.toward)], strong = m.strength === "strongly";
  if (kind === "shift") return zh ? `今年天命${strong ? "大幅" : "略"}移向${s}` : `this year Heaven's Mandate moved ${strong ? "strongly" : "slightly"} toward ${s}`;
  return zh ? `天命${strong ? "明顯" : "略"}偏向${s}` : `Heaven's Mandate leaned ${strong ? "strongly" : "slightly"} toward ${s}`;
}

// Who has the upper hand in a region at a year's end (null: no one).
function regionLead([a, b]) {
  if (a === "control" || a === "domination") return ["qin", a];
  if (b === "control" || b === "domination") return ["chu", b];
  return null;
}

function yearEndText(it, prev, lang) {
  const T = L[lang], zh = lang === "zh";
  const lines = [];
  const regs = SCORED_REGIONS.map((r) => {
    const lead = regionLead(it.regions[r]);
    if (!lead) return zh ? `${T.region(r)}無人佔上風` : `in ${T.region(r)} no one had the upper hand`;
    const s = T.side[sideIx(lead[0])];
    return zh ? `${T.region(r)}${s}${LEVEL.zh[lead[1]]}` : `in ${T.region(r)} ${s} held ${LEVEL.en[lead[1]]}`;
  });
  lines.push((zh ? "各地形勢:" : "The regions: ") + regs.join(zh ? ";" : "; "));
  lines.push(it.luoyi ? (zh ? `洛邑周室由${T.side[sideIx(it.luoyi)]}掌握` : `Luoyi and the Zhou court were in ${T.side[sideIx(it.luoyi)]}'s hands`) : (zh ? "洛邑周室無人掌握" : "no one held Luoyi and the Zhou court"));
  lines.push(`${leanText(it.mandate, lang)}${zh ? ";" : "; "}${leanText(it.shift, lang, "shift")}`);
  lines.push(zh ? `天下${WEARY.zh[it.weariness]}` : WEARY.en[it.weariness]);
  // What is held so far, and what of it is new this year: a heading must not
  // claim last year's seal as this year's.
  const newOf = (now, was) => now.filter((x) => !(was || []).includes(x));
  if (it.seals.length) {
    const fresh = newOf(it.seals, prev && prev.seals);
    lines.push(zh
      ? `至此持相印從楚者:${it.seals.map(T.state).join("、")}${fresh.length ? `(其中${fresh.map(T.state).join("、")}為本年新得)` : "(本年無新得)"}`
      : `By now Chu held the seals of ${T.list(it.seals.map(T.state))}${fresh.length ? `; ${T.list(fresh.map(T.state))} ${fresh.length > 1 ? "gave theirs" : "gave its seal"} this year` : "; none was new this year"}`);
  }
  if (it.fallen.length) {
    const fresh = newOf(it.fallen, prev && prev.fallen);
    lines.push(zh
      ? `至此已為秦所滅:${it.fallen.map(T.state).join("、")}${fresh.length ? `(其中${fresh.map(T.state).join("、")}亡於本年)` : ""}`
      : `By now Qin had destroyed ${T.list(it.fallen.map(T.state))}${fresh.length ? `; ${T.list(fresh.map(T.state))} fell this year` : ""}`);
  }
  const box = (b) => (b ? `「${T.box(b)}」` : "尚未起步");
  const boxEn = (s, b) => (b ? `${s}'s reforms stood at "${T.box(b)}"` : `${s} had not yet begun to reform`);
  lines.push(zh ? `變法:秦${box(it.reform[0])},楚${box(it.reform[1])}` : `${boxEn("Qin", it.reform[0])}; ${boxEn("Chu", it.reform[1])}`);
  lines.push(zh ? `九鼎在${T.side[sideIx(it.cauldrons)]}` : `The Nine Cauldrons were with ${T.side[sideIx(it.cauldrons)]}`);
  return lines;
}

// A year's record as moves: a play (or a headline event, the headline, a new
// era, a zhou blessing) opens a move; what follows from it belongs to it.
// Each move carries the episodes behind it: that year's non-reckoning cards
// only (the ones a chapter may picture), never a card only set aside for reform.
function movesOf(t) {
  const allowed = new Set(t.cards.filter((c) => !isScoring(c)));
  const moves = [];
  let m = null;
  const add = (c) => { if (c && allowed.has(c) && !m.cards.includes(c)) m.cards.push(c); };
  t.events.forEach((it, seq) => {
    if (it.type === "yearEnd") return;
    const leads = it.type === "play" || (it.type === "event" && it.headline) || ["headline", "era", "bogged", "zhou"].includes(it.type);
    if (leads || !m) { m = { items: [], cards: [], seq }; moves.push(m); }
    m.items.push(it);
    // A natural card used for its means did not happen: it is behind nothing.
    if (it.type === "play" && it.use !== "reform" && !it.pair && !(isNatural(it.card) && it.use !== "event")) add(it.card);
    if (it.type === "play" && it.pair) add(it.card);
    if (it.type === "event" || it.type === "campaign") add(it.card);
  });
  return moves;
}

// The 「本年要事」 of one year: [{rank, seq, text, cards}], ranked, at most five.
function keyEvents(t, prevEnd, d, lang) {
  const T = L[lang], zh = lang === "zh", S = (s) => T.side[sideIx(s)];
  const moves = movesOf(t);
  const yend = t.events.find((it) => it.type === "yearEnd");
  const out = [];
  const moveOf = (it) => moves.find((m) => m.items.includes(it));
  const cardsOf = (items) => { const c = []; for (const it of items) { const m = moveOf(it); if (m) for (const x of m.cards) if (!c.includes(x)) c.push(x); } return c; };
  const seqOf = (it) => t.events.indexOf(it);
  const all = t.events;

  // 1: the end, or a claim to be Emperor.
  const end = all.find((it) => it.type === "end");
  const crown = all.filter((it) => it.type === "reform" && it.emperor);
  if (end) {
    // What decided it: for a lost capital, the moves that took it; for a
    // count at the end of the years, nothing in particular.
    const loser = otherSide(end.winner);
    const byCard = ["final", "tie", "scoring", "scoringBoth", "emperor"].includes(end.reason) ? []
      : end.reason === "homeFall" ? cardsOf(all.filter((x) => x.type === "capital" && x.whose === loser && x.status === "taken"))
        : cardsOf([end]);
    let text = endText(end, lang);
    const won = crown.find((c) => c.emperor === "won");
    if (won) text = zh ? `${S(won.side)}王變法功成,登基稱帝,${S(won.side)}勝` : `the King of ${S(won.side)}, his reforms complete, proclaimed himself Emperor, and ${S(won.side)} won`;
    out.push({ rank: 1, seq: -1, text, cards: byCard }); // the end before anything else of its rank
  }
  for (const c of crown) {
    if (c.emperor === "won" && end) continue;
    out.push({ rank: 1, seq: seqOf(c), text: describe(c, lang), cards: [] });
  }

  // 2: the capitals, one item per capital: how the year went for it.
  for (const whose of ["qin", "chu"]) {
    const seq = all.filter((it) => it.type === "capital" && it.whose === whose);
    if (seq.length) {
      const cap = T.space(seq[0].capital), w = S(whose), o = S(otherSide(whose));
      const start = seq[0].was, fin = seq[seq.length - 1].status;
      const taken = seq.some((x) => x.status === "taken");
      const threats = seq.filter((x) => x.status === "threatened" && x.was === "secure").length;
      let text;
      if (start === "taken") {
        text = fin === "secure" ? (zh ? `${w}奪回國都${cap}` : `${w} won back its capital ${cap}`)
          : fin === "threatened" ? (zh ? `${o}對${w}都${cap}的掌握動搖` : `${o}'s grip on ${w}'s capital ${cap} loosened`)
            : (zh ? `${w}都${cap}幾經爭奪,仍在${o}手中` : `${w}'s capital ${cap} was fought over and stayed in ${o}'s hands`);
      } else if (fin === "taken") text = zh ? `${w}都${cap}落入${o}之手,年終未能收復` : `${w}'s capital ${cap} fell into ${o}'s hands and was not won back that year`;
      else if (taken) text = fin === "secure"
        ? (zh ? `${w}都${cap}一度落入${o}之手,其後收復` : `${w}'s capital ${cap} fell into ${o}'s hands for a time and was won back`)
        : (zh ? `${w}都${cap}一度落入${o}之手,其後${o}的掌握動搖,至年終仍未安` : `${w}'s capital ${cap} fell into ${o}'s hands for a time; ${o}'s grip then loosened, but the city was still not safe at the year's end`);
      else if (fin === "secure") text = threats > 1 ? (zh ? `${w}都${cap}${numZh(threats)}度告急,終得穩住` : `${w}'s capital ${cap} was threatened ${threats === 2 ? "twice" : `${numEn(threats)} times`}, and held`) : (zh ? `${w}都${cap}一度告急,終得穩住` : `${w}'s capital ${cap} was threatened, and held`);
      else text = threats > 1 ? (zh ? `${w}都${cap}${numZh(threats)}度告急,至年終仍未解圍` : `${w}'s capital ${cap} was threatened ${threats === 2 ? "twice" : `${numEn(threats)} times`}, and was still in danger at the year's end`) : (zh ? `${w}都${cap}告急,至年終仍未解圍` : `${w}'s capital ${cap} was threatened, and was still in danger at the year's end`);
      const fell = all.find((x) => x.type === "capitalFell" && x.whose === whose);
      if (fell) text += zh ? ",國都就此陷落" : `; the capital was lost`;
      out.push({ rank: 2, seq: seqOf(seq[0]), text, cards: cardsOf(seq) });
    }
  }
  const told2 = new Set(["qin", "chu"].filter((w) => all.some((x) => x.type === "capital" && x.whose === w)));
  for (const it of all.filter((x) => (x.type === "capitalFell" && !told2.has(x.whose)) || x.type === "capitalMoved")) {
    out.push({ rank: 2, seq: seqOf(it), text: describe(it, lang), cards: it.type === "capitalMoved" ? [] : cardsOf([it]) });
  }

  // 3 and 4: states destroyed or restored; seals given or taken back. A seal
  // lost with the state that gave it is told with the fall.
  const falls = all.filter((x) => x.type === "fall" || x.type === "restore");
  const sealsWithFall = new Set();
  for (const it of falls) {
    let text = describe(it, lang);
    if (it.type === "fall") {
      const un = all.find((x) => x.type === "unseal" && x.state === it.state && moveOf(x) === moveOf(it));
      if (un) { sealsWithFall.add(un); text += zh ? `,${T.state(it.state)}國給楚的相印也隨之收回` : `, and the seal ${T.state(it.state)} had given Chu was taken back with it`; }
    }
    out.push({ rank: 3, seq: seqOf(it), text, cards: cardsOf([it]) });
  }
  // One item per state: a seal given and taken back in one year is one story.
  const sealMoves = all.filter((x) => (x.type === "seal" || x.type === "unseal") && !sealsWithFall.has(x));
  for (const state of [...new Set(sealMoves.map((x) => x.state))]) {
    const seq = sealMoves.filter((x) => x.state === state);
    const a = seq[0], z = seq[seq.length - 1], st = T.state(state);
    let text;
    if (seq.length === 1) text = describe(a, lang);
    else if (a.type === "unseal") text = z.type === "seal"
      ? (zh ? `${st}國一度收回給楚的相印,其後又交還給楚` : `the state of ${st} took back the seal it had given Chu, and later gave it to Chu again`)
      : (zh ? `${st}國的相印幾度往返,年終已不在楚手` : `the seal of ${st} went back and forth, and at the year's end Chu no longer held it`);
    else text = z.type === "unseal"
      ? (zh ? `${st}國將相印交給楚,其後又收回` : `the state of ${st} gave its seal to Chu and later took it back`)
      : (zh ? `${st}國的相印幾度往返,年終仍在楚手` : `the seal of ${st} went back and forth, and at the year's end Chu held it`);
    out.push({ rank: 4, seq: seqOf(a), text, cards: cardsOf(seq) });
  }

  // 5: the regions at the year's end, against the year before (year 1: who leads at all).
  if (yend) {
    const parts = [], why = [];
    for (const r of SCORED_REGIONS) {
      const now = regionLead(yend.regions[r]), was = prevEnd ? regionLead(prevEnd.regions[r]) : null;
      const nw = now && now[0], ow = was && was[0];
      if (nw === ow) continue;
      const R = T.region(r);
      if (!prevEnd) parts.push(zh ? `${R}${S(nw)}佔上風` : `${S(nw)} held the upper hand in ${R}`);
      else if (!ow) parts.push(zh ? `${R}轉由${S(nw)}佔上風` : `${S(nw)} gained the upper hand in ${R}`);
      else if (!nw) parts.push(zh ? `${R}${S(ow)}不再佔上風` : `${S(ow)} no longer held the upper hand in ${R}`);
      else parts.push(zh ? `${R}由${S(ow)}轉歸${S(nw)}` : `${R} passed from ${S(ow)} to ${S(nw)}`);
      // The moves behind it: control won in the region by the new leader, or lost there by the old.
      for (const m of moves) {
        const hits = m.items.flatMap((it) => it.control || []).filter(([id, from, to]) => SPACE[id].region === r && (nw ? to === nw : from === ow)).length;
        if (hits) why.push([m, hits]);
      }
    }
    if (parts.length) {
      why.sort((a, b) => b[1] - a[1] || a[0].seq - b[0].seq);
      const cards = [];
      for (const [m] of why) for (const c of m.cards) if (!cards.includes(c) && cards.length < 3) cards.push(c);
      const text = !prevEnd ? (zh ? `首年年終,${parts.join(",")}` : `At the end of the first year ${T.list(parts)}`) : (zh ? `年終形勢易手:${parts.join(";")}` : `By the year's end ${T.list(parts)}`);
      out.push({ rank: 5, seq: t.events.length, text, cards });
    }
  }

  // 6: reform, one item per side.
  for (const side of ["qin", "chu"]) {
    const steps = all.filter((x) => x.type === "reform" && x.side === side && !x.emperor);
    if (!steps.length) continue;
    const last = steps[steps.length - 1], first = steps.some((x) => x.first);
    const text = zh
      ? `${S(side)}變法${steps.length > 1 ? `連進${numZh(steps.length)}步,` : ""}進至「${T.box(last.box)}」${first ? ",天下首創" : ""}`
      : `${S(side)}'s reforms ${steps.length > 1 ? `advanced ${numEn(steps.length)} steps, ` : "advanced "}to "${T.box(last.box)}"${first ? ", ahead of the rest of the realm" : ""}`;
    out.push({ rank: 6, seq: seqOf(steps[0]), text, cards: cardsOf(steps) });
  }

  // 7: Heaven's Mandate, when it swung strongly, and what swung it.
  if (yend && yend.shift.toward && yend.shift.strength === "strongly") {
    const side = yend.shift.toward;
    const regions = all.filter((x) => x.type === "reckoning" && x.toward === side).map((x) => T.region(x.region));
    const moved = all.filter((x) => (x.type === "event" && x.heaven && x.heaven.toward === side) || (x.type === "zhou" && x.toward === side)
      || (x.type === "seal" && side === "chu") || (x.type === "fall" && side === "qin") || (x.type === "reckoning" && x.toward === side));
    let text = zh ? `是年天命大幅移向${S(side)}` : `This year Heaven's Mandate swung strongly toward ${S(side)}`;
    if (regions.length) text += zh ? `,${[...new Set(regions)].join("、")}諸國人心皆向${S(side)}` : `, as the states of ${T.list([...new Set(regions)])} turned toward ${S(side)}`;
    out.push({ rank: 7, seq: t.events.length + 1, text, cards: cardsOf(moved) });
  }

  // 8: the largest events of the year, by what they changed.
  const told = new Set(out.flatMap((x) => x.cards));
  const sized = all.filter((x) => x.type === "event").map((ev) => {
    const m = moveOf(ev);
    const camps = m ? m.items.filter((x) => x.type === "campaign" && x.card === ev.card) : [];
    const amount = [...(ev.gains || []), ...(ev.losses || [])].reduce((s, g) => s + g[2], 0) + camps.reduce((s, c) => s + c.removed + c.placed, 0);
    const ctl = [...(ev.control || []), ...camps.flatMap((c) => c.control || [])];
    return { ev, camps, ctl, size: amount + 2 * ctl.length + (ev.disaster ? 2 : 0) + (ev.ends ? 1 : 0) };
  }).filter((x) => x.size >= 6 && !told.has(x.ev.card)).sort((a, b) => b.size - a.size).slice(0, 2);
  for (const { ev, camps, ctl } of sized) {
    const gained = {}, lost = {};
    for (const [id, from, to] of ctl) { if (to) (gained[to] = gained[to] || []).push(T.space(id)); if (from && from !== to) (lost[from] = lost[from] || []).push(T.space(id)); }
    const bits = [];
    for (const c of camps) bits.push(zh ? `${S(c.side)}發兵攻${T.space(c.target)}` : `${S(c.side)} marched on ${T.space(c.target)}`);
    for (const s of ["qin", "chu"]) {
      if (gained[s]) bits.push(zh ? `${S(s)}得${[...new Set(gained[s])].join("、")}` : `${S(s)} won ${T.list([...new Set(gained[s])])}`);
      if (lost[s]) bits.push(zh ? `${S(s)}失${[...new Set(lost[s])].join("、")}` : `${S(s)} lost ${T.list([...new Set(lost[s])])}`);
    }
    if (!ctl.length) {
      const hurt = [...new Set((ev.losses || []).map(([id]) => T.space(id)))];
      if (hurt.length) bits.push(zh ? `${hurt.join("、")}人心動盪` : `${T.list(hurt)} were shaken`);
      const helped = [...new Set((ev.gains || []).map(([, s]) => s))];
      for (const s of helped) bits.push(zh ? `${S(s)}添了不少親附者` : `${S(s)} won many new supporters`);
    }
    let text;
    if (isNatural(ev.card)) {
      const hap = zh ? `是年${NATURAL[ev.card].zh}` : `that year ${NATURAL[ev.card].en}`;
      text = zh ? [hap, ...bits].join(",") : bits.length ? `${hap}: ${T.list(bits)}` : hap;
    } else {
      const name = zh ? `「${T.card(ev.card)}」一事` : T.card(ev.card);
      text = zh ? `${name}:${bits.join(",")}` : `${name}: ${T.list(bits)}`;
    }
    out.push({ rank: 8, seq: seqOf(ev), text, cards: [ev.card].filter((c) => !isScoring(c)) });
  }

  // Nothing of the above: the ground most fought over.
  if (!out.length) {
    const count = {};
    for (const it of all) for (const [id] of it.control || []) count[id] = (count[id] || 0) + 1;
    const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => id);
    if (top.length) {
      const cards = cardsOf(all.filter((it) => (it.control || []).some(([id]) => top.includes(id)))).slice(0, 3);
      out.push({ rank: 9, seq: 0, text: zh ? `是年爭奪最烈之地:${top.map(T.space).join("、")}` : `The hardest-fought ground this year: ${T.list(top.map(T.space))}`, cards });
    } else {
      out.push({ rank: 9, seq: 0, text: zh ? "是年兩國各有經營,大局未變" : "Both courts were busy this year, but the balance did not change", cards: [] });
    }
  }
  out.sort((a, b) => a.rank - b.rank || a.seq - b.seq);
  return out.slice(0, 5);
}

// The whole contest in one line, from Heaven's Mandate at each year's end:
// who led when, and the year it turned for good.
function arcText(d, lang) {
  const T = L[lang], zh = lang === "zh", S = (s) => T.side[sideIx(s)];
  const ends = d.turns.map((t) => t.events.find((it) => it.type === "yearEnd"));
  const Y = (n) => (zh ? `第${NUM_ZH[n] ?? n}年` : `Year ${n}`);
  const runs = [];
  ends.forEach((e, i) => {
    const tw = e.mandate.toward, last = runs[runs.length - 1];
    if (last && last.tw === tw) last.to = i + 1, last.strong.push(e.mandate.strength === "strongly");
    else runs.push({ tw, from: i + 1, to: i + 1, strong: [e.mandate.strength === "strongly"] });
  });
  const runText = (r) => {
    const span = r.from === r.to ? (zh ? `${Y(r.from)}終` : `after ${Y(r.from)}`) : (zh ? `${Y(r.from)}至${Y(r.to)}終` : `from ${Y(r.from)} to ${Y(r.to)}`);
    if (!r.tw) return zh ? `${span}兩國持平` : `the two stood even ${span}`;
    const s = S(r.tw), k = r.strong.indexOf(true), allStrong = r.strong.every(Boolean), rest = k >= 0 && r.strong.slice(k).every(Boolean);
    if (allStrong) return zh ? `${span}${s}明顯領先` : `${s} was clearly ahead ${span}`;
    if (k < 0) return zh ? `${span}${s}略佔先` : `${s} was slightly ahead ${span}`;
    if (rest) return zh ? `${span}${s}佔先(${Y(r.from + k)}起明顯領先)` : `${s} was ahead ${span} (clearly so from ${Y(r.from + k)})`;
    const strongYears = r.strong.map((x, j) => (x ? r.from + j : null)).filter((x) => x != null);
    return zh ? `${span}${s}佔先(${strongYears.map(Y).join("、")}明顯領先)` : `${s} was ahead ${span} (clearly so in ${T.list(strongYears.map(Y))})`;
  };
  const parts = [runs.map(runText).join(zh ? ";" : "; ")];
  const W = SIDE[d.winner], lastRun = runs[runs.length - 1];
  if (lastRun.tw === W) {
    if (lastRun.from === 1) parts.push(zh ? `${S(W)}自首年起始終領先` : `${S(W)} led from the first year to the last`);
    else if (lastRun.from === ends.length) parts.push(zh ? `直到最後的${Y(lastRun.from)},${S(W)}才轉居上風` : `${S(W)} only took the lead in the last year, ${Y(lastRun.from)}`);
    else {
      const sh = ends[lastRun.from - 1].shift;
      const how = sh.toward === W ? (zh ? `天命${sh.strength === "strongly" ? "大幅" : "略"}移向${S(W)}` : `Heaven's Mandate moved ${sh.strength} toward ${S(W)}`) : (zh ? `${S(W)}重新領先` : `${S(W)} took the lead again`);
      parts.push(zh ? `轉折在${Y(lastRun.from)}:是年${how},此後${S(W)}未再落後` : `the tide turned in ${Y(lastRun.from)}, when ${how}; ${S(W)} never fell behind again`);
    }
  } else {
    const everLed = runs.some((r) => r.tw === W);
    parts.push(zh
      ? `終局時天命${lastRun.tw ? `仍偏向${S(lastRun.tw)}` : "不偏不倚"},${S(W)}${everLed ? "雖曾領先,最終" : ""}卻另以他途取勝`
      : `at the end Heaven's Mandate ${lastRun.tw ? `still leaned toward ${S(lastRun.tw)}` : "stood even"}, and ${S(W)}${everLed ? ", once ahead," : ""} won by another road`);
  }
  const swings = ends.map((e, i) => (e.shift.toward && e.shift.strength === "strongly" ? [i + 1, e.shift.toward] : null)).filter(Boolean);
  if (swings.length) parts.push(zh ? `天命大幅擺盪之年:${swings.map(([y, s]) => `${Y(y)}(向${S(s)})`).join("、")}` : `the years of great swings: ${T.list(swings.map(([y, s]) => `${Y(y)} (toward ${S(s)})`))}`);
  parts.push(zh ? `終局:${endText({ winner: W, reason: d.reason }, lang)}` : `the end: ${endText({ winner: W, reason: d.reason }, lang)}`);
  return (zh ? "天命走勢:" : "Heaven's Mandate over the years: ") + parts.map((p, i) => (i ? cap(p) : p)).join(zh ? "。" : ". ") + T.end;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export function digestText(d, lang) {
  if (lang !== "zh" && lang !== "en") throw new Error("digestText: lang is zh or en");
  const T = L[lang], zh = lang === "zh";
  const out = [];
  const where = (pairs) => pairs.map(([id, n]) => (n > 1 ? (zh ? `${T.space(id)}(${numZh(n)}批)` : `${T.space(id)} (${numEn(n)} parties)`) : T.space(id)));
  out.push(zh ? "【全局大勢】" : "[The course of the contest]");
  out.push(arcText(d, lang));
  out.push("");
  out.push(zh ? "【開局】" : "[The opening]");
  out.push(zh ? `秦據西土(關中為都),楚據南方(郢為都);韓、魏、趙、齊、燕五國夾在其間。` : `Qin held the West (its capital Guanzhong), Chu the South (its capital Ying); Han, Wei, Zhao, Qi and Yan lay between them.`);
  if (d.opening.farStart) out.push(zh ? "秦素行遠交之策,在臨淄、薊早有耳目。" : "Qin, befriending the far, already had agents in Linzi and Ji.");
  out.push(zh ? `秦又遣人入${T.list(where(d.opening.qin))}。` : `Qin also sent agents into ${T.list(where(d.opening.qin))}.`);
  out.push(zh ? `楚又遣人入${T.list(where(d.opening.chu))}。` : `Chu also sent agents into ${T.list(where(d.opening.chu))}.`);
  out.push(zh ? `此局共${NUM_ZH[d.years] ?? d.years}年。` : `The contest lasted ${d.years} years.`);
  let prevEnd = null;
  for (const t of d.turns) {
    out.push("");
    out.push(zh ? `【${T.year(t.turn)}】` : `[${T.year(t.turn)}]`);
    out.push(zh ? "本年要事:" : "Key events this year:");
    keyEvents(t, prevEnd, d, lang).forEach((k, i) => {
      const behind = k.cards.length ? (zh ? `(其事見${k.cards.map((c) => `「${T.card(c)}」`).join("、")})` : ` (behind it: ${k.cards.map(T.card).join("; ")})`) : "";
      out.push(`${i + 1}. ${cap(k.text)}${zh ? "" : "."}${behind}${zh ? "。" : ""}`);
    });
    out.push(zh ? "詳細經過:" : "Full record:");
    // One line per move: a play opens a line, what follows from it continues
    // it, and the card a move was made under closes it.
    let line = null, ctx = null, lead = null, k = 0;
    const flush = () => {
      if (line) out.push("- " + cap(line) + (ctx ? (zh ? `(事在「${T.card(ctx)}」之時)` : ` (in the days of ${T.card(ctx)})`) : "") + T.end);
      line = null; ctx = null; lead = null;
    };
    const yend = t.events.find((it) => it.type === "yearEnd");
    for (const it of t.events) {
      if (it.type === "yearEnd") continue;
      const opsPlay = it.type === "play" && ["place", "campaign", "lobby"].includes(it.use) && !it.pair && it.card !== JIUDING && !isScoring(it.card) && !isNatural(it.card);
      const cont = it.type === "event" && lead && lead.type === "play" && lead.use === "event" && lead.card === it.card;
      const s = describe(it, lang, k++, cont);
      const leads = it.type === "play" || (it.type === "event" && it.headline);
      const alone = it.type === "headline" || it.type === "era" || it.type === "bogged" || it.type === "zhou" || it.type === "end";
      if (leads || alone) {
        flush();
        line = s || null;
        lead = it;
        if (opsPlay) ctx = it.card;
        if (alone) flush();
      } else if (!s) continue;
      else if (line) line += line.endsWith(",") ? (zh ? "" : " ") + s : T.sep + s;
      else line = s;
      if (it.type === "event" && it.card === ctx) ctx = null; // the card is named where its event is told
    }
    flush();
    out.push(zh ? "年終:" : "At the year's end:");
    for (const s of yearEndText(yend, prevEnd, lang)) out.push("  " + cap(s) + T.end);
    prevEnd = yend;
  }
  out.push("");
  out.push(zh ? "【結局】" : "[The ending]");
  out.push(cap(endText({ winner: SIDE[d.winner], reason: d.reason }, lang)) + T.end);
  return out.join("\n");
}
