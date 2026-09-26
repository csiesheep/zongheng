// #130: `homeFall` -- what happens when the enemy takes your home capital (Qin 關中, Chu 郢).
//
// Expected behaviour from the brief of #130 and the orchestrator's resume message (「pls simulate them all」):
//   none / absent  today: nothing
//   lose           the moment the enemy controls your home capital you lose, end reason "homeFall"
//                  (checked where the other markers are checked)
//   lose-turn      you lose if the enemy controls it at the end of a turn; the rest of the turn is yours
//   lose-majority  you lose if the enemy has MORE influence than you there at the end of a turn
//   move           (遷都) the first time the enemy controls your home capital at the end of a turn, the
//                  enemy gains 3 Mandate and your capital moves -- Chu 郢 → 陳蔡, Qin 關中 → 漢中 -- logged as
//                  its own entry; if the enemy controls the NEW capital at the end of a later turn, you lose
//                  ("homeFall"); the old capital is an ordinary space; where the capital is lives in the state.
// Control, from the rulebook: influence at least the other side's plus the stability (關中 and 郢 are 4).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

const { QIN, CHU } = E;
const MOVE_VP = 3;
const HOME = ["guanzhong", "ying"], MOVED = ["hanzhong", "chencai"];
const CARDS = ["tiangou", "zhouzuo", "zhizi", "yetie", "daji", "huanghe"];

// A turn-2 action round for `side`, rebuilt as our own board: `inf` only, the Mandate 0, no scoring card in
// a hand (holding one at the end of a turn is its own loss), `side` to act in the last round of the turn
// (`round: "early"`: the round before). Qin acts first in a round, so a Chu play in the last round ends
// the turn; after a Qin play there, Chu's half is still to come (`toTurnEnd`).
function stage(options, side, { inf, round = "last", hand, oppHand }) {
  let st = null;
  for (let seed = 1; seed < 200 && !st; seed++) {
    const rng = E.makeRng(seed * 7919);
    let s = E.createGame(seed, options);
    for (let k = 0; s.winner == null && k < 3000; k++) {
      if (s.phase === "action" && s.actor === side && !s.pending && s.turn === 2) { st = s; break; }
      const who = E.mustAct(s), x = who[rng.int(who.length)];
      s = E.apply(s, B.randomAction(s, x, rng));
    }
  }
  st = E.clone(st);
  st.log = [];
  for (const pile of [st.hands[0], st.hands[1], st.draw, st.discard, st.removed, ...Object.values(st.later)]) {
    for (const c of CARDS) { const i = pile.indexOf(c); if (i >= 0) pile.splice(i, 1); }
  }
  st.hands[side] = hand || ["tiangou", "yetie", "huanghe"];
  st.hands[1 - side] = oppHand || ["zhizi", "daji"];
  st.inf = E.clone(inf);
  st.effects = []; st.mie = {}; st.seals = {}; st.mieHold = {}; st.forced = [null, null];
  st.mandate = 0; st.weariness = 5; st.jiuding = { holder: 1 - side, faceDown: true };
  st.round = round === "last" ? st.rounds : st.rounds - 1;
  return st;
}
const place = (side, card, ...points) => ({ type: "play", side, card, use: "place", points });
// Whoever is to act puts one point on a space of no interest (Qin 函谷關, Chu 吳越) until the turn is over.
const QUIET = ["hangu", "wuyue"];
function toTurnEnd(s) {
  const t = s.turn;
  for (let k = 0; s.winner == null && s.turn === t && s.phase === "action" && k < 20; k++) s = E.apply(s, place(s.actor, s.hands[s.actor][0], QUIET[s.actor]));
  return s;
}
// Chu 1 short of 關中 (control needs 5 against Qin's 1), Qin 1 short of 郢; room elsewhere for harmless plays.
const BOARD = { guanzhong: [1, 4], ying: [4, 1], hangu: [3, 0], wuyue: [0, 2], song: [1, 1] };

test("absent and none: the enemy may hold your capital, nothing ends", () => {
  for (const options of [{}, { homeFall: "none" }]) {
    const st = stage(options, CHU, { inf: BOARD });
    const after = E.apply(st, place(CHU, "tiangou", "guanzhong"));
    assert.equal(E.controller(after, "guanzhong"), CHU);
    assert.equal(after.winner, null);
    assert.equal(after.turn, 3, "the turn ended and the next began");
  }
});

test("lose: taking the enemy's capital wins at once, mid-turn, reason homeFall (both sides)", () => {
  const st = stage({ homeFall: "lose" }, CHU, { inf: BOARD, round: "early" });
  const after = E.apply(st, place(CHU, "tiangou", "guanzhong"));
  assert.equal(after.winner, CHU);
  assert.equal(after.reason, "homeFall");
  assert.equal(after.turn, 2); assert.equal(after.round, st.round, "mid-turn");
  const q = stage({ homeFall: "lose" }, QIN, { inf: BOARD, round: "early" });
  const afterQ = E.apply(q, place(QIN, "tiangou", "ying"));
  assert.equal(afterQ.winner, QIN);
  assert.equal(afterQ.reason, "homeFall");
  // One point short is not a fall.
  const near = stage({ homeFall: "lose" }, CHU, { inf: { ...BOARD, guanzhong: [2, 4] }, round: "early" });
  assert.equal(E.apply(near, place(CHU, "tiangou", "guanzhong")).winner, null);
});

test("lose-turn: no end mid-turn; the end of the turn ends it if the capital is still held", () => {
  const st = stage({ homeFall: "lose-turn" }, CHU, { inf: BOARD, round: "early" });
  let s = E.apply(st, place(CHU, "tiangou", "guanzhong"));
  assert.equal(E.controller(s, "guanzhong"), CHU);
  assert.equal(s.winner, null, "not mid-turn");
  assert.equal(s.actor, QIN);
  s = E.apply(s, place(QIN, "zhizi", "hangu"));        // Qin does not retake it
  assert.equal(s.winner, null);
  s = E.apply(s, place(CHU, "yetie", "wuyue"));        // Chu's last half: the turn ends
  assert.equal(s.winner, CHU);
  assert.equal(s.reason, "homeFall");
  assert.equal(s.turn, 2);
});

test("lose-turn: retaken before the end of the turn, the game goes on", () => {
  const st = stage({ homeFall: "lose-turn" }, CHU, { inf: BOARD, round: "early", oppHand: ["yetie", "zhizi"], hand: ["tiangou", "daji"] });
  let s = E.apply(st, place(CHU, "tiangou", "guanzhong"));
  s = E.apply(s, place(QIN, "yetie", "guanzhong"));     // 2 ops, a point in an enemy-held space costs 2
  assert.notEqual(E.controller(s, "guanzhong"), CHU);
  s = E.apply(s, place(CHU, "daji", "wuyue"));
  assert.equal(s.winner, null);
  assert.equal(s.turn, 3);
});

test("lose-turn: Qin taking 郢 in the last round wins at that turn's end, not before", () => {
  let s = stage({ homeFall: "lose-turn" }, QIN, { inf: BOARD });
  s = E.apply(s, place(QIN, "tiangou", "ying"));
  assert.equal(s.winner, null, "Chu's half is still to come");
  s = E.apply(s, place(CHU, "zhizi", "wuyue"));
  assert.equal(s.winner, QIN);
  assert.equal(s.reason, "homeFall");
});

test("lose-majority: more enemy influence than yours at the end of a turn loses; level does not", () => {
  const inf = { ...BOARD, guanzhong: [3, 3], ying: [1, 4] }; // Qin no longer ahead in 郢
  const st = stage({ homeFall: "lose-majority" }, CHU, { inf });
  const after = E.apply(st, place(CHU, "tiangou", "guanzhong")); // 3 : 4, no control
  assert.equal(E.controller(after, "guanzhong"), null);
  assert.equal(after.winner, CHU);
  assert.equal(after.reason, "homeFall");
  const level = E.apply(stage({ homeFall: "lose-majority" }, CHU, { inf }), place(CHU, "tiangou", "wuyue"));
  assert.equal(level.winner, null, "3 : 3 is not a majority");
  // Mid-turn a majority is not a loss.
  const mid = E.apply(stage({ homeFall: "lose-majority" }, CHU, { inf, round: "early" }), place(CHU, "tiangou", "guanzhong"));
  assert.equal(mid.winner, null);
});

// Both capitals lost at the same turn end: the rules say nothing; BE's reading (flagged on #130) is the
// final scoring's -- the side ahead on the Mandate, level by the `tie` option (Chu unless tie=qin).
for (const [mandate, tie, winner] of [[2, undefined, QIN], [-2, undefined, CHU], [0, undefined, CHU], [0, "qin", QIN]]) {
  test(`both capitals lost at one turn end: Mandate ${mandate}${tie ? `, tie=${tie}` : ""} → ${winner === QIN ? "Qin" : "Chu"}`, () => {
    const inf = { ...BOARD, guanzhong: [3, 3], ying: [4, 3] }; // Qin already ahead in 郢
    const st = stage({ homeFall: "lose-majority", ...(tie ? { tie } : {}) }, CHU, { inf });
    st.mandate = mandate;
    const after = E.apply(st, place(CHU, "tiangou", "guanzhong"));
    assert.equal(after.winner, winner);
    assert.equal(after.reason, "homeFall");
  });
}

test("move: the state says where each capital is; without move there is no such key", () => {
  assert.deepEqual(E.createGame(1, { homeFall: "move" }).capital, HOME);
  for (const options of [{}, { homeFall: "lose" }, { homeFall: "lose-turn" }]) assert.equal("capital" in E.createGame(1, options), false);
});

for (const side of [QIN, CHU]) {
  const enemy = 1 - side, name = side === QIN ? "Qin" : "Chu";
  test(`move (${name}): the first fall at a turn end gives the enemy ${MOVE_VP} and moves the capital to ${MOVED[side]}; the game goes on`, () => {
    const st = stage({ homeFall: "move" }, enemy, { inf: BOARD });
    const after = toTurnEnd(E.apply(st, place(enemy, "tiangou", HOME[side])));
    assert.equal(after.winner, null);
    assert.equal(after.mandate, enemy === QIN ? MOVE_VP : -MOVE_VP);
    assert.equal(after.capital[side], MOVED[side]);
    assert.equal(after.capital[enemy], HOME[enemy], "the other capital stays");
    const e = after.log.find((l) => l.type === "capitalMoves");
    assert.ok(e, "logged as its own entry");
    assert.equal(e.whose, side); assert.equal(e.from, HOME[side]); assert.equal(e.to, MOVED[side]); assert.equal(e.by, enemy);
    assert.equal(after.turn, 3);
  });

  test(`move (${name}): held at a later turn end, the new capital loses; the old one no longer matters`, () => {
    const cap = MOVED[side], S = E.SPACE[cap].stability;
    const inf = { ...BOARD, [HOME[side]]: side === QIN ? [0, 6] : [6, 0], [cap]: side === QIN ? [1, S] : [S, 1] };
    const st = stage({ homeFall: "move" }, enemy, { inf });
    st.capital = side === QIN ? [cap, HOME[CHU]] : [HOME[QIN], cap];
    // The old capital enemy-held, the new one one point short: nothing.
    const quiet = toTurnEnd(st);
    assert.equal(quiet.turn, 3);
    assert.equal(quiet.winner, null);
    assert.equal(quiet.mandate, 0, "no second +3 for the old capital");
    const lost = toTurnEnd(E.apply(st, place(enemy, "tiangou", cap)));
    assert.equal(E.controller(lost, cap), enemy);
    assert.equal(lost.winner, enemy);
    assert.equal(lost.reason, "homeFall");
  });
}

test("move: the new capital already held at the turn end of the move is lost only at a later turn end", () => {
  // Chu takes 關中 while holding 漢中 too: at this turn end the capital moves to 漢中, Chu +3, no loss yet.
  const inf = { ...BOARD, hanzhong: [0, 3] };
  const st = stage({ homeFall: "move" }, CHU, { inf });
  let s = E.apply(st, place(CHU, "tiangou", "guanzhong"));
  assert.equal(E.controller(s, "hanzhong"), CHU);
  assert.equal(s.winner, null);
  assert.deepEqual(s.capital, ["hanzhong", "ying"]);
  // The next turn, straight to Chu's last half with 漢中 still Chu's: that turn end loses it for Qin.
  s = E.clone(s);
  s.phase = "action"; s.pending = null; s.plan = []; s.headline = [null, null];
  s.round = s.rounds; s.actor = CHU; s.hands = [["zhizi"], ["daji"]];
  s = E.apply(s, place(CHU, "daji", "wuyue"));
  assert.equal(s.winner, CHU);
  assert.equal(s.reason, "homeFall");
  assert.equal(s.turn, 3);
});

test("move: taken and retaken within the turn is no fall", () => {
  const st = stage({ homeFall: "move" }, CHU, { inf: BOARD, round: "early", oppHand: ["yetie", "zhizi"], hand: ["tiangou", "daji"] });
  let s = E.apply(st, place(CHU, "tiangou", "guanzhong"));
  s = E.apply(s, place(QIN, "yetie", "guanzhong"));
  s = E.apply(s, place(CHU, "daji", "wuyue"));
  assert.equal(s.winner, null);
  assert.deepEqual(s.capital, HOME);
  assert.equal(s.log.some((l) => l.type === "capitalMoves"), false);
});
