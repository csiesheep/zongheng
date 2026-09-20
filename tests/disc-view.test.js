// Guard for the influence disc (orchestrator-owned, #51).
//
// Owner, 2026-09-20: a side with no influence is not drawn; a lone side fills
// the whole disc; black / red means that side CONTROLS the space, grey / pink
// means influence without control. Tone is now the only sign of control on
// the map (the control ring is gone), so what the disc is told to show must be
// exactly the engine's truth. public/disc-view.js decides that, without a DOM;
// colours and sizes are CSS and are checked in the browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { discParts } from "../public/disc-view.js";

test("nobody present: an empty disc, whoever is said to control", () => {
  assert.deepEqual(discParts(0, 0, null), { kind: "empty" });
});

test("one side present: a lone disc for that side, with its count", () => {
  assert.deepEqual(discParts(2, 0, null), { kind: "lone", side: E.QIN, n: 2, controlled: false });
  assert.deepEqual(discParts(4, 0, E.QIN), { kind: "lone", side: E.QIN, n: 4, controlled: true });
  assert.deepEqual(discParts(0, 1, null), { kind: "lone", side: E.CHU, n: 1, controlled: false });
  assert.deepEqual(discParts(0, 3, E.CHU), { kind: "lone", side: E.CHU, n: 3, controlled: true });
});

test("both present: a split disc, and only the controller's half is marked controlled", () => {
  assert.deepEqual(discParts(2, 2, null), { kind: "split", qin: { n: 2, controlled: false }, chu: { n: 2, controlled: false } });
  assert.deepEqual(discParts(3, 1, E.QIN), { kind: "split", qin: { n: 3, controlled: true }, chu: { n: 1, controlled: false } });
  assert.deepEqual(discParts(1, 4, E.CHU), { kind: "split", qin: { n: 1, controlled: false }, chu: { n: 4, controlled: true } });
});

test("the absent side is never drawn, even when it is the one said to control", () => {
  // cannot happen under the rules (control needs influence), but a wrong `ctl` must not paint a half that has no count
  const p = discParts(2, 0, E.CHU);
  assert.equal(p.kind, "lone");
  assert.equal(p.side, E.QIN);
  assert.equal(p.controlled, false);
});

test("on a real position every space's disc says what the engine says", () => {
  const st = E.createGame(7);
  // a spread of cases on top of the opening position: lone, split, controlled, contested
  const put = { ju: [2, 0], hedong: [3, 1], song: [1, 3], zhongshan: [1, 1], liaodong: [0, 0] };
  for (const [id, v] of Object.entries(put)) st.inf[id] = v;
  let lone = 0, split = 0, empty = 0, controlled = 0;
  for (const sp of E.SPACES) {
    const [q, c] = E.infOf(st, sp.id);
    const ctl = E.controller(st, sp.id);
    const p = discParts(q, c, ctl);
    if (!q && !c) { assert.equal(p.kind, "empty", sp.id); empty++; continue; }
    if (q && c) {
      assert.equal(p.kind, "split", sp.id); split++;
      assert.equal(p.qin.n, q, sp.id); assert.equal(p.chu.n, c, sp.id);
      assert.equal(p.qin.controlled, ctl === E.QIN, sp.id); assert.equal(p.chu.controlled, ctl === E.CHU, sp.id);
      if (ctl != null) controlled++;
    } else {
      assert.equal(p.kind, "lone", sp.id); lone++;
      assert.equal(p.side, q ? E.QIN : E.CHU, sp.id); assert.equal(p.n, q || c, sp.id);
      assert.equal(p.controlled, ctl === p.side, sp.id);
      if (p.controlled) controlled++;
    }
  }
  // the position really exercises every kind; otherwise this test proves nothing
  assert.ok(lone > 0 && split > 0 && empty > 0 && controlled > 0, JSON.stringify({ lone, split, empty, controlled }));
});
