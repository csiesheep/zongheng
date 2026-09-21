// Guard for #85 (orchestrator-owned). The opponent's-move thumbnail (#79/#85) lives in the map's top-left corner, so that
// corner must hold no city. Owner, 2026-09-21: 「地圖上把代,跟中山往右移一點」. In design units (the map is drawn on a
// 390x408 canvas, public/map-draw.js), the corner box is x 0-56, y 0-60. A city takes its disc (radius 22) plus its
// stability badge, which hangs off the disc's lower left: roughly x from cx-36 to cx+22 and y from cy-22 to cy+30.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { NODE_POS, DESIGN_W, DESIGN_H } from "../public/map-draw.js";

const CORNER = { x0: 0, y0: 0, x1: 56, y1: 60 };
const footprint = ([cx, cy]) => ({ x0: cx - 36, x1: cx + 22, y0: cy - 22, y1: cy + 30 });
const hits = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

test("no city sits in the map's top-left corner, where the opponent's-move thumbnail lives", () => {
  for (const sp of E.SPACES) {
    const pos = NODE_POS[sp.id];
    assert.ok(pos, `${sp.id} has no position`);
    assert.ok(!hits(footprint(pos), CORNER), `${sp.id} at ${pos} reaches into the corner box`);
  }
});

test("every city stays on the canvas and no two discs overlap", () => {
  const ids = E.SPACES.map((s) => s.id);
  for (const id of ids) {
    const [x, y] = NODE_POS[id];
    assert.ok(x >= 18 && x <= DESIGN_W - 18 && y >= 18 && y <= DESIGN_H - 18, `${id} at ${x},${y} is off the canvas`);
  }
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const [ax, ay] = NODE_POS[ids[i]], [bx, by] = NODE_POS[ids[j]];
    assert.ok(Math.hypot(ax - bx, ay - by) >= 44, `${ids[i]} and ${ids[j]} are too close`);
  }
});
