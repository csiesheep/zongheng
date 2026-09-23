// #107: placement rule B is the rule (owner, 2026-09-22: 「B 改成預設」).
// `reach` defaults to "ts": place where you have influence, or next to any
// space where you have influence, with the eligible set FIXED at the start of
// the place action. Cost (2 per point into an enemy-controlled space, re-read
// per point) and the cap (stability + 2) are unchanged.
//
// Every expectation below is written by hand from the rulebook map
// (board.js's `adj`/`stability`) and the rule text above, or from the engine's
// own refusal on the real path (`placePoints`). Nothing here asks the code
// under test — `placeTargets` — what the answer should be.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import { advise } from "../public/shared/advisor.js";

const { QIN, CHU, SPACES } = E;

function bare(options, inf) {
  const st = E.createGame(7, options);
  st.inf = {};
  for (const [id, [q, c]] of Object.entries(inf)) st.inf[id] = [q, c];
  st.log = [];
  return st;
}
const sorted = (s) => [...s].sort();

// ---------- 1. the default ----------

test("#107: the default reach is ts, and a new game carries it", () => {
  assert.equal(E.DEFAULT_OPTIONS.reach, "ts");
  assert.equal(E.createGame(11).options.reach, "ts");
  assert.equal(E.createGame(11, { cap: 3 }).options.reach, "ts", "another option given must not drop reach");
  // 宜陽's neighbour 上黨 is now placeable off one point of influence (no control).
  const def = bare({}, { yiyang: [1, 0] });
  assert.equal(E.canPlaceAt(def, QIN, "shangdang"), true);
  // And #104's chaining payload is now refused by default: 邯鄲 was not
  // eligible at the start (its neighbours 河東 上黨 大梁 中山 hold no 秦 point).
  const def2 = bare({}, { yiyang: [1, 0] });
  assert.throws(() => E.placePoints(def2, QIN, ["yiyang", "shangdang", "shangdang", "handan"], 4), /handan is not reachable/);
});

test("#107: a save with no reach key keeps the rule its game started under (control)", () => {
  // A game in progress must not change rules under the players: the engine
  // reads a missing `reach` as "control" (#104) and nothing migrates it.
  const legacy = bare({}, { yiyang: [1, 0] });
  delete legacy.options.reach;
  assert.equal(E.canPlaceAt(legacy, QIN, "shangdang"), false, "no 秦 control next to 上黨");
  const chain = bare({}, { yiyang: [1, 0] });
  delete chain.options.reach;
  assert.equal(E.placePoints(chain, QIN, ["yiyang", "shangdang", "shangdang", "handan"], 4), 4,
    "the old chaining must still resolve in a game that started before the flip");
});

// ---------- 2. the lit set, by hand ----------
//
// The board: 秦 has one point in 宜陽 (stability 2, so influence, not control)
// and the board is otherwise empty. 宜陽's neighbours, from the map: 函谷關,
// 洛邑, 新鄭, 上黨. So the eligible set at the start of the action is exactly
// those four plus 宜陽 itself. 上黨's own neighbours are 宜陽, 河東, 邯鄲, 新鄭
// — 河東 and 邯鄲 are the two spaces a point in 上黨 would open if the set were
// re-read point by point, and they are exactly what the rule forbids.
const START_SET = ["hangu", "luoyi", "shangdang", "xinzheng", "yiyang"];
const OPENED_BY_SHANGDANG = ["handan", "hedong"];

test("#107: after a point mid-action the lit set is still the action-start set", () => {
  const st = bare({}, { yiyang: [1, 0] });
  assert.deepEqual(sorted(E.placeTargets(st, QIN, 3, []).lit), START_SET, "before the first point");
  // One point into 上黨: 秦 now has influence there, so re-reading the rule
  // point by point would open 河東 and 邯鄲. The rule says it must not.
  const after1 = E.placeTargets(st, QIN, 3, ["shangdang"]);
  assert.deepEqual(sorted(after1.lit), START_SET);
  for (const id of OPENED_BY_SHANGDANG) assert.ok(!after1.lit.has(id), `${id} must stay dark`);
  // Two points into 上黨 (stability 2, 楚 0): 秦 now CONTROLS it. Still nothing new.
  const trial = E.clone(st);
  E.place(trial, QIN, "shangdang", 2);
  assert.equal(E.controller(trial, "shangdang"), QIN, "sanity: two points take 上黨");
  const after2 = E.placeTargets(st, QIN, 3, ["shangdang", "shangdang"]);
  assert.deepEqual(sorted(after2.lit), START_SET);
  // The engine refuses both of the spaces the old lighting would have lit.
  for (const id of OPENED_BY_SHANGDANG) {
    assert.throws(() => E.placePoints(E.clone(st), QIN, ["shangdang", "shangdang", id], 3),
      new RegExp(`${id} is not reachable`));
  }
});

test("#107: under reach=control the lit set still chains, point by point", () => {
  // The other branch stays alive: 宜陽 1 -> 2 wins control, which opens 上黨.
  const st = bare({ reach: "control" }, { yiyang: [1, 0] });
  assert.deepEqual(sorted(E.placeTargets(st, QIN, 4, []).lit), ["yiyang"]);
  assert.deepEqual(sorted(E.placeTargets(st, QIN, 4, ["yiyang"]).lit), ["hangu", "luoyi", "shangdang", "xinzheng", "yiyang"]);
});

test("#107: the cap and the enemy-control cost still filter the lit set", () => {
  // 楚 controls 上黨 with 2 (stability 2): the first 秦 point there costs 2.
  const st = bare({}, { yiyang: [1, 0], shangdang: [0, 2] });
  const two = E.placeTargets(st, QIN, 2, []);
  assert.equal(two.costs.shangdang, 2);
  assert.equal(two.costs.yiyang, 1);
  // One op left: 上黨 cannot be paid for, the rest can.
  const one = E.placeTargets(st, QIN, 1, []);
  assert.ok(!one.lit.has("shangdang"), "2 ops needed, 1 left");
  assert.deepEqual(sorted(one.lit), ["hangu", "luoyi", "xinzheng", "yiyang"]);
  // At the cap (stability 2 + 2 = 4) a space goes dark even though it is eligible.
  const full = bare({}, { yiyang: [4, 0] });
  assert.ok(!E.placeTargets(full, QIN, 3, []).lit.has("yiyang"), "宜陽 is at the cap");
});

// ---------- 3. lit set == legal set, over real mid-action states ----------
//
// The expectation is not another copy of the lighting: for each space it asks
// the rules door itself — `placePoints` with the points picked so far plus
// that one — and requires "lit" and "accepted" to be the same answer.
function acceptsNext(st, side, ops, points, id) {
  try { E.placePoints(E.clone(st), side, [...points, id], ops); return true; } catch { return false; }
}
function checkOneState(st, side, ops, label, counts) {
  const points = [];
  for (let step = 0; step <= ops; step++) {
    const { lit } = E.placeTargets(st, side, ops, points);
    for (const sp of SPACES) {
      const ok = acceptsNext(st, side, ops, points, sp.id);
      counts.checks++;
      if (lit.has(sp.id) && !ok) { counts.litIllegal++; counts.first ??= `${label} [${points}] ${sp.id}: lit but refused`; }
      if (!lit.has(sp.id) && ok) { counts.darkLegal++; counts.first ??= `${label} [${points}] ${sp.id}: legal but dark`; }
    }
    if (!lit.size) break;
    points.push(sorted(lit)[step % lit.size]); // walk a different branch each step
  }
}

test("#107: the lit set equals the engine's legal set, mid-action, over real games", () => {
  const counts = { checks: 0, litIllegal: 0, darkLegal: 0, first: null };
  for (const seed of [1, 2, 3, 4, 5]) {
    const rng = E.makeRng(seed * 104729);
    let st = E.createGame(seed);
    for (let steps = 0; st.winner == null && steps < 400; steps++) {
      const who = E.mustAct(st);
      const side = who[rng.int(who.length)];
      const L = E.legal(E.view(st, side), side);
      if (L.kind === "action") {
        for (const c of L.cards) if (c.uses.place) checkOneState(E.view(st, side), side, c.uses.place.ops, `seed ${seed} ${c.id}`, counts);
      } else if (L.kind === "pending" && L.pending.kind === "ops" && L.pending.allowed.includes("place")) {
        checkOneState(E.view(st, side), side, L.pending.ops, `seed ${seed} pending`, counts);
      }
      st = E.apply(st, B.decide(E.view(st, side), side, "normal", rng));
    }
  }
  assert.ok(counts.checks > 5000, `only ${counts.checks} space checks`);
  assert.equal(counts.litIllegal, 0, `lit but refused: ${counts.first}`);
  assert.equal(counts.darkLegal, 0, `legal but dark: ${counts.first}`);
});

test("#107: the map's lighting goes through the engine, not its own copy of the rule", () => {
  // public/app.js used to re-read `E.canPlaceAt(trial, me, sp.id)` per point,
  // which under "ts" lights spaces the engine refuses (#104's checker: two of
  // them right after the first point, with the refusal only at Confirm).
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.ok(/E\.placeTargets\(/.test(app), "app.js must light place targets from E.placeTargets");
  assert.ok(!/E\.canPlaceAt\(/.test(app), "app.js must not carry its own reach check");
});

// ---------- 4. the advisor ----------

test("#107: every point the advisor suggests is accepted by the engine", () => {
  let advisedPlaces = 0, refused = null;
  for (const seed of [1, 2, 3] ) {
    const rng = E.makeRng(seed * 7919);
    let st = E.createGame(seed);
    for (let steps = 0; st.winner == null && steps < 60; steps++) {
      const who = E.mustAct(st);
      const side = who[rng.int(who.length)];
      const a = advise(E.view(st, side), side);
      if (a && a.use === "place" && a.targets.length) {
        advisedPlaces++;
        try { E.apply(st, a.action); } catch (e) { refused ??= `seed ${seed} step ${steps}: ${e.message} (${a.targets})`; }
      }
      st = E.apply(st, B.decide(E.view(st, side), side, "normal", rng));
    }
  }
  assert.ok(advisedPlaces > 20, `only ${advisedPlaces} place suggestions seen`);
  assert.equal(refused, null, `the engine refused the advisor's own plan: ${refused}`);
});

test("#107: the bots place only inside the action-start set under the default", () => {
  const eligible = new Set(START_SET);
  const st = bare({}, { yiyang: [1, 0] });
  const greedy = B.greedyPlacement(st, QIN, 4);
  assert.ok(greedy.length > 0);
  for (const id of greedy) assert.ok(eligible.has(id), `greedy placed in ${id}, not eligible at the start`);
  E.placePoints(E.clone(st), QIN, greedy, 4);
  for (let seed = 1; seed <= 100; seed++) {
    const pts = B.randomPoints(st, QIN, 4, E.makeRng(seed));
    for (const id of pts) assert.ok(eligible.has(id), `random (seed ${seed}) placed in ${id}, not eligible at the start`);
    E.placePoints(E.clone(st), QIN, pts, 4);
  }
  // 楚 too, from its own side of the board: 郢 4 of stability 4 is control.
  const cst = bare({}, { ying: [0, 1] });
  for (const id of B.greedyPlacement(cst, CHU, 3)) {
    assert.ok(["ying", "chencai", "qianzhong", "huaisi", "wuyue"].includes(id), `楚 greedy placed in ${id}`);
  }
});
