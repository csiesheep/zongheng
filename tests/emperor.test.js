// #121: the `emperor` option -- what reaching reform box 6 (稱帝) is worth.
//
// Expected values are copied from the rulebook (Projects/zongheng/zongheng - rulebook.md, 變法軌):
// box 6 稱帝, threshold 4, first / second = 3 / 1, "到達時疲敝軌立即後退 1 格"; and from the brief of #121:
//   vp        first +3, second +1 (the default until #125; an absent option -- a save from before #125 -- plays as vp)
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

// #125 made win-lead the default (tests/emperor-default.test.js). What stays from #121's first two tests: a state
// with no `emperor` key (a save from before #125) plays exactly as emperor=vp, and apart from that one key a new
// game's state is what it was.
const noEmperor = (options) => { const o = { ...options }; delete o.emperor; return o; };
test("default: apart from the `emperor` key, a new game's state is what it was", () => {
  const { options: a, ...restA } = E.createGame(7), { options: b, ...restB } = E.createGame(7, { emperor: "vp" });
  assert.equal(JSON.stringify(restA), JSON.stringify(restB));
  assert.deepEqual(noEmperor(a), noEmperor(b));
});

test("default: an absent option (an old save) and emperor=vp play the same game, move for move", () => {
  for (const seed of [3, 11]) {
    const play = (options) => {
      const rng = E.makeRng(seed);
      let st = E.createGame(seed, options);
      if (!("emperor" in options)) st = { ...st, options: noEmperor(st.options) };
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

for (const [label, options, old] of [["absent (an old save)", {}, true], ["vp", { emperor: "vp" }, false]]) {
  test(`${label}: reaching box 6 first gives +${FIRST_VP}, relieves weariness by 1, and the game goes on`, () => {
    for (const side of [QIN, CHU]) {
      const at = atBox5(options, side, 3);
      if (old) at.options = noEmperor(at.options);
      const st = reform(at, side);
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

// win-lead (#121's one extra, from the numbers: under `win` 75 of 187 games won by 稱帝 went to the side behind on the
// Mandate): the first to box 6 wins only when it leads the Mandate at that moment (Qin above 0, Chu below 0); otherwise
// it is +3 as today and the first place is taken.
const LEAD = 4;
function withMandate(st, m) { const s = E.clone(st); s.mandate = m; return s; }
test("win-lead: the first to box 6 while leading the Mandate wins, reason emperor", () => {
  for (const side of [QIN, CHU]) {
    const st = reform(withMandate(atBox5({ emperor: "win-lead" }, side, 3), signed(side, LEAD)), side);
    assert.equal(st.winner, side);
    assert.equal(st.reason, "emperor");
  }
});
test(`win-lead: the first to box 6 while level or behind gets +${FIRST_VP}, the game goes on, and the second cannot win by it`, () => {
  for (const side of [QIN, CHU]) for (const m of [0, -LEAD]) {
    const st = reform(withMandate(atBox5({ emperor: "win-lead" }, side, 6), signed(side, m)), side);
    assert.equal(st.winner, null, `side ${side} mandate ${m}`);
    assert.equal(st.mandate, signed(side, m + FIRST_VP));
    assert.equal(st.reformFirst[6], side);
  }
  // The other side, leading, arrives second: +1, no win.
  const second = reform(withMandate(atBox5({ emperor: "win-lead" }, CHU, 7, 6), signed(CHU, LEAD)), CHU);
  assert.equal(second.winner, null);
  assert.equal(second.mandate, signed(CHU, LEAD + SECOND_VP));
});

// ---------- the bots under a win by reform ----------
// A bot that ignores a winning condition makes a simulation of it meaningless (#121 brief). Positions: random play
// to Qin's action round on turn 7, then Qin is put at `box` with `used` reform advances spent this turn and 長平之戰
// (4 ops, the card that takes box 6) in hand, the Mandate level, Chu at box 1. Any other 4-op card in Qin's hand goes
// back to the draw pile, so 長平 is the only card that can take the last step; `extra` cards are added to the hand.
function racePositions(options, box, used, extra = []) {
  const out = [];
  for (let seed = 1; out.length < 12 && seed <= 40; seed++) {
    let st;
    try { st = E.clone(actionRoundFrom(seed, options, QIN, 7)); } catch { continue; }
    st.log = [];
    for (const c of ["changping", ...extra]) for (const pile of [st.hands[0], st.hands[1], st.draw, st.discard, st.removed, ...Object.values(st.later)]) {
      const i = pile.indexOf(c); if (i >= 0) pile.splice(i, 1);
    }
    for (const c of st.hands[QIN].filter((c) => c !== E.JIUDING && E.CARD[c].ops >= 4)) {
      st.hands[QIN].splice(st.hands[QIN].indexOf(c), 1); st.draw.push(c);
    }
    st.hands[QIN].push("changping", ...extra);
    st.reform = [box, 1]; st.reformUsed = [used, 0];
    st.reformFirst = { 1: QIN }; for (let b = 2; b <= box; b++) st.reformFirst[b] = QIN;
    st.mandate = 0;
    out.push({ seed, st });
  }
  return out;
}
function actionRoundFrom(seed, options, side, turn) {
  const rng = E.makeRng(seed * 7919);
  let st = E.createGame(seed, options);
  for (let steps = 0; st.winner == null && steps < 3000 && st.turn <= turn; steps++) {
    if (st.phase === "action" && st.turn === turn && st.actor === side && !st.pending && E.mustAct(st).includes(side)) return st;
    const who = E.mustAct(st), s = who[rng.int(who.length)];
    st = E.apply(st, B.randomAction(st, s, rng));
  }
  throw new Error("not reached");
}

test("bots, win: at box 5 with an advance left and a 4-op card in hand, normal and hard take the win", () => {
  const pos = racePositions({ emperor: "win" }, 5, 0);
  assert.ok(pos.length >= 8, `only ${pos.length} positions`);
  for (const level of ["normal", "hard"]) for (const { seed, st } of pos) {
    const a = B.decide(E.view(st, QIN), QIN, level, E.makeRng(seed));
    const after = B.simulate(st, a, E.makeRng(seed));
    assert.equal(after.reason, "emperor", `${level} seed ${seed}: played ${a.card} as ${a.use}`);
  }
});

test("bots, win: at box 5 with no advance left this turn, normal and hard keep the 4-op card for the win", () => {
  const pos = racePositions({ emperor: "win" }, 5, 2);
  assert.ok(pos.length >= 8, `only ${pos.length} positions`);
  const spent = [];
  for (const level of ["normal", "hard"]) for (const { seed, st } of pos) {
    const a = B.decide(E.view(st, QIN), QIN, level, E.makeRng(seed));
    if (a.card === "changping" || a.pair === "changping") spent.push(`${level} seed ${seed}: ${a.use}`);
  }
  assert.deepEqual(spent, []);
});

test("bots, win: at box 4 with 長平 in hand, normal and hard do not spend it on anything but the track", () => {
  const pos = racePositions({ emperor: "win" }, 4, 0);
  assert.ok(pos.length >= 8, `only ${pos.length} positions`);
  const spent = [];
  for (const level of ["normal", "hard"]) for (const { seed, st } of pos) {
    const a = B.decide(E.view(st, QIN), QIN, level, E.makeRng(seed));
    if ((a.card === "changping" || a.pair === "changping") && a.use !== "reform") spent.push(`${level} seed ${seed}: ${a.use}`);
  }
  assert.deepEqual(spent, []);
});

test("bots, win: at box 4 with two advances left, a 3-op card and 長平, hard climbs to box 5 and keeps 長平 (or wins now)", () => {
  // Box 5's threshold is 3 and box 6's is 4 (rulebook): 白起破郢 (3) now, 長平 (4) next round wins within the turn.
  // An event that moves the track (韓非入秦 +1, 鄭國渠 +2) climbs as well.
  const pos = racePositions({ emperor: "win" }, 4, 0, ["poying"]);
  assert.ok(pos.length >= 8, `only ${pos.length} positions`);
  const other = [];
  for (const { seed, st } of pos) {
    const a = B.decide(E.view(st, QIN), QIN, "hard", E.makeRng(seed));
    const after = B.simulate(st, a, E.makeRng(seed));
    const climbed = after.reason === "emperor" || (after.reform[QIN] === 5 && after.hands[QIN].includes("changping"));
    if (!climbed) other.push(`seed ${seed}: ${a.card} ${a.use} -> box ${after.reform[QIN]}`);
  }
  assert.deepEqual(other, []);
});

test("bots, win-lead: leading the Mandate at box 5 with no advance left, normal and hard keep 長平; with an advance, they win", () => {
  const keep = racePositions({ emperor: "win-lead" }, 5, 2).map((p) => ({ ...p, st: withMandate(p.st, LEAD) }));
  const now = racePositions({ emperor: "win-lead" }, 5, 0).map((p) => ({ ...p, st: withMandate(p.st, LEAD) }));
  assert.ok(keep.length >= 8 && now.length >= 8);
  const bad = [];
  for (const level of ["normal", "hard"]) {
    for (const { seed, st } of keep) {
      const a = B.decide(E.view(st, QIN), QIN, level, E.makeRng(seed));
      if (a.card === "changping" || a.pair === "changping") bad.push(`${level} seed ${seed}: spent it on ${a.use}`);
    }
    for (const { seed, st } of now) {
      const a = B.decide(E.view(st, QIN), QIN, level, E.makeRng(seed));
      if (B.simulate(st, a, E.makeRng(seed)).reason !== "emperor") bad.push(`${level} seed ${seed}: ${a.card} ${a.use}, no win`);
    }
  }
  assert.deepEqual(bad, []);
});

test("bots, old save: the evaluation of a position is the same with the option absent and with emperor=vp", () => {
  for (const { st: s0 } of racePositions({}, 5, 0)) {
    const st = { ...s0, options: noEmperor(s0.options) };
    const v = { ...st, options: { ...st.options, emperor: "vp" } };
    assert.equal(B.evaluate(st, QIN), B.evaluate(v, QIN));
    assert.equal(B.evaluate(st, E.CHU), B.evaluate(v, E.CHU));
  }
});
