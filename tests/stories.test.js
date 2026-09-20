// Guard for the card histories (orchestrator-owned, #36).
//
// The owner approved three samples (張儀連橫, 吳起變法, 澠池之會) for tone and
// length, and ruled that a history shows in ONE language, the interface's.
// So each language's text and source must stand on its own. These checks
// keep the other 69 in the same shape; whether a story is TRUE is checked by
// reading sources, not here.
import { test } from "node:test";
import assert from "node:assert/strict";
import STORIES from "../public/i18n/stories.js";
import { CARDS } from "../public/shared/cards.js";
import * as E from "../public/shared/engine.js";

const IDS = new Set([...CARDS.map((c) => c.id), E.JIUDING]);
const entries = Object.entries(STORIES);
const words = (s) => s.trim().split(/\s+/).length;
const han = (s) => [...s].length;

test("every story belongs to a card and has all four fields", () => {
  const bad = [];
  for (const [id, s] of entries) {
    if (!IDS.has(id)) bad.push(`${id}: not a card id`);
    for (const k of ["zh", "en", "srcZh", "srcEn"]) if (typeof s[k] !== "string" || !s[k].trim()) bad.push(`${id}.${k}: missing`);
    for (const k of Object.keys(s)) if (!["zh", "en", "srcZh", "srcEn"].includes(k)) bad.push(`${id}.${k}: unknown field`);
  }
  assert.deepEqual(bad, []);
});

test("lengths stay near the approved samples (zh 70 to 130 characters, en 40 to 85 words)", () => {
  const bad = [];
  for (const [id, s] of entries) {
    if (typeof s.zh === "string" && (han(s.zh) < 70 || han(s.zh) > 130)) bad.push(`${id}.zh: ${han(s.zh)} characters`);
    if (typeof s.en === "string" && (words(s.en) < 40 || words(s.en) > 85)) bad.push(`${id}.en: ${words(s.en)} words`);
  }
  assert.deepEqual(bad, []);
});

test("house style: one paragraph, no dashes, each language keeps to itself, sources name a work", () => {
  const bad = [];
  for (const [id, s] of entries) {
    for (const k of ["zh", "en"]) {
      const v = s[k] || "";
      if (/[—–]|--/.test(v)) bad.push(`${id}.${k}: dash`);
      if (/\n/.test(v)) bad.push(`${id}.${k}: more than one paragraph`);
      if (/ {2,}/.test(v)) bad.push(`${id}.${k}: double space`);
    }
    if (/[一-鿿]/.test(s.en || "")) bad.push(`${id}.en: Chinese characters in the English story`);
    if (/[一-鿿]/.test(s.srcEn || "")) bad.push(`${id}.srcEn: Chinese characters in the English source`);
    if (/[A-Za-z]{4,}/.test(s.zh || "")) bad.push(`${id}.zh: an English word in the Chinese story`);
    if (!/《[^》]+》/.test(s.srcZh || "")) bad.push(`${id}.srcZh: no 《work》 named`);
    if (words(s.srcEn || "") < 2) bad.push(`${id}.srcEn: too short to name a work and a chapter`);
  }
  assert.deepEqual(bad, []);
});

// Flip `todo` off when the last batch of #36 lands.
test("all 72 cards have a story", { todo: "the writer's four batches (#36) are still coming in" }, () => {
  const missing = [...IDS].filter((id) => !STORIES[id]);
  assert.deepEqual(missing, []);
});
