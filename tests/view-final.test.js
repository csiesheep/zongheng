// Guard for #137 (orchestrator-owned): the post-game reveal appears only after the end, and matches the game.
//
// #137 part A made `view()` of a finished game carry `final` (both hands, the piles in order, the seed, the board) for
// every seat and spectators, per the owner's ruling that a finished game is revealed. The #131 guards only looked at the
// top level of a view mid-game, so a reveal leaking into a mid-game view (the peer's falsification: the seed, both
// hands and the draw in every view) left all 14 of them green. This closes that: at every position before the end, no
// view holds `final`, the seed's value, or a card from a pile or hand the viewer cannot see; after the end every
// viewer's `final` equals the raw state, read from the state and not from `view()`.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import { exportGame } from "../public/shared/export.js";

const { QIN, CHU } = E;
const VIEWERS = [QIN, CHU, null];
const GAMES = 25;

function play(seed, onStep) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  // A distinctive game seed, so its value can be searched for in a view's JSON (a seed of 1 would match any 1).
  let st = E.createGame(987654321 + seed, {});
  for (let k = 0; st.winner == null && k < 4000; k++) {
    onStep(st);
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    st = E.apply(st, B.randomAction(st, side, rng));
  }
  return st;
}
// Cards the viewer must not know mid-game: the draw pile and later decks always; the other hand unless the view
// itself shows it (完璧歸趙 reveals it for a turn, and 細作 shows it to the chooser, both by rule).
function hiddenCards(st, v, viewer) {
  const out = new Set([...st.draw, ...Object.values(st.later).flat()]);
  for (const side of [QIN, CHU]) {
    if (side === viewer) continue;
    if (Array.isArray(v.hands?.[side]) && v.hands[side].every((c) => typeof c === "string" && c !== "hidden")) continue;
    for (const c of st.hands[side]) out.add(c);
  }
  return out;
}

test("#137: before the end no view holds final, the seed, or a card it cannot see (Qin, Chu, spectator)", () => {
  let checked = 0;
  for (let seed = 1; seed <= GAMES; seed++) {
    play(seed, (st) => {
      for (const viewer of VIEWERS) {
        const v = E.view(st, viewer);
        assert.equal("final" in v, false, `seed ${seed} t${st.turn} ${st.phase}: a view holds final before the end`);
        assert.equal("seed" in v, false, `seed ${seed}: top-level seed in a view`);
        assert.ok(!JSON.stringify(v).includes(String(st.seed)), `seed ${seed}: the seed's value is in a mid-game view`);
        // The piles and hidden hand, never as a key holding those cards: the draw/later arrays must not appear.
        assert.equal("draw" in v, false); assert.equal("later" in v, false);
        // No card the viewer cannot see appears in the hands the view shows.
        const hidden = hiddenCards(st, v, viewer);
        for (const side of [QIN, CHU]) {
          if (side === viewer || !Array.isArray(v.hands?.[side])) continue;
          for (const c of v.hands[side]) if (typeof c === "string" && hidden.has(c)) assert.fail(`seed ${seed}: viewer ${viewer} sees ${c} in side ${side}'s hand`);
        }
        checked++;
      }
    });
  }
  assert.ok(checked > 1000, `only ${checked} views checked`);
});

test("#137: after the end every viewer's final equals the raw state, and the top-level seed stays out", () => {
  let finished = 0;
  for (let seed = 1; seed <= GAMES; seed++) {
    const st = play(seed, () => {});
    if (st.winner == null) continue;
    finished++;
    for (const viewer of VIEWERS) {
      const v = E.view(st, viewer);
      assert.ok(v.final, `seed ${seed} viewer ${viewer}: no final after the end`);
      assert.equal("seed" in v, false, "the seed lives in final, not at the top level");
      assert.equal(v.final.seed, st.seed);
      assert.deepEqual(v.final.hands, st.hands);
      assert.deepEqual(v.final.draw, st.draw);
      assert.deepEqual(v.final.later, st.later);
      assert.deepEqual(v.final.discard, st.discard);
      assert.deepEqual(v.final.removed, st.removed);
      assert.deepEqual(v.final.inf, st.inf);
    }
  }
  assert.ok(finished >= GAMES - 2, `only ${finished} of ${GAMES} games finished`);
});

test("#137: exportGame follows the contract -- null result and final mid-game, the reveal after, viewer null for a spectator", () => {
  const keys = ["format", "version", "exportedAt", "lang", "game", "result", "log", "final"];
  let mid = null, end = null;
  const st = play(3, (s) => { if (!mid && s.phase === "action" && s.turn === 2) mid = E.clone(s); });
  end = st;
  assert.ok(mid && end.winner != null, "harness reached mid-game and the end");
  const m = exportGame(E.view(mid, CHU), { mode: "room", level: null, names: { qin: "甲", chu: "乙" }, lang: "zh", viewer: CHU, exportedAt: "2026-09-27T00:00:00Z" });
  assert.deepEqual(Object.keys(m), keys);
  assert.equal(m.format, "zongheng-log"); assert.equal(m.version, 1); assert.equal(m.lang, "zh-Hant");
  assert.deepEqual(m.game.names, ["甲", "乙"]); assert.equal(m.game.viewer, CHU); assert.equal(m.game.mode, "room");
  assert.equal(m.result, null); assert.equal(m.final, null);
  assert.ok(!JSON.stringify(m).includes(String(mid.seed)), "no seed in a mid-game export");
  const s = exportGame(E.view(end, null), { mode: "room", names: ["甲", "乙"], lang: "en", viewer: "spectator" });
  assert.equal(s.game.viewer, null); assert.equal(s.lang, "en");
  assert.deepEqual(s.result, { winner: end.winner, reason: end.reason, turn: end.turn, mandate: end.mandate });
  assert.equal(s.final.seed, end.seed);
  assert.deepEqual(s.final.hands, end.hands);
  assert.equal(s.log.length, end.log.length);
});
