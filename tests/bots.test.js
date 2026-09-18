// The bot never breaks the rules, never walks into a loss it can see, and
// plays the scoring card it holds before the turn ends.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import { playGame } from "./sim.js";

const { QIN, CHU } = E;

function atAction(hands = [[], []], patch = {}) {
  let st = E.createGame(11);
  st = E.apply(st, { type: "choose", side: QIN, choice: ["yiyang", "yiyang", "hedong", "hedong"] });
  st = E.apply(st, { type: "choose", side: CHU, choice: ["song", "song", "huaisi", "chencai"] });
  st.draw = st.draw.concat(st.hands[0], st.hands[1]).filter((c) => !hands.flat().includes(c));
  st.hands = [hands[0].slice(), hands[1].slice()];
  Object.assign(st, { phase: "action", round: 1, actor: QIN, phasing: QIN, plan: [], pending: null, headline: [null, null] }, patch);
  return st;
}

test("bots: normal against normal finishes games legally, from views only", () => {
  const ends = {};
  for (const seed of [1, 2, 3]) {
    const { st } = playGame(seed, { qin: "normal", chu: "normal" });
    assert.ok(st.winner === 0 || st.winner === 1, `seed ${seed}`);
    ends[st.reason] = (ends[st.reason] || 0) + 1;
  }
  console.log("bots: endings", ends);
});

test("bots: easy and hard also finish a game", () => {
  const a = playGame(5, { qin: "easy", chu: "hard" });
  assert.ok(a.st.winner != null);
  const b = playGame(6, { qin: "hard", chu: "easy" });
  assert.ok(b.st.winner != null);
});

test("bots: with the realm at 民困, Chu does not spend 長平之戰 when it holds another card", () => {
  const st = atAction([["hexi", "keqing"], ["changping", "mozhe", "wuqi"]], { weariness: 2, actor: CHU, phasing: CHU });
  const rng = E.makeRng(3);
  for (let i = 0; i < 5; i++) {
    const a = B.decide(E.view(st, CHU), CHU, "normal", rng);
    assert.notEqual(a.card, "changping", "playing it in any way collapses the realm on Chu");
    assert.doesNotThrow(() => E.apply(st, a));
  }
});

test("bots: a scoring card in hand is played before the turn runs out", () => {
  const st = atAction([["score_west", "keqing", "hexi"], ["mozhe", "wuqi"]], { round: 6, rounds: 6 });
  const a = B.decide(E.view(st, QIN), QIN, "normal", E.makeRng(1));
  assert.equal(a.card, "score_west");
  assert.equal(a.use, "event");
});

test("bots: a headline is chosen from the hand and is legal", () => {
  let st = E.createGame(21);
  const rng = E.makeRng(2);
  while (st.phase === "setup" || st.pending) {
    const who = st.pending.who;
    st = E.apply(st, B.decide(E.view(st, who), who, "normal", rng));
  }
  assert.equal(st.phase, "headline");
  const a = B.decide(E.view(st, QIN), QIN, "normal", rng);
  assert.equal(a.type, "headline");
  assert.ok(st.hands[QIN].includes(a.card));
  assert.doesNotThrow(() => E.apply(st, a));
});

test("bots: greedy placement spends the ops within reach and the engine accepts it", () => {
  const st = atAction([["shangyang"], ["mozhe"]]);
  const points = B.greedyPlacement(st, QIN, 3);
  assert.equal(points.length, 3);
  assert.doesNotThrow(() => E.apply(st, { type: "play", side: QIN, card: "shangyang", use: "place", points }));
});

test("bots: determinize yields a state the engine plays on, with the other hand the right size", () => {
  const st = atAction([["hexi", "keqing"], ["mozhe", "wuqi", "score_jin"]]);
  const d = B.determinize(E.view(st, QIN), QIN, E.makeRng(9));
  assert.equal(d.hands[CHU].length, 3);
  assert.ok(!d.hands[CHU].includes("hexi") && !d.hands[CHU].includes("keqing"));
  assert.ok(Array.isArray(d.draw) && d.draw.length > 0);
  assert.doesNotThrow(() => E.apply(d, { type: "play", side: QIN, card: "hexi", use: "event" }));
});
