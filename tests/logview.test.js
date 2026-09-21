// Guard for the log redesign (orchestrator-owned, #88, design A 逐手卷軸). public/oppmove.js gains groupLog(log): the WHOLE
// log, both sides, in time order, as the rows the log panel draws: turn headers, headlines, one row per card played with
// its steps, and anything logged outside a move as its own row. DOM-free, so this pins the grouping the panel trusts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupLog } from "../public/oppmove.js";

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
  { i: 11, t: 1, r: 6, type: "endTurn" },
  { i: 12, t: 2, r: 0, type: "turn", turn: 2, era: "reform" },
];

test("the whole log, both sides, in time order: setup, turn, headline, moves, then loose entries", () => {
  const rows = groupLog(LOG);
  assert.deepEqual(rows.map((r) => r.kind), ["setup", "setup", "turn", "headline", "move", "move", "other", "turn"]);
  const [s0, s1, t1, h, qin, chu, end, t2] = rows;
  assert.equal(s0.side, 0);
  assert.deepEqual(s0.spaces, [["guanzhong", 2], ["hangu", 2]], "setup points collapse into [space, count]");
  assert.deepEqual(s1.spaces, [["linzi", 3], ["jimo", 1]]);
  assert.equal(t1.turn, 1);
  assert.equal(t1.era, "reform");
  assert.deepEqual(h.cards, ["zhouzuo", "suqin"], "a headline row carries both cards");
  assert.equal(h.first, 1);
  assert.equal(qin.side, 0);
  assert.equal(qin.card, "huanghe");
  assert.equal(qin.round, 1);
  assert.equal(qin.turn, 1);
  assert.deepEqual(qin.steps.map((s) => s.type), ["place"]);
  assert.deepEqual(qin.steps[0].spaces, [["hanzhong", 2]]);
  assert.equal(chu.side, 1);
  assert.equal(chu.card, "shangyang");
  assert.deepEqual(chu.steps.map((s) => s.type), ["reform", "vp", "place"], "a move keeps every step, whoever it happened to");
  assert.deepEqual(chu.steps[2].spaces, [["daliang", 2], ["handan", 1]]);
  assert.equal(end.entry.type, "endTurn", "an entry outside any move is its own row, carrying the entry");
  assert.equal(t2.turn, 2);
});

test("every row keeps its log index, and odd input never throws", () => {
  const rows = groupLog(LOG);
  assert.deepEqual(rows.map((r) => r.seq), [1, 2, 3, 4, 5, 7, 11, 12]);
  for (const bad of [null, undefined, [], [{}], [{ type: "play" }], [{ i: 1, type: "place", points: ["x"] }]]) assert.doesNotThrow(() => groupLog(bad));
  assert.deepEqual(groupLog(null), []);
});
