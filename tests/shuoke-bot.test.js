// #115 (orchestrator's addition), BE. 說客 played alone as its event does
// nothing: its text only describes the pairing, and its effect is empty. The
// bots offered it like any other event -- the easy bot picked it at random
// (and fell back to it when a pair had no ops to spend), the normal and hard
// bots scored it among their candidates. A dead play must not be chosen while
// anything else is legal; when it is the ONLY legal play, it is still offered.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

function firstAction(seed) {
  let st = E.createGame(seed);
  const rng = E.makeRng(seed);
  for (let g = 0; g < 50 && (st.phase !== "action" || st.pending); g++) {
    const who = E.mustAct(st)[0];
    st = E.apply(st, B.decide(E.view(st, who), who, "easy", rng));
  }
  return st;
}
function give(st, side, card) {
  for (const s of [0, 1]) st.hands[s] = st.hands[s].filter((x) => x !== card);
  for (const k of ["draw", "discard", "removed"]) st[k] = st[k].filter((x) => x !== card);
  for (const k of Object.keys(st.later)) st.later[k] = st.later[k].filter((x) => x !== card);
  st.hands[side].push(card);
}
const isDead = (a) => a && a.type === "play" && a.card === "shuoke" && !a.pair && a.use === "event";

test("the easy bot never plays 說客 alone as its event while it has other plays (200 draws)", () => {
  const st = firstAction(4);
  const side = st.actor;
  give(st, side, "shuoke");
  st.hands[side] = ["shuoke", ...st.hands[side].filter((c) => c !== "shuoke").slice(0, 2)];
  let dead = 0;
  for (let k = 0; k < 200; k++) if (isDead(B.decide(E.view(st, side), side, "easy", E.makeRng(k)))) dead++;
  assert.equal(dead, 0, `the dead play was chosen ${dead} times in 200`);
});

test("the normal and hard bots do not even consider 說客 alone as its event while other plays exist", () => {
  const st = firstAction(4);
  const side = st.actor;
  give(st, side, "shuoke");
  const cands = B.scoreCandidates(E.view(st, side), side, E.makeRng(1), "normal");
  assert.ok(cands.length > 1);
  assert.ok(!cands.some((c) => isDead(c.a)), "a dead 說客 event is among the candidates");
});

test("when 說客 alone is the only card and nothing can take its op, the bot still plays it (as its event)", () => {
  const st = firstAction(4);
  const side = st.actor;
  st.hands[side] = [];
  give(st, side, "shuoke");
  st.jiuding = { holder: 1 - side, faceDown: true };
  // Nowhere to place, nothing to campaign or lobby: take every point of influence off the board for both sides.
  for (const sp of E.SPACES) st.inf[sp.id] = [0, 0];
  const L = E.legal(st, side);
  assert.equal(L.kind, "action");
  for (const level of ["easy", "normal", "hard"]) {
    const a = B.decide(E.view(st, side), side, level, E.makeRng(2));
    assert.ok(isDead(a), `${level}: the only legal play is made`);
  }
});
