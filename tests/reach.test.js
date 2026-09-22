// #104: the `reach` option. "control" is today's rule (place where you have
// influence or next to a space you control, re-read point by point, so a
// point that wins control opens that space's neighbours in the same action).
// "ts" is Twilight Struggle 6.1 (option B in the issue): place where you have
// influence or next to a space where you have any influence, with the set of
// eligible spaces fixed at the start of the place action.
//
// Every expectation here is written by hand from the map in the rulebook
// (board.js adjacency, stability) and the rule text above, not computed by
// the engine: the lists of neighbours are spelled out.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";

const { QIN, CHU } = E;

// A board with nothing on it but what the test puts there.
function bare(options, inf) {
  const st = E.createGame(7, options);
  st.inf = {};
  for (const [id, [q, c]] of Object.entries(inf)) st.inf[id] = [q, c];
  st.log = [];
  return st;
}

// 宜陽 (yiyang, stability 2) neighbours, from the rulebook map: 函谷關, 洛邑, 新鄭, 上黨.
const YIYANG_AND_NEIGHBOURS = ["hangu", "luoyi", "shangdang", "xinzheng", "yiyang"];

test("reach: the option exists, defaults to control, and a state without it plays as control", () => {
  assert.equal(E.DEFAULT_OPTIONS.reach, "control");
  const legacy = bare({}, { yiyang: [1, 0] });
  delete legacy.options.reach;
  assert.equal(E.canPlaceAt(legacy, QIN, "shangdang"), false, "no control next to 上黨: not placeable under today's rule");
  assert.throws(() => E.placePoints(E.clone(legacy), QIN, ["shangdang"], 1), /not reachable/);
});

test("reach=ts: a space next to your influence (not control) is placeable", () => {
  // 秦 has 1 in 宜陽 (stability 2): influence, not control.
  const ts = bare({ reach: "ts" }, { yiyang: [1, 0] });
  assert.equal(E.controller(ts, "yiyang"), null, "sanity: 宜陽 is not controlled");
  assert.equal(E.canPlaceAt(ts, QIN, "shangdang"), true);
  const spent = E.placePoints(ts, QIN, ["shangdang"], 1);
  assert.equal(spent, 1);
  assert.deepEqual(E.infOf(ts, "shangdang"), [1, 0]);
  // Exactly 宜陽 and its four neighbours are offered, nothing else (on the board before that point).
  const offered = E.opsOptions(bare({ reach: "ts" }, { yiyang: [1, 0] }), QIN).placeOptions.map((o) => o.id).sort();
  assert.deepEqual(offered, YIYANG_AND_NEIGHBOURS);
  // The same board under today's rule offers 宜陽 only.
  const ctl = bare({ reach: "control" }, { yiyang: [1, 0] });
  assert.equal(E.canPlaceAt(ctl, QIN, "shangdang"), false);
  assert.deepEqual(E.opsOptions(ctl, QIN).placeOptions.map((o) => o.id), ["yiyang"]);
});

test("reach=ts: a space reachable only through a point placed earlier in the same action is refused", () => {
  // 邯鄲 (handan) neighbours: 河東, 上黨, 大梁, 中山 — none has 秦 influence at the start.
  // 上黨 gets a 秦 point first; under ts that does not open 邯鄲.
  const ts = bare({ reach: "ts" }, { yiyang: [1, 0] });
  assert.throws(() => E.placePoints(ts, QIN, ["shangdang", "handan"], 2), /handan is not reachable/);
  // Even when the earlier points win control of 上黨 (2 of stability 2).
  const ts2 = bare({ reach: "ts" }, { yiyang: [1, 0] });
  assert.throws(() => E.placePoints(ts2, QIN, ["shangdang", "shangdang", "handan"], 3), /handan is not reachable/);
  // And a space eligible at the start stays eligible: 上黨 twice is fine.
  const ts3 = bare({ reach: "ts" }, { yiyang: [1, 0] });
  assert.equal(E.placePoints(ts3, QIN, ["shangdang", "shangdang"], 2), 2);
});

test("reach=control: the old chaining still works", () => {
  // 宜陽 1 -> 2 wins control, which opens 上黨; 上黨 0 -> 2 wins control, which opens 邯鄲.
  const ctl = bare({ reach: "control" }, { yiyang: [1, 0] });
  const spent = E.placePoints(ctl, QIN, ["yiyang", "shangdang", "shangdang", "handan"], 4);
  assert.equal(spent, 4);
  assert.deepEqual(E.infOf(ctl, "handan"), [1, 0]);
  // The default (no option given) chains the same way.
  const def = bare({}, { yiyang: [1, 0] });
  assert.equal(E.placePoints(def, QIN, ["yiyang", "shangdang", "shangdang", "handan"], 4), 4);
  // And the same payload is refused under ts (邯鄲 was not eligible at the start).
  const ts = bare({ reach: "ts" }, { yiyang: [1, 0] });
  assert.throws(() => E.placePoints(ts, QIN, ["yiyang", "shangdang", "shangdang", "handan"], 4), /handan is not reachable/);
});

test("reach=ts: the cost (2 into an enemy-controlled space, re-read per point) and the cap do not change", () => {
  // 楚 controls 上黨 with 2 (stability 2). 秦 has 1 in 宜陽 next to it.
  // First 秦 point costs 2 (enemy-controlled), then 楚 2 < 1 + 2: not controlled, the second costs 1.
  const a = bare({ reach: "ts" }, { yiyang: [1, 0], shangdang: [0, 2] });
  assert.equal(E.placeCost(a, QIN, "shangdang"), 2);
  assert.equal(E.placePoints(a, QIN, ["shangdang", "shangdang"], 3), 3);
  const b = bare({ reach: "ts" }, { yiyang: [1, 0], shangdang: [0, 2] });
  assert.throws(() => E.placePoints(b, QIN, ["shangdang", "shangdang"], 2), /not enough ops/);
  // Cap = stability + 2 = 4 in 上黨: a fifth point is refused.
  const c = bare({ reach: "ts" }, { yiyang: [1, 0], shangdang: [4, 0] });
  assert.throws(() => E.placePoints(c, QIN, ["shangdang"], 1), /at the cap/);
});

test("reach=ts: the bots only place in spaces eligible at the start, and the engine accepts what they choose", () => {
  // 秦: 1 in 宜陽 only; a 4-ops placement. Eligible at the start: 宜陽 and its neighbours.
  const eligible = new Set(YIYANG_AND_NEIGHBOURS);
  const st = bare({ reach: "ts" }, { yiyang: [1, 0], guanzhong: [0, 0] });
  const greedy = B.greedyPlacement(st, QIN, 4);
  assert.ok(greedy.length > 0, "greedy placed something");
  for (const id of greedy) assert.ok(eligible.has(id), `greedy placed in ${id}, not eligible at the start`);
  E.placePoints(E.clone(st), QIN, greedy, 4);
  for (let seed = 1; seed <= 200; seed++) {
    const rng = E.makeRng(seed);
    const pts = B.randomPoints(st, QIN, 4, rng);
    for (const id of pts) assert.ok(eligible.has(id), `random (seed ${seed}) placed in ${id}, not eligible at the start`);
    E.placePoints(E.clone(st), QIN, pts, 4);
  }
});

test("reach=control: the bots still chain (the greedy placement reaches past the start set)", () => {
  // Alive check for the control branch of the bots: with 3 in 宜陽 (control) and nothing else,
  // a 4-ops random placement that wins 上黨 can go on to 邯鄲. Over 200 seeds at least one does.
  const st = bare({ reach: "control" }, { yiyang: [2, 0] });
  let chained = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const pts = B.randomPoints(st, QIN, 4, E.makeRng(seed));
    E.placePoints(E.clone(st), QIN, pts, 4);
    if (pts.some((id) => !YIYANG_AND_NEIGHBOURS.includes(id))) chained++;
  }
  assert.ok(chained > 0, "no random placement ever chained under control");
});

test("reach=ts: a whole game between bots finishes with no refused move", () => {
  for (const seed of [1, 2, 3]) {
    const rng = E.makeRng(seed * 7919);
    let st = E.createGame(seed, { reach: "ts" });
    for (let steps = 0; st.winner == null; steps++) {
      assert.ok(steps < 6000, `seed ${seed}: no end`);
      const who = E.mustAct(st);
      const side = who[rng.int(who.length)];
      const a = B.decide(E.view(st, side), side, "normal", rng);
      st = E.apply(st, a);
    }
    assert.ok(st.winner === QIN || st.winner === CHU);
  }
});
