// The advisor (軍師). Two promises are worth more than the rest: the hand it
// points at is the hard bot's own hand (it invents no second evaluation), and
// it reads nothing the player cannot read. The third is that the "why" is a
// number out of the evaluation, not a sentence: every reason test below has a
// twin that breaks the condition and demands the key move.
//
// Constants here (the reason keys, the uses, the control rule, the scoring
// rule) are copied from the design (issue #17 and the rulebook), never read
// back out of the product.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import { advise } from "../public/shared/advisor.js";
import EN from "../public/i18n/en.js";
import ZH from "../public/i18n/zh-Hant.js";

const { QIN, CHU, CARD, SPACE, JIUDING } = E;

// issue #17, plus the bogDiscard key added by the orchestrator on 2026-09-19.
const REASON_KEYS = [
  "takeControl", "breakControl", "battleground", "scoringSoon", "destroyState",
  "nearDestroy", "seal", "denySeal", "mandate", "reform", "dumpEnemyEvent",
  "mustPlayScoring", "avoidCollapse", "bogDiscard", "best",
];
const USES = ["event", "place", "campaign", "lobby", "reform", "score", "bog", "headline"];
const ORDERS = ["opsFirst", "eventFirst"];

function opened(seed = 11) {
  let st = E.createGame(seed);
  st = E.apply(st, { type: "choose", side: QIN, choice: ["yiyang", "yiyang", "hedong", "hedong"] });
  st = E.apply(st, { type: "choose", side: CHU, choice: ["song", "song", "huaisi", "chencai"] });
  return st;
}
// A turn-1 action round with the hands dealt by hand.
function atAction(hands = [[], []], patch = {}) {
  const st = opened();
  st.draw = st.draw.concat(st.hands[0], st.hands[1]).filter((c) => !hands.flat().includes(c));
  st.hands = [hands[0].slice(), hands[1].slice()];
  Object.assign(st, { phase: "action", round: 1, actor: QIN, phasing: QIN, plan: [], pending: null, headline: [null, null] }, patch);
  return st;
}
const setInf = (st, map) => { for (const [id, pair] of Object.entries(map)) st.inf[id] = pair.slice(); };
// A board written out in full, so nothing but what is listed is on the map.
function board(hands, inf, patch = {}) {
  const st = atAction(hands, patch);
  st.inf = {};
  setInf(st, inf);
  return st;
}
// Qin at home and Chu at home, with nothing contested in between: the fixed
// backdrop the reason scenarios add one contested space to.
const QIN_HOME = { guanzhong: [6, 0], hangu: [5, 0], hanzhong: [3, 0], yiqu: [2, 0], yiyang: [4, 0] };
const CHU_HOME = { ying: [0, 6], chencai: [0, 2], huaisi: [0, 2], qianzhong: [0, 1] };

// Every promise that must hold at every decision point.
function checkShape(st, side, k) {
  const v = E.view(st, side);
  const adv = advise(v, side, E.makeRng(k));
  const want = B.decide(v, side, "hard", E.makeRng(k));
  if (want == null) { assert.equal(adv, null, "no hard move means no advice"); return 0; }
  assert.ok(adv, "there is a hard move, so there must be advice");
  assert.deepStrictEqual(adv.action, want, "the advice must be the hard bot's own move");
  assert.doesNotThrow(() => E.apply(st, adv.action), "the engine must accept the advised action");
  if (adv.card != null) {
    if (adv.card === JIUDING) assert.ok(E.jiudingUsable(st, side), "九鼎 advised but not usable");
    else assert.ok(st.hands[side].includes(adv.card), `${adv.card} is not in this side's hand`);
  }
  if (adv.action.type === "choose") {
    assert.equal(adv.card, null, "a pending choice names no card");
    assert.equal(adv.use, null, "a pending choice names no use");
  }
  assert.ok(adv.use === null || USES.includes(adv.use), `unknown use ${adv.use}`);
  assert.ok(adv.order === null || ORDERS.includes(adv.order), `unknown order ${adv.order}`);
  assert.ok(Array.isArray(adv.targets), "targets must be an array");
  for (const t of adv.targets) assert.ok(SPACE[t], `${t} is not a space on the board`);
  assert.ok(REASON_KEYS.includes(adv.reason.key), `unknown reason key ${adv.reason.key}`);
  // Playing the scoring card is never "get this region ready" -- the region is
  // being scored right now (orchestrator, #17).
  if (adv.use === "score") {
    assert.ok(["mandate", "mustPlayScoring"].includes(adv.reason.key),
      `a scoring card was played and the reason was ${adv.reason.key}`);
  }
  // The other headline is face down, so any story about the turn is a guess.
  if (adv.use === "headline") assert.equal(adv.reason.key, "best", "a headline's reason rests on a guess");
  assert.equal(typeof adv.reason.params, "object");
  for (const id of [adv.reason.params.space].filter(Boolean)) assert.ok(SPACE[id], `params.space ${id} is not a space`);
  for (const id of [adv.reason.params.state].filter(Boolean)) assert.ok(E.STATES[id], `params.state ${id} is not a state`);
  for (const id of [adv.reason.params.region].filter(Boolean)) assert.ok(E.REGIONS[id], `params.region ${id} is not a region`);
  return 1;
}

test("advisor: 20 seeded games, the advice is the hard bot's own legal move at every sampled point", () => {
  let checks = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const rng = E.makeRng(seed ^ 0x9e3779b9);
    let st = E.createGame(seed);
    let taken = 0;
    for (let step = 0; st.winner == null && step < 400 && taken < 4; step++) {
      const who = E.mustAct(st);
      if (!who.length) break;
      const side = who[rng.int(who.length)];
      if (step % 17 === 3) { taken++; checks += checkShape(st, side, seed * 1000 + step); }
      const a = B.randomAction(st, side, rng);
      if (!a) break;
      st = E.apply(st, a);
    }
  }
  console.log("advisor: checked", checks, "advices over 20 games");
  assert.ok(checks >= 60, `only ${checks} advices were reached`);
});

test("advisor: the headline, the opening placement and an event's pending all get advice", () => {
  const seen = new Set();
  for (let seed = 30; seed < 45 && seen.size < 3; seed++) {
    const rng = E.makeRng(seed);
    let st = E.createGame(seed);
    for (let step = 0; st.winner == null && step < 60; step++) {
      const who = E.mustAct(st);
      if (!who.length) break;
      const side = who[0];
      const kind = st.pending ? (st.pending.tag === "setup" ? "setup" : "pending") : st.phase;
      if (["setup", "pending", "headline"].includes(kind) && !seen.has(kind)) {
        seen.add(kind);
        assert.equal(checkShape(st, side, seed * 100 + step), 1, `${kind} produced no advice`);
        const adv = advise(E.view(st, side), side, E.makeRng(seed * 100 + step));
        if (kind === "headline") assert.equal(adv.use, "headline");
        if (kind === "setup") assert.ok(adv.targets.length > 0, "the opening placement must name spaces");
      }
      const a = B.decide(E.view(st, side), side, "normal", rng);
      if (!a) break;
      st = E.apply(st, a);
    }
  }
  assert.deepStrictEqual([...seen].sort(), ["headline", "pending", "setup"]);
});

test("advisor: swapping the hand the player cannot see changes nothing", () => {
  // What this pins: `view()` hides the other hand, and `advise` reads only the
  // view. The two views come out byte for byte identical -- that identity is
  // itself the assertion, and it is what makes the advice identical.
  const st1 = atAction([["shangyang", "hexi", "keqing"], ["mozhe", "wuqi", "wanbi"]], { turn: 3, round: 2 });
  const st2 = E.clone(st1);
  const swapped = st2.draw.splice(0, 3);
  st2.draw.push(...st2.hands[CHU]);
  st2.hands[CHU] = swapped;
  assert.notDeepStrictEqual(st1.hands[CHU], st2.hands[CHU], "the hidden hands must really differ");
  assert.equal(st1.hands[CHU].length, st2.hands[CHU].length);
  const v1 = E.view(st1, QIN), v2 = E.view(st2, QIN);
  assert.equal(v1.hands[CHU], null, "the view must hide the other hand");
  assert.deepStrictEqual(v1, v2, "the two positions look the same to Qin");
  const a1 = advise(v1, QIN, E.makeRng(55));
  const a2 = advise(v2, QIN, E.makeRng(55));
  assert.deepStrictEqual(a1, a2);
});

test("advisor: reason takeControl -- the engine agrees a space changed hands", () => {
  // 代 (stability 3, so control needs q >= c + 3) sits one point short, and it
  // is the only space on the board a single op can flip. Taking it puts Qin in
  // 北疆 for the first time: none -> presence, which is where the points are.
  const st = board([["envoy"], ["mozhe"]], { ...QIN_HOME, ...CHU_HOME, dai: [2, 0] }, { turn: 3, round: 2, weariness: 5 });
  assert.equal(E.controller(st, "dai"), null, "nobody controls 代 yet");
  assert.ok(!SPACE.dai.battleground, "代 is not a 要衝, so this is takeControl and not battleground");
  const adv = advise(E.view(st, QIN), QIN, E.makeRng(7));
  assert.equal(adv.reason.key, "takeControl");
  assert.ok(adv.targets.includes(adv.reason.params.space), "the named space must be one this hand touches");
  const after = E.apply(st, adv.action);
  assert.equal(E.controller(after, adv.reason.params.space), QIN, "the engine must agree Qin now controls it");
  // Twin: hand 代 to Qin up front, and with nothing left to flip the key moves.
  const st2 = board([["envoy"], ["mozhe"]], { ...QIN_HOME, ...CHU_HOME, dai: [5, 0] }, { turn: 3, round: 2, weariness: 5 });
  assert.equal(E.controller(st2, "dai"), QIN, "now it is already Qin's");
  const adv2 = advise(E.view(st2, QIN), QIN, E.makeRng(7));
  assert.notEqual(adv2.reason.key, "takeControl");
});

test("advisor: a 要衝 that changes hands is takeControl, not battleground", () => {
  // orchestrator, #17: control outranks everything else that can be said, so a
  // campaign that takes 邯鄲 -- a battleground, and the move that turns 三晉
  // from presence into domination -- still reads as taking control.
  const backdrop = { ...QIN_HOME, ...CHU_HOME, hedong: [3, 0], shangdang: [0, 4] };
  const st = board([["hexi"], ["mozhe"]], { ...backdrop, handan: [2, 1] }, { turn: 3, round: 2, weariness: 5 });
  assert.ok(SPACE.handan.battleground, "邯鄲 is a 要衝 in the rulebook's table");
  assert.equal(E.controller(st, "handan"), null);
  const adv = advise(E.view(st, QIN), QIN, E.makeRng(13));
  assert.equal(adv.reason.key, "takeControl");
  assert.equal(adv.reason.params.space, "handan");
  const after = E.apply(st, adv.action);
  assert.equal(E.controller(after, "handan"), QIN, "the engine must agree the 要衝 changed hands");
});

test("advisor: reason battleground -- aimed at a 要衝 without taking it", () => {
  // Qin holds no influence anywhere on this board, so there is nowhere to
  // place under either reach rule (#107 made "ts" the default: the fixture
  // used to lean on 河東 [4,4], which under "ts" opens 函谷關/上黨/邯鄲 next
  // door and gave the card a placement again). At 禍結 三晉 is shut to
  // campaigns, so the only ops this card has is a campaign on 宋 -- a 要衝
  // with no state behind it, where 4 Chu points keep control whatever one op
  // removes. Nothing changes hands, and the 要衝 is all there is to say.
  const inf = { hedong: [0, 4], song: [0, 4] };
  const patch = { turn: 3, round: 2, weariness: 3 };
  const st = board([["envoy"], ["mozhe"]], inf, patch);
  assert.ok(SPACE.song.battleground, "宋 is a 要衝");
  assert.equal(E.legal(st, QIN).cards[0].uses.place, null, "there is nowhere to place");
  const adv = advise(E.view(st, QIN), QIN, E.makeRng(2));
  assert.equal(adv.reason.key, "battleground");
  assert.ok(SPACE[adv.reason.params.space].battleground, "the named space must be a 要衝");
  const after = E.apply(st, adv.action);
  for (const sp of E.SPACES) {
    assert.equal(E.controller(after, sp.id), E.controller(st, sp.id), `${sp.id} changed hands`);
  }
  // Twin: the same position with 薛 in 宋's place. 薛 is not a 要衝, so with
  // nothing else moving the advisor has nothing to name.
  const st2 = board([["envoy"], ["mozhe"]], { hedong: [0, 4], xue: [0, 4] }, patch);
  assert.ok(!SPACE.xue.battleground, "薛 is not a 要衝");
  const adv2 = advise(E.view(st2, QIN), QIN, E.makeRng(2));
  assert.deepStrictEqual(adv2.targets, ["xue"]);
  assert.equal(adv2.reason.key, "best");
});

test("advisor: playing the scoring card reads from what the region pays", () => {
  // orchestrator, #17: the region is being scored right now, so this is never
  // scoringSoon. What it pays decides: a region that pays says Mandate, a
  // region that costs says the card simply had to leave the hand.
  const held = ["keqing", "hexi"], theirs = ["mozhe", "wuqi"];
  const last = { round: 6, rounds: 6 };
  for (const [card, region, want] of [["score_west", "west", "mandate"], ["score_jin", "jin", "mandate"],
    ["score_south", "south", "mustPlayScoring"], ["score_east", "east", "mustPlayScoring"],
    ["score_north", "north", "mustPlayScoring"]]) {
    const st = atAction([[card, ...held], theirs], last);
    const [q, c] = E.regionTally(st, region); // the engine's own tally, not the advisor's
    const net = q.total - c.total;
    assert.equal(net > 0, want === "mandate", `${region} net ${net} does not match the case`);
    const adv = advise(E.view(st, QIN), QIN, E.makeRng(21));
    assert.equal(adv.card, card);
    assert.equal(adv.use, "score");
    assert.equal(adv.reason.key, want, `${card} (net ${net})`);
    assert.equal(adv.reason.params.region, region);
    if (want === "mandate") assert.equal(adv.reason.params.n, net, "the Mandate moves by what the region paid");
  }
  // 北疆 is the boundary above: a net of exactly 0 is not a reason to celebrate.
  const [nq, nc] = E.regionTally(atAction([["score_north", ...held], theirs], last), "north");
  assert.equal(nq.total - nc.total, 0, "北疆 is the net-zero case, so it tests the boundary");
  // Twin: no scoring card in hand at all, so neither branch can be reached.
  const st2 = atAction([[...held], theirs], last);
  const adv2 = advise(E.view(st2, QIN), QIN, E.makeRng(21));
  assert.notEqual(adv2.use, "score");
  assert.notEqual(adv2.reason.key, "mustPlayScoring");
});

test("advisor: reason bogDiscard -- 頓兵堅城 leaves only the discard", () => {
  const st = atAction([["shangyang", "keqing", "wanbi"], ["mozhe", "wuqi"]], { turn: 7, round: 2 });
  st.effects.push({ card: "dunbing", side: CHU, kind: "bog", who: QIN, until: "game" });
  const adv = advise(E.view(st, QIN), QIN, E.makeRng(31));
  assert.equal(adv.use, "bog");
  assert.equal(adv.reason.key, "bogDiscard");
  assert.deepStrictEqual(adv.targets, []);
  assert.equal(adv.reason.params.card, adv.card);
  assert.ok(CARD[adv.card].ops >= 2, "the discard must be a card of 2+ ops");
  assert.ok(["shangyang", "keqing"].includes(adv.card), "wanbi is 1 ops and cannot be the discard");
  // Twin: lift the effect and the key moves.
  const st2 = E.clone(st);
  st2.effects = [];
  const adv2 = advise(E.view(st2, QIN), QIN, E.makeRng(31));
  assert.notEqual(adv2.reason.key, "bogDiscard");
  assert.notEqual(adv2.use, "bog");
});

test("advisor: the evaluation's named terms add back up to the evaluation", () => {
  // The advisor ranks reasons by these buckets; if they stop covering the
  // evaluation, the ranking is measuring something else.
  const cases = [
    atAction([["shangyang", "hexi"], ["mozhe", "wuqi"]]),
    atAction([["score_west", "keqing"], ["mozhe", "wuqi"]], { round: 6, rounds: 6 }),
    atAction([["hexi"], ["changping", "mozhe"]], { weariness: 2, actor: CHU, phasing: CHU }),
  ];
  for (const st of cases) {
    for (const side of [QIN, CHU]) {
      const terms = {};
      const v = B.evaluate(st, side, terms);
      let sum = 0;
      for (const [k, x] of Object.entries(terms)) if (!k.startsWith("$")) sum += x;
      assert.ok(Math.abs(sum - v) < 1e-9, `terms sum ${sum} != evaluate ${v}`);
    }
  }
});

test("advisor: instrumenting evaluate did not move the hard bot", () => {
  // Expectations captured from the build BEFORE the terms parameter existed
  // (f51e0f6), so this is a real before/after pin, not a snapshot of itself.
  const cases = [
    [atAction([["shangyang", "hexi"], ["mozhe", "wuqi"]]), QIN, 101,
      { type: "play", side: 0, card: "shangyang", use: "campaign", order: "opsFirst", target: "ying", why: "campaign:shangyang" }],
    [atAction([["score_west", "keqing", "hexi"], ["mozhe", "wuqi"]], { round: 6, rounds: 6 }), QIN, 102,
      { type: "play", side: 0, card: "score_west", use: "event", why: "event:score_west" }],
    [atAction([["hexi", "keqing"], ["changping", "mozhe", "wuqi"]], { weariness: 2, actor: CHU, phasing: CHU }), CHU, 103,
      { type: "play", side: 1, card: "jiuding", use: "place", points: ["xinzheng", "xinzheng", "daliang", "daliang", "xinzheng"], why: "place:jiuding" }],
    [atAction([["poying", "yuyu", "wanbi"], ["mozhe", "wuqi", "score_jin"]], { turn: 4, round: 3 }), QIN, 104,
      { type: "play", side: 0, card: "poying", use: "campaign", order: "opsFirst", target: "song", why: "campaign:poying" }],
  ];
  for (const [st, side, k, want] of cases) {
    assert.deepStrictEqual(B.decide(E.view(st, side), side, "hard", E.makeRng(k)), want, `case k=${k}`);
  }
  const values = [4.6062499999999975, 0.8562499999999971, -7.756249999999998, 7.443749999999996];
  cases.forEach(([st, side], i) => assert.equal(B.evaluate(st, side), values[i], `evaluate case ${i}`));
});

test("advisor: a hard decision on a midgame position stays inside the phone budget", () => {
  const st = atAction([["shangyang", "hexi", "keqing", "poying", "ximin"], ["mozhe", "wuqi", "wanbi", "yuyu"]], { turn: 4, round: 3 });
  setInf(st, { handan: [2, 1], daliang: [1, 2], shangdang: [3, 1], song: [1, 2], linzi: [0, 3] });
  const v = E.view(st, QIN);
  advise(v, QIN, E.makeRng(1)); // warm
  const ms = [];
  for (let i = 0; i < 5; i++) {
    const t0 = process.hrtime.bigint();
    advise(v, QIN, E.makeRng(200 + i));
    ms.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  ms.sort((a, b) => a - b);
  console.log(`advisor: advise on a midgame position ${ms.map((x) => x.toFixed(0)).join("/")} ms (median ${ms[2].toFixed(0)})`);
  assert.ok(ms[2] < 3000, `median ${ms[2]} ms is far past anything a phone can hide`);
});

test("advisor: every reason key has a line of copy in both languages, and no line is spare", () => {
  // The key list above is copied from the design; these two are the writer's
  // (#19). A key the advisor can return with nothing to say, or a line nothing
  // can ever reach, is the same bug seen from two sides.
  const want = [...REASON_KEYS].sort();
  assert.deepStrictEqual(Object.keys(EN.advisor.reasons).sort(), want);
  assert.deepStrictEqual(Object.keys(ZH.advisor.reasons).sort(), want);
  // Every use the advisor can return is one the copy knows how to phrase.
  for (const u of USES) {
    if (u === "headline") { assert.ok(EN.advisor.suggestHeadline && ZH.advisor.suggestHeadline); continue; }
    assert.ok(EN.advisor.suggestUse[u], `en has no copy for use ${u}`);
    assert.ok(ZH.advisor.suggestUse[u], `zh has no copy for use ${u}`);
  }
});

test("advisor: no advice when it is not this side's decision", () => {
  const st = atAction([["shangyang"], ["mozhe"]]);
  assert.equal(advise(E.view(st, CHU), CHU, E.makeRng(1)), null, "Qin is the actor");
  const over = E.clone(st);
  over.winner = QIN; over.phase = "over";
  assert.equal(advise(E.view(over, QIN), QIN, E.makeRng(1)), null, "the game is over");
});

test("advisor: without an rng the same position gives the same advice twice", () => {
  const st = atAction([["shangyang", "hexi", "keqing"], ["mozhe", "wuqi"]], { turn: 3, round: 2 });
  const v = E.view(st, QIN);
  assert.deepStrictEqual(advise(v, QIN), advise(v, QIN), "the advice must not flicker between renders");
});
