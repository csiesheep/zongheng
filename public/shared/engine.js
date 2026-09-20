// Pure rules. Runs unchanged in the browser (solo) and in the room Durable
// Object. Deterministic: the seeded RNG lives in the state, so a game replays
// from seed + actions, which is what makes the tests and the harness cheap.
//
// Shape of the machine. The state carries a `plan`: a queue of steps (an
// event to resolve, ops to spend, the end of an action round, the end of a
// turn). `run` executes steps until one needs a decision, which it parks in
// `pending` (who decides, what kind of choice, the options). The four
// external actions are `setup`/`headline`/`play`/`choose`; each validates,
// mutates, then calls `run`. Every rule in the rulebook
// (Projects/zongheng/zongheng - rulebook.md) has a named function here.
//
// One `apply` is therefore not one "move": `run` stops only at a decision,
// never at a boundary in the turn structure. When nobody can play, a single
// `apply` walks out the rest of the action rounds, the end-of-turn scoring and
// the next deal, and hands back a state waiting on the next headline. That is
// the rulebook (四、細則:「兩人皆無合法行動時(理論上不會),該行動回合跳過」,
// and nothing in 三、回合結構 4「結算」 is a player's choice except the 明法令
// discard, which does park). tests/engine-validation.test.js pins it.
export * from "./board.js";
import {
  SPACES, SPACE, REGIONS, SCORED_REGIONS, STATES, SETUP, spacesOf, spacesOfState,
} from "./board.js";
import { CARDS, CARD, ERA_DECKS } from "./cards.js";
export { CARDS, CARD, ERA_DECKS };

export const QIN = 0, CHU = 1;
export const SIDES = ["qin", "chu"];
export const other = (s) => 1 - s;
export const MIN_PLAYERS = 2, MAX_PLAYERS = 2;
export const JIUDING = "jiuding";
export const MANDATE_TO_WIN = 20;
export const WEARINESS_NAMES = { 5: "承平", 4: "兵連", 3: "禍結", 2: "民困", 1: "土崩" };
// Era: the deck shuffled in before that turn's refill; hand size and action
// rounds follow the era (rulebook 三, 回合結構).
export const ERAS = [
  { id: "reform",   zh: "變法期", en: "Reform era",   from: 1, hand: 8, rounds: 6 },
  { id: "alliance", zh: "縱橫期", en: "Alliance era", from: 4, hand: 9, rounds: 7 },
  { id: "conquest", zh: "兼併期", en: "Conquest era", from: 7, hand: 9, rounds: 7 },
];
export const REFORM = [
  { box: 1, zh: "徙木立信", ops: 2, first: 1, second: 0, perk: null },
  { box: 2, zh: "廢井田",   ops: 2, first: 0, second: 0, perk: "twice" },
  { box: 3, zh: "軍功爵",   ops: 2, first: 1, second: 0, perk: "campaign" },
  { box: 4, zh: "行縣制",   ops: 3, first: 0, second: 0, perk: "peek" },
  { box: 5, zh: "明法令",   ops: 3, first: 2, second: 0, perk: "discard" },
  { box: 6, zh: "稱帝",     ops: 4, first: 3, second: 1, perk: "emperor" },
];
// The rulebook's open numbers, each a harness cell. `scoringSplit`: "homes"
// scores 三晉 + both homes in the reform era and 東方 + 北疆 from the alliance
// era; "v2" is the rulebook's first draft (東方 early, 西土 late), which scored
// Chu's home two and a half times as often as Qin's.
// `sealAt`: "control" gives Chu a 相印 on controlling the capital; "cap" only
// once Chu's influence there sits at the cap (stability + 2).
// `tie`: who wins a level Mandate after the final scoring.
// `hangu`: Qin's starting influence in 函谷關 (stability 3): 2 leaves Qin with one
// controlled home space at the start against Chu's two, 3 makes it two each.
// `wuguo`: "any" lets 五國伐秦 strike any West space; "nonbg" keeps it out of 關中.
// `yue`: "lasting" gives 楚滅越 a +1 on every South scoring, "none" leaves it at the two points.
// `westBonus`: 司馬錯伐蜀 also gives Qin +1 on every West scoring (the granary of 蜀).
// Defaults are the rules as decided on 2026-09-18 from the harness (plan note,
// Balance log); the first drafts stay reachable as cells: sealAt "control",
// comp 2, hangu 2, wuguo "any", and round 2's westBonus false with yue "lasting"
// (Qin 39 % over 1,000 games; the pair below brought it to 50 %).
export const DEFAULT_OPTIONS = { cap: 2, seals: 4, mie: 3, comp: 0, homeLock: 4, luoyi: 1, turns: 8, scoringSplit: "homes", sealAt: "cap", tie: "chu", hangu: 3, wuguo: "nonbg", westBonus: true, yue: "none" };
export const USES = ["event", "place", "campaign", "lobby", "reform"];

// ---------- RNG (mulberry32) ----------
export function makeRng(seed) {
  let a = seed >>> 0;
  const rng = {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n) { return Math.floor(rng.next() * n); },
    getState() { return a; },
    setState(s) { a = s >>> 0; },
  };
  return rng;
}
export function randomSeed() { return Math.floor(Math.random() * 2 ** 31); }
export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
// JSON clone on purpose: structuredClone crashes V8 on the development machine.
export const clone = (x) => JSON.parse(JSON.stringify(x));
function withRng(st, fn) {
  const rng = makeRng(0);
  rng.setState(st.rngState);
  const out = fn(rng);
  st.rngState = rng.getState();
  return out;
}
// Entries carry a running number `i`, so a reader that only sees the tail
// (the log keeps the last 400) knows what it missed.
export function log(st, entry) {
  st.logSeq = (st.logSeq || 0) + 1;
  st.log.push({ i: st.logSeq, t: st.turn, r: st.round, ...entry });
  if (st.log.length > 400) st.log.splice(0, st.log.length - 400);
}
const fail = (msg) => { throw new Error(msg); };

// ---------- the board ----------
export function infOf(st, id) { return st.inf[id] || [0, 0]; }
function ensure(st, id) { if (!st.inf[id]) st.inf[id] = [0, 0]; return st.inf[id]; }
export function controller(st, id) {
  const [q, c] = infOf(st, id), S = SPACE[id].stability;
  if (q >= c + S) return QIN;
  if (c >= q + S) return CHU;
  return null;
}
export function capOf(st, id) { return SPACE[id].stability + st.options.cap; }
// Place up to n points, never above the cap; returns how many landed.
export function place(st, side, id, n = 1) {
  const a = ensure(st, id);
  const k = Math.max(0, Math.min(n, capOf(st, id) - a[side]));
  a[side] += k;
  return k;
}
export function remove(st, side, id, n) {
  const a = ensure(st, id);
  const k = Math.min(n, a[side]);
  a[side] -= k;
  return k;
}
export function controlled(st, side) { return SPACES.filter((s) => controller(st, s.id) === side).map((s) => s.id); }
export function canPlaceAt(st, side, id) {
  if (infOf(st, id)[side] > 0) return true;
  return SPACE[id].adj.some((a) => controller(st, a) === side);
}
export function placeCost(st, side, id) { return controller(st, id) === other(side) ? 2 : 1; }
// 局勢 for 遊說: my controlled neighbours minus theirs.
export function edge(st, side, id) {
  let e = 0;
  for (const a of SPACE[id].adj) {
    const c = controller(st, a);
    if (c === side) e++; else if (c === other(side)) e--;
  }
  return e;
}
export function isProtected(st, id) { return st.effects.some((e) => e.kind === "protect" && e.space === id); }

// ---------- weariness ----------
export function campaignLocked(st, id) {
  const sp = SPACE[id], w = st.weariness;
  if (w <= st.options.homeLock && REGIONS[sp.region].home) return true;
  if (w <= 3 && (sp.region === "jin" || sp.region === "zhou")) return true;
  if (w <= 2 && sp.battleground) return true;
  return false;
}
export function tire(st, n, pusher) {
  if (n <= 0 || st.winner) return;
  st.weariness = Math.max(1, st.weariness - n);
  log(st, { type: "tire", to: st.weariness, by: pusher });
  if (st.weariness <= 1) win(st, other(pusher), "collapse");
}
export function recover(st, n) { st.weariness = Math.min(5, st.weariness + n); }

// ---------- mandate, markers, scoring, reform ----------
export function win(st, side, reason) {
  if (st.winner != null) return;
  st.winner = side; st.reason = reason; st.phase = "over"; st.pending = null; st.plan = [];
  log(st, { type: "over", winner: side, reason });
}
export function vp(st, side, n) {
  if (!n || st.winner != null) return;
  st.mandate += side === QIN ? n : -n;
  log(st, { type: "vp", side, n, mandate: st.mandate });
  if (st.mandate >= MANDATE_TO_WIN) win(st, QIN, "mandate");
  else if (st.mandate <= -MANDATE_TO_WIN) win(st, CHU, "mandate");
}
export function checkMarkers(st) {
  if (st.winner != null) return;
  for (const [id, s] of Object.entries(STATES)) {
    const capCtl = controller(st, s.capital);
    if (st.mie[id] && capCtl === CHU) { delete st.mie[id]; log(st, { type: "restore", state: id }); }
    if (st.seals[id] && capCtl === QIN) { delete st.seals[id]; log(st, { type: "unseal", state: id }); }
    const all = spacesOfState(id).every((x) => controller(st, x) === QIN);
    if (all && !st.mie[id]) {
      st.mie[id] = true; log(st, { type: "mie", state: id });
      if (!st.mieVp[id]) { st.mieVp[id] = true; vp(st, QIN, s.vp); }
    }
    const sealed = capCtl === CHU && (st.options.sealAt !== "cap" || infOf(st, s.capital)[CHU] >= capOf(st, s.capital));
    if (sealed && !st.seals[id]) {
      st.seals[id] = true; log(st, { type: "seal", state: id });
      if (!st.sealVp[id]) { st.sealVp[id] = true; vp(st, CHU, 1); }
    }
  }
  if (st.winner == null && Object.keys(st.mie).length >= st.options.mie) win(st, QIN, "unification");
  if (st.winner == null && Object.keys(st.seals).length >= st.options.seals) win(st, CHU, "alliance");
}
export function regionTally(st, region) {
  const ids = spacesOf(region), R = REGIONS[region];
  const res = [QIN, CHU].map((side) => {
    const ctl = ids.filter((id) => controller(st, id) === side);
    return { spaces: ctl.length, bg: ctl.filter((id) => SPACE[id].battleground).length, ids: ctl };
  });
  return [QIN, CHU].map((i) => {
    const me = res[i], op = res[1 - i];
    let level = "none";
    if (me.spaces === ids.length) level = "control";
    else if (me.spaces > 0 && me.spaces > op.spaces && me.bg > op.bg) level = "domination";
    else if (me.spaces > 0) level = "presence";
    const base = level === "none" ? 0 : R[level];
    let bonus = me.bg;
    for (const e of st.effects) if (e.kind === "score" && e.region === region && e.who === i) bonus += e.delta;
    return { ...me, level, base, bonus, total: base + bonus };
  });
}
export function scoreRegion(st, region) {
  const [q, c] = regionTally(st, region);
  log(st, { type: "score", region, qin: q, chu: c });
  vp(st, QIN, q.total - c.total);
}
export function reformThreshold(st, side) { return st.reform[side] >= 6 ? Infinity : REFORM[st.reform[side]].ops; }
export function reformUsesLeft(st, side) { return (st.reform[side] >= 2 ? 2 : 1) - st.reformUsed[side]; }
export function hasPerk(st, side, perk) { return REFORM.some((r) => r.perk === perk && st.reform[side] >= r.box); }
export function reformAdvance(st, side, n = 1) {
  for (let i = 0; i < n; i++) {
    if (st.reform[side] >= 6) return;
    const box = ++st.reform[side], R = REFORM[box - 1];
    log(st, { type: "reform", side, box });
    if (st.reformFirst[box] == null) { st.reformFirst[box] = side; vp(st, side, R.first); } else vp(st, side, R.second);
    if (R.perk === "emperor") recover(st, 1);
  }
}

// ---------- ops ----------
export function opsOf(st, side, cardId) {
  const base = cardId === JIUDING ? 4 : CARD[cardId].ops;
  if (base === 0) return 0;
  let o = base;
  for (const e of st.effects) if (e.kind === "opsAll" && e.target === side) o += e.delta;
  return Math.max(1, o);
}
function inZhou(id) { const r = SPACE[id].region; return r === "jin" || r === "zhou"; }
export function campaignMod(st, side, target) {
  const region = SPACE[target].region;
  let d = 0;
  for (const e of st.effects) {
    if (e.kind !== "campaign") continue;
    if (e.who !== side && e.who !== "both") continue;
    if (e.regions && !e.regions.includes(region)) continue;
    d += e.delta;
  }
  return d;
}
export function addEffect(st, e) { st.effects.push(e); }
export function removeEffect(st, pred) { st.effects = st.effects.filter((e) => !pred(e)); }

// A campaign with `ops` points against `target` by `side`. Locks and
// protection are checked by the caller (free campaigns from events may skip
// them); the weariness cost is paid here unless `noTire`.
export function campaign(st, side, target, ops, { noTire = false, pusher = side } = {}) {
  const opp = other(side);
  let o = ops + campaignMod(st, side, target);
  if (hasPerk(st, side, "campaign") && !st.perkUsed[side]) { st.perkUsed[side] = true; o += 1; }
  o = Math.max(0, o);
  const removed = remove(st, opp, target, o);
  const placed = place(st, side, target, o - removed);
  log(st, { type: "campaign", side, target, ops: o, removed, placed });
  if (!noTire && SPACE[target].battleground) tire(st, 1, pusher);
  checkMarkers(st);
  return { ops: o, removed, placed };
}
export function lobby(st, side, target, ops) {
  const e = edge(st, side, target);
  const removed = e > 0 ? remove(st, other(side), target, Math.min(ops, e)) : 0;
  log(st, { type: "lobby", side, target, ops, edge: e, removed });
  checkMarkers(st);
  return removed;
}
// Points one at a time, so the cost re-evaluates as control changes.
export function placePoints(st, side, points, ops) {
  let spent = 0;
  for (const id of points) {
    const cost = placeCost(st, side, id);
    if (spent + cost > ops) fail(`place: not enough ops for ${id}`);
    if (!canPlaceAt(st, side, id)) fail(`place: ${id} is not reachable`);
    if (infOf(st, id)[side] >= capOf(st, id)) fail(`place: ${id} is at the cap`);
    place(st, side, id, 1);
    spent += cost;
  }
  log(st, { type: "place", side, points, spent });
  checkMarkers(st);
  return spent;
}

// ---------- decks and hands ----------
function drawOne(st) {
  if (!st.draw.length) {
    if (!st.discard.length) return null;
    st.draw = withRng(st, (rng) => shuffle(rng, st.discard));
    st.discard = [];
    log(st, { type: "reshuffle", n: st.draw.length });
  }
  return st.draw.pop();
}
// Refill draws; event draws (`nonScoring`) reveal and reshuffle scoring cards.
export function draw(st, side, n, { nonScoring = false } = {}) {
  let got = 0;
  for (let guard = 0; got < n && guard < 200; guard++) {
    const c = drawOne(st);
    if (c == null) break;
    if (nonScoring && CARD[c].scoring) {
      st.draw.push(c);
      st.draw = withRng(st, (rng) => shuffle(rng, st.draw));
      if (st.draw.every((x) => CARD[x].scoring)) break;
      continue;
    }
    st.hands[side].push(c);
    got++;
  }
  return got;
}
export function discardCard(st, side, cardId, { noEvent = true } = {}) {
  const h = st.hands[side], i = h.indexOf(cardId);
  if (i < 0) fail(`discard: ${cardId} not in hand`);
  h.splice(i, 1);
  st.discard.push(cardId);
  log(st, { type: "discard", side, card: cardId, noEvent });
}
export function eraOf(turn) { return ERAS.filter((e) => turn >= e.from).pop(); }
export function hasCards(st, side) { return st.hands[side].length > 0 || jiudingUsable(st, side); }
// 細作 (xizuo, 67) names a card the other side must play on its next action
// round (`st.forced[side]`, cards.js). The obligation LAPSES when that card is
// no longer in that side's hand -- orchestrator's ruling (#55), flagged to the
// owner; the rulebook says nothing about the case. Any other reading freezes
// the game: seed 70 on fallbacks stopped at turn 7 with Chu forced to play
// 說客 after 春申君's event made Chu draw two and discard that very card, and
// `legal()` then offered Chu nothing at all.
//
// This is the ONE place that decides it. Every reader of `st.forced` goes
// through here (`legal`, both checks in `play`, the Nine Cauldrons guard), so
// a stale value can never reach a rule. It does not mutate: `legal` and the
// per-seat `view` are read-only for the room and the bots. The stale value is
// wiped once, in `beginAction`, so the state on the wire is honest too.
export function forcedCard(st, side) {
  const c = st.forced[side];
  return c != null && st.hands[side].includes(c) ? c : null;
}
export function jiudingUsable(st, side) { return st.jiuding.holder === side && !st.jiuding.faceDown; }

// ---------- creating a game ----------
export function createGame(seed, options = {}) {
  const rng = makeRng(seed);
  const st = {
    seed, rngState: 0, options: { ...DEFAULT_OPTIONS, ...options },
    turn: 0, era: null, phase: "setup", round: 0, rounds: 0, actor: QIN, phasing: QIN,
    inf: {}, mandate: 0, weariness: 5,
    reform: [0, 0], reformUsed: [0, 0], reformFirst: {}, perkUsed: [false, false],
    mie: {}, seals: {}, mieVp: {}, sealVp: {}, luoyiYields: true,
    jiuding: { holder: CHU, faceDown: false },
    draw: [], discard: [], removed: [], later: {},
    hands: [[], []], headline: [null, null],
    effects: [], forced: [null, null], revealed: [false, false],
    pending: null, plan: [], winner: null, reason: null, log: [],
  };
  for (const side of [QIN, CHU]) {
    for (const [id, n] of Object.entries(SETUP[SIDES[side]].fixed)) ensure(st, id)[side] = n;
  }
  ensure(st, "hangu")[QIN] = st.options.hangu;
  const decks = { reform: ERA_DECKS.reform.slice(), alliance: ERA_DECKS.alliance.slice(), conquest: ERA_DECKS.conquest.slice() };
  if (st.options.scoringSplit === "v2") {
    decks.reform = decks.reform.filter((c) => c !== "score_west").concat("score_east");
    decks.alliance = decks.alliance.filter((c) => c !== "score_east").concat("score_west");
  }
  st.draw = shuffle(rng, decks.reform);
  st.later = { alliance: decks.alliance, conquest: decks.conquest };
  st.rngState = rng.getState();
  st.plan = [
    { do: "setup", side: QIN, n: SETUP.qin.free, regions: SETUP.qin.freeIn, choices: [] },
    { do: "setup", side: CHU, n: SETUP.chu.free, regions: SETUP.chu.freeIn, choices: [] },
    { do: "setup", side: CHU, n: st.options.comp, regions: null, choices: [] },
    { do: "startTurn" },
  ];
  return run(st);
}

// ---------- the plan runner ----------
export function run(st) {
  for (let guard = 0; !st.pending && st.winner == null && st.plan.length; guard++) {
    if (guard > 10000) fail("run: plan did not settle");
    const step = st.plan[0];
    if (exec(st, step)) st.plan.shift();
  }
  return st;
}
function ask(st, step, spec) {
  st.pending = { who: step.side, ...spec, step: step.do };
  return false;
}
function exec(st, step) {
  switch (step.do) {
    case "setup": {
      if (step.n <= 0) return true;
      if (!step.choices.length) {
        const options = step.regions
          ? SPACES.filter((s) => step.regions.includes(s.region)).map((s) => s.id)
          : SPACES.filter((s) => infOf(st, s.id)[step.side] > 0).map((s) => s.id);
        return ask(st, step, { kind: "points", n: step.n, min: step.n, options, side: step.side, tag: "setup" });
      }
      for (const id of step.choices[0]) place(st, step.side, id, 1);
      log(st, { type: "setup", side: step.side, points: step.choices[0] });
      checkMarkers(st);
      return true;
    }
    case "startTurn": return startTurn(st), true;
    case "headline": return resolveHeadlines(st), true;
    case "event": {
      st.phasing = step.by ?? step.side;
      for (let guard = 0; guard < 20; guard++) {
        const need = CARD[step.card].effect(st, step.side, step.choices, step);
        if (!need) break;
        // A choice with nothing to choose from resolves itself as "nothing".
        if ((need.kind === "points" || need.kind === "card") && (!need.options.length || need.n === 0) && !(need.min > 0)) { step.choices.push([]); continue; }
        return ask(st, step, { ...need, tag: "event", card: step.card });
      }
      step.done = true;
      checkMarkers(st);
      return true;
    }
    case "score": return scoreRegion(st, step.region), true;
    case "ops": {
      // Ops chosen up front (in the play action) or asked for now (an
      // opponent's card played event-first, 商旅通賈).
      let choice = step.payload;
      if (!choice) {
        if (!step.choices.length) {
          const o = opsOptions(st, step.side);
          const allowed = [];
          if (o.placeOptions.length) allowed.push("place");
          if (o.campaignTargets.length) allowed.push("campaign");
          if (o.lobbyTargets.length) allowed.push("lobby");
          if (!allowed.length) { log(st, { type: "opsLost", side: step.side, ops: step.ops }); return true; }
          return ask(st, step, { kind: "ops", ops: step.ops, card: step.card, allowed, options: o, tag: "ops" });
        }
        choice = step.choices[0];
      }
      doOps(st, step.side, step.card, step.ops, choice);
      return true;
    }
    case "reform": {
      st.reformUsed[step.side]++;
      reformAdvance(st, step.side, 1);
      return true;
    }
    case "finishCard": return finishCard(st, step), true;
    case "jiudingPass": {
      st.jiuding = { holder: other(step.side), faceDown: true };
      log(st, { type: "jiuding", to: other(step.side) });
      return true;
    }
    case "endAction": return endAction(st), true;
    case "beginAction": return beginAction(st), true;
    case "endTurn": {
      if (!step.stage) {
        endTurnChecks(st);
        if (st.winner != null) return true;
        step.stage = "discard";
        step.sides = [QIN, CHU].filter((s) => hasPerk(st, s, "discard") && st.hands[s].some((c) => !CARD[c].scoring));
        step.choices = [];
      }
      while (step.sides.length) {
        const side = step.sides[0];
        if (!step.choices.length) {
          return ask(st, { ...step, side }, { kind: "card", n: 1, min: 0, options: st.hands[side].filter((c) => !CARD[c].scoring), tag: "endDiscard" });
        }
        const [pick] = step.choices.shift();
        if (pick) discardCard(st, side, pick);
        step.sides.shift();
      }
      if (st.turn >= st.options.turns) finalScoring(st);
      else st.plan.push({ do: "startTurn" });
      return true;
    }
    default: fail(`exec: unknown step ${step.do}`);
  }
}

function startTurn(st) {
  st.turn++;
  const era = eraOf(st.turn);
  if (era.id !== st.era) {
    st.era = era.id;
    if (st.later[era.id]) {
      st.draw = withRng(st, (rng) => shuffle(rng, st.draw.concat(st.later[era.id])));
      delete st.later[era.id];
      log(st, { type: "era", era: era.id });
    }
  }
  st.rounds = era.rounds;
  st.round = 0;
  st.reformUsed = [0, 0]; st.perkUsed = [false, false]; st.forced = [null, null]; st.revealed = [false, false];
  st.headline = [null, null];
  if (st.jiuding.faceDown) st.jiuding.faceDown = false;
  // Alternate draws so a mid-deal reshuffle is fair.
  for (let guard = 0; guard < 40; guard++) {
    let dealt = 0;
    for (const side of [QIN, CHU]) if (st.hands[side].length < era.hand) dealt += draw(st, side, 1);
    if (!dealt) break;
  }
  st.phase = "headline";
  log(st, { type: "turn", turn: st.turn, era: st.era });
}

function resolveHeadlines(st) {
  const [q, c] = st.headline;
  const first = CARD[c].ops > CARD[q].ops ? CHU : QIN; // ties go to Qin
  const order = first === QIN ? [QIN, CHU] : [CHU, QIN];
  log(st, { type: "headline", cards: st.headline, first });
  const steps = [];
  for (const side of order) {
    const card = st.headline[side];
    if (CARD[card].scoring) steps.push({ do: "score", region: CARD[card].scoring, side });
    else steps.push({ do: "event", card, side: CARD[card].side ?? side, by: side, choices: [] });
    steps.push({ do: "finishCard", card, side, triggered: true });
  }
  steps.push({ do: "beginAction" });
  st.plan.splice(1, 0, ...steps);
  st.phase = "action"; st.round = 1; st.actor = QIN;
}

// A side with nothing to play skips its half of the action round (rulebook
// 四、細則). There is no decision in a skip, so `run` does not stop: with both
// hands empty the remaining rounds, the end of the turn and the next deal all
// come out of whichever `apply` emptied the last hand.
function beginAction(st) {
  if (st.winner != null) return;
  st.phasing = st.actor;
  // The obligation lapsed while someone else was acting (#55): drop the stale
  // name so the state this side is about to see says what the rules say.
  if (st.forced[st.actor] && !forcedCard(st, st.actor)) st.forced[st.actor] = null;
  if (!hasCards(st, st.actor)) {
    log(st, { type: "skip", side: st.actor });
    st.plan.push({ do: "endAction" });
  }
}
function endAction(st) {
  if (st.winner != null) return;
  if (st.actor === QIN) { st.actor = CHU; }
  else { st.actor = QIN; st.round++; }
  if (st.round > st.rounds) { st.round = st.rounds; st.plan.push({ do: "endTurn" }); return; }
  st.plan.push({ do: "beginAction" });
}
function endTurnChecks(st) {
  const holding = [QIN, CHU].filter((s) => st.hands[s].some((c) => CARD[c].scoring));
  if (holding.length === 2) return win(st, CHU, "scoringBoth");
  if (holding.length === 1) return win(st, other(holding[0]), "scoring");
  recover(st, 1);
  if (st.luoyiYields) {
    const ctl = controller(st, "luoyi");
    if (ctl != null) vp(st, ctl, st.options.luoyi);
  }
  st.effects = st.effects.filter((e) => e.until !== "turn");
  log(st, { type: "endTurn", turn: st.turn, weariness: st.weariness });
}
function finalScoring(st) {
  for (const r of SCORED_REGIONS) { scoreRegion(st, r); if (st.winner != null) return; }
  if (st.mandate > 0) win(st, QIN, "final");
  else if (st.mandate < 0) win(st, CHU, "final");
  else win(st, st.options.tie === "qin" ? QIN : CHU, "tie");
}
function finishCard(st, step) {
  const c = step.card;
  if (c === JIUDING) return;
  if (st.hands[QIN].includes(c) || st.hands[CHU].includes(c) || st.removed.includes(c) || st.discard.includes(c)) return;
  if (step.triggered && CARD[c].remove) st.removed.push(c);
  else st.discard.push(c);
}
// The one door for spending ops, whichever action brought them: `play` dry
// runs it through `validateOps` before it commits, and so does `choose` for
// the ops steps that ask (the event-first branch, 商旅通賈). Every refusal is
// a rules `Error`, so a payload with no points or a space that is not on the
// board is a refusal too, not a TypeError from three calls down (#16).
function doOps(st, side, card, ops, choice) {
  if (!choice || typeof choice !== "object") fail("ops: no choice");
  if (choice.use === "place") {
    if (!Array.isArray(choice.points)) fail("place: points must be a list");
    for (const id of choice.points) if (!SPACE[id]) fail(`place: unknown space ${id}`);
    if (card === JIUDING && choice.points.every(inZhou)) ops += 1;
    placePoints(st, side, choice.points, ops);
  } else if (choice.use === "campaign") {
    if (!SPACE[choice.target]) fail(`campaign: unknown space ${choice.target}`);
    if (card === JIUDING && inZhou(choice.target)) ops += 1;
    const t = choice.target;
    if (infOf(st, t)[other(side)] <= 0) fail("campaign: no enemy influence there");
    if (campaignLocked(st, t)) fail("campaign: locked by weariness");
    if (isProtected(st, t)) fail("campaign: the space is protected this turn");
    campaign(st, side, t, ops);
  } else if (choice.use === "lobby") {
    if (!SPACE[choice.target]) fail(`lobby: unknown space ${choice.target}`);
    if (card === JIUDING && inZhou(choice.target)) ops += 1;
    const t = choice.target;
    if (infOf(st, t)[other(side)] <= 0) fail("lobby: no enemy influence there");
    if (edge(st, side, t) <= 0) fail("lobby: no edge there");
    if (isProtected(st, t)) fail("lobby: the space is protected this turn");
    lobby(st, side, t, ops);
  } else fail(`ops: bad use ${choice.use}`);
}

// ---------- actions ----------
export function mustAct(st) {
  if (st.winner != null) return [];
  if (st.pending) return [st.pending.who];
  if (st.phase === "headline") return [QIN, CHU].filter((s) => st.headline[s] == null);
  if (st.phase === "action") return [st.actor];
  return [];
}

export function apply(state, action) {
  const st = clone(state);
  if (st.winner != null) fail("game over");
  switch (action.type) {
    case "choose": return choose(st, action);
    case "headline": return headline(st, action);
    case "play": return play(st, action);
    default: fail(`unknown action ${action.type}`);
  }
}

function choose(st, action) {
  const p = st.pending;
  if (!p) fail("nothing to choose");
  if (action.side !== p.who) fail("not your choice");
  const step = st.plan[0];
  const choice = validateChoice(st, p, action.choice);
  st.pending = null;
  step.choices.push(choice);
  return run(st);
}
function validateChoice(st, p, choice) {
  switch (p.kind) {
    case "points": {
      if (!Array.isArray(choice) || choice.length < p.min || choice.length > p.n) fail("points: wrong count");
      const opts = new Set(p.options);
      const counts = {};
      for (const id of choice) {
        if (!opts.has(id)) fail(`points: ${id} not allowed`);
        counts[id] = (counts[id] || 0) + 1;
        if (p.distinct && counts[id] > 1) fail("points: repeats not allowed");
        if (p.maxPer && counts[id] > p.maxPer) fail(`points: more than ${p.maxPer} in ${id}`);
        if (p.maxOf && counts[id] > (p.maxOf[id] ?? 0)) fail(`points: not that many in ${id}`);
        if (p.side != null && infOf(st, id)[p.side] + counts[id] > capOf(st, id)) fail(`points: ${id} over the cap`);
      }
      return choice;
    }
    case "card": {
      const arr = Array.isArray(choice) ? choice : choice == null ? [] : [choice];
      if (arr.length < (p.min ?? 1) || arr.length > (p.n ?? 1)) fail("card: wrong count");
      for (const c of arr) if (!p.options.includes(c)) fail(`card: ${c} not allowed`);
      return arr;
    }
    case "option": {
      if (!p.options.some((o) => o.id === choice)) fail(`option: ${choice} not allowed`);
      return choice;
    }
    case "ops": {
      if (!choice || !p.allowed.includes(choice.use)) fail("ops: bad use");
      // The same dry run `play` does, so ops that arrive through this door are
      // refused by the same rules with the same error (#16). Without it an
      // illegal `points` / `target` only blew up once `run` reached the step.
      validateOps(st, p.who, p.card, p.ops, choice);
      return choice;
    }
    default: fail(`choose: unknown kind ${p.kind}`);
  }
}

function headline(st, action) {
  if (st.phase !== "headline") fail("not the headline phase");
  const side = action.side;
  if (st.headline[side] != null) fail("already headlined");
  const c = action.card;
  if (c === JIUDING) fail("the Nine Cauldrons may not be headlined");
  const h = st.hands[side], i = h.indexOf(c);
  if (i < 0) fail("card not in hand");
  h.splice(i, 1);
  st.headline[side] = c;
  if (st.headline[QIN] != null && st.headline[CHU] != null) st.plan.unshift({ do: "headline" });
  return run(st);
}

function play(st, action) {
  if (st.phase !== "action" || st.pending) fail("not an action round");
  const side = action.side;
  if (side !== st.actor) fail("not your action");
  const c = action.card, use = action.use;
  const steps = [];
  if (c === JIUDING) {
    if (!jiudingUsable(st, side)) fail("the Nine Cauldrons are not yours to use");
    if (forcedCard(st, side)) fail("you must play the named card");
    if (!["place", "campaign", "lobby"].includes(use)) fail("the Nine Cauldrons: place, campaign or lobby only");
    validateOps(st, side, JIUDING, 4, { use, points: action.points, target: action.target }, true);
    steps.push({ do: "ops", side, card: JIUDING, ops: 4, payload: { use, points: action.points, target: action.target } });
    steps.push({ do: "jiudingPass", side }, { do: "endAction" });
    st.plan.unshift(...steps);
    return run(st);
  }
  const h = st.hands[side];
  if (!h.includes(c)) fail("card not in hand");
  const forced = forcedCard(st, side);
  if (forced && forced !== c) fail("you must play the named card");
  const card = CARD[c];
  const bog = st.effects.find((e) => e.kind === "bog" && e.who === side);
  const bogCards = bog ? h.filter((x) => CARD[x].ops >= 2) : [];
  if (bogCards.length && use !== "bog") fail("頓兵堅城: discard a card of 2+ ops first");
  h.splice(h.indexOf(c), 1);
  st.forced[side] = null;
  const ops = opsOf(st, side, c);
  if (use === "bog") {
    if (!bogCards.includes(c)) fail("bog: that card cannot be discarded");
    removeEffect(st, (e) => e === bog);
    log(st, { type: "bog", side, card: c });
    steps.push({ do: "finishCard", card: c, side, triggered: false }, { do: "endAction" });
  } else if (card.scoring) {
    if (use !== "event") fail("a scoring card must be played as its event");
    steps.push({ do: "score", region: card.scoring, side }, { do: "finishCard", card: c, side, triggered: true }, { do: "endAction" });
  } else if (use === "event") {
    steps.push({ do: "event", card: c, side: card.side ?? side, by: side, choices: [] }, { do: "finishCard", card: c, side, triggered: true }, { do: "endAction" });
  } else if (use === "reform") {
    if (reformUsesLeft(st, side) <= 0) fail("reform: no advances left this turn");
    if (card.ops < reformThreshold(st, side)) fail("reform: card below the threshold");
    steps.push({ do: "reform", side }, { do: "finishCard", card: c, side, triggered: false }, { do: "endAction" });
  } else if (["place", "campaign", "lobby"].includes(use)) {
    const payload = { use, points: action.points, target: action.target };
    const enemy = card.side != null && card.side !== side;
    if (c === "shuoke" && action.pair) {
      // 說客: the paired enemy card's ops, no event, both discarded.
      const pair = CARD[action.pair];
      if (!h.includes(action.pair) || pair.side !== other(side)) fail("說客: pair an enemy card from your hand");
      h.splice(h.indexOf(action.pair), 1);
      const pops = opsOf(st, side, action.pair);
      validateOps(st, side, action.pair, pops, payload);
      steps.push({ do: "ops", side, card: action.pair, ops: pops, payload });
      steps.push({ do: "finishCard", card: c, side, triggered: false }, { do: "finishCard", card: action.pair, side, triggered: false }, { do: "endAction" });
    } else if (enemy && action.order === "eventFirst") {
      steps.push({ do: "event", card: c, side: card.side, by: side, choices: [] });
      steps.push({ do: "ops", side, card: c, ops, payload: null, choices: [] });
      steps.push({ do: "finishCard", card: c, side, triggered: true }, { do: "endAction" });
    } else {
      validateOps(st, side, c, ops, payload);
      steps.push({ do: "ops", side, card: c, ops, payload });
      if (enemy) steps.push({ do: "event", card: c, side: card.side, by: side, choices: [] });
      steps.push({ do: "finishCard", card: c, side, triggered: enemy }, { do: "endAction" });
    }
  } else fail(`play: bad use ${use}`);
  log(st, { type: "play", side, card: c, use });
  st.plan.unshift(...steps);
  return run(st);
}
// Validate ops without mutating: replay the placement on a throwaway copy.
function validateOps(st, side, card, ops, payload, jiuding = false) {
  const trial = clone(st);
  trial.log = [];
  doOps(trial, side, jiuding ? JIUDING : card, ops, payload);
}

// ---------- what a side may do now (for the UI and the bots) ----------
// Where ops can go right now: placement targets with their cost per point,
// campaign targets (enemy influence, not locked, not protected), lobby
// targets with a positive edge.
export function opsOptions(st, side) {
  const placeOptions = SPACES.filter((s) => canPlaceAt(st, side, s.id) && infOf(st, s.id)[side] < capOf(st, s.id))
    .map((s) => ({ id: s.id, cost: placeCost(st, side, s.id) }));
  const campaignTargets = SPACES.filter((s) => infOf(st, s.id)[other(side)] > 0 && !campaignLocked(st, s.id) && !isProtected(st, s.id)).map((s) => s.id);
  const lobbyTargets = SPACES.filter((s) => infOf(st, s.id)[other(side)] > 0 && !isProtected(st, s.id))
    .map((s) => ({ id: s.id, edge: edge(st, side, s.id) })).filter((x) => x.edge > 0);
  return { placeOptions, campaignTargets, lobbyTargets };
}
export function legal(st, side) {
  if (st.winner != null) return { kind: "over" };
  if (st.pending) return st.pending.who === side ? { kind: "pending", pending: st.pending } : { kind: "wait" };
  if (st.phase === "headline") {
    return st.headline[side] == null ? { kind: "headline", cards: st.hands[side].slice() } : { kind: "wait" };
  }
  if (st.phase !== "action" || st.actor !== side) return { kind: "wait" };
  const h = st.hands[side];
  const bog = st.effects.some((e) => e.kind === "bog" && e.who === side);
  const bogCards = bog ? h.filter((x) => CARD[x].ops >= 2) : [];
  if (bogCards.length) return { kind: "action", bog: bogCards, cards: [] };
  const { placeOptions, campaignTargets, lobbyTargets } = opsOptions(st, side);
  const forced = forcedCard(st, side);
  const cards = h.filter((c) => !forced || c === forced).map((c) => {
    const card = CARD[c];
    if (card.scoring) return { id: c, ops: 0, uses: { event: true } };
    const ops = opsOf(st, side, c);
    const uses = {
      event: true,
      place: placeOptions.length ? { ops, options: placeOptions } : null,
      campaign: campaignTargets.length ? { ops, targets: campaignTargets } : null,
      lobby: lobbyTargets.length ? { ops, targets: lobbyTargets } : null,
      reform: reformUsesLeft(st, side) > 0 && card.ops >= reformThreshold(st, side),
      enemy: card.side != null && card.side !== side,
    };
    if (c === "shuoke") uses.pair = h.filter((x) => CARD[x].side === other(side));
    return { id: c, ops, uses };
  });
  const jiuding = !forced && jiudingUsable(st, side)
    ? { ops: 4, place: placeOptions.length ? { options: placeOptions } : null, campaign: campaignTargets.length ? { targets: campaignTargets } : null, lobby: lobbyTargets.length ? { targets: lobbyTargets } : null }
    : null;
  return { kind: "action", cards, jiuding, forced };
}

// ---------- the per-seat view ----------
export function view(st, side) {
  // The plan stays: it names only cards already face up and choices already
  // made, and a bot answering a pending needs it to simulate.
  const v = clone(st);
  delete v.rngState;
  v.drawCount = st.draw.length; delete v.draw;
  v.laterCounts = Object.fromEntries(Object.entries(st.later).map(([k, a]) => [k, a.length])); delete v.later;
  v.handCounts = [st.hands[QIN].length, st.hands[CHU].length];
  if (side == null) {
    // A spectator sees the table and neither hand.
    v.hands = [null, null];
    if (st.phase === "headline") v.headline = st.headline.map((h) => (h == null ? null : "hidden"));
  } else {
    const opp = other(side);
    const showOpp = st.revealed[side] || (st.pending && st.pending.who === side && st.pending.showHand);
    if (!showOpp) v.hands[opp] = null;
    // Headlines stay hidden until both are in, unless 行縣制 lets this side peek.
    if (st.phase === "headline" && st.headline[side] == null && !hasPerk(st, side, "peek")) v.headline[opp] = st.headline[opp] == null ? null : "hidden";
    if (st.phase === "headline" && st.headline[opp] == null) v.headline[opp] = null;
  }
  return v;
}
