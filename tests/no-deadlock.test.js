// Guard against engine deadlocks (orchestrator-owned, #55 and #57).
//
// 細作 names a card the opponent must play next. When that card left the hand first (a forced discard), the engine
// offered the side NO legal action: no card, no Cauldrons, every play refused. A human in that seat was stuck for good.
// Ruling (2026-09-20, #55): the obligation lapses when the named card is no longer in the hand.
// Ruling (2026-09-20, #57): 頓兵堅城 comes first: while a bog discard is owed and possible the round IS the discard, of any
// 2+ ops card; 細作 carries over to the next round unless the named card itself was discarded. And a side with an empty
// hand commits no headline.
//
// The invariant below is wider than those cards: whenever the engine says a side must act, it must also offer that
// side something it accepts. Games are driven by the shared fallback, which asks the engine for every candidate.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { fallbackFor, fallbackCandidates } from "../public/shared/fallback.js";

function runFrom(st0, label, maxSteps = 4000) {
  let st = st0, steps = 0;
  while (st.winner == null && steps < maxSteps) {
    const need = E.mustAct(st);
    if (!need.length) return { st, steps, stuck: `${label}: nobody must act at step ${steps} but the game is not over` };
    const side = need[0], fb = fallbackFor(st, side);
    if (!fb) {
      const L = E.legal(st, side);
      return { st, steps, stuck: `${label}, step ${steps}, turn ${st.turn} round ${st.round}: side ${side} must act but nothing is accepted (legal kind ${L.kind}, ${(L.cards || []).length} cards, bog ${JSON.stringify(L.bog || null)}, forced ${JSON.stringify(st.forced)}, hand ${st.hands[side].join(",")})` };
    }
    st = fb.state; steps++;
  }
  return { st, steps, stuck: st.winner == null ? `${label}: no winner after ${steps} steps` : null };
}
const run = (seed) => runFrom(E.createGame(seed), `seed ${seed}`);

test("seed 70: the named card is discarded before it can be played, and the game goes on", () => {
  const r = run(70);
  assert.equal(r.stuck, null, r.stuck || "");
  assert.notEqual(r.st.winner, null);
});

test("the seeds that ever stopped a game all finish (70, 1259, 1332, 1385)", () => {
  for (const seed of [70, 1259, 1332, 1385]) { const r = run(seed); assert.equal(r.stuck, null, r.stuck || ""); }
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
        if (L.kind === "action" && !(L.bog && L.bog.length)) {
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

// ---- #57: 頓兵堅城 and 細作 on the same side ----
// A real position: the first action round where the acting side holds two cards of 2+ ops and one of fewer, no bog, no name.
function bogPosition() {
  for (let seed = 1; seed <= 20; seed++) {
    let st = E.createGame(seed), steps = 0;
    while (st.winner == null && steps < 3000) {
      const side = E.mustAct(st)[0]; if (side == null) break;
      if (st.phase === "action" && !st.pending && side === st.actor && !st.forced[side] && !st.effects.some((e) => e.kind === "bog")) {
        const h = st.hands[side], big = h.filter((c) => E.CARD[c].ops >= 2), small = h.filter((c) => E.CARD[c].ops < 2);
        if (big.length >= 2 && small.length >= 1) return { st, side, big, small };
      }
      const fb = fallbackFor(st, side); if (!fb) break; st = fb.state; steps++;
    }
  }
  return null;
}
function withBogAndName(p, named) {
  const st = JSON.parse(JSON.stringify(p.st));
  st.effects.push({ card: "dunbing", side: 1 - p.side, kind: "bog", who: p.side, until: "game" });
  st.forced[p.side] = named;
  return st;
}
// the side's next own action round after `st` (the other side plays on fallbacks in between)
function toNextActionOf(st, side) {
  let s = st, guard = 0;
  while (s.winner == null && guard++ < 200) {
    const who = E.mustAct(s)[0]; if (who == null) return null;
    if (who === side && s.phase === "action" && !s.pending) return s;
    const fb = fallbackFor(s, who); if (!fb) return null; s = fb.state;
  }
  return null;
}

test("頓兵堅城 with a named card under 2 ops: every 2+ ops card is accepted as the discard, and the name carries over", () => {
  const p = bogPosition(); assert.ok(p, "no position found: widen the seeds");
  const named = p.small[0], st = withBogAndName(p, named);
  const L = E.legal(st, p.side);
  assert.deepEqual([...L.bog].sort(), [...p.big].sort(), "legal() does not offer the bog discards");
  for (const c of p.big) assert.doesNotThrow(() => E.apply(st, { type: "play", side: p.side, card: c, use: "bog" }), `the bog discard of ${c} is refused`);
  assert.throws(() => E.apply(st, { type: "play", side: p.side, card: named, use: "event" }), "the named card was accepted although a bog discard is owed");
  const after = E.apply(st, { type: "play", side: p.side, card: p.big[0], use: "bog" });
  assert.ok(!after.effects.some((e) => e.kind === "bog" && e.who === p.side), "the bog is still there after the discard");
  const next = toNextActionOf(after, p.side);
  assert.ok(next && next.hands[p.side].includes(named), "the position never came back to this side with the named card in hand: this check proves nothing, pick another position");
  const L2 = E.legal(next, p.side);
  assert.deepEqual(L2.cards.map((c) => c.id), [named], "the obligation did not carry over to the next action round");
  assert.equal(L2.jiuding, null, "the Cauldrons are offered although the named card is still owed");
});

test("頓兵堅城 with a named card of 2+ ops: discarding it ends both, discarding another keeps the name", () => {
  const p = bogPosition(); assert.ok(p, "no position found: widen the seeds");
  const named = p.big[0], otherBig = p.big[1], st = withBogAndName(p, named);
  for (const c of p.big) assert.doesNotThrow(() => E.apply(st, { type: "play", side: p.side, card: c, use: "bog" }), `the bog discard of ${c} is refused`);
  const gone = E.apply(st, { type: "play", side: p.side, card: named, use: "bog" });
  assert.equal(E.forcedCard(gone, p.side), null, "the named card was discarded to the bog but the obligation is still live");
  const kept = E.apply(st, { type: "play", side: p.side, card: otherBig, use: "bog" });
  assert.equal(E.forcedCard(kept, p.side), named, "another card was discarded to the bog and the obligation vanished");
});

test("the games from both bog positions finish on fallbacks", () => {
  const p = bogPosition(); assert.ok(p);
  for (const named of [p.small[0], p.big[0]]) { const r = runFrom(withBogAndName(p, named), `bog + ${named}`); assert.equal(r.stuck, null, r.stuck || ""); }
});

// ---- #57 B: the headline phase with an empty hand ----
test("a side with an empty hand at the headline phase does not stop the game", () => {
  let seen = 0;
  for (const seed of [2, 9]) {
    let st = E.createGame(seed), steps = 0;
    // reach the SECOND turn's headline phase on fallbacks, so the position is a real one
    while (st.winner == null && steps < 3000 && !(st.phase === "headline" && st.turn >= 2 && !st.pending)) { const fb = fallbackFor(st, E.mustAct(st)[0]); if (!fb) break; st = fb.state; steps++; }
    if (st.winner != null || st.phase !== "headline") continue;
    for (const empty of [E.QIN, E.CHU]) {
      const s = JSON.parse(JSON.stringify(st)); s.discard.push(...s.hands[empty].splice(0)); seen++;
      const r = runFrom(s, `seed ${seed}, side ${empty} has no card at the headline`); assert.equal(r.stuck, null, r.stuck || "");
    }
    // nobody has a card: no action exists that could move the table, so the engine's own runner has to end the phase.
    // A real game reaches this through run() (startTurn is one of its steps); the built position is put through it the same way.
    const s2 = JSON.parse(JSON.stringify(st)); for (const side of [E.QIN, E.CHU]) s2.discard.push(...s2.hands[side].splice(0)); seen++;
    const r2 = runFrom(E.run(s2), `seed ${seed}, nobody has a card at the headline`); assert.equal(r2.stuck, null, r2.stuck || "");
  }
  assert.ok(seen > 0, "never reached a second-turn headline phase: this test proves nothing");
});
