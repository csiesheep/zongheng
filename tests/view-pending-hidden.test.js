// #131 audit: a choice the OTHER side is answering must not show this seat the
// cards of a hand it cannot see.
//
// `view()` hides the other hand (`hands[opp] = null`) but used to keep
// `pending` whole, and three choices list the answering side's own hand as
// their options:
//   明法令 (reform box 5) end-of-turn discard: "any non-scoring card" of the hand
//   (engine.js endTurn), i.e. the whole hand at that point;
//   春申君 (chunshenjun): Chu draws 2, then discards 1 of its non-scoring cards;
//   韓非入秦 (hanfei): Qin may discard one Chu-side card from its hand.
// So while the other side thought it over, this seat (and a spectator) read
// that hand off `view.pending.options`.
//
// Each case is a real engine position (the choice is reached through `apply`
// or `run`), checked for the other seat and for a spectator; and the side that
// answers must still get every option (a fix that hid them from it too would
// freeze the table).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { randomAction } from "../public/shared/bots.js";

const { QIN, CHU } = E;

// A turn-1 action round with `actor` to play, from real play.
function actionRound(seed, actor) {
  const rng = E.makeRng(seed);
  let st = E.createGame(seed);
  for (let n = 0; n < 500; n++) {
    if (st.phase === "action" && !st.pending && st.actor === actor && st.winner == null) return st;
    const who = E.mustAct(st);
    st = E.apply(st, randomAction(st, who[rng.int(who.length)], rng));
  }
  throw new Error(`seed ${seed}: no action round for ${actor}`);
}
// Move `card` into `side`'s hand from wherever it is (the conquest cards sit in
// `later` in turn 1).
function give(st, side, card) {
  for (const h of st.hands) { const i = h.indexOf(card); if (i >= 0) h.splice(i, 1); }
  for (const k of ["draw", "discard", "removed"]) { const i = st[k].indexOf(card); if (i >= 0) st[k].splice(i, 1); }
  for (const a of Object.values(st.later)) { const i = a.indexOf(card); if (i >= 0) a.splice(i, 1); }
  st.hands[side].push(card);
}

// The check: `who` answers a card choice whose options are cards in its own
// hand; nobody who cannot see that hand may find one of them in the view.
function assertHidden(st, label) {
  const p = st.pending;
  assert.ok(p && p.kind === "card", `${label}: a card choice is pending`);
  const who = p.who;
  const hand = st.hands[who];
  assert.ok(p.options.length > 0 && p.options.every((c) => hand.includes(c)), `${label}: the options are cards in ${E.SIDES[who]}'s hand (non-vacuous)`);
  // The side that answers sees all of them.
  assert.deepEqual(E.view(st, who).pending.options, p.options, `${label}: ${E.SIDES[who]} must still see its own options`);
  for (const viewer of [E.other(who), null]) {
    const v = E.view(st, viewer);
    assert.equal(v.hands[who], null, `${label}: ${E.SIDES[who]}'s hand is hidden from ${viewer == null ? "a spectator" : E.SIDES[viewer]}`);
    const seen = JSON.stringify({ pending: v.pending, plan: v.plan });
    const leaked = hand.filter((c) => seen.includes(`"${c}"`));
    assert.deepEqual(leaked, [], `${label}: ${viewer == null ? "a spectator" : E.SIDES[viewer]} reads ${E.SIDES[who]}'s hidden cards off the pending choice: ${leaked.join(" ")}`);
  }
}

test("#131: Qin does not see Chu's hand while Chu picks its 明法令 discard", () => {
  const st = actionRound(11, QIN);
  // End of the turn with Chu on 明法令 (box 5) and no scoring card in either
  // hand (holding one ends the game before the discard).
  for (const s of [QIN, CHU]) st.hands[s] = st.hands[s].filter((c) => !E.CARD[c].scoring);
  st.reform[CHU] = 5;
  st.plan = [{ do: "endTurn" }];
  const s2 = E.run(st);
  assert.equal(s2.pending && s2.pending.tag, "endDiscard");
  assert.equal(s2.pending.who, CHU);
  assertHidden(s2, "明法令");
});

test("#131: Qin does not see Chu's hand while Chu picks its 春申君 discard", () => {
  const st = actionRound(12, CHU);
  give(st, CHU, "chunshenjun");
  const s2 = E.apply(st, { type: "play", side: CHU, card: "chunshenjun", use: "event" });
  assert.equal(s2.pending && s2.pending.card, "chunshenjun");
  assertHidden(s2, "春申君");
});

test("#131: Chu does not see Qin's Chu-side cards while Qin decides on 韓非入秦", () => {
  const st = actionRound(13, QIN);
  give(st, QIN, "hanfei");
  if (!st.hands[QIN].some((c) => E.CARD[c].side === CHU)) give(st, QIN, E.CARDS.find((c) => c.side === CHU && c.era === "reform").id);
  const s2 = E.apply(st, { type: "play", side: QIN, card: "hanfei", use: "event" });
  assert.equal(s2.pending && s2.pending.card, "hanfei");
  assertHidden(s2, "韓非入秦");
});

// 細作 is the other card choice drawn from a hand, and there the hand is
// SHOWN by the card's own text (「對手展示手牌」): the player who picks sees it.
// The hand's owner knows its own cards. Pinned so the fix does not overreach.
test("#131: 細作 still shows the picker the other hand, and its owner its own cards", () => {
  const st = actionRound(14, QIN);
  give(st, QIN, "xizuo");
  const s2 = E.apply(st, { type: "play", side: QIN, card: "xizuo", use: "event" });
  assert.equal(s2.pending && s2.pending.card, "xizuo");
  assert.equal(s2.pending.who, QIN);
  const q = E.view(s2, QIN), c = E.view(s2, CHU);
  assert.deepEqual(q.hands[CHU], s2.hands[CHU], "the picker sees the shown hand");
  assert.deepEqual(q.pending.options, s2.pending.options, "the picker gets every option");
  assert.deepEqual(c.pending.options, s2.pending.options, "the owner sees its own cards named");
});
