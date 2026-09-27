// #134: a bot never misses an immediate win, whatever the lobby option.
//
// The win conditions are the rulebook's (Projects/zongheng/zongheng - rulebook.md): the third 滅 wins for Qin
// (unification), the fourth 相印 wins for Chu (alliance); 稱帝 wins at once under emperor "win" / "win-lead"
// (the latter only while leading the Mandate); under homeFall "lose" controlling the enemy home capital wins.
// A 滅 is Qin controlling every space of a state; a 相印 (sealAt "cap") is Chu controlling the capital with its
// influence at the cap. Every position below is checked first to HAVE a win, by the engine applying a
// hand-written play (never a bot's), so a position without one cannot pass for a bot that took it.
//
// Red on main (1d73cc4): the placement wins. The one place candidate per card was a greedy walk over
// `evaluate`, whose road to 滅 / 相印 is in steps (every need up to 2 points is worth the same), so the first
// point on the last state gained nothing there and went elsewhere: normal and hard took the last 滅 in 0 of
// 12 positions below, the last 相印 in 1 of 12 (each level, each lobby). The 稱帝 and capital cases were green on main and are pinned
// here under realign-own, the lobby the gate found them red under (#133); those reds were the positions,
// not the bots (see #134: a forced 荊軻 left no win; a capital taken by more than one point counted as not taken).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

const { QIN, CHU } = E;
const LEVELS = ["normal", "hard"];
const LOBBIES = [{ lobby: "realign-own" }, {}];

// A random game (the easy bot on both seats) up to `side`'s action round on turn 3, mid-turn.
function staged(options, side, seed) {
  const rng = E.makeRng(seed * 7919);
  let s = E.createGame(seed, options);
  for (let k = 0; s.winner == null && k < 3000; k++) {
    if (s.phase === "action" && s.actor === side && !s.pending && s.turn === 3) break;
    const who = E.mustAct(s), x = who[rng.int(who.length)];
    s = E.apply(s, B.randomAction(s, x, rng));
  }
  if (s.phase !== "action" || s.turn !== 3 || s.actor !== side || s.pending) return null;
  const st = E.clone(s);
  st.log = []; st.effects = []; st.forced = [null, null]; st.weariness = 5; st.mandate = 0;
  st.round = st.rounds - 2;
  return st;
}
// `cards` into `side`'s hand, and out of every other pile.
function give(st, side, cards) {
  for (const pile of [st.hands[0], st.hands[1], st.draw, st.discard, st.removed, ...Object.values(st.later)]) {
    for (const c of cards) { const i = pile.indexOf(c); if (i >= 0) pile.splice(i, 1); }
  }
  st.hands[side] = cards.slice();
}
// Up to 12 positions from `make(seed)`, each checked to have a win by the engine playing `witness(st)`.
function positions(make, witness, side) {
  const out = [];
  for (let seed = 1; out.length < 12 && seed <= 40; seed++) {
    const st = make(seed);
    if (!st) continue;
    E.checkMarkers(st);
    if (st.winner != null) continue;
    const w = witness(st);
    let after;
    try { after = E.apply(st, w); } catch (e) { throw new Error(`seed ${seed}: the witness is illegal: ${e.message}`); }
    assert.equal(after.winner, side, `seed ${seed}: the witness ${w.card} ${w.use} ${(w.points || []).join(",")} does not win`);
    out.push({ seed, st });
  }
  assert.ok(out.length >= 10, `only ${out.length} positions`);
  return out;
}
function misses(pos, side) {
  const bad = [];
  for (const level of LEVELS) for (const { seed, st } of pos) {
    const a = B.decide(E.view(st, side), side, level, E.makeRng(seed));
    const after = B.simulate(st, a, E.makeRng(seed));
    if (after.winner !== side) bad.push(`${level} seed ${seed}: ${a.card} ${a.use} ${a.target || (a.points || []).join(",")}`);
  }
  return bad;
}

// Qin holds 滅 of 韓 and 魏 (every space controlled, stability points each, Chu none); 燕's two spaces (薊 3,
// 遼東 4) are each one point short of Qin control; three Qin 2-op cards. Placing one point on each wins.
const QIN_2OPS = ["hangu", "keqing", "xidi"];
function lastMie(options) {
  return (seed) => {
    const st = staged(options, QIN, seed);
    if (!st) return null;
    for (const id of ["han", "wei"]) {
      for (const x of E.spacesOfState(id)) st.inf[x] = [E.SPACE[x].stability, 0];
      st.mie[id] = true; st.mieVp[id] = true;
    }
    for (const x of E.spacesOfState("yan")) st.inf[x] = [E.SPACE[x].stability - 1, 0];
    give(st, QIN, QIN_2OPS);
    return st;
  };
}
for (const lob of LOBBIES) {
  test(`#134 unification by placement (lobby ${lob.lobby || "off"}): one 滅 short, normal and hard take the third`, () => {
    const pos = positions(lastMie(lob), (st) => ({ type: "play", side: QIN, card: "hangu", use: "place", order: "opsFirst", points: E.spacesOfState("yan") }), QIN);
    assert.deepEqual(misses(pos, QIN), []);
  });
}

// Chu holds 相印 of 韓, 魏 and 燕 (each capital at the cap, Qin none); 邯鄲 is two points under the cap, Qin none
// there; three Chu 2-op cards. Two points on 邯鄲 seal it.
const CHU_2OPS = ["wuqi", "weiwei", "jixia"];
function lastSeal(options) {
  return (seed) => {
    const st = staged(options, CHU, seed);
    if (!st) return null;
    for (const id of Object.keys(st.mie)) delete st.mie[id];
    for (const id of ["han", "wei", "yan"]) {
      const c = E.STATES[id].capital;
      st.inf[c] = [0, E.capOf(st, c)];
      st.seals[id] = true; st.sealVp[id] = true;
    }
    st.inf.handan = [0, E.capOf(st, "handan") - 2];
    give(st, CHU, CHU_2OPS);
    return st;
  };
}
for (const lob of LOBBIES) {
  test(`#134 alliance by placement (lobby ${lob.lobby || "off"}): one 相印 short, normal and hard take the fourth`, () => {
    const pos = positions(lastSeal(lob), () => ({ type: "play", side: CHU, card: "wuqi", use: "place", order: "opsFirst", points: ["handan", "handan"] }), CHU);
    assert.deepEqual(misses(pos, CHU), []);
  });
}

// 稱帝 under realign-own: Qin at box 5 with no advance spent this turn, 長平之戰 (4 ops; box 6's threshold is 4)
// in hand, no other 4-op card, Chu at box 1; under win-lead Qin leads the Mandate by 1.
for (const emperor of ["win", "win-lead"]) {
  test(`#134 稱帝 (emperor ${emperor}, lobby realign-own): at box 5 with 長平, normal and hard take the win`, () => {
    const pos = positions((seed) => {
      const st = staged({ emperor, lobby: "realign-own" }, QIN, seed);
      if (!st) return null;
      const hand = st.hands[QIN].filter((c) => c !== E.JIUDING && E.CARD[c].ops < 4 && !E.CARD[c].scoring).slice(0, 3);
      give(st, QIN, [...hand, "changping"]);
      st.reform = [5, 1]; st.reformUsed = [0, 0];
      st.reformFirst = { 1: QIN, 2: QIN, 3: QIN, 4: QIN, 5: QIN };
      st.mandate = emperor === "win-lead" ? 1 : 0;
      return st;
    }, () => ({ type: "play", side: QIN, card: "changping", use: "reform" }), QIN);
    assert.deepEqual(misses(pos, QIN), []);
  });
}

// A capital under homeFall "lose" and realign-own: 郢 two points short of Qin control, Chu none there, three
// Qin 2-op cards. Two points on 郢 take it, and the game.
test("#134 capital (homeFall lose, lobby realign-own): two points short of 郢, normal and hard take it", () => {
  const pos = positions((seed) => {
    const st = staged({ homeFall: "lose", lobby: "realign-own" }, QIN, seed);
    if (!st) return null;
    st.inf.ying = [E.SPACE.ying.stability - 2, 0];
    give(st, QIN, QIN_2OPS);
    return st;
  }, () => ({ type: "play", side: QIN, card: "hangu", use: "place", order: "opsFirst", points: ["ying", "ying"] }), QIN);
  assert.deepEqual(misses(pos, QIN), []);
});
