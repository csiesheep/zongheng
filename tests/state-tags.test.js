// Guard for the state tags (orchestrator-owned, #95; owner picked 五國 A 國字小籤). Every space that belongs to one of the
// five states carries a tiny state tag; its spot comes from a per-space table in public/map-draw.js, chosen against the
// other pills. A space missing from the table, or a table entry for a space with no state, fails silently on the map.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { STATE_TAG_POS, STATE_TAG_COLOR } from "../public/map-draw.js";

test("every state space has a tag position, and only state spaces do", () => {
  const stateSpaces = E.SPACES.filter((s) => s.state).map((s) => s.id).sort();
  assert.deepEqual(Object.keys(STATE_TAG_POS).sort(), stateSpaces);
  assert.equal(stateSpaces.length, 14);
});

test("each state has its own colour, and each tag spot is a real offset", () => {
  assert.deepEqual(Object.keys(STATE_TAG_COLOR).sort(), Object.keys(E.STATES).sort());
  assert.equal(new Set(Object.values(STATE_TAG_COLOR)).size, 5, "five different colours");
  for (const [id, p] of Object.entries(STATE_TAG_POS)) {
    assert.ok(p && Number.isFinite(p.dx) && Number.isFinite(p.dy), `${id}: position must be {dx, dy} in design units`);
  }
});
