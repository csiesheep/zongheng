// Guard for #137 part A2 (orchestrator-owned): a finished game replays exactly from its download.
//
// Owner, 2026-09-27: 「可以完整重播」. The engine records every applied action (st.actions); a view never carries them
// before the end (they hold hidden choices: headline picks, cards chosen from a hand); after the end `final.actions`
// does, and `createGame(final.seed, game.options)` plus those actions must rebuild the game byte for byte. The check
// goes through the same path a player's download does: E.view -> exportGame -> E.replay, compared with the raw state.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import { exportGame } from "../public/shared/export.js";
import { createTutorial } from "../public/shared/tutorial.js";

const { QIN, CHU } = E;

function botGame(seed, level, options = {}) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(900000000 + seed, options);
  for (let k = 0; st.winner == null && k < 4000; k++) {
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    const a = level === "easy" ? B.randomAction(st, side, rng) : B.decide(E.view(st, side), side, level, rng);
    st = E.apply(st, a);
  }
  return st;
}
const strip = (st) => { const { actions: _a, ...rest } = st; return rest; };

function replaysExactly(st, viewer) {
  const x = exportGame(E.view(st, viewer), { mode: "solo", viewer, lang: "zh" });
  assert.ok(x.final && Array.isArray(x.final.actions), "a finished game's export carries final.actions");
  assert.equal(x.final.actions.length, st.actions.length);
  const again = E.replay(x.final.seed, x.game.options, x.final.actions);
  assert.equal(JSON.stringify(again), JSON.stringify(st), "the replay is the game, byte for byte");
  return x;
}

test("#137 A2: finished games replay exactly from their export (easy, normal, hard; Qin, Chu, spectator exports)", () => {
  const plan = [["easy", [1, 2, 3, 4, 5, 6]], ["normal", [7, 8, 9, 10]], ["hard", [11, 12]]];
  let n = 0;
  for (const [level, seeds] of plan) for (const seed of seeds) {
    const st = botGame(seed, level);
    assert.ok(st.winner != null, `${level} ${seed} finished`);
    replaysExactly(st, [QIN, CHU, null][seed % 3]);
    n++;
  }
  assert.equal(n, 12);
});

test("#137 A2: non-default options replay too (replay from the export's game.options starts where the game did)", () => {
  for (const [i, options] of [{ lobby: undefined, homeFall: undefined, seals: 4 }, { homeFall: "move", lobby: "realign" }, { emperor: "vp", reach: "chain" }].entries()) {
    const st = botGame(20 + i, "easy", options);
    const x = replaysExactly(st, null);
    assert.equal(JSON.stringify(strip(E.replay(x.final.seed, x.game.options, []))), JSON.stringify(strip(E.createGame(st.seed, options))), `options set ${i}: the replay starts where the game did`);
  }
});

test("#137 A2: no view holds the action list before the end; after it, only final does", () => {
  const rng = E.makeRng(77);
  let st = E.createGame(900000077, {});
  let views = 0;
  for (let k = 0; st.winner == null && k < 4000; k++) {
    for (const viewer of [QIN, CHU, null]) {
      const v = E.view(st, viewer);
      assert.equal("actions" in v, false, `step ${k}: a mid-game view holds actions`);
      assert.equal("final" in v, false);
      views++;
    }
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    st = E.apply(st, B.randomAction(st, side, rng));
  }
  assert.ok(views > 300);
  for (const viewer of [QIN, CHU, null]) {
    const v = E.view(st, viewer);
    assert.equal("actions" in v, false, "the top level stays clean after the end too");
    assert.deepEqual(v.final.actions, st.actions);
  }
});

test("#137 A2: a refused action records nothing; the count equals the accepted applies", () => {
  const rng = E.makeRng(5);
  let st = E.createGame(900000005, {});
  let accepted = 0;
  for (let k = 0; st.winner == null && k < 60; k++) {
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    assert.throws(() => E.apply(st, { type: "play", side: 1 - side, card: "nope", use: "event" }));
    st = E.apply(st, B.randomAction(st, side, rng));
    accepted++;
  }
  assert.equal(st.actions.length, accepted);
});

test("#137 A2: an old save (no action list) and the tutorial are marked not replayable", () => {
  const st = botGame(31, "easy");
  delete st.actions;
  const x = exportGame(E.view(st, null), { mode: "solo" });
  assert.ok(x.final, "the reveal is still there");
  assert.equal("actions" in x.final, false, "no final.actions marks an unreplayable game");
  assert.throws(() => E.replay(x.final.seed, x.game.options, x.final.actions), /no recorded actions/);
  assert.equal("actions" in createTutorial(), false, "the tutorial's hand-built position records nothing");
});

test("#137 A2: an export names the rules it was recorded under; a missing option key stays missing in the replay", () => {
  const st = E.createGame(900000041, {});
  assert.equal(st.rulesVersion, E.RULES_VERSION);
  assert.equal(exportGame(E.view(st, null), {}).game.rulesVersion, E.RULES_VERSION);
  const older = E.clone(st); older.rulesVersion = "2020-01-01";
  assert.equal(exportGame(E.view(older, null), {}).game.rulesVersion, "2020-01-01", "a game keeps the version it was created under");
  const pre = E.clone(st); delete pre.rulesVersion;
  assert.equal(exportGame(E.view(pre, null), {}).game.rulesVersion, null);
  // A recording without a key (as a game recorded before a new option existed) replays with that key absent.
  const g = botGame(42, "easy", { lobby: undefined, homeFall: undefined });
  const x = JSON.parse(JSON.stringify(exportGame(E.view(g, null), {})));
  assert.equal("lobby" in x.game.options, false);
  const again = E.replay(x.final.seed, x.game.options, x.final.actions);
  assert.deepEqual(Object.keys(again.options).sort(), Object.keys(x.game.options).sort(), "no key filled from today's defaults");
  assert.equal(JSON.stringify(again), JSON.stringify(g));
});
