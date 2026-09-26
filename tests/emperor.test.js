// #121: the `emperor` option -- what reaching reform box 6 (稱帝) is worth.
//
// Expected values are copied from the rulebook (Projects/zongheng/zongheng - rulebook.md, 變法軌):
// box 6 稱帝, threshold 4, first / second = 3 / 1, "到達時疲敝軌立即後退 1 格"; and from the brief of #121:
//   vp        today: first +3, second +1 (the default; an absent option plays as vp)
//   vp5       first +5, second +1
//   win       the first to reach box 6 wins at once, end reason "emperor"
//   win-late  as win from turn 5 on; before turn 5 it is +3 as today
// None of these numbers is read from the engine's REFORM table.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

const { QIN, CHU } = E;
const FIRST_VP = 3, SECOND_VP = 1, VP5_FIRST = 5, LATE_FROM = 5;

// Random play (the easy bot) until `side` must take an action round on turn `turn`.
function actionRound(options, side, turn) {
  for (let seed = 1; seed < 400; seed++) {
    const rng = E.makeRng(seed * 7919);
    let st = E.createGame(seed, options);
    for (let steps = 0; st.winner == null && steps < 3000 && st.turn <= turn; steps++) {
      if (st.phase === "action" && st.turn === turn && st.actor === side && !st.pending && E.mustAct(st).includes(side)) return st;
      const who = E.mustAct(st), s = who[rng.int(who.length)];
      st = E.apply(st, B.randomAction(st, s, rng));
    }
  }
  throw new Error(`no action round for side ${side} on turn ${turn}`);
}
// A side at box 5 holding 長平之戰 (a 4-op card), no reform used this turn, the Mandate level.
function atBox5(options, side, turn, otherBox = 0) {
  const st = E.clone(actionRound(options, side, turn));
  st.log = [];
  for (const pile of [st.hands[0], st.hands[1], st.draw, st.discard, st.removed, ...Object.values(st.later)]) {
    const i = pile.indexOf("changping"); if (i >= 0) pile.splice(i, 1);
  }
  st.hands[side].push("changping");
  st.reform[side] = 5; st.reform[1 - side] = otherBox; st.reformUsed = [0, 0];
  st.reformFirst = {};
  for (let b = 1; b <= 5; b++) st.reformFirst[b] = side;
  if (otherBox === 6) st.reformFirst[6] = 1 - side;
  st.mandate = 0; st.weariness = 3;
  return st;
}
const reform = (st, side) => E.apply(st, { type: "play", side, card: "changping", use: "reform" });
const signed = (side, n) => (side === QIN ? n : -n);

test("default: no `emperor` key is added to a new game's options, so a default game state is what it was", () => {
  assert.equal("emperor" in E.DEFAULT_OPTIONS, false);
  assert.equal("emperor" in E.createGame(1).options, false);
  assert.equal(JSON.stringify(E.createGame(7)), JSON.stringify(E.createGame(7, {})));
});

test("default: an absent option and emperor=vp play the same game, move for move", () => {
  for (const seed of [3, 11]) {
    const play = (options) => {
      const rng = E.makeRng(seed);
      let st = E.createGame(seed, options);
      for (let steps = 0; st.winner == null && steps < 3000; steps++) {
        const who = E.mustAct(st), s = who[rng.int(who.length)];
        st = E.apply(st, B.randomAction(st, s, rng));
      }
      const { options: _o, ...rest } = st;
      return JSON.stringify(rest);
    };
    const a = play({}), b = play({ emperor: "vp" });
    assert.ok(JSON.parse(a).winner != null, "the game finished");
    assert.equal(a, b, `seed ${seed}`);
  }
});

for (const [label, options] of [["absent (today)", {}], ["vp", { emperor: "vp" }]]) {
  test(`${label}: reaching box 6 first gives +${FIRST_VP}, relieves weariness by 1, and the game goes on`, () => {
    for (const side of [QIN, CHU]) {
      const st = reform(atBox5(options, side, 3), side);
      assert.equal(st.reform[side], 6);
      assert.equal(st.winner, null);
      assert.equal(st.mandate, signed(side, FIRST_VP));
      assert.equal(st.weariness, 4);
    }
  });
}

test(`vp5: first to box 6 gets +${VP5_FIRST}, the second +${SECOND_VP}, no one wins by it`, () => {
  for (const side of [QIN, CHU]) {
    const first = reform(atBox5({ emperor: "vp5" }, side, 6), side);
    assert.equal(first.winner, null);
    assert.equal(first.mandate, signed(side, VP5_FIRST));
    const second = reform(atBox5({ emperor: "vp5" }, side, 6, 6), side);
    assert.equal(second.winner, null);
    assert.equal(second.mandate, signed(side, SECOND_VP));
  }
});

test("win: the first to reach box 6 wins at once, reason emperor, on any turn", () => {
  for (const side of [QIN, CHU]) for (const turn of [2, 6]) {
    const st = reform(atBox5({ emperor: "win" }, side, turn), side);
    assert.equal(st.winner, side, `side ${side} turn ${turn}`);
    assert.equal(st.reason, "emperor");
    assert.equal(st.phase, "over");
    assert.ok(st.log.some((l) => l.type === "over" && l.reason === "emperor" && l.winner === side));
  }
});

test(`win: the second to reach box 6 does not win; it gets +${SECOND_VP} as today`, () => {
  for (const side of [QIN, CHU]) {
    const st = reform(atBox5({ emperor: "win" }, side, 6, 6), side);
    assert.equal(st.winner, null);
    assert.equal(st.mandate, signed(side, SECOND_VP));
  }
});

test("win: box 6 reached by an event (鄭國渠, two boxes from box 4) wins the same way", () => {
  const st = E.clone(atBox5({ emperor: "win" }, QIN, 6));
  st.reform[QIN] = 4; delete st.reformFirst[5];
  E.reformAdvance(st, QIN, 2);
  assert.equal(st.reform[QIN], 6);
  assert.equal(st.winner, QIN);
  assert.equal(st.reason, "emperor");
});

test(`win-late: before turn ${LATE_FROM} the first to box 6 gets +${FIRST_VP} and the game goes on; the win is then gone`, () => {
  for (const side of [QIN, CHU]) {
    const st = reform(atBox5({ emperor: "win-late" }, side, LATE_FROM - 1), side);
    assert.equal(st.turn, LATE_FROM - 1);
    assert.equal(st.winner, null);
    assert.equal(st.mandate, signed(side, FIRST_VP));
    assert.equal(st.reformFirst[6], side);
  }
  // The other side reaching box 6 later, on or after turn 5, is second: +1, no win.
  const late = reform(atBox5({ emperor: "win-late" }, CHU, LATE_FROM + 1, 6), CHU);
  assert.equal(late.winner, null);
  assert.equal(late.mandate, signed(CHU, SECOND_VP));
});

test(`win-late: from turn ${LATE_FROM} on, the first to box 6 wins, reason emperor`, () => {
  for (const side of [QIN, CHU]) for (const turn of [LATE_FROM, LATE_FROM + 2]) {
    const st = reform(atBox5({ emperor: "win-late" }, side, turn), side);
    assert.equal(st.turn, turn);
    assert.equal(st.winner, side, `side ${side} turn ${turn}`);
    assert.equal(st.reason, "emperor");
  }
});
