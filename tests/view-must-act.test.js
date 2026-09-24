// #112: `mustAct` on a per-seat view.
//
// A room never sends a client the real state. `E.view(st, side)` is the same
// game with the other side's hand blacked out and its headline face down --
// the rulebook's Headline row says both sides "pick one card from hand and lay
// it face down ... then reveal together", so the hand and the committed card
// are private, and `view` renders that by putting `null` where the hidden hand
// was. Every client then runs the same engine on that redacted state:
// public/app.js asks `mustAct` once a second to decide whose clock is running.
//
// A redaction is not a rule change. "Who still owes a decision" has one answer
// for the player, for the opponent and for a spectator, and blacking out a hand
// must neither invent an obligation nor lose one -- and must not throw.
//
// The expected answers here are read off the rulebook, not off the engine:
//   - turn 1 is the 變法期 (ERAS[0]), which deals 8 cards to each side;
//   - the Headline row above: BOTH sides commit a card each turn, so on a fresh
//     turn both owe one;
//   - a side holding nothing commits nothing (orchestrator's ruling #57), so an
//     empty hand owes no headline -- and a hidden empty hand owes none either.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { playRandomGame, randomAction } from "./driver.js";

const { QIN, CHU } = E;
const SEATS = [QIN, CHU, null]; // Qin's seat, Chu's seat, a spectator
const seatName = (s) => (s == null ? "spectator" : E.SIDES[s]);

// The first moment of turn 1 that both sides can see: setup is answered, the
// era has dealt, nobody has committed a headline yet.
function freshTurnOne(seed = 7) {
  const rng = E.makeRng(seed ^ 0x51ed270b);
  let st = E.createGame(seed);
  for (let guard = 0; guard < 200 && st.phase !== "headline"; guard++) {
    const who = E.mustAct(st);
    assert.ok(who.length, `seed ${seed}: setup stalled in ${st.phase}`);
    st = E.apply(st, randomAction(st, who[0], rng));
  }
  return st;
}

test("#112: every seat's view of a fresh turn 1 agrees with the table on who owes a headline", () => {
  const st = freshTurnOne();
  // Anchored on the rulebook, not on the engine: 變法期 deals 8, both commit.
  assert.equal(st.turn, 1);
  assert.equal(st.phase, "headline");
  assert.equal(E.ERAS[0].hand, 8);
  assert.deepEqual([st.hands[QIN].length, st.hands[CHU].length], [8, 8]);
  assert.deepEqual(E.mustAct(st), [QIN, CHU], "rulebook: both sides headline every turn");

  for (const seat of SEATS) {
    const v = E.view(st, seat);
    // The redaction really is in place -- otherwise this test proves nothing.
    const hidden = seat == null ? [QIN, CHU] : [E.other(seat)];
    for (const h of hidden) assert.equal(v.hands[h], null, `${seatName(seat)}: hand ${h} should be face down`);
    assert.deepEqual(E.mustAct(v), [QIN, CHU], `${seatName(seat)}: a hidden hand still owes its headline`);
  }
});

test("#112: a hidden EMPTY hand owes no headline either (#57 seen from the other seat)", () => {
  const st = freshTurnOne();
  // #57: the deal can run the deck dry, so a side can reach the headline phase
  // holding nothing; it commits no headline. Take Chu's cards away by hand.
  st.hands[CHU] = [];
  assert.deepEqual(E.mustAct(st), [QIN], "rulebook/#57: an empty hand commits nothing");
  for (const seat of SEATS) {
    assert.deepEqual(E.mustAct(E.view(st, seat)), [QIN], `${seatName(seat)}: hiding an empty hand must not invent a headline`);
  }
  // And the mirror: Qin empty instead.
  const st2 = freshTurnOne();
  st2.hands[QIN] = [];
  assert.deepEqual(E.mustAct(st2), [CHU]);
  for (const seat of SEATS) assert.deepEqual(E.mustAct(E.view(st2, seat)), [CHU], `${seatName(seat)}: mirror`);
});

test("#112: through whole games, no seat's view ever disagrees with the table (or throws)", () => {
  for (const seed of [1, 2, 3, 11, 404]) {
    const check = (st) => {
      const truth = E.mustAct(st);
      for (const seat of SEATS) {
        const v = E.view(st, seat);
        let got;
        assert.doesNotThrow(() => { got = E.mustAct(v); },
          `seed ${seed}: mustAct threw on ${seatName(seat)}'s view (turn ${st.turn}, phase ${st.phase})`);
        assert.deepEqual(got, truth, `seed ${seed}: ${seatName(seat)}'s view disagrees (turn ${st.turn}, phase ${st.phase})`);
      }
    };
    playRandomGame(seed, {}, { onStep: check });
  }
});
