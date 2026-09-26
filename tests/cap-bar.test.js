// Guard for #129 (orchestrator-owned): a bar over a number means that side is
// at its cap, and nothing else.
//
// The owner could not tell why 新鄭 (秦 4 | 楚 4, stability 2) would not take
// another point: both sides were at the cap, stability + 2, and nothing on the
// map said so. Design D puts a bar over a numeral at its cap. A bar that shows
// one below the cap, or misses the cap, is worse than none, so this plays real
// games and compares every disc the map would draw with the engine's own cap.
//
// Also: the zh term for stability is 安定值. #129's first version wrote
// 穩定度 and 安定度 beside it, three names on one page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as E from "../public/shared/engine.js";
import { discParts } from "../public/disc-view.js";
import { playGame } from "./sim.js";

const sides = (p) => p.kind === "lone" ? [p] : p.kind === "split" ? [p.qin, p.chu] : [];

test("#129: the owner's 新鄭 4|4 — both numerals carry the bar; 3|4 only the 4", () => {
  const st = E.createGame(1);
  const cap = E.capOf(st, "xinzheng");
  assert.equal(cap, 4, "新鄭's cap is stability 2 + 2");
  const both = discParts(4, 4, null, cap);
  assert.equal(both.qin.atCap, true);
  assert.equal(both.chu.atCap, true);
  const one = discParts(3, 4, E.CHU, cap);
  assert.equal(one.qin.atCap, false);
  assert.equal(one.chu.atCap, true);
  assert.equal(discParts(3, 0, null, cap).atCap, false);
  assert.equal(discParts(0, 4, E.CHU, cap).atCap, true);
});

test("#129: over real games, a numeral has the bar exactly when it sits at the engine's cap", () => {
  let checked = 0, barred = 0;
  for (const seed of [1, 2, 3, 4]) {
    const { st } = playGame(seed);
    for (const id of Object.keys(E.SPACE)) {
      const [q, c] = (st.inf && st.inf[id]) || [0, 0];
      const cap = E.capOf(st, id);
      for (const part of sides(discParts(q, c, null, cap))) {
        checked++;
        if (part.atCap) barred++;
        assert.equal(part.atCap, part.n >= cap, `seed ${seed} ${id}: n=${part.n} cap=${cap} atCap=${part.atCap}`);
      }
    }
  }
  assert.ok(checked > 0, "no discs were drawn; the harness is broken");
  assert.ok(barred > 0, `no numeral reached its cap in ${checked}; the test would pass on a bar that never shows`);
});

test("#129: the map passes the cap to the disc, or no bar is ever drawn", () => {
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const calls = app.split("\n").filter((l) => /=\s*discParts\(/.test(l) && !/^\s*\/\//.test(l));
  assert.ok(calls.length > 0, "app.js no longer calls discParts");
  for (const call of calls) assert.match(call, /capOf\(/, `app.js calls discParts without a cap: ${call.trim()}`);
});

test("#129: zh names stability one way, 安定值", () => {
  for (const f of ["../public/i18n/zh-Hant.js", "../public/rules.js", "../public/app.js"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    for (const bad of ["穩定度", "安定度", "穩定值"]) assert.ok(!src.includes(bad), `${f} says ${bad}; the game's word is 安定值`);
  }
});
