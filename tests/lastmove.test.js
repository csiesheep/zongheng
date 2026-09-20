// Guard for the map's last-move marks (orchestrator-owned, #41).
//
// The table frames every space the last action changed and tags it with the
// change. The marks are a pure diff of two views (public/lastmove.js); if the
// diff lies, the map lies about what the opponent just did. These checks pin
// what counts as a change and which side the tag speaks for.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { computeLastMoveMarks } from "../public/lastmove.js";

const clone = (st) => JSON.parse(JSON.stringify(st));
const game = () => E.view(E.createGame(7), E.QIN);
const add = (v, id, dq, dc) => { const [q, c] = E.infOf(v, id); v.inf[id] = [q + dq, c + dc]; };

test("no previous view, or the same view, marks nothing", () => {
  const v = game();
  assert.deepEqual(computeLastMoveMarks(null, v), {});
  assert.deepEqual(computeLastMoveMarks(v, null), {});
  assert.deepEqual(computeLastMoveMarks(v, clone(v)), {});
});

test("a placement marks that space only, with the side and the amount", () => {
  const a = game(), b = clone(a);
  add(b, "daliang", 0, 2);
  assert.deepEqual(computeLastMoveMarks(a, b), { daliang: { side: E.CHU, delta: 2 } });
  const c = clone(a); add(c, "hanzhong", 3, 0);
  assert.deepEqual(computeLastMoveMarks(a, c), { hanzhong: { side: E.QIN, delta: 3 } });
});

test("a removal is a negative change", () => {
  const a = game(); add(a, "guanzhong", 3, 0);
  const b = clone(a); add(b, "guanzhong", -3, 0);
  assert.deepEqual(computeLastMoveMarks(a, b), { guanzhong: { side: E.QIN, delta: -3 } });
});

test("several spaces changed in one action are all marked, and nothing else", () => {
  const a = game(), b = clone(a);
  add(b, "xinzheng", 0, 3); add(b, "daliang", 0, 2);
  assert.deepEqual(Object.keys(computeLastMoveMarks(a, b)).sort(), ["daliang", "xinzheng"]);
});

test("when both sides change at one space the bigger swing speaks, Qin on a tie", () => {
  const a = game(); add(a, "handan", 0, 3);
  const b = clone(a); add(b, "handan", 1, -3);
  assert.deepEqual(computeLastMoveMarks(a, b).handan, { side: E.CHU, delta: -3 });
  const c = clone(a); add(c, "handan", 2, -2);
  assert.deepEqual(computeLastMoveMarks(a, c).handan, { side: E.QIN, delta: 2 });
});

test("a state destroyed or restored is marked on its capital, and wins the tag", () => {
  const a = game(), b = clone(a);
  const [stateId, state] = Object.entries(E.STATES)[0];
  b.mie = { ...(b.mie || {}), [stateId]: true };
  add(b, state.capital, 1, 0);
  assert.deepEqual(computeLastMoveMarks(a, b)[state.capital], { destroyed: true });
  assert.deepEqual(computeLastMoveMarks(b, a)[state.capital], { destroyed: false });
});

test("every mark names a real space", () => {
  const a = game(), b = clone(a);
  for (const sp of E.SPACES) add(b, sp.id, 1, 0);
  const ids = new Set(E.SPACES.map((s) => s.id));
  for (const id of Object.keys(computeLastMoveMarks(a, b))) assert.ok(ids.has(id), id);
  assert.equal(Object.keys(computeLastMoveMarks(a, b)).length, E.SPACES.length);
});
