// #130: the bots must understand both options, or the simulations measure a bot that ignores the rule
// (the brief, after #121). Two things are pinned here, each red on the bots before #130's bot change:
//
// 1. Under lobby "realign" a 遊說 is a roll. A bot that scores it by ONE simulated roll picks the lucky
//    ones. The fixtures (tests/bots-130-realign.fixtures.json) are 8 positions from normal-vs-normal
//    realign games (seeds 21-26) where the pre-#130 normal bot played a 遊說 worth, over 48 rolls, more
//    than 3 points less than its best other play. Here the normal bot decides each again from its own
//    view with 6 RNG seeds; a decision is BAD when it is a 遊說 whose mean over 48 rolls is more than 3
//    below the best of the 5 top non-遊說 candidates (their means over 8 rolls). The judge is the mean
//    over many rolls on the true state -- the expectation the brief asks the bot to value -- not the
//    bot's own score.
// 2. Under homeFall a bot defends its capital: with the enemy one point short of the losing condition
//    (control of 關中 for lose / lose-turn / move after the move, more influence for lose-majority), the
//    normal bot's play leaves the enemy at least two points short, in at least 7 of 8 seeds; and one
//    point short of the enemy's capital mid-turn under lose-turn / lose-majority, it takes it (7 of 8).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

const { QIN, CHU } = E;
const FIX = JSON.parse(readFileSync(new URL("./bots-130-realign.fixtures.json", import.meta.url), "utf8"));
const M = 48, GAP = 3, SEEDS = 6;

function mean(st, a, side, m) {
  let t = 0;
  for (let k = 0; k < m; k++) {
    const s = { ...st, rngState: (k * 2654435761 + 17) >>> 0 };
    try { t += B.evaluate(B.simulate(s, a, E.makeRng(k)), side); } catch { return -Infinity; }
  }
  return t / m;
}

test("realign: the normal bot does not play 遊說 that lose on average (fixtures from pre-#130 bad picks)", (t) => {
  assert.equal(FIX.length, 8, "the population is the 8 fixtures");
  let decisions = 0, lobbies = 0;
  const bad = [];
  for (const f of FIX) {
    const st = f.st;
    assert.equal(st.options.lobby, "realign");
    const alts = B.scoreCandidates(st, f.side, E.makeRng(1), "normal").filter((c) => c.a.use !== "lobby").slice(0, 5);
    const best = Math.max(...alts.map((c) => mean(st, c.a, f.side, 8)));
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = B.decide(E.view(st, f.side), f.side, "normal", E.makeRng(seed * 7919));
      decisions++;
      if (a.use !== "lobby") continue;
      lobbies++;
      const v = mean(st, a, f.side, M);
      if (v < best - GAP) bad.push(`${f.seed}/${f.k} seed ${seed}: ${a.card}→${a.target} ${v.toFixed(1)} vs ${best.toFixed(1)}`);
    }
  }
  assert.equal(decisions, FIX.length * SEEDS);
  t.diagnostic(`${bad.length} bad 遊說 of ${decisions} decisions (${lobbies} 遊說)`);
  assert.ok(bad.length <= 4, `${bad.length} bad 遊說 of ${decisions} decisions (${lobbies} 遊說):\n${bad.join("\n")}`);
});

// ---------- homeFall ----------
// The first 8 seeds whose random game reaches turn 3 (the board is the random game's, with the capital set).
function* staged(options, side, set) {
  let n = 0;
  for (let seed = 1; n < 8 && seed < 60; seed++) { const st = stage(options, side, seed, set); if (st) { n++; yield [seed, st]; } }
  assert.equal(n, 8, "8 positions");
}
const CARDS = ["tiangou", "yetie", "huanghe", "daji", "zhizi", "mibing"];
function stage(options, side, seed, set) {
  const rng = E.makeRng(seed * 7919);
  let s = E.createGame(seed, options);
  for (let k = 0; s.winner == null && k < 3000; k++) {
    if (s.phase === "action" && s.actor === side && !s.pending && s.turn === 3) break;
    const who = E.mustAct(s), x = who[rng.int(who.length)];
    s = E.apply(s, B.randomAction(s, x, rng));
  }
  if (s.phase !== "action" || s.turn !== 3) return null; // that game ended before turn 3
  const st = E.clone(s);
  st.log = [];
  for (const pile of [st.hands[0], st.hands[1], st.draw, st.discard, st.removed, ...Object.values(st.later)]) {
    for (const c of CARDS) { const i = pile.indexOf(c); if (i >= 0) pile.splice(i, 1); }
  }
  st.hands[side] = ["yetie", "huanghe", "mibing"];
  st.hands[1 - side] = ["tiangou", "daji", "zhizi"];
  st.effects = []; st.forced = [null, null]; st.weariness = 5; st.mandate = 0;
  st.round = st.rounds - 2; // mid-turn: the enemy acts again before the turn ends
  for (const [id, v] of Object.entries(set)) st.inf[id] = v.slice();
  return st;
}
const shortOf = (hf, st, side, cap) => {
  const [o, x] = [E.infOf(st, cap)[side], E.infOf(st, cap)[1 - side]], S = E.SPACE[cap].stability;
  return hf === "lose-majority" ? o - x + 1 : o + S - x;
};
const CASES = [
  ["lose", { guanzhong: [2, 5] }, "guanzhong", null],
  ["lose-turn", { guanzhong: [2, 5] }, "guanzhong", null],
  ["lose-majority", { guanzhong: [4, 4] }, "guanzhong", null],
  ["move", { hanzhong: [1, 3], guanzhong: [0, 5] }, "hanzhong", ["hanzhong", "ying"]],
];
for (const [hf, set, cap, capital] of CASES) {
  test(`homeFall ${hf}: the normal bot defends its capital when the enemy is one point short`, () => {
    const out = [];
    for (const [seed, st] of staged({ homeFall: hf }, QIN, set)) {
      if (capital) st.capital = capital.slice();
      assert.equal(shortOf(hf, st, QIN, cap), 1, "one point short before");
      assert.equal(st.winner, null);
      const a = B.decide(E.view(st, QIN), QIN, "normal", E.makeRng(seed));
      const after = B.simulate(st, a, E.makeRng(seed));
      out.push({ seed, short: after.winner == null ? shortOf(hf, after, QIN, cap) : after.winner === QIN ? 99 : -99, a: `${a.card} ${a.use} ${a.target || (a.points || []).join(",")}` });
    }
    const held = out.filter((x) => x.short >= 2).length;
    assert.ok(held >= 7, `defended in ${held}/8:\n${out.map((x) => `seed ${x.seed}: ${x.a} → short ${x.short}`).join("\n")}`);
  });
}

// Attack: mid-turn, Qin one point short of 郢. Under lose-turn / lose-majority taking it now forces Chu to
// spend its next play winning it back or lose at the turn end; the bot before #130 did not see it at all
// (a one-ply search stops before the turn end). Under lose, taking it is the win and was always seen.
for (const [hf, set] of [["lose-turn", { ying: [4, 1] }], ["lose-majority", { ying: [3, 3] }]]) {
  test(`homeFall ${hf}: the normal bot takes the enemy capital mid-turn when it can`, () => {
    const out = [];
    for (const [seed, st] of staged({ homeFall: hf }, QIN, set)) {
      const a = B.decide(E.view(st, QIN), QIN, "normal", E.makeRng(seed));
      const after = B.simulate(st, a, E.makeRng(seed));
      out.push({ seed, took: after.winner === QIN || shortOf(hf, after, CHU, "ying") === 0, a: `${a.card} ${a.use} ${a.target || (a.points || []).join(",")}` });
    }
    const took = out.filter((x) => x.took).length;
    assert.ok(took >= 7, `took it in ${took}/8:\n${out.map((x) => `seed ${x.seed}: ${x.a}${x.took ? " (took)" : ""}`).join("\n")}`);
  });
}
