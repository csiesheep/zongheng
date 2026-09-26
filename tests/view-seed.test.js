// #131: a room seat's view must not carry the game seed.
//
// The engine is deterministic from seed + actions (engine.js, line 1) and the
// decks are public (cards.js), so a seat that is handed the seed can run the
// same shuffle and read the other hand and the draw order. The room sends every
// seat and every spectator `E.view(state, side)` (src/room.js `viewMsg`), so
// whatever `view()` keeps is on every client's devtools.
//
// Each test first shows the attack WORKS when it is given the real seed (the
// control: without it, "the attack failed" would prove nothing), then runs the
// very same attack on what the view carries.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { randomAction } from "../public/shared/bots.js";

const { QIN, CHU } = E;
const SEED = 424242; // any seed but 0: `createGame(undefined)` is seed 0

// What a devtools user can do with a seed and the public log: start the same
// game and replay the setup choices the log shows (the only choices made
// before the first deal).
function rebuild(seed, options, log) {
  let g = E.createGame(seed, options);
  for (const e of log.filter((x) => x.type === "setup")) g = E.apply(g, { type: "choose", side: g.pending.who, choice: e.points });
  return g;
}

// A fresh game, played to the first headline phase (the first deal).
function firstDeal(seed) {
  const rng = E.makeRng(seed ^ 0x5bd1e995);
  let st = E.createGame(seed);
  while (st.phase === "setup") st = E.apply(st, randomAction(st, E.mustAct(st)[0], rng));
  return st;
}

test("#131: the seat's view does not carry the seed or the rng state", () => {
  const st = firstDeal(SEED);
  for (const side of [QIN, CHU, null]) {
    const v = E.view(st, side);
    assert.equal(v.seed, undefined, `view(${side}) carries seed ${v.seed}`);
    assert.equal(v.rngState, undefined, `view(${side}) carries rngState`);
  }
});

test("#131: Qin cannot rebuild Chu's opening hand or the draw pile from its view", () => {
  const st = firstDeal(SEED);
  assert.equal(st.phase, "headline");
  assert.equal(st.turn, 1);
  assert.ok(st.hands[CHU].length > 0 && st.draw.length > 0, "the deal happened");

  // Control: with the real seed the attack reproduces the hidden cards exactly.
  const real = rebuild(st.seed, st.options, st.log);
  assert.deepEqual(real.hands[CHU], st.hands[CHU], "control: the attack must work with the real seed");
  assert.deepEqual(real.draw, st.draw, "control: the attack must work with the real seed");

  const v = E.view(st, QIN);
  assert.equal(v.hands[CHU], null, "Chu's hand is hidden from Qin");
  const guess = rebuild(v.seed, v.options, v.log);
  assert.notDeepEqual(guess.hands[CHU], st.hands[CHU], `Qin rebuilt Chu's hand from view.seed ${v.seed}: ${st.hands[CHU].join(" ")}`);
  assert.notDeepEqual(guess.draw, st.draw, `Qin rebuilt the draw pile from view.seed ${v.seed}`);

  // And a spectator, the same way.
  const s = E.view(st, null);
  const sg = rebuild(s.seed, s.options, s.log);
  assert.notDeepEqual(sg.hands[CHU], st.hands[CHU], "a spectator rebuilt Chu's hand from view.seed");
  assert.notDeepEqual(sg.hands[QIN], st.hands[QIN], "a spectator rebuilt Qin's hand from view.seed");
});

test("#131: mid-game (after a reshuffle), Chu cannot rebuild Qin's hand or the draw pile from its view", () => {
  // Play on to the turn-2 headline: turn 1 played out, the turn-2 deal done.
  // The reform deck runs out in that deal, so the discard pile has been
  // reshuffled too: the rng has moved on past the opening shuffle.
  const rng = E.makeRng(SEED ^ 0x9e3779b9);
  let st = E.createGame(SEED);
  const actions = [];
  while (st.winner == null && !(st.turn === 2 && st.phase === "headline")) {
    const who = E.mustAct(st);
    const a = randomAction(st, who[rng.int(who.length)], rng);
    actions.push(a);
    st = E.apply(st, a);
  }
  assert.equal(st.winner, null, "the game reached turn 2");
  assert.ok(st.log.some((e) => e.type === "reshuffle"), "a reshuffle happened (the case the opening shuffle alone does not cover)");
  assert.ok(st.draw.length > 0 && st.hands[QIN].length > 0, "cards left to draw, and a hand to hide");

  // The attack: start the game from the seed and replay the moves. Every move
  // was public as it happened (the log names each play, headline, placement,
  // target and discard), so a seat that has the seed has everything this needs.
  const replay = (seed, options) => {
    try { let g = E.createGame(seed, options); for (const a of actions) g = E.apply(g, a); return g; } catch { return null; }
  };
  const real = replay(st.seed, st.options);
  assert.deepEqual(real && real.hands[QIN], st.hands[QIN], "control: with the real seed the attack rebuilds Qin's hand");
  assert.deepEqual(real && real.draw, st.draw, "control: with the real seed the attack rebuilds the pile");

  const v = E.view(st, CHU);
  assert.equal(v.hands[QIN], null, "Qin's hand is hidden from Chu");
  assert.equal(v.draw, undefined, "the pile itself is not in the view");
  const guess = replay(v.seed, v.options);
  assert.notDeepEqual(guess && guess.hands[QIN], st.hands[QIN], `Chu rebuilt Qin's hand from view.seed ${v.seed}: ${st.hands[QIN].join(" ")}`);
  assert.notDeepEqual(guess && guess.draw, st.draw, `Chu rebuilt the ${st.draw.length}-card draw pile from view.seed ${v.seed}`);
});
