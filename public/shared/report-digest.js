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
const REFORM_EN = ["Moving the Pole", "Ending the Well-Field", "Ranks for Merit in War", "The County System", "Clear Laws", "Proclaiming an Emperor"];
const WEARY = {
  zh: { 5: "承平", 4: "兵連", 3: "禍結", 2: "民困", 1: "土崩" },
  en: { 5: "peace", 4: "war upon war", 3: "calamity upon calamity", 2: "the people exhausted", 1: "collapse" },
};
const LEVEL = {
  zh: { presence: "有立足之地", domination: "佔上風", control: "盡得其地", none: "無一席之地" },
  en: { presence: "a foothold", domination: "the upper hand", control: "the whole region", none: "nothing" },
};
const NUM_ZH = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
const L = {
  zh: {
    side: ["秦", "楚"], year: (t) => `第${NUM_ZH[t] ?? t}年`,
    space: (id) => SPACE[id].zh, state: (id) => STATES[id].zh, region: (r) => REGIONS[r].zh,
    card: (id) => (id === JIUDING ? "九鼎" : CARD[id].zh), era: (e) => E.ERAS.find((x) => x.id === e).zh,
    box: (b) => REFORM[b - 1].zh, list: (a) => a.join("、"), sep: ";", end: "。",
  },
  en: {
    side: ["Qin", "Chu"], year: (t) => `Year ${t}`,
    space: (id) => SPACE[id].en, state: (id) => STATES[id].en, region: (r) => REGIONS[r].en,
    card: (id) => (id === JIUDING ? "the Nine Cauldrons" : CARD[id].en), era: (e) => E.ERAS.find((x) => x.id === e).en,
    box: (b) => REFORM_EN[b - 1], list: (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]), sep: "; ", end: ".",
  },
};
const sideIx = (s) => (s === "qin" ? QIN : CHU);

function describe(it, lang) {
  const T = L[lang], zh = lang === "zh";
  const S = (s) => T.side[sideIx(s)];
  const q = (id) => (zh ? `「${T.card(id)}」` : T.card(id));
  const sp = T.space;
  const ctlText = (c) => c.map(([id, from, to]) => (to
    ? (zh ? `${sp(id)}遂歸${S(to)}掌握` : `${sp(id)} passed under ${S(to)}'s control`)
    : (zh ? `${S(from)}失去對${sp(id)}的掌握` : `${S(from)} lost its hold on ${sp(id)}`)));
  const moves = (arr, up) => arr.map(([id, s, n]) => (zh ? `${S(s)}在${sp(id)}的勢力${up ? "增" : "減"}${n}` : `${S(s)}'s standing in ${sp(id)} ${up ? "rose" : "fell"} by ${n}`));
  const reckon = (region) => (zh ? `${T.region(region)}諸國權衡秦楚向背` : `the states of ${T.region(region)} weighed Qin against Chu`);
  switch (it.type) {
    case "era": return zh ? `${T.era(it.era)}開始,新的人物與時勢登場` : `The ${T.era(it.era)} began; new men and new circumstances came onto the stage`;
    case "headline": {
      const one = (s) => {
        const c = it.cards[s];
        if (c == null) return zh ? `${T.side[s]}無所謀` : `${T.side[s]} had no design`;
        if (CARD[c] && CARD[c].scoring) return zh ? `${T.side[s]}欲使${T.region(CARD[c].scoring)}諸國表態` : `${T.side[s]} meant to call ${T.region(CARD[c].scoring)} to declare itself`;
        return zh ? `${T.side[s]}以${q(c)}為先` : `${T.side[s]} opened with ${T.card(c)}`;
      };
      const first = it.first ? (zh ? `,${S(it.first)}先發` : `; ${S(it.first)} moved first`) : "";
      return zh ? `年初兩國各定國策:${one(QIN)},${one(CHU)}${first}` : `At the start of the year each court set its first design: ${one(QIN)}, ${one(CHU)}${first}`;
    }
    case "play": {
      const c = CARD[it.card];
      if (c && c.scoring) return zh ? `${S(it.side)}召${T.region(c.scoring)}諸國表態` : `${S(it.side)} called on ${T.region(c.scoring)} to declare itself`;
      const enemy = c && c.side != null && SIDE[c.side] !== it.side;
      switch (it.use) {
        case "event": return enemy ? (zh ? `${S(it.side)}任由${q(it.card)}之事發生` : `${S(it.side)} let ${T.card(it.card)} come to pass`) : (zh ? `${S(it.side)}行${q(it.card)}之事` : `${S(it.side)} brought about ${T.card(it.card)}`);
        case "reform": return zh ? `${S(it.side)}王捨${q(it.card)}之機,專心推行變法` : `the King of ${S(it.side)} laid down the tally of ${T.card(it.card)} to push his reform`;
        case "place": case "campaign": case "lobby": {
          if (it.pair) return zh ? `${S(it.side)}遣說客,借${q(it.pair)}之資而不使其事成` : `${S(it.side)} sent a persuader to turn the means of ${T.card(it.pair)} to its own ends without letting it come to pass`;
          if (it.card === JIUDING) return zh ? "挾九鼎之威," : "With the Nine Cauldrons in hand,";
          const theirs = enemy ? (zh ? `(此乃${T.side[c.side]}之事)` : ` (an episode of ${T.side[c.side]}'s)`) : "";
          return zh ? `時值${q(it.card)}${theirs},` : `In the time of ${T.card(it.card)}${theirs},`;
        }
        default: return zh ? `${S(it.side)}有所舉措` : `${S(it.side)} acted`;
      }
    }
    case "bogged": return zh ? `${S(it.side)}軍頓兵堅城之下,只得放棄${q(it.card)}之謀` : `${S(it.side)}'s army was bogged down before the walls and had to give up ${T.card(it.card)}`;
    case "event": {
      const parts = [];
      const who = zh ? `(${S(it.owner)}之事)` : ` (to ${S(it.owner)}'s benefit)`;
      parts.push(zh ? `${q(it.card)}之事發生${it.owner !== it.by ? who : ""}` : `${T.card(it.card)} came to pass${it.owner !== it.by ? who : ""}`);
      if (it.disaster) parts.push(zh ? { famine: "天降大饑", flood: "黃河決堤", pestilence: "疫癘流行", eclipse: "天狗食日,人心惶惶" }[it.disaster] : { famine: "famine struck", flood: "the Yellow River burst its banks", pestilence: "pestilence spread", eclipse: "the sun was eaten in the sky and men were afraid" }[it.disaster]);
      if (it.gains) parts.push(...moves(it.gains, true));
      if (it.losses) parts.push(...moves(it.losses, false));
      if (it.control) parts.push(...ctlText(it.control));
      if (it.heaven) parts.push(zh ? `天命${it.heaven.strength === "strongly" ? "大" : "稍"}向${S(it.heaven.toward)}傾斜` : `Heaven's Mandate leaned ${it.heaven.strength} toward ${S(it.heaven.toward)}`);
      if (it.lasting) parts.push(zh ? "其影響延續下去" : "its influence would last");
      if (it.ends) parts.push(zh ? `${it.ends.map(q).join("、")}的影響就此消散` : `the influence of ${T.list(it.ends.map(T.card))} came to an end`);
      if (it.hands) it.hands.forEach((n, s) => { if (n > 0) parts.push(zh ? `${T.side[s]}得到新的謀略` : `${T.side[s]} gained new counsel`); });
      if (it.setAside) parts.push(zh ? `${it.setAside.map(q).join("、")}之謀遂被擱置` : `the plan of ${T.list(it.setAside.map(T.card))} was set aside`);
      if (it.easedTo) parts.push(zh ? `天下稍得喘息(${WEARY.zh[it.easedTo]})` : `the realm found a little relief (${WEARY.en[it.easedTo]})`);
      if (it.cauldronsTo) parts.push(zh ? `九鼎歸${S(it.cauldronsTo)}` : `the Nine Cauldrons passed to ${S(it.cauldronsTo)}`);
      if (it.wearied) parts.push(zh ? `天下更加疲敝(${WEARY.zh[it.wearied]})` : `the realm grew wearier (${WEARY.en[it.wearied]})`);
      if (it.effect === false) parts.push(zh ? "然而並未改變甚麼" : "but it changed nothing");
      return parts.join(T.sep);
    }
    case "place": {
      const where = it.spaces.map(([id, n]) => (n > 1 ? (zh ? `${sp(id)}(${n})` : `${sp(id)} (${n})`) : sp(id)));
      const s = zh ? `${S(it.side)}遣人入${T.list(where)}結交豪傑,廣植勢力` : `${S(it.side)} sent men to win friends in ${T.list(where)}`;
      return [s, ...ctlText(it.control || [])].join(T.sep);
    }
    case "campaign": {
      const opp = it.side === "qin" ? "chu" : "qin";
      const by = it.card ? (zh ? `(因${q(it.card)})` : ` (by ${T.card(it.card)})`) : "";
      const parts = [zh ? `${S(it.side)}發兵攻${sp(it.target)}${by},逐走${S(opp)}的人馬${it.removed}${it.placed ? `,留駐${it.placed}` : ""}` : `${S(it.side)} marched on ${sp(it.target)}${by}, drove out ${it.removed} of ${S(opp)}'s men${it.placed ? ` and left ${it.placed} of its own` : ""}`];
      parts.push(...ctlText(it.control || []));
      if (it.wearied) parts.push(zh ? `天下更加疲敝(${WEARY.zh[it.wearied]})` : `the realm grew wearier (${WEARY.en[it.wearied]})`);
      return parts.join(T.sep);
    }
    case "lobby": {
      const opp = it.side === "qin" ? "chu" : "qin";
      let s = zh ? `${S(it.side)}的使者前往${sp(it.target)}遊說` : `${S(it.side)}'s envoys went to ${sp(it.target)}`;
      const r = [];
      if (it.driven) r.push(zh ? `說動當地人士,逐走${S(opp)}的人馬${it.driven}` : `and drove out ${it.driven} of ${S(opp)}'s men`);
      if (it.lost) r.push(zh ? `卻也折損了自家的人${it.lost}` : `${it.driven ? "but" : "and"} lost ${it.lost} of their own`);
      if (!it.driven && !it.lost) r.push(zh ? "雙方僵持,無功而返" : "and came back with nothing");
      if (it.stopped) r.push(zh ? "見好就收" : "then wisely stopped");
      s += (zh ? "," : " ") + r.join(zh ? "," : ", ");
      return [s, ...ctlText(it.control || [])].join(T.sep);
    }
    case "cauldrons": return zh ? `九鼎易手,歸於${S(it.to)}(暫且蒙塵)` : `the Nine Cauldrons changed hands and went, veiled for now, to ${S(it.to)}`;
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
      const c = sp(it.capital), w = S(it.whose), o = it.whose === "qin" ? S("chu") : S("qin");
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
    case "weariness": return zh ? `天下更加疲敝(${WEARY.zh[it.level]})` : `the realm grew wearier (${WEARY.en[it.level]})`;
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

function yearEndText(it, lang) {
  const T = L[lang], zh = lang === "zh";
  const lines = [];
  const regs = SCORED_REGIONS.map((r) => {
    const [a, b] = it.regions[r];
    const lead = a === "control" || a === "domination" ? ["qin", a] : b === "control" || b === "domination" ? ["chu", b] : null;
    if (!lead) return zh ? `${T.region(r)}無人佔上風` : `in ${T.region(r)} no one had the upper hand`;
    const s = T.side[sideIx(lead[0])];
    return zh ? `${T.region(r)}${s}${LEVEL.zh[lead[1]]}` : `in ${T.region(r)} ${s} held ${LEVEL.en[lead[1]]}`;
  });
  lines.push((zh ? "各地形勢:" : "The regions: ") + regs.join(zh ? ";" : "; "));
  lines.push(it.luoyi ? (zh ? `洛邑周室由${T.side[sideIx(it.luoyi)]}掌握` : `Luoyi and the Zhou court were in ${T.side[sideIx(it.luoyi)]}'s hands`) : (zh ? "洛邑周室無人掌握" : "no one held Luoyi and the Zhou court"));
  lines.push(`${leanText(it.mandate, lang)}${zh ? ";" : "; "}${leanText(it.shift, lang, "shift")}`);
  lines.push(zh ? `天下${WEARY.zh[it.weariness]}` : `The realm: ${WEARY.en[it.weariness]}`);
  if (it.seals.length) lines.push(zh ? `持相印從楚者:${it.seals.map(T.state).join("、")}` : `States holding Chu's seal: ${T.list(it.seals.map(T.state))}`);
  if (it.fallen.length) lines.push(zh ? `已為秦所滅:${it.fallen.map(T.state).join("、")}` : `States destroyed by Qin: ${T.list(it.fallen.map(T.state))}`);
  const box = (b) => (b ? `「${T.box(b)}」` : (zh ? "尚未起步" : "not yet begun"));
  lines.push(zh ? `變法:秦${box(it.reform[0])},楚${box(it.reform[1])}` : `Reforms: Qin ${it.reform[0] ? T.box(it.reform[0]) : "not yet begun"}; Chu ${it.reform[1] ? T.box(it.reform[1]) : "not yet begun"}`);
  lines.push(zh ? `九鼎在${T.side[sideIx(it.cauldrons)]}` : `The Nine Cauldrons were with ${T.side[sideIx(it.cauldrons)]}`);
  return lines;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export function digestText(d, lang) {
  if (lang !== "zh" && lang !== "en") throw new Error("digestText: lang is zh or en");
  const T = L[lang], zh = lang === "zh";
  const out = [];
  const where = (pairs) => pairs.map(([id, n]) => (n > 1 ? `${T.space(id)}(${n})` : T.space(id)));
  out.push(zh ? "【開局】" : "[The opening]");
  out.push(zh ? `秦據西土(關中為都),楚據南方(郢為都);韓、魏、趙、齊、燕五國夾在其間。` : `Qin held the West (its capital Guanzhong), Chu the South (its capital Ying); Han, Wei, Zhao, Qi and Yan lay between them.`);
  if (d.opening.farStart) out.push(zh ? "秦素行遠交之策,在臨淄、薊早有耳目。" : "Qin, befriending the far, already had friends in Linzi and Ji.");
  out.push(zh ? `秦又遣人入${T.list(where(d.opening.qin))}。` : `Qin also sent men into ${T.list(where(d.opening.qin))}.`);
  out.push(zh ? `楚又遣人入${T.list(where(d.opening.chu))}。` : `Chu also sent men into ${T.list(where(d.opening.chu))}.`);
  out.push(zh ? `此局共${NUM_ZH[d.years] ?? d.years}年。` : `The contest lasted ${d.years} years.`);
  for (const t of d.turns) {
    out.push("");
    out.push(zh ? `【${T.year(t.turn)}】` : `[${T.year(t.turn)}]`);
    // The reckonings are told where they happen, not named: their names are the game's.
    const named = t.cards.filter((c) => !(CARD[c] && CARD[c].scoring));
    if (named.length) out.push(zh ? `本年的重要人物與事件:${named.map((c) => `「${T.card(c)}」`).join("、")}` : `Episodes of this year: ${named.map(T.card).join("; ")}`);
    // One line per move: an action opens a line, what follows from it continues it.
    let line = null;
    const flush = () => { if (line) out.push("- " + cap(line) + T.end); line = null; };
    for (const it of t.events) {
      if (it.type === "yearEnd") { flush(); out.push(zh ? "年終:" : "At the year's end:"); for (const s of yearEndText(it, lang)) out.push("  " + cap(s) + T.end); continue; }
      const s = describe(it, lang);
      if (!s) continue;
      const leads = it.type === "play" || (it.type === "event" && it.headline);
      const alone = it.type === "headline" || it.type === "era" || it.type === "bogged" || it.type === "zhou" || it.type === "end";
      if (leads || alone) {
        flush();
        line = s;
        if (alone) flush();
      } else if (line) {
        line += line.endsWith(",") ? (zh ? "" : " ") + s : T.sep + s;
      } else line = s;
    }
    flush();
  }
  out.push("");
  out.push(zh ? "【結局】" : "[The ending]");
  out.push(endText({ winner: SIDE[d.winner], reason: d.reason }, lang) + T.end);
  return out.join("\n");
}
