// Random legal games, many seeds, invariants after every action. This is
// what catches the rules the unit tests did not think of.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { playRandomGame } from "./driver.js";

const GAMES = Number(process.env.FUZZ_GAMES || 60);
const REASONS = new Set(["unification", "alliance", "mandate", "collapse", "scoring", "scoringBoth", "final", "tie"]);
const ALL = E.CARDS.map((c) => c.id).sort();

function checkInvariants(st, seed) {
  for (const [id, [q, c]] of Object.entries(st.inf)) {
    assert.ok(q >= 0 && c >= 0, `${seed}: negative influence at ${id}`);
    assert.ok(q <= E.capOf(st, id) && c <= E.capOf(st, id), `${seed}: over the cap at ${id}: ${q}/${c}`);
  }
  assert.ok(st.weariness >= 1 && st.weariness <= 5, `${seed}: weariness ${st.weariness}`);
  if (st.winner == null) assert.ok(Math.abs(st.mandate) < E.MANDATE_TO_WIN, `${seed}: mandate ${st.mandate} without a winner`);
  for (const s of [0, 1]) assert.ok(st.reform[s] >= 0 && st.reform[s] <= 6, `${seed}: reform ${st.reform[s]}`);
  for (const h of st.hands) for (const c of h) assert.ok(E.CARD[c], `${seed}: unknown card ${c} in hand`);
  assert.ok(!st.hands.flat().includes(E.JIUDING), `${seed}: the cauldrons are in a hand`);
  // Card conservation whenever no card is in flight.
  if (!st.plan.length && !st.pending && st.winner == null) {
    const seen = [...st.draw, ...st.discard, ...st.removed, ...st.hands[0], ...st.hands[1], ...Object.values(st.later).flat()];
    if (st.phase === "headline") for (const c of st.headline) if (c) seen.push(c);
    assert.deepEqual(seen.slice().sort(), ALL, `${seed}: cards are not conserved (turn ${st.turn}, phase ${st.phase})`);
  }
  if (st.winner == null) assert.ok(E.mustAct(st).length > 0, `${seed}: nobody to act`);
}

test(`fuzz: ${GAMES} random games end legally and keep every invariant`, () => {
  const ends = {}, turns = [];
  let qinWins = 0, totalActions = 0;
  for (let seed = 1; seed <= GAMES; seed++) {
    const { st, actions } = playRandomGame(seed, {}, { onStep: (s) => checkInvariants(s, seed) });
    assert.ok(REASONS.has(st.reason), `${seed}: odd reason ${st.reason}`);
    assert.ok(st.winner === 0 || st.winner === 1, `${seed}: no winner`);
    ends[st.reason] = (ends[st.reason] || 0) + 1;
    turns.push(st.turn);
    if (st.winner === E.QIN) qinWins++;
    totalActions += actions;
  }
  const meanTurn = (turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1);
  console.log(`fuzz: ${GAMES} games, Qin ${qinWins}, mean turn ${meanTurn}, mean actions ${(totalActions / GAMES).toFixed(0)}, ends ${JSON.stringify(ends)}`);
});

test("fuzz: the same seed and actions replay to the same state", () => {
  const log = [];
  const a = playRandomGame(7, {}, { onStep: (s, action) => log.push(action) });
  let st = E.createGame(7);
  for (const action of log) st = E.apply(st, action);
  assert.deepEqual(st.inf, a.st.inf);
  assert.equal(st.mandate, a.st.mandate);
  assert.equal(st.winner, a.st.winner);
  assert.equal(st.reason, a.st.reason);
});
