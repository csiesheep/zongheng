// #130: the two new engine options, `lobby` and `homeFall`, are off unless named. A game that names
// neither must be the game it was before #130, byte for byte -- the engine AND the bots (the bots
// gain terms for both options, and those terms must not move a default game by one decision).
//
// The hashes below were recorded on origin/main 01b1b9d, before any #130 change, with this very
// file: they are the pre-#130 build's own output, not something the code under test computed.
// A hash is sha256 over the final state (log included) of a game played from a seed:
//   easy    whole games, both seats `randomAction` (the fuzz driver's play)
//   normal  whole games, both seats `decide(view, side, "normal")` (seed 7 lasts to turn 8, seed 8 to turn 7)
//   hard    a whole game, both seats hard (seed 7, to turn 7)
// and `homeFall: "none"` named must give the same bytes as no `homeFall` at all, apart from the
// options object itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

const GOLDEN = {
  easy: { 1: "e5dbcc65b348032a", 2: "5255e28806069a92", 3: "70fc23352415d1de", 4: "5c0b3cd68f659695", 5: "ed8acdeef679fe0a" },
  normal: { 7: "20ab2cb6be50061a", 8: "006d08425a6d58f6" },
  hard: { 7: "d948bb979f9728f2" },
};

function play(seed, level, steps, options = {}) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(seed, options);
  for (let k = 0; st.winner == null && k < steps; k++) {
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    const a = level === "easy" ? B.randomAction(st, side, rng) : B.decide(E.view(st, side), side, level, rng);
    st = E.apply(st, a);
  }
  return st;
}
const hash = (st) => createHash("sha256").update(JSON.stringify(st)).digest("hex").slice(0, 16);
const withoutOptions = (st) => { const { options: _o, ...rest } = st; return rest; };

for (const [level, seeds] of Object.entries(GOLDEN)) {
  const steps = 3000;
  test(`defaults: ${level} games play byte for byte as before #130 (seeds ${Object.keys(seeds).join(", ")})`, () => {
    const got = {};
    for (const seed of Object.keys(seeds)) got[seed] = hash(play(Number(seed), level, steps));
    assert.deepEqual(got, seeds);
  });
}

test("defaults: homeFall \"none\" named is the same game as no homeFall at all", () => {
  for (const seed of [1, 2]) {
    const a = play(seed, "easy", 3000), b = play(seed, "easy", 3000, { homeFall: "none" });
    assert.ok(a.winner != null, "the game finished");
    assert.equal(JSON.stringify(withoutOptions(a)), JSON.stringify(withoutOptions(b)), `seed ${seed}`);
  }
});

test("defaults: neither option is a key of DEFAULT_OPTIONS (absent means today)", () => {
  assert.equal("lobby" in E.DEFAULT_OPTIONS, false);
  assert.equal("homeFall" in E.DEFAULT_OPTIONS, false);
  const st = E.createGame(1);
  assert.equal("lobby" in st.options, false);
  assert.equal("homeFall" in st.options, false);
});
