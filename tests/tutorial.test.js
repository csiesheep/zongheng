// The tutorial script (public/shared/tutorial.js) walked on the real engine.
// Every number expected here is read off the rulebook / board data, never off
// tutorial.js: stability 2 at 宜陽・新鄭・河東・大梁・上黨・邯鄲, cap = stability + 2,
// 三晉 presence 4 / domination 8, 韓 = 宜陽 + 新鄭 worth 2, 疲敝 5 承平 → 4 兵連.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { createTutorial, STEPS, STEP_IDS, applyStep, submit, factsOf, replayTo } from "../public/shared/tutorial.js";

const { QIN, CHU } = E;
const inf = (st, id) => E.infOf(st, id);

// states[i] is the position the player sees at lesson i + 1; states[10] is the end.
function walk() {
  const states = [createTutorial()];
  for (let i = 0; i < STEPS.length; i++) states.push(applyStep(states[i], i));
  return states;
}

test("tutorial: the ten lessons keep the ids and the order the FE and the writer were given", () => {
  assert.deepEqual(STEP_IDS, ["map", "control", "hand", "place", "event", "enemyCard", "campaign", "lobby", "scoring", "destroy"]);
  assert.deepEqual(STEPS.map((s) => s.id), STEP_IDS);
  for (const s of STEPS) {
    assert.ok(s.expect && (s.expect.kind === "tap" || s.expect.kind === "action"), `${s.id}: expect`);
    assert.ok(Array.isArray(s.then), `${s.id}: then`);
    assert.equal(typeof s.facts, "function", `${s.id}: facts`);
    if (s.spotlight) assert.ok(s.spotlight.space || s.spotlight.card || s.spotlight.track, `${s.id}: spotlight`);
  }
});

test("tutorial: the opening position is a legal engine state, fixed, with Qin to act", () => {
  const a = createTutorial(), b = createTutorial();
  assert.deepEqual(a, b, "createTutorial must not depend on anything random");
  assert.equal(a.winner, null);
  assert.equal(a.phase, "action");
  assert.deepEqual(E.mustAct(a), [QIN]);
  assert.equal(E.legal(a, QIN).kind, "action");
  assert.equal(a.pending, null);
  assert.deepEqual(a.plan, []);
  assert.equal(a.weariness, 5, "承平");
  assert.equal(a.mandate, 0);
  assert.deepEqual(a.mie, {});
  assert.deepEqual(a.seals, {});
  for (const s of E.SPACES) {
    const [q, c] = inf(a, s.id);
    assert.ok(q >= 0 && c >= 0, `${s.id}: negative influence`);
    assert.ok(q <= s.stability + a.options.cap, `${s.id}: Qin over the cap`);
    assert.ok(c <= s.stability + a.options.cap, `${s.id}: Chu over the cap`);
  }
});

test("tutorial: every scripted action is accepted by the real engine and the game is still running at the end", () => {
  const states = walk();
  const end = states[10];
  assert.equal(end.winner, null, "the tutorial must not end the game");
  assert.ok(end.mie.han, "韓 destroyed");
  assert.equal(Object.keys(end.mie).length, 1, "only 韓");
  assert.deepEqual(end.hands[QIN], [], "Qin spends exactly the scripted hand");
  assert.ok(end.hands[CHU].length > 0, "Chu keeps a card so the engine parks on Chu's action");
  assert.equal(end.phase, "action");
  assert.equal(end.actor, CHU);
  assert.ok(end.round <= end.rounds, `round ${end.round} of ${end.rounds}: the turn must not roll over`);
  assert.equal(end.turn, 1);
});

test("tutorial 1 map / 3 hand: a tap changes nothing", () => {
  const states = walk();
  assert.deepEqual(states[1], states[0], "lesson 1 is a tap");
  assert.deepEqual(states[3], states[2], "lesson 3 is a tap");
  assert.equal(STEPS[0].expect.space, "guanzhong");
  assert.equal(STEPS[2].expect.card, STEPS[3].expect.action.card, "lesson 3 taps the card lesson 4 spends");
});

test("tutorial 2 control: 宜陽 is Qin's, and the numbers on screen are the numbers in the state", () => {
  const st = walk()[1];
  assert.equal(E.controller(st, "yiyang"), QIN);
  const f = factsOf(st, 1);
  assert.equal(f.space, "yiyang");
  assert.deepEqual([f.qin, f.chu, f.stability], [3, 0, 2], "3 ≥ 0 + 2");
  assert.ok(f.qin >= f.chu + f.stability);
  assert.equal(f.cap, 4, "stability 2 + 2");
  assert.equal(f.controller, "qin");
});

test("tutorial 4 place: Qin takes a city it did not hold, and 韓 survives to lesson 10", () => {
  const states = walk();
  const before = states[3], after = states[4];
  const target = STEPS[3].expect.action.points[0];
  assert.equal(E.controller(before, target), null, `${target} must not already be Qin's`);
  assert.equal(E.controller(after, target), QIN);
  assert.ok(!E.spacesOfState("han").includes(target), "orchestrator's ruling: lesson 4 may not be a 韓 city");
  assert.ok(!after.mie.han, "韓 must not fall in lesson 4");
  assert.notEqual(E.controller(after, "xinzheng"), QIN, "新鄭 is kept for lesson 10");
});

test("tutorial 5 event: 商鞅變法 advances the reform track by one box", () => {
  const states = walk();
  const before = states[4], after = states[5];
  assert.equal(STEPS[4].expect.action.use, "event");
  assert.equal(before.reform[QIN], 0);
  assert.equal(after.reform[QIN], 1, "box 1 徙木立信");
  assert.equal(after.reformFirst[1], QIN);
  assert.equal(after.mandate, before.mandate + 1, "first into box 1 scores 1");
});

test("tutorial 6 enemyCard: a Chu card spent for its ops, and its event fires anyway", () => {
  const states = walk();
  const before = states[5], after = states[6];
  const card = STEPS[5].expect.action.card;
  assert.equal(E.CARD[card].side, CHU, "the lesson needs an enemy card");
  assert.notEqual(STEPS[5].expect.action.order, "eventFirst", "the design says ops first");
  // 圍魏救趙: Chu places 1 in 邯鄲. The event ran even though Qin took the ops.
  assert.equal(inf(after, "handan")[CHU], inf(before, "handan")[CHU] + 1, "the enemy event happened");
  assert.equal(E.controller(after, "handan"), QIN, "Qin still holds 邯鄲 — lesson 8 leans on it");
  const spent = STEPS[5].expect.action.points.length;
  assert.equal(spent, E.opsOf(before, QIN, card), "the lesson spends the card's full ops");
});

test("tutorial 7 campaign: 上黨 changes hands and the realm tires from 承平 to 兵連", () => {
  const states = walk();
  const before = states[6], after = states[7];
  const target = STEPS[6].expect.action.target;
  assert.equal(STEPS[6].expect.action.use, "campaign");
  assert.ok(E.SPACE[target].battleground, `${target} must be a battleground to tire the realm`);
  assert.ok(inf(before, target)[CHU] > 0, "a campaign needs enemy influence");
  assert.equal(E.controller(before, target), CHU);
  assert.equal(E.controller(after, target), QIN);
  assert.equal(inf(after, target)[CHU], 0);
  assert.equal(before.weariness, 5);
  assert.equal(after.weariness, 4, "承平 → 兵連");
  assert.equal(E.WEARINESS_NAMES[before.weariness], "承平");
  assert.equal(E.WEARINESS_NAMES[after.weariness], "兵連");
});

test("tutorial 8 lobby: a positive edge takes Chu points off, places nothing and tires nobody", () => {
  const states = walk();
  const before = states[7], after = states[8];
  const target = STEPS[7].expect.action.target;
  assert.equal(STEPS[7].expect.action.use, "lobby");
  const edge = E.edge(before, QIN, target);
  assert.ok(edge > 0, `edge at ${target} must be positive, got ${edge}`);
  const ops = E.opsOf(before, QIN, STEPS[7].expect.action.card);
  assert.equal(inf(after, target)[CHU], inf(before, target)[CHU] - Math.min(ops, edge), "remove min(ops, edge)");
  assert.equal(inf(after, target)[QIN], inf(before, target)[QIN], "lobby places nothing");
  assert.equal(after.weariness, before.weariness, "lobby tires nobody");
});

test("tutorial 9 scoring: 三晉記分 moves the Mandate toward Qin with a battleground bonus above zero", () => {
  const states = walk();
  const before = states[8], after = states[9];
  const [q, c] = E.regionTally(before, "jin");
  assert.ok(q.bonus > 0, "the +1 per battleground must not read 0 on screen");
  assert.equal(q.bonus, q.bg);
  assert.equal(q.level, "domination");
  assert.equal(q.base, 8, "三晉 domination is 8");
  assert.equal(c.base, 4, "三晉 presence is 4");
  assert.ok(after.mandate > before.mandate, "the Mandate moves toward Qin");
  assert.equal(after.mandate - before.mandate, q.total - c.total);
});

test("tutorial 10 destroy: Qin holds every city of 韓, 韓 falls, Qin scores 2, the game goes on", () => {
  const states = walk();
  const before = states[9], after = states[10];
  assert.ok(!before.mie.han, "韓 is still standing when lesson 10 starts");
  for (const id of E.spacesOfState("han")) assert.equal(E.controller(after, id), QIN, id);
  assert.ok(after.mie.han);
  assert.equal(after.mandate - before.mandate, 2, "韓 is worth 2");
  assert.equal(after.winner, null, "one state of the three: no unification yet");
  assert.ok(Object.keys(after.mie).length < E.MIE_TO_WIN);
});

test("tutorial: every lesson refuses a legal engine action that is not the one it teaches", () => {
  const states = walk();
  // A legal play at that moment that the lesson does not ask for.
  const wrong = (i) => {
    const card = i <= 6 ? "envoy" : i === 7 ? "score_jin" : "hexi";
    return { type: "play", side: QIN, card, use: "event" };
  };
  for (let i = 0; i < STEPS.length; i++) {
    const st = states[i], w = wrong(i);
    assert.doesNotThrow(() => E.apply(st, w), `${STEPS[i].id}: the probe must itself be legal`);
    assert.throws(() => submit(st, i, w), /tutorial/, `${STEPS[i].id}: the gate let the wrong action through`);
    if (STEPS[i].expect.kind === "tap") {
      const t = STEPS[i].expect;
      assert.throws(() => submit(st, i, { type: "tap", space: "hangu" }), /tutorial/, `${STEPS[i].id}: wrong tap`);
      assert.doesNotThrow(() => submit(st, i, { type: "tap", ...(t.space ? { space: t.space } : { card: t.card }) }));
    } else {
      assert.doesNotThrow(() => submit(st, i, STEPS[i].expect.action), `${STEPS[i].id}: the gate refused its own action`);
    }
  }
});

test("tutorial: facts are read off the state, not copied into the script", () => {
  const st = createTutorial();
  assert.equal(factsOf(st, 1).qin, 3);
  st.inf.yiyang[0] = 2;
  assert.equal(factsOf(st, 1).qin, 2, "facts.qin must follow the board");
  assert.equal(factsOf(st, 1).controller, "qin", "2 against 0 at stability 2 is still control");
  st.inf.yiyang[0] = 1;
  assert.equal(factsOf(st, 1).qin, 1);
  assert.equal(factsOf(st, 1).controller, null, "1 against 0 at stability 2 is not control");
});

test("tutorial: replayTo rebuilds any lesson from the start, which is how Back works", () => {
  const states = walk();
  for (let i = 0; i <= STEPS.length; i++) assert.deepEqual(replayTo(i), states[i], `replay to ${i}`);
});
