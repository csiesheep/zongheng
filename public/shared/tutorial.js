// The tutorial: one short game with a written-down script, ten lessons, the
// player on Qin's seat. This file is data plus the gate that keeps the player
// on the rails; the picture is the FE's (#15) and the words are the writer's
// (#14).
//
// Two rules this file obeys, and the tests in tests/tutorial.test.js hold it to
// both. First: every move — the player's and the scripted opponent's — goes
// through the real `E.apply`. Nothing reaches into `st.inf` except
// `createTutorial`, which authors the opening position. Second: `facts` is
// computed from the state it is handed, never typed in, so a changed position
// changes the numbers the coach says.
//
// The opening position is authored, not dealt: it is not a position the setup
// rules could produce on turn 1 (Qin already holds 邯鄲, Chu already stands in
// 三晉). It is a legal engine state, which is what the engine cares about.
//
// The script leaves out, on purpose, what the design said to leave out: the
// headline phase (the state starts in the action phase), the Nine Cauldrons
// (face down on Chu's side, so they are nobody's to use), 洛邑, 相印 and the
// reform perks.
//
// Shape of a lesson:
//   id         the ten ids the FE and the writer share; fixed, ordered
//   spotlight  what to light up: { space } | { card } | { track }
//   expect     the only thing the player may do:
//                { kind: "tap", space | card }              — looking, not moving
//                { kind: "action", action: <E.apply input> } — one engine action
//   then       the script's answer, zero or more engine actions, applied after
//   facts(st)  the numbers for the coach's text, read off `st` as it is when
//              the lesson opens (before `expect` is applied)
//
// `facts` keys the writer can lean on everywhere: `space`/`spaceZh`/`spaceEn`,
// `card`/`cardZh`/`cardEn`, `qin`, `chu` and `n` (the lesson's headline count).
// `from`/`to` name the one thing that changes, and only the six lessons that
// change something carry them: 4 (who controls 河東), 5 (the reform box),
// 7 (the weariness step, by name), 8 (Chu's points in 大梁), 9 and 10 (the
// Mandate). Lessons 1, 2, 3 and 6 have no from/to — nothing on the board moves
// in 1–3, and 6 is about where a card came from, which `owner` already says.
import * as E from "./engine.js";

const QIN = E.QIN, CHU = E.CHU;

export const TUTORIAL_SEED = 1;
export const TUTORIAL_TURN = 1;
// Seven action rounds: the seven lessons that take an action (4 to 10). The
// turn must never roll over — `endTurn` would recover weariness, pay 洛邑 and
// deal a second turn out of an empty deck, in the middle of the last lesson.
export const TUTORIAL_ROUNDS = 7;

// The opening position, [Qin, Chu] per space. Every space is listed so the
// board reads whole; the engine treats a missing entry as [0, 0] anyway.
export const START_INF = {
  // 西土 — Qin's home, as the setup deals it
  guanzhong: [4, 0],   // stability 4: Qin controls
  hangu:     [3, 0],   // stability 3: Qin controls — this is what reaches 河東
  hanzhong:  [1, 0],
  bashu:     [1, 0],
  yiqu:      [1, 0],
  // 三晉 — the front the tutorial is fought on
  yiyang:    [3, 0],   // lesson 2: 3 ≥ 0 + 2, Qin controls. Half of 韓.
  xinzheng:  [0, 1],   // lesson 10: 韓's capital, kept out of Qin's hands until then
  hedong:    [0, 0],   // lesson 4: empty, next to 函谷關, two points take it
  daliang:   [0, 3],   // lesson 8 and 9: Chu controls, battleground. 3 < cap 4, so no 相印.
  shangdang: [0, 2],   // lesson 7: Chu controls, battleground
  handan:    [3, 0],   // Qin controls: the one neighbour that gives 大梁 a positive edge
  // 周室
  luoyi:     [0, 0],
  // 東方
  song:      [0, 1],
  linzi:     [0, 0],
  jimo:      [0, 0],
  ju:        [0, 0],
  xue:       [0, 0],
  // 南方 — Chu's home, as the setup deals it
  ying:      [0, 4],
  huaisi:    [0, 1],
  chencai:   [0, 2],
  qianzhong: [0, 1],
  wuyue:     [0, 0],
  // 北疆 — left empty so 趙 cannot fall when Qin takes 上黨 and holds 邯鄲
  ji:        [0, 0],
  liaodong:  [0, 0],
  zhongshan: [0, 0],
  dai:       [0, 0],
};

// Qin's hand, in the order the script spends it: lessons 4, 5, 6, 7, 8, 9, 10.
export const QIN_HAND = ["keqing", "shangyang", "weiwei", "zhangyi", "envoy", "score_jin", "hexi"];
// Chu's hand: six cards the script spends, one (蘇秦合縱) it never reaches. That
// last card matters — with an empty hand Chu would be skipped and the engine
// would run the turn out on its own after lesson 10.
export const CHU_HAND = ["wuqi", "jixia", "chumieyue", "maling", "wuguo", "mozhe", "suqin"];

// ---------- the opening position ----------
// Built off `createGame` so the state carries whatever shape the engine
// currently expects, then overwritten field by field.
export function createTutorial() {
  const st = E.createGame(TUTORIAL_SEED);
  st.inf = {};
  for (const [id, [q, c]] of Object.entries(START_INF)) st.inf[id] = [q, c];
  st.hands = [QIN_HAND.slice(), CHU_HAND.slice()];
  st.draw = []; st.discard = []; st.removed = []; st.later = {};
  st.turn = TUTORIAL_TURN; st.era = "reform";
  st.rounds = TUTORIAL_ROUNDS; st.round = 1;
  st.phase = "action"; st.actor = QIN; st.phasing = QIN;
  st.headline = [null, null];
  st.pending = null; st.plan = [];
  st.jiuding = { holder: CHU, faceDown: true }; // out of the tutorial
  st.mandate = 0; st.weariness = 5;
  st.reform = [0, 0]; st.reformUsed = [0, 0]; st.reformFirst = {}; st.perkUsed = [false, false];
  st.mie = {}; st.seals = {}; st.mieVp = {}; st.sealVp = {};
  st.effects = []; st.forced = [null, null]; st.revealed = [false, false];
  st.winner = null; st.reason = null;
  st.log = []; st.logSeq = 0;
  return st;
}

// ---------- little readers, so nothing below types a number twice ----------
const sideName = (s) => (s == null ? null : E.SIDES[s]);
const at = (st, id) => { const [qin, chu] = E.infOf(st, id); return { qin, chu }; };
function spaceFacts(st, id) {
  const sp = E.SPACE[id], { qin, chu } = at(st, id);
  return {
    space: id, spaceZh: sp.zh, spaceEn: sp.en,
    region: sp.region, regionZh: E.REGIONS[sp.region].zh,
    stability: sp.stability, cap: E.capOf(st, id), battleground: sp.battleground,
    qin, chu, controller: sideName(E.controller(st, id)),
  };
}
function cardFacts(st, id) {
  const c = E.CARD[id];
  return { card: id, cardZh: c.zh, cardEn: c.en, owner: sideName(c.side), printed: c.ops, ops: E.opsOf(st, QIN, id) };
}
// What a campaign of `ops` points would do here, by the rule: remove first,
// then place what is left, never past the cap.
function campaignFacts(st, id, card) {
  const sp = E.SPACE[id], { qin, chu } = at(st, id);
  const ops = E.opsOf(st, QIN, card) + E.campaignMod(st, QIN, id);
  const removed = Math.min(ops, chu);
  const placed = Math.min(ops - removed, E.capOf(st, id) - qin);
  const qAfter = qin + placed, cAfter = chu - removed;
  const controllerAfter = qAfter >= cAfter + sp.stability ? "qin"
    : cAfter >= qAfter + sp.stability ? "chu" : null;
  return { ops, removed, placed, qinAfter: qAfter, chuAfter: cAfter, controllerAfter, locked: E.campaignLocked(st, id) };
}
const play = (side, card, use, extra = {}) => ({ type: "play", side, card, use, ...extra });
const chuPlaces = (card, points) => play(CHU, card, "place", { points });

// ---------- the ten lessons ----------
export const STEPS = [
  {
    id: "map",
    spotlight: { space: "guanzhong" },
    expect: { kind: "tap", space: "guanzhong" },
    then: [],
    facts(st) {
      return {
        ...spaceFacts(st, "guanzhong"),
        spaces: E.SPACES.length,
        regions: E.SCORED_REGIONS.length,
        battlegrounds: E.BATTLEGROUNDS.length,
        n: E.SPACES.length,
      };
    },
  },
  {
    id: "control",
    spotlight: { space: "yiyang" },
    expect: { kind: "tap", space: "yiyang" },
    then: [],
    facts(st) {
      const f = spaceFacts(st, "yiyang");
      // What Qin would need here, and what it has: the rule is mine ≥ theirs + stability.
      // Nothing changes in a lesson the player only looks at, so there is no from/to.
      return { ...f, need: f.chu + f.stability, n: f.stability };
    },
  },
  {
    id: "hand",
    spotlight: { card: "keqing" },
    expect: { kind: "tap", card: "keqing" },
    then: [],
    facts(st) {
      return { ...cardFacts(st, "keqing"), hand: st.hands[QIN].length, uses: E.USES.length, n: E.opsOf(st, QIN, "keqing") };
    },
  },
  {
    // 河東: empty, stability 2, reachable from 函谷關. Two points take it.
    // The design drew this lesson on 新鄭; 宜陽 + 新鄭 is the whole of 韓, so
    // that would have destroyed 韓 five lessons early (orchestrator's ruling, #13).
    id: "place",
    spotlight: { space: "hedong" },
    expect: { kind: "action", action: play(QIN, "keqing", "place", { points: ["hedong", "hedong"] }) },
    then: [chuPlaces("wuqi", ["wuyue", "wuyue"])],
    facts(st) {
      const id = "hedong", card = "keqing", n = 2, f = spaceFacts(st, id);
      return {
        ...f, ...cardFacts(st, card), n,
        cost: E.placeCost(st, QIN, id), spent: n * E.placeCost(st, QIN, id),
        need: f.chu + f.stability, qinAfter: f.qin + n,
        from: f.controller, to: f.qin + n >= f.chu + f.stability ? "qin" : f.controller,
      };
    },
  },
  {
    id: "event",
    spotlight: { card: "shangyang" },
    expect: { kind: "action", action: play(QIN, "shangyang", "event") },
    then: [chuPlaces("jixia", ["wuyue", "wuyue"])],
    facts(st) {
      const box = st.reform[QIN] + 1, R = E.REFORM[box - 1], first = st.reformFirst[box] == null;
      return {
        ...cardFacts(st, "shangyang"),
        reform: st.reform[QIN], box, boxZh: R.zh, boxOps: R.ops,
        first, vp: first ? R.first : R.second,
        mandate: st.mandate, n: box, from: st.reform[QIN], to: box,
      };
    },
  },
  {
    // 圍魏救趙 is Chu's card in Qin's hand: Qin takes the ops, Chu still gets
    // the event (a point into 邯鄲 — the very space lesson 8 leans on).
    id: "enemyCard",
    spotlight: { card: "weiwei" },
    expect: { kind: "action", action: play(QIN, "weiwei", "place", { order: "opsFirst", points: ["hedong", "hedong", "yiyang"] }) },
    then: [chuPlaces("chumieyue", ["ying", "ying"])],
    facts(st) {
      const card = "weiwei", points = ["hedong", "hedong", "yiyang"];
      const f = cardFacts(st, card);
      const where = [...new Set(points)].map((id) => ({ space: id, spaceZh: E.SPACE[id].zh, spaceEn: E.SPACE[id].en, n: points.filter((p) => p === id).length }));
      return {
        ...f, n: points.length, order: "opsFirst",
        bonus: f.ops - f.printed, // 商鞅變法 is still paying out this turn
        points: where, spacesZh: where.map((w) => w.spaceZh),
        space: points[0], spaceZh: E.SPACE[points[0]].zh, spaceEn: E.SPACE[points[0]].en,
      };
    },
  },
  {
    id: "campaign",
    spotlight: { space: "shangdang" },
    expect: { kind: "action", action: play(QIN, "zhangyi", "campaign", { target: "shangdang" }) },
    then: [chuPlaces("maling", ["qianzhong", "qianzhong", "qianzhong"])],
    facts(st) {
      const id = "shangdang", card = "zhangyi";
      const c = campaignFacts(st, id, card);
      return {
        ...spaceFacts(st, id), ...cardFacts(st, card), ...c, n: c.ops,
        weariness: st.weariness, wearinessNext: st.weariness - 1,
        from: E.WEARINESS_NAMES[st.weariness], to: E.WEARINESS_NAMES[st.weariness - 1],
      };
    },
  },
  {
    id: "lobby",
    spotlight: { space: "daliang" },
    expect: { kind: "action", action: play(QIN, "envoy", "lobby", { target: "daliang" }) },
    then: [chuPlaces("wuguo", ["qianzhong", "chencai", "chencai"])],
    facts(st) {
      const id = "daliang", card = "envoy", f = spaceFacts(st, id), o = E.opsOf(st, QIN, card);
      const edge = E.edge(st, QIN, id);
      const removed = edge > 0 ? Math.min(o, edge) : 0;
      const mine = E.SPACE[id].adj.filter((a) => E.controller(st, a) === QIN);
      const theirs = E.SPACE[id].adj.filter((a) => E.controller(st, a) === CHU);
      return {
        ...f, ...cardFacts(st, card), edge, removed, n: removed,
        mine: mine.length, theirs: theirs.length,
        mineZh: mine.map((a) => E.SPACE[a].zh), theirsZh: theirs.map((a) => E.SPACE[a].zh),
        from: f.chu, to: f.chu - removed,
      };
    },
  },
  {
    id: "scoring",
    spotlight: { card: "score_jin" },
    expect: { kind: "action", action: play(QIN, "score_jin", "event") },
    then: [chuPlaces("mozhe", ["huaisi"])],
    facts(st) {
      const region = "jin", R = E.REGIONS[region];
      const [q, c] = E.regionTally(st, region);
      return {
        ...cardFacts(st, "score_jin"),
        region, regionZh: R.zh, regionEn: R.en,
        presence: R.presence, domination: R.domination, control: R.control,
        qin: q.total, chu: c.total, delta: q.total - c.total, n: q.total - c.total,
        qinLevel: q.level, chuLevel: c.level,
        qinBase: q.base, chuBase: c.base,
        qinBonus: q.bonus, chuBonus: c.bonus, bonus: q.bonus,
        qinSpaces: q.spaces, chuSpaces: c.spaces, qinBg: q.bg, chuBg: c.bg,
        mandate: st.mandate, from: st.mandate, to: st.mandate + (q.total - c.total),
      };
    },
  },
  {
    id: "destroy",
    spotlight: { space: "xinzheng" },
    expect: { kind: "action", action: play(QIN, "hexi", "campaign", { target: "xinzheng" }) },
    then: [],
    facts(st) {
      const id = "xinzheng", card = "hexi", state = E.SPACE[id].state, S = E.STATES[state];
      const c = campaignFacts(st, id, card);
      const spaces = E.spacesOfState(state);
      return {
        ...spaceFacts(st, id), ...cardFacts(st, card), ...c,
        state, stateZh: S.zh, stateEn: S.en,
        spaces, spacesZh: spaces.map((s) => E.SPACE[s].zh),
        vp: S.vp, n: S.vp, mie: E.MIE_TO_WIN, have: Object.keys(st.mie).length,
        mandate: st.mandate, from: st.mandate, to: st.mandate + S.vp,
      };
    },
  },
];

export const STEP_IDS = STEPS.map((s) => s.id);

// ---------- walking the script ----------
export function stepAt(i) {
  const step = STEPS[i];
  if (!step) throw new Error(`tutorial: no lesson ${i}`);
  return step;
}
export function factsOf(st, i) { return stepAt(i).facts(st); }

// Apply lesson `i`: the player's action if it has one, then the script's
// answer. `E.apply` clones, so `st` is left alone and a lesson that only asks
// for a tap hands the same state back.
export function applyStep(st, i) {
  const step = stepAt(i);
  let next = st;
  if (step.expect.kind === "action") next = E.apply(next, step.expect.action);
  for (const action of step.then) next = E.apply(next, action);
  return next;
}

// Rebuild the position at lesson `i` from the start. This is Back: there is no
// undo in the engine, so the FE replays.
export function replayTo(i) {
  if (i < 0 || i > STEPS.length) throw new Error(`tutorial: no lesson ${i}`);
  let st = createTutorial();
  for (let k = 0; k < i; k++) st = applyStep(st, k);
  return st;
}

function same(a, b) {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).filter((k) => a[k] !== undefined);
  const kb = Object.keys(b).filter((k) => b[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => kb.includes(k) && same(a[k], b[k]));
}

// Is `action` the one thing this lesson allows? A tap arrives as
// { type: "tap", space | card } and never reaches the engine.
export function allows(step, action) {
  if (!action || typeof action !== "object") return false;
  if (step.expect.kind === "tap") {
    if (action.type !== "tap") return false;
    if (step.expect.space) return action.space === step.expect.space && action.card == null;
    return action.card === step.expect.card && action.space == null;
  }
  return same(action, step.expect.action);
}

// The gate. Anything but the lesson's own move is refused, legal or not, and
// the caller gets the lesson back in the message so the FE can say which one.
export function submit(st, i, action) {
  const step = stepAt(i);
  if (!allows(step, action)) throw new Error(`tutorial: lesson ${step.id} does not allow ${JSON.stringify(action)}`);
  return applyStep(st, i);
}
