// Guard: legal() and play() must agree (orchestrator-owned, #59).
//
// Twice in one day the two were found to disagree: a bog discard that legal() offered and play() refused (#57, a deadlock),
// and the Nine Cauldrons that legal() did not offer and play() accepted in a 頓兵堅城 round (#59: the round was spent and the
// bog was still owed). The table's UI and the bots read legal(), so only a hand-written room message could use the second
// one; the engine is the referee all the same.
//
// This file checks the side that the no-deadlock guard does not: what legal() does NOT offer in an action round is refused.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { fallbackFor } from "../public/shared/fallback.js";

const SPACES = Object.keys(E.SPACE);
// every shape a Cauldrons play can take, without asking legal() what is sensible: if any of them is accepted, the Cauldrons were playable
function* cauldronPlays(side) {
  for (const s of SPACES) {
    yield { type: "play", side, card: E.JIUDING, use: "place", points: [s] };
    yield { type: "play", side, card: E.JIUDING, use: "campaign", target: s };
    yield { type: "play", side, card: E.JIUDING, use: "lobby", target: s };
  }
}
const accepted = (st, a) => { try { E.apply(st, a); return true; } catch { return false; } };
const refusal = (st, a) => { try { E.apply(st, a); return null; } catch (e) { return e.message; } };

// every quiet action-round position of the first `games` fallback games
function* positions(games) {
  for (let seed = 1; seed <= games; seed++) {
    let st = E.createGame(seed), steps = 0;
    while (st.winner == null && steps < 4000) {
      const side = E.mustAct(st)[0]; if (side == null) break;
      if (st.phase === "action" && !st.pending && side === st.actor) yield { st, side, seed, steps };
      const fb = fallbackFor(st, side); if (!fb) break; st = fb.state; steps++;
    }
  }
}

test("a 頓兵堅城 round with usable Cauldrons: the Cauldrons are refused with the bog's message, the discards are accepted", () => {
  let built = null;
  for (const p of positions(6)) { const big = p.st.hands[p.side].filter((c) => E.CARD[c].ops >= 2); if (big.length >= 2 && !p.st.forced[p.side] && !p.st.effects.some((e) => e.kind === "bog")) { built = { ...p, big }; break; } }
  assert.ok(built, "no position found: widen the seeds");
  const st = JSON.parse(JSON.stringify(built.st)), side = built.side;
  st.jiuding = { ...st.jiuding, holder: side, faceDown: false };
  // without the bog the Cauldrons ARE playable here: otherwise refusing them below would prove nothing
  assert.ok(E.legal(st, side).jiuding, "the built position does not offer the Cauldrons even without a bog");
  assert.ok([...cauldronPlays(side)].some((a) => accepted(st, a)), "no Cauldrons play is accepted even without a bog: the check below would prove nothing");
  st.effects.push({ card: "dunbing", side: 1 - side, kind: "bog", who: side, until: "game" });
  const L = E.legal(st, side);
  assert.deepEqual([...L.bog].sort(), [...built.big].sort());
  assert.ok(!L.jiuding, "legal() offers the Cauldrons in a bog round");
  for (const a of cauldronPlays(side)) assert.match(refusal(st, a) ?? "ACCEPTED", /頓兵堅城/, `${a.use} ${a.target || a.points[0]}: the Cauldrons were not refused by the bog`);
  for (const c of built.big) assert.ok(accepted(st, { type: "play", side, card: c, use: "bog" }), `the bog discard of ${c} is refused`);
  // a named card as well (#57: the bog comes first): still the bog's message, and the discards are still accepted
  const both = JSON.parse(JSON.stringify(st)); both.forced[side] = both.hands[side].find((c) => E.CARD[c].ops < 2) ?? built.big[0];
  assert.equal(E.forcedCard(both, side), both.forced[side], "the named card is not live in the built position");
  for (const a of cauldronPlays(side)) assert.match(refusal(both, a) ?? "ACCEPTED", /頓兵堅城/, `${a.use} ${a.target || a.points[0]}: with a named card too, the refusal is not the bog's`);
  for (const c of built.big) assert.ok(accepted(both, { type: "play", side, card: c, use: "bog" }), `with a named card too, the bog discard of ${c} is refused`);
  // no card the bog can take: a normal round, the Cauldrons are back
  const free = JSON.parse(JSON.stringify(st)); free.discard.push(...free.hands[side].filter((c) => E.CARD[c].ops >= 2)); free.hands[side] = free.hands[side].filter((c) => E.CARD[c].ops < 2);
  assert.ok(E.legal(free, side).jiuding, "with no card the bog can take, legal() should offer the Cauldrons again");
  assert.ok([...cauldronPlays(side)].some((a) => accepted(free, a)), "with no card the bog can take, no Cauldrons play is accepted");
});

test("in real games: when legal() does not offer the Cauldrons to the side that holds them face up, every Cauldrons play is refused", () => {
  let seen = 0; const wrong = [];
  for (const { st, side, seed, steps } of positions(20)) {
    if (!E.jiudingUsable(st, side)) continue;
    const L = E.legal(st, side); if (L.kind !== "action" || L.jiuding) continue;
    seen++;
    for (const a of cauldronPlays(side)) if (accepted(st, a)) { wrong.push(`seed ${seed} step ${steps} turn ${st.turn}: ${a.use} ${a.target || a.points[0]} accepted; legal bog ${JSON.stringify(L.bog || null)}, forced ${JSON.stringify(st.forced)}`); break; }
  }
  assert.ok(seen > 0, "no position where the holder is not offered the Cauldrons in 20 games: this check proves nothing, widen the seeds");
  assert.deepEqual(wrong, []);
});

test("in real games: in a bog round nothing but an offered discard is accepted", () => {
  let seen = 0; const wrong = [];
  for (const { st, side, seed, steps } of positions(20)) {
    const L = E.legal(st, side); if (L.kind !== "action" || !(L.bog && L.bog.length)) continue;
    seen++;
    for (const c of st.hands[side]) {
      if (accepted(st, { type: "play", side, card: c, use: "event" })) wrong.push(`seed ${seed} step ${steps}: ${c} played for its event in a bog round`);
      const offered = L.bog.includes(c), ok = accepted(st, { type: "play", side, card: c, use: "bog" });
      if (offered !== ok) wrong.push(`seed ${seed} step ${steps}: the bog discard of ${c} is ${offered ? "offered but refused" : "accepted but not offered"}`);
    }
  }
  assert.ok(seen > 0, "no bog round in 20 games: this check proves nothing, widen the seeds");
  assert.deepEqual(wrong, []);
});
