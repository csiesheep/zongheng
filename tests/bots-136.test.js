// #136: under emperor "win" / "win-lead", a 稱帝 that is certain this turn must outrank a capital take the enemy
// can undo (homeFall "lose-turn").
//
// Rulebook (Projects/zongheng/zongheng - rulebook.md, 變法軌): box 5 明法令 takes a card of 3 ops, box 6 稱帝 a card
// of 4; from box 2 on a side may advance twice a turn by reform; an event's 「變法軌前進」 is not a reform and uses
// none of them. Under "win" the first to box 6 wins at once, under "win-lead" only while leading the Mandate.
// 韓非入秦 (Qin's event): 變法軌前進 1. 長平之戰: 4 ops.
//
// The position is tests/emperor.test.js's race at box 4 (turn 7, Qin to act in round 1 of 7, no advance used,
// 長平 the only 4-op card in hand), with 韓非入秦 added and homeFall "lose-turn", lobby "realign-own" -- seed 18 of
// that race is the one the #134 peer found: the bot spent 長平 on a campaign that took 郢, which Chu has six actions
// to undo (17 losses in 200 playouts), while 韓非 → box 5, 長平 → box 6 wins this turn (200 of 200).
//
// The judge, from the rule text above and not from the bots: after the bot's play, either Qin has won by 稱帝, or
// Qin can still reach box 6 THIS TURN with the cards left in its hand -- 韓非 (+1, no reform used) and reform with a
// card of at least the next box's ops, one per remaining action of Qin's, at most the advances left.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

const { QIN } = E;
const BOX_OPS = { 5: 3, 6: 4 }, ADVANCES = 2, TRACK = { hanfei: 1 };

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
// tests/emperor.test.js's racePositions at box 4, no advance used, 長平 and 韓非入秦 in Qin's hand.
function positions(options, mandate) {
  const out = [];
  for (let seed = 1; out.length < 12 && seed <= 40; seed++) {
    let st;
    try { st = E.clone(actionRoundFrom(seed, options, QIN, 7)); } catch { continue; }
    st.log = [];
    for (const c of ["changping", "hanfei"]) for (const pile of [st.hands[0], st.hands[1], st.draw, st.discard, st.removed, ...Object.values(st.later)]) {
      const i = pile.indexOf(c); if (i >= 0) pile.splice(i, 1);
    }
    for (const c of st.hands[QIN].filter((c) => c !== E.JIUDING && E.CARD[c].ops >= 4)) { st.hands[QIN].splice(st.hands[QIN].indexOf(c), 1); st.draw.push(c); }
    st.hands[QIN].push("changping", "hanfei");
    st.reform = [4, 1]; st.reformUsed = [0, 0];
    st.reformFirst = { 1: QIN, 2: QIN, 3: QIN, 4: QIN };
    st.mandate = mandate; st.forced = [null, null];
    out.push({ seed, st });
  }
  assert.ok(out.length >= 10, `only ${out.length} positions`);
  return out;
}
// Qin's own actions left this turn, Qin acting first in each round.
function qinActionsLeft(st) {
  return st.rounds - st.round + (st.actor === QIN ? 1 : 0);
}
// Whether Qin can reach box 6 this turn from `st` with its hand (the rule text above).
function canReachThisTurn(st) {
  const hand = st.hands[QIN];
  const go = (box, used, acts, cards) => {
    if (box >= 6) return true;
    if (acts <= 0) return false;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i], rest = cards.slice(0, i).concat(cards.slice(i + 1));
      if (TRACK[c] && go(box + TRACK[c], used, acts - 1, rest)) return true;
      if (c !== E.JIUDING && !E.CARD[c].scoring && used < ADVANCES && E.CARD[c].ops >= BOX_OPS[box + 1] && go(box + 1, used + 1, acts - 1, rest)) return true;
    }
    return false;
  };
  return go(st.reform[QIN], st.reformUsed[QIN], qinActionsLeft(st), hand.filter((c) => TRACK[c] || E.CARD[c].ops >= 3));
}

for (const [emperor, mandate] of [["win", 0], ["win-lead", 4]]) {
  test(`#136 emperor ${emperor}, lose-turn: at box 4 with 韓非入秦 and 長平, normal and hard keep the 稱帝 of this turn`, () => {
    const pos = positions({ emperor, lobby: "realign-own", homeFall: "lose-turn" }, mandate);
    const bad = [];
    for (const { seed, st } of pos) {
      assert.ok(canReachThisTurn(st), `seed ${seed}: the position has no 稱帝 this turn`);
      for (const level of ["normal", "hard"]) {
        const a = B.decide(E.view(st, QIN), QIN, level, E.makeRng(seed));
        const after = B.simulate(st, a, E.makeRng(seed));
        if (after.reason === "emperor" && after.winner === QIN) continue;
        if (after.winner == null && canReachThisTurn(after)) continue;
        bad.push(`${level} seed ${seed}: ${a.card} ${a.use} ${a.target || (a.points || []).join(",")} -> box ${after.reform[QIN]}, hand ${after.hands[QIN].filter((c) => c === "changping" || c === "hanfei")}`);
      }
    }
    assert.deepEqual(bad, []);
  });
}
