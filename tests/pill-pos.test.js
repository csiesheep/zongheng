// Guard for the map's small pills (orchestrator-owned, #49).
//
// The +N badge while picking and the last-move tag after an action share one
// per-space position table (NODE_PILL_POS in public/map-draw.js). A key that
// is not a space, or a position the stylesheet does not know, fails silently:
// the pill falls back to the default corner and covers a name or a numeral
// again. Where a pill may sit was chosen against a layout sweep in the
// browser; this file only pins that the table and the stylesheet agree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as E from "../public/shared/engine.js";
import { NODE_PILL_POS } from "../public/map-draw.js";

const POSITIONS = ["tr", "trl", "tl", "r", "l", "t", "b"];
const css = readFileSync(new URL("../public/style.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

test("every entry of the pill table names a real space and a known position", () => {
  const ids = new Set(E.SPACES.map((s) => s.id));
  for (const [id, pos] of Object.entries(NODE_PILL_POS)) {
    assert.ok(ids.has(id), `${id} is not a space`);
    assert.ok(POSITIONS.includes(pos), `${id}: "${pos}" is not a position`);
  }
});

test("the stylesheet places BOTH pills for every position, the default included", () => {
  for (const pos of POSITIONS) {
    for (const pill of ["badge", "lastmove-tag"]) {
      const re = new RegExp(`\\.node\\.pill-${pos}\\s+\\.${pill}\\b`);
      assert.match(css, re, `style.css has no rule for .node.pill-${pos} .${pill}`);
    }
  }
});

test("the table is what puts the class on a node, with tr as the default", () => {
  assert.match(app, /NODE_PILL_POS\[[^\]]+\]\s*\|\|\s*"tr"/, "app.js no longer reads NODE_PILL_POS with a \"tr\" default");
  assert.doesNotMatch(css + app, /lastmove-l\b|NODE_LASTMOVE_LEFT\s*[.(\[]/, "the old left-only switch is back in live code");
});

test("a pill that takes the top-left corner sends the cost tag to the other corner", () => {
  assert.match(css, /\.node\.pill-tl\s+\.cost\s*\{[^}]*right:/, "style.css no longer moves .cost away from a top-left pill");
});
