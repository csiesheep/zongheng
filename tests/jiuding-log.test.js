// Guard for #81 (orchestrator-owned). Playing the Nine Cauldrons must log a `play` entry like every other card: without it
// the news, the opponent's-move reveal (#79) and anything else reading the log cannot tell a Cauldrons move started.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { decide } from "../public/shared/bots.js";
import { opponentMoves } from "../public/oppmove.js";

function findCauldronsPlay() {
  for (let seed = 1; seed < 80; seed++) {
    let st = E.createGame(seed);
    for (let n = 0; n < 3000 && st.winner == null; n++) {
      let moved = false;
      for (const s of [0, 1]) {
        const L = E.legal(st, s);
        if (!L || !["action", "headline", "pending"].includes(L.kind)) continue;
        const act = decide(E.view(st, s), s, "normal", E.makeRng(seed * 7919 + n));
        if (!act) continue;
        if (act.type === "play" && act.card === E.JIUDING) return { st, act: { ...act, side: s } };
        st = E.apply(st, { ...act, side: s }); moved = true; break;
      }
      if (!moved) break;
    }
  }
  return null;
}

test("playing the Nine Cauldrons logs a play entry, then its ops", () => {
  const found = findCauldronsPlay();
  assert.ok(found, "no Cauldrons play found in 80 seeds");
  const { st, act } = found;
  const before = st.log.length ? st.log[st.log.length - 1].i : 0;
  const after = E.apply(st, act);
  const fresh = after.log.filter((e) => e.i > before);
  assert.equal(fresh[0]?.type, "play", `first new entry is ${fresh[0]?.type}`);
  assert.equal(fresh[0].card, E.JIUDING);
  assert.equal(fresh[0].side, act.side);
  assert.equal(fresh[0].use, act.use);
  assert.ok(fresh.some((e) => ["place", "campaign", "lobby"].includes(e.type)), "the ops still log after the play entry");
  // and the reveal groups it as a move of the side that played it, never of the other side
  const seen = opponentMoves(after.log, before, 1 - act.side);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].card, E.JIUDING);
  assert.equal(opponentMoves(after.log, before, act.side).length, 0, "the player's own Cauldrons move is not an opponent move");
});

test("the player's own Cauldrons steps never land on the opponent's previous move", () => {
  const log = [
    { i: 1, type: "play", side: 1, card: "weiwei", use: "event" },
    { i: 2, type: "place", side: 1, points: ["handan"] },
    { i: 3, type: "play", side: 0, card: "jiuding", use: "campaign" },
    { i: 4, type: "campaign", side: 0, target: "luoyi", ops: 4, removed: 2, placed: 0 },
  ];
  const moves = opponentMoves(log, 0, 0);
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0].steps.map((s) => s.type), ["place"], "Qin's Cauldrons campaign is not a step of Chu's weiwei");
});
