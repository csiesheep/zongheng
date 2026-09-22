// #103: the setup prompt (public/app.js, the "setup" prompt key) used to say
// "only on or next to your own influence" -- the in-game 放置 rule, not the
// free-placement rule setup actually uses (SETUP.qin.freeIn / chu.freeIn,
// public/shared/board.js). Ties the prompt to the engine two ways: (1) the
// regions the fixed pending's own options actually sit in must be exactly
// SETUP[side].freeIn, for both sides; (2) app.js's setup-key branch must
// derive its {regions} text from those same options (E.SPACE[id].region),
// not from a hard-coded per-side string -- so it stays right if SETUP ever
// changes. setupBonus (Chu's compensation step, regions: null, only spaces
// Chu already holds) is untouched by #103 and is not covered here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as E from "../public/shared/engine.js";
import zh from "../public/i18n/zh-Hant.js";
import en from "../public/i18n/en.js";

const { QIN, CHU } = E;
const regionsOf = (options) => [...new Set(options.map((id) => E.SPACE[id].region))];

test("#103: qin's and chu's setup pending options sit exactly in SETUP.freeIn's regions", () => {
  let st = E.createGame(1);
  assert.equal(st.pending.tag, "setup");
  assert.equal(st.pending.who, QIN);
  assert.deepEqual(regionsOf(st.pending.options).sort(), [...E.SETUP.qin.freeIn].sort(), "qin's setup options");
  assert.ok(st.pending.options.every((id) => E.SETUP.qin.freeIn.includes(E.SPACE[id].region)));

  st = E.apply(st, { type: "choose", side: QIN, choice: st.pending.options.slice(0, st.pending.n) });
  assert.equal(st.pending.tag, "setup");
  assert.equal(st.pending.who, CHU);
  assert.deepEqual(regionsOf(st.pending.options).sort(), [...E.SETUP.chu.freeIn].sort(), "chu's setup options");
  assert.ok(st.pending.options.every((id) => E.SETUP.chu.freeIn.includes(E.SPACE[id].region)));
});

test("#103: every region regionShort names is a real region, in both languages", () => {
  for (const [lang, S] of [["zh-Hant", zh], ["en", en]]) {
    for (const r of [...E.SETUP.qin.freeIn, ...E.SETUP.chu.freeIn]) {
      assert.ok(S.regionShort[r], `${lang} regionShort is missing "${r}"`);
    }
  }
});

// app.js can't be imported under node --test (it touches document/Audio at
// module scope) -- read it as text instead, the same way tests/pill-pos.test.js
// already does, and check the setup-key branch actually derives {regions}
// from the pending's own options rather than a hard-coded string.
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

test("#103: app.js derives the setup prompt's {regions} from p.options, not a fixed string", () => {
  assert.match(app, /key === "setup"[^;]*p\.options\.map\(\(id\)\s*=>\s*E\.SPACE\[id\]\.region\)/,
    "the setup prompt must read each option's region off the engine (E.SPACE[id].region), not hard-code it per side");
  assert.match(app, /t\(`prompt\.\$\{key\}`,\s*\{\s*n:\s*p\.n,\s*left:\s*p\.n\s*-\s*ui\.picks\.length,\s*regions\s*\}\)/,
    "the setup prompt must pass regions through to t(\"prompt.setup\", ...)");
});

test("#103: the i18n setup string names the regions ({regions}), not a fixed rule", () => {
  assert.match(zh.prompt.setup, /\{regions\}/, "zh prompt.setup must include {regions}");
  assert.match(en.prompt.setup, /\{regions\}/, "en prompt.setup must include {regions}");
  assert.doesNotMatch(zh.prompt.setup, /相鄰/, "zh prompt.setup must not describe the in-game adjacency rule");
  assert.doesNotMatch(en.prompt.setup, /next to your influence/, "en prompt.setup must not describe the in-game adjacency rule");
  // setupBonus is untouched by #103 -- still the compensation text, no regions.
  assert.doesNotMatch(zh.prompt.setupBonus, /\{regions\}/);
  assert.doesNotMatch(en.prompt.setupBonus, /\{regions\}/);
});
