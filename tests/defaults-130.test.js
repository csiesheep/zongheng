// #130 (rewritten by the orchestrator for #132/#133): a saved game whose options do not name `lobby` or `homeFall`
// must play by the rules it was saved under, byte for byte, whatever the defaults and the bots become later.
//
// The first version pinned whole bot-vs-bot games by hash. That also pinned the bots' every decision, so any bot
// improvement (#132 fixes Chu keeping a scoring card) or a new default (#133 turns on the dice 遊說) broke it without
// breaking a single rule. Now the games are recorded once, on 1d73cc4 (the last build with both options off by
// default, byte-identical to the pre-#130 build 01b1b9d: the easy / normal / hard hashes below equal the ones this file
// recorded there), as `tests/fixtures/replays.json`: each game's exact starting state, as a save holds it, every action
// in order, and a sha256 of the final state. The replay feeds those actions to today's engine. No bot runs, so only a
// rule change for an old save can make it fail. Re-record only on purpose: `node tests/fixtures/record-replays.mjs`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

const FIX = JSON.parse(readFileSync(new URL("./fixtures/replays.json", import.meta.url), "utf8"));
const hash = (st) => createHash("sha256").update(JSON.stringify(st)).digest("hex").slice(0, 16);
// The pre-#130 build's own hashes, recorded on 01b1b9d by the first version of this file.
const PRE_130 = { "easy:1": "e5dbcc65b348032a", "easy:2": "5255e28806069a92", "easy:3": "70fc23352415d1de", "easy:4": "5c0b3cd68f659695", "easy:5": "ed8acdeef679fe0a", "normal:7": "20ab2cb6be50061a", "normal:8": "006d08425a6d58f6", "hard:7": "d948bb979f9728f2" };

export function replay(g, onStep) {
  let st = E.clone(g.start);
  for (const a of g.actions) {
    st = E.apply(st, a);
    if (onStep) onStep(st);
  }
  return st;
}

test("defaults: the fixture games are the pre-#130 games (their recorded hashes equal 01b1b9d's)", () => {
  for (const g of FIX.games) {
    const k = `${g.level}:${g.seed}`;
    if (PRE_130[k]) assert.equal(g.hash, PRE_130[k], `${k}: the fixture was not recorded on a pre-#130-equivalent build`);
    assert.ok(!("lobby" in g.start.options) && !("homeFall" in g.start.options), `${k}: a fixture game must not name the new options`);
  }
});

for (const g of FIX.games) {
  test(`defaults: a saved ${g.level} game (seed ${g.seed}, ${g.actions.length} actions) replays byte for byte on today's engine`, () => {
    const st = replay(g);
    assert.ok(st.winner != null, "the replay reached the end");
    assert.equal(hash(st), g.hash);
  });
}

test("defaults: homeFall \"none\" named is the same game as no homeFall at all", () => {
  const withoutOptions = (st) => { const { options: _o, ...rest } = st; return rest; };
  const play = (seed, options) => {
    const rng = E.makeRng((seed * 2654435761) >>> 0);
    let st = E.createGame(seed, options);
    for (let k = 0; st.winner == null && k < 3000; k++) {
      const who = E.mustAct(st), side = who[rng.int(who.length)];
      st = E.apply(st, B.randomAction(st, side, rng));
    }
    return st;
  };
  for (const seed of [1, 2]) {
    const a = play(seed, { homeFall: undefined }), b = play(seed, { homeFall: "none" });
    assert.ok(a.winner != null, "the game finished");
    assert.equal(JSON.stringify(withoutOptions(a)), JSON.stringify(withoutOptions(b)), `seed ${seed}`);
  }
});
