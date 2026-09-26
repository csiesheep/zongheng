// Guard for #128 (BE peer; tests/ is the orchestrator's -- named in the handover). The engine kept only the last 400
// log entries, so a long game lost its first turns and a move whose `play` entry was evicted fell apart: its later
// steps were read as rows of their own (#127 found raw {target}/{removed} placeholders that way).
//
// The issue's two rules, checked here without reading the engine's own grouping or cap:
//   1. a finished game's log still shows how it began (its setup and its whole first turn);
//   2. no move is ever split: every step the log panel groups under a move still has that move's opening entry,
//      and no move loses its later steps.
// The reader for rule 2 is the log panel's grouping, `groupLog` (public/oppmove.js, FE's file), compared with the
// grouping of the full log the test keeps itself from every entry the engine ever showed it.
//
// The long games: bot-vs-bot the way tests/sim.js plays them. #128's measurement found these seeds over 400 entries on
// origin/main 0e558a8 (normal: 62 -> 421, 14 -> 419, 68 -> 415, 11 -> 404, 10 -> 401). A rules change can move a
// game's length, so the test takes the first of them that is still long enough and fails loudly if none is. "Long
// enough" is more than the old cap by more than the game's entries before its first move: a game only 1 over (seed
// 10) lost one setup row, which is its own row, and the split check passed on the old engine without seeing a split.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import { groupLog } from "../public/oppmove.js";

const OLD_CAP = 400;
const SEEDS = [62, 14, 68, 11, 10];

// Every entry the engine ever showed, by its running number; a later copy wins (an event-first play's `use` is
// written back into its entry when the ops are chosen).
function remember(ref, log) { for (const l of log) ref.set(l.i, l); }
const fullLog = (ref) => [...ref.values()].sort((a, b) => a.i - b.i);

// Rule 2 on one log against the full one: each move/headline row the panel builds from `log` has exactly the steps the
// same row has in the full log, and no row standing on its own in `log` was a step of a move in the full log.
function splitMoves(log, full) {
  const fullRows = groupLog(full);
  const rowOf = new Map(); // entry i -> the full-log row it belongs to
  for (const row of fullRows) {
    rowOf.set(row.seq, row);
    for (const s of row.steps || []) rowOf.set(s.i, row);
  }
  const bad = [];
  for (const row of groupLog(log)) {
    const ref = rowOf.get(row.seq);
    if (!ref) { bad.push(`row ${row.seq} is not in the full log`); continue; }
    if (ref.seq !== row.seq) { bad.push(`entry ${row.seq} (${row.entry?.type}) stands alone but belongs to the ${ref.kind} opened by ${ref.seq}`); continue; }
    if (row.steps || ref.steps) {
      const got = (row.steps || []).map((s) => s.i).join(","), want = (ref.steps || []).map((s) => s.i).join(",");
      if (got !== want) bad.push(`${row.kind} ${row.seq} has steps [${got}], the full game has [${want}]`);
    }
  }
  return bad;
}

let played;
function longGame() {
  if (played) return played;
  for (const seed of SEEDS) {
    const rng = E.makeRng((seed * 2654435761) >>> 0);
    let st = E.createGame(seed, {});
    const ref = new Map();
    remember(ref, st.log);
    const problems = [];
    for (let steps = 0; st.winner == null; steps++) {
      if (steps > 6000) throw new Error(`seed ${seed}: no end after ${steps} actions`);
      const who = E.mustAct(st);
      const side = who[rng.int(who.length)];
      st = E.apply(st, B.decide(E.view(st, side), side, "normal", rng));
      remember(ref, st.log);
      if (problems.length < 5) {
        for (const p of splitMoves(st.log, fullLog(ref))) problems.push(`seed ${seed}, entry ${st.logSeq}: ${p}`);
        // a pending ops step writes its real use back into its play entry: that entry must still be there
        for (const s of st.plan) if (s.playSeq && !st.log.some((l) => l.i === s.playSeq && l.type === "play")) problems.push(`seed ${seed}, entry ${st.logSeq}: the play ${s.playSeq} an ops step still waits on is gone`);
      }
    }
    const full = fullLog(ref);
    const firstMove = full.findIndex((l) => l.type === "play" || l.type === "headline");
    if (st.logSeq - OLD_CAP > firstMove + 1) { played = { seed, st, full, problems, firstMove }; return played; }
  }
  throw new Error(`none of seeds ${SEEDS} is past ${OLD_CAP} log entries by more than its opening rows any more: pick new long games`);
}

test("#128: a finished long game's log still shows how it began", () => {
  const { seed, st, full } = longGame();
  assert.ok(st.logSeq > OLD_CAP, `seed ${seed} wrote ${st.logSeq} entries, more than the old cap`);
  assert.equal(full.length, st.logSeq, "the test saw every entry the game wrote");
  // How it began: the setup placements and the whole of turn 1, up to the entry that opens turn 2.
  const turn2 = full.find((l) => l.type === "turn" && l.turn === 2);
  assert.ok(turn2, "the game reached turn 2");
  const opening = full.filter((l) => l.i < turn2.i);
  assert.ok(opening.some((l) => l.type === "setup") && opening.some((l) => l.type === "turn" && l.turn === 1), "the opening has setup and turn 1");
  const kept = new Set(st.log.map((l) => l.i));
  const lost = opening.filter((l) => !kept.has(l.i));
  assert.equal(lost.length, 0, `seed ${seed}: ${lost.length} of the ${opening.length} opening entries are gone from the finished log (first kept entry is ${st.log[0].i}, ${st.log[0].type}, turn ${st.log[0].t})`);
  assert.equal(st.log[0].i, 1, "the log starts at the game's first entry");
});

test("#128: no move is ever split, at any point of a long game", () => {
  const { seed, st, firstMove, problems } = longGame();
  assert.ok(st.logSeq - OLD_CAP > firstMove + 1, `seed ${seed}: ${st.logSeq} entries reach past the old cap into a move (first move at entry ${firstMove + 1})`);
  assert.deepEqual(problems, [], problems.join("\n"));
});

// A full game fits under the cap (see the issue: max 421 entries in 400 games), so the eviction below never runs in a
// real game today. It is tested on its own, with the long game's real log and a cap far under it.
test("#128: when a log does outgrow the cap, whole moves go and the opening stays", () => {
  assert.equal(typeof E.trimLog, "function", "engine exports trimLog(log, cap)");
  const { full } = longGame();
  const turn2 = full.find((l) => l.type === "turn" && l.turn === 2);
  const openingLen = full.filter((l) => l.i < turn2.i).length;
  for (const cap of [openingLen + 40, 150, 300]) {
    const log = E.clone(full);
    E.trimLog(log, cap);
    assert.ok(log.length <= cap, `cap ${cap}: ${log.length} entries left`);
    assert.ok(log.length > cap - 40, `cap ${cap}: only ${log.length} entries left, it dropped far more than it had to`);
    for (let k = 0; k < openingLen; k++) assert.equal(log[k].i, full[k].i, `cap ${cap}: opening entry ${full[k].i} kept`);
    assert.equal(log[log.length - 1].i, full[full.length - 1].i, `cap ${cap}: the latest entry kept`);
    assert.deepEqual(splitMoves(log, full), [], `cap ${cap}: no move split`);
    for (let k = 1; k < log.length; k++) assert.ok(log[k].i > log[k - 1].i, `cap ${cap}: order kept`);
  }
});
