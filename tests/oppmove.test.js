// Guard for the opponent's-move reveal (orchestrator-owned, #79). public/oppmove.js is DOM-free: it reads the game log and
// groups what the OTHER side did since the player last acted into moves, one per card played (or headline), each with its
// steps in the order they happened. The page animates these; this test pins the grouping so the page can trust it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { opponentMoves } from "../public/oppmove.js";

// The owner's design example (canvas page 對手的一手): Chu plays Qin's 商鞅變法 for place; Qin's event fires (reform, mandate);
// then Chu places 大梁 twice and 邯鄲 once. Entries 1-6 come before; entry 5-6 is the player's (Qin's) own move.
const LOG = [
  { i: 1, t: 0, r: 0, type: "setup", side: 0, points: ["guanzhong", "guanzhong", "hangu", "hangu"] },
  { i: 2, t: 0, r: 0, type: "setup", side: 1, points: ["linzi", "linzi", "linzi", "jimo"] },
  { i: 3, t: 1, r: 0, type: "turn", turn: 1, era: "reform" },
  { i: 4, t: 1, r: 0, type: "headline", cards: ["zhouzuo", "suqin"], first: 1 },
  { i: 5, t: 1, r: 1, type: "play", side: 0, card: "huanghe", use: "place" },
  { i: 6, t: 1, r: 1, type: "place", side: 0, points: ["hanzhong", "hanzhong"], spent: 2 },
  { i: 7, t: 1, r: 1, type: "play", side: 1, card: "shangyang", use: "place" },
  { i: 8, t: 1, r: 1, type: "reform", side: 0, box: 1 },
  { i: 9, t: 1, r: 1, type: "vp", side: 0, n: 1, mandate: 1 },
  { i: 10, t: 1, r: 1, type: "place", side: 1, points: ["daliang", "handan", "daliang"], spent: 3 },
];

test("one opponent move: its card, use and steps in order; the player's own move is not included", () => {
  const moves = opponentMoves(LOG, 6, 0);
  assert.equal(moves.length, 1);
  const m = moves[0];
  assert.equal(m.side, 1);
  assert.equal(m.card, "shangyang");
  assert.equal(m.use, "place");
  assert.equal(m.seq, 7, "seq is the log index of the play entry");
  assert.deepEqual(m.steps.map((s) => s.type), ["reform", "vp", "place"]);
  assert.equal(m.steps[0].side, 0, "a step keeps the side it happened to (Qin's reform, from Qin's card)");
  assert.equal(m.steps[1].n, 1);
  // a placement's points collapse into [space, count] pairs, in the order each space first appears
  assert.deepEqual(m.steps[2].spaces, [["daliang", 2], ["handan", 1]]);
});

test("sinceSeq decides what is new: nothing after the last entry, everything of theirs after an earlier one", () => {
  assert.deepEqual(opponentMoves(LOG, 10, 0), []);
  const fromChu = opponentMoves(LOG, 4, 1); // seen from Chu's seat: Qin's move 5-6 is the opponent's
  // Qin's play (5-6) is the only opponent move; entries 8-10 (Qin's reform and mandate included) belong to Chu's own move 7
  assert.equal(fromChu.length, 1);
  assert.equal(fromChu[0].side, 0);
  assert.equal(fromChu[0].card, "huanghe");
  assert.deepEqual(fromChu[0].steps.map((s) => s.type), ["place"]);
  assert.deepEqual(fromChu[0].steps[0].spaces, [["hanzhong", 2]]);
});

test("a headline reveals the opponent's headline card", () => {
  const moves = opponentMoves(LOG.slice(0, 4), 3, 0);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].use, "headline");
  assert.equal(moves[0].card, "suqin", "Qin is seat 0, so the opponent's headline is cards[1]");
  assert.equal(opponentMoves(LOG.slice(0, 4), 3, 1)[0].card, "zhouzuo");
});

test("several opponent moves come back in order, and odd input never throws", () => {
  const log = [
    ...LOG,
    { i: 11, t: 1, r: 2, type: "play", side: 0, card: "simacuo", use: "place" },
    { i: 12, t: 1, r: 2, type: "place", side: 0, points: ["yiyang"], spent: 1 },
    { i: 13, t: 1, r: 2, type: "play", side: 1, card: "weiwei", use: "campaign" },
    { i: 14, t: 1, r: 2, type: "campaign", side: 1, target: "luoyi", ops: 3, removed: 2, placed: 0 },
    { i: 15, t: 1, r: 3, type: "play", side: 1, card: "daji", use: "lobby" },
    { i: 16, t: 1, r: 3, type: "lobby", side: 1, target: "yiyang", ops: 2, edge: 1, removed: 1 },
  ];
  const moves = opponentMoves(log, 6, 0);
  assert.deepEqual(moves.map((m) => m.card), ["shangyang", "weiwei", "daji"]);
  assert.equal(moves[1].steps[0].type, "campaign");
  assert.equal(moves[1].steps[0].target, "luoyi");
  assert.equal(moves[2].steps[0].target, "yiyang");
  for (const bad of [null, undefined, [], [{}], [{ type: "play" }]]) assert.doesNotThrow(() => opponentMoves(bad, 0, 0));
  assert.deepEqual(opponentMoves(null, 0, 0), []);
});
