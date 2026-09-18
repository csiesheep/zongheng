// M0: the board data is the first thing the engine rests on, so it is the
// first thing under test. M1 grows this file into a test per rulebook rule
// plus a fuzz test over legal moves.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";

test("board: 26 spaces with unique ids, stability 2 to 4", () => {
  assert.equal(E.SPACES.length, 26);
  assert.equal(new Set(E.SPACES.map((s) => s.id)).size, 26);
  for (const s of E.SPACES) assert.ok(s.stability >= 2 && s.stability <= 4, s.id);
});

test("board: adjacency is symmetric and never dangling or reflexive", () => {
  for (const s of E.SPACES) {
    for (const o of s.adj) {
      assert.notEqual(o, s.id, `${s.id} adjacent to itself`);
      assert.ok(E.SPACE[o], `${s.id} -> ${o} does not exist`);
      assert.ok(E.SPACE[o].adj.includes(s.id), `${s.id} -> ${o} is one-way`);
    }
  }
});

test("board: region sizes match the rulebook", () => {
  const sizes = Object.fromEntries(Object.keys(E.REGIONS).map((r) => [r, E.spacesOf(r).length]));
  assert.deepEqual(sizes, { west: 5, jin: 6, zhou: 1, east: 5, south: 5, north: 4 });
});

test("board: eight battlegrounds, at least one in every scored region", () => {
  assert.equal(E.BATTLEGROUNDS.length, 8);
  for (const r of E.SCORED_REGIONS) {
    assert.ok(E.spacesOf(r).some((id) => E.SPACE[id].battleground), r);
  }
  assert.ok(!E.SPACE.luoyi.battleground);
});

test("board: five states, each capital inside its state, sizes 2/2/4/4/2", () => {
  const sizes = {};
  for (const [id, st] of Object.entries(E.STATES)) {
    assert.equal(E.SPACE[st.capital].state, id, `${id} capital`);
    sizes[id] = E.spacesOfState(id).length;
  }
  assert.deepEqual(sizes, { han: 2, wei: 2, zhao: 4, qi: 4, yan: 2 });
  // 趙 straddles the Three Jin and the North; that is the rulebook's choice.
  assert.deepEqual(new Set(E.spacesOfState("zhao").map((id) => E.SPACE[id].region)), new Set(["jin", "north"]));
});

test("board: home regions and the cap", () => {
  assert.equal(E.REGIONS.west.home, "qin");
  assert.equal(E.REGIONS.south.home, "chu");
  assert.equal(E.cap("guanzhong"), 6);
  assert.equal(E.cap("shangdang"), 4);
});

test("setup: fixed points sit in the right home and free points have regions", () => {
  for (const side of ["qin", "chu"]) {
    const home = side === "qin" ? "west" : "south";
    for (const id of Object.keys(E.SETUP[side].fixed)) assert.equal(E.SPACE[id].region, home, `${side} ${id}`);
    for (const r of E.SETUP[side].freeIn) assert.ok(E.REGIONS[r], r);
  }
  assert.equal(E.SETUP.chu.bonus, 2);
});

test("rng: deterministic, and shuffle is a permutation", () => {
  const a = E.makeRng(7), b = E.makeRng(7);
  const xs = [...Array(20).keys()];
  assert.deepEqual(E.shuffle(a, xs), E.shuffle(b, xs));
  assert.deepEqual(E.shuffle(E.makeRng(3), xs).slice().sort((x, y) => x - y), xs);
  const c = E.makeRng(1); c.next(); const s = c.getState();
  const d = E.makeRng(0); d.setState(s);
  assert.equal(c.next(), d.next());
});
