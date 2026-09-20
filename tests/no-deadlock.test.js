// Guard against engine deadlocks (orchestrator-owned, #55).
//
// 細作 names a card the opponent must play next. When that card left the hand first (a forced discard), the engine
// offered the side NO legal action: no card, no Cauldrons, every play refused. A human in that seat was stuck for good.
// Ruling (2026-09-20): the obligation lapses when the named card is no longer in the hand.
//
// The invariant below is wider than that one card: whenever the engine says a side must act, it must also offer that
// side something it accepts. Games are driven by the shared fallback, which asks the engine for every candidate.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { fallbackFor, fallbackCandidates } from "../public/shared/fallback.js";

function run(seed, maxSteps = 4000) {
  let st = E.createGame(seed), steps = 0;
  while (st.winner == null && steps < maxSteps) {
    const need = E.mustAct(st);
    if (!need.length) return { st, steps, stuck: `nobody must act at step ${steps} but the game is not over` };
    const side = need[0], fb = fallbackFor(st, side);
    if (!fb) {
      const L = E.legal(st, side);
      return { st, steps, stuck: `seed ${seed}, step ${steps}, turn ${st.turn} round ${st.round}: side ${side} must act but nothing is accepted (legal kind ${L.kind}, ${(L.cards || []).length} cards, forced ${JSON.stringify(st.forced)}, hand ${st.hands[side].join(",")})` };
    }
    st = fb.state; steps++;
  }
  return { st, steps, stuck: st.winner == null ? `seed ${seed}: no winner after ${steps} steps` : null };
}

test("seed 70: the named card is discarded before it can be played, and the game goes on", () => {
  const r = run(70);
  assert.equal(r.stuck, null, r.stuck || "");
  assert.notEqual(r.st.winner, null);
});

test("whenever a side must act, the engine offers it something it accepts (120 games on fallbacks)", () => {
  const stops = [];
  for (let seed = 1; seed <= 120; seed++) { const r = run(seed); if (r.stuck) stops.push(r.stuck); }
  assert.deepEqual(stops, []);
});

test("a named card that is still in the hand is still the only card that may be played", () => {
  // the ruling must not dissolve the rule itself: find a position where a force is live and check legal() honours it
  let seen = 0;
  for (let seed = 1; seed <= 60 && seen < 3; seed++) {
    let st = E.createGame(seed), steps = 0;
    while (st.winner == null && steps < 4000) {
      const side = E.mustAct(st)[0]; if (side == null) break;
      const named = st.forced && st.forced[side];
      if (named && st.phase === "action" && st.hands[side].includes(named)) {
        const L = E.legal(st, side);
        if (L.kind === "action") {
          seen++;
          assert.deepEqual(L.cards.map((c) => c.id), [named], `seed ${seed}, step ${steps}: the side may play something other than the named card`);
          assert.equal(L.jiuding, null, `seed ${seed}, step ${steps}: the Cauldrons are offered although a card is named`);
          for (const a of fallbackCandidates(st, side)) if (a.type === "play" && a.card !== named) assert.throws(() => E.apply(st, a), `seed ${seed}: ${a.card} was accepted although ${named} is named`);
        }
      }
      const fb = fallbackFor(st, side); if (!fb) break; st = fb.state; steps++;
    }
  }
  assert.ok(seen > 0, "no position with a live named card was reached in 60 games: this test proves nothing, widen the seeds");
});
