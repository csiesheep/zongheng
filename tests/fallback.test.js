// Guard for the shared fallback (orchestrator-owned, #53).
//
// When a bot's action is refused, the room (#25) and the solo game (#53) play a fallback instead of hanging.
// The fallback is only worth anything if it is ALWAYS something the engine accepts, in every kind of position,
// and if asking for one can never itself throw. public/shared/fallback.js decides that, without a DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import { fallbackFor } from "../public/shared/fallback.js";

// A whole game in which EVERY decision is the fallback's: the strongest statement that it is always legal.
function playOnFallbacks(seed, maxSteps = 4000) {
  let st = E.createGame(seed); const kinds = new Set(); let steps = 0;
  while (st.winner == null && steps < maxSteps) {
    const need = E.mustAct(st); assert.ok(need.length > 0, `seed ${seed}: nobody must act but the game is not over`);
    const side = need[0]; const L = E.legal(st, side);
    kinds.add(L.kind === "pending" ? "pending:" + L.pending.kind : L.kind);
    const fb = fallbackFor(st, side);
    assert.ok(fb, `seed ${seed}, step ${steps}: no fallback for side ${side} in ${L.kind}${L.pending ? "/" + L.pending.kind : ""}`);
    // what it returns is what the engine itself produces for that action
    assert.deepEqual(fb.state, E.apply(st, fb.action), `seed ${seed}, step ${steps}: the returned state is not E.apply(state, action)`);
    st = fb.state; steps++;
  }
  return { st, kinds, steps };
}

test("a game played entirely on fallbacks reaches its end: every fallback is accepted by the engine", () => {
  const seen = new Set();
  for (const seed of [1, 7, 42]) {
    const { st, kinds, steps } = playOnFallbacks(seed);
    assert.notEqual(st.winner, null, `seed ${seed}: no winner after ${steps} fallbacks`);
    // a safety net must not lose the game by its own neglect: a scoring card in the hand is played first (#53)
    assert.notEqual(st.reason, "scoring", `seed ${seed}: the side carried by fallbacks lost for holding a scoring card (turn ${st.turn})`);
    for (const k of kinds) seen.add(k);
  }
  // the three games between them visit every kind of decision the fallback exists for; otherwise this test proves little
  for (const k of ["headline", "action", "pending:points", "pending:option", "pending:ops", "pending:card"]) assert.ok(seen.has(k), `never visited ${k}: ${[...seen].join(", ")}`);
});

test("it answers the pending kinds a real game produces", () => {
  // bots play, and whenever a pending choice comes up the fallback must have an answer for the side that owes it
  const seen = new Set();
  for (const seed of [3, 11, 19, 23]) {
    let st = E.createGame(seed); const rng = E.makeRng(seed);
    for (let i = 0; i < 1500 && st.winner == null; i++) {
      const side = E.mustAct(st)[0]; const L = E.legal(st, side);
      if (L.kind === "pending") { seen.add(L.pending.kind); const fb = fallbackFor(st, side); assert.ok(fb, `seed ${seed}: no fallback for a pending ${L.pending.kind}`); assert.equal(fb.action.type, "choose"); }
      st = E.apply(st, B.decide(E.view(st, side), side, "easy", rng));
    }
  }
  assert.ok(seen.size >= 2, `only saw pending kinds: ${[...seen].join(", ")}`);
});

test("asking can never throw: a finished game, a side that does not have to act, no state", () => {
  let st = E.createGame(5);
  const idle = [E.QIN, E.CHU].find((s) => !E.mustAct(st).includes(s));
  if (idle != null) assert.doesNotThrow(() => fallbackFor(st, idle));
  const over = playOnFallbacks(5).st;
  assert.doesNotThrow(() => fallbackFor(over, E.QIN));
  assert.equal(fallbackFor(over, E.QIN), null, "a finished game has no fallback");
  assert.doesNotThrow(() => fallbackFor(null, E.QIN));
  assert.equal(fallbackFor(null, E.QIN), null);
});

test("it does not change the state it is given", () => {
  const st = E.createGame(9); const before = JSON.stringify(st);
  fallbackFor(st, E.mustAct(st)[0]);
  assert.equal(JSON.stringify(st), before);
});
