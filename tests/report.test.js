// Guard for #138 (orchestrator-owned): the 戰報 -- the digest a report is written from, the once-per-game key, and the
// check every report passes before it is stored.
//
// Owner, 2026-09-27: 說書 style, 「不要用 打出，記分 等等字眼，內容像在詳述真實歷史」, 「重要的牌顯示圖片及卡牌連結」,
// 「每一回更詳細些」, 「每一回至少有一張當時地圖」, 「每一局最多產生一次」, 「中英都要」, model deepseek-v4-pro.
// Three states: the modules are not there yet -> todo; there -> every check runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import { exportGame } from "../public/shared/export.js";

async function load(path) { try { return await import(path); } catch (e) { if (e.code === "ERR_MODULE_NOT_FOUND") return null; throw e; } }
const D = await load("../public/shared/report-digest.js");
const V = await load("../src/report-check.js");

function botGame(seed, level) {
  const rng = E.makeRng((seed * 2654435761) >>> 0);
  let st = E.createGame(700000000 + seed);
  for (let k = 0; st.winner == null && k < 4000; k++) {
    const who = E.mustAct(st), side = who[rng.int(who.length)];
    const a = level === "easy" ? B.randomAction(st, side, rng) : B.decide(E.view(st, side), side, level, rng);
    st = E.apply(st, a);
  }
  assert.ok(st.winner != null, `seed ${seed} finished`);
  return st;
}
const exp = (st, viewer, meta = {}) => exportGame(E.view(st, viewer), { mode: "solo", viewer, level: "normal", lang: "zh", ...meta });
const GAMES = [[1, "normal"], [2, "hard"], [3, "easy"], [4, "normal"]].map(([s, l]) => botGame(s, l));

const T = (name, fn, mod) => (mod ? test(name, fn) : test.todo(name + " (not implemented yet)"));

T("#138 key: one key per game -- the same for every seat, name, language and export time; any change to the actions changes it", async () => {
  for (const st of GAMES) {
    const k = await D.reportKey(exp(st, E.QIN));
    assert.match(k, /^[0-9a-f]{64}$/);
    assert.equal(await D.reportKey(exp(st, E.CHU, { lang: "en", names: ["a", "b"], exportedAt: "2020-01-01T00:00:00Z" })), k);
    assert.equal(await D.reportKey(exp(st, null, { mode: "room" })), k, "a spectator's export is the same game");
    const x = exp(st, E.QIN);
    x.final.actions = x.final.actions.slice(0, -1);
    assert.notEqual(await D.reportKey(x), k);
  }
  const keys = await Promise.all(GAMES.map((st) => D.reportKey(exp(st, E.QIN))));
  assert.equal(new Set(keys).size, GAMES.length, "different games, different keys");
}, D);

T("#138 digest: one entry per year played, the cards of that year only, deterministic, and it refuses a log that does not replay", async () => {
  for (const st of GAMES) {
    const x = exp(st, E.CHU);
    const d = D.buildDigest(x);
    assert.equal(JSON.stringify(D.buildDigest(exp(st, E.QIN))), JSON.stringify(d), "the seat does not change the digest");
    assert.equal(d.winner, st.winner);
    assert.equal(d.turns.length, st.turn, "one entry per year, the last year included");
    d.turns.forEach((t, i) => {
      assert.equal(t.turn, i + 1);
      assert.ok(Array.isArray(t.cards) && Array.isArray(t.events) && t.events.length > 0, `year ${t.turn} has events`);
    });
    const played = new Map();
    for (const l of st.log) if (l.card) { const t = l.t ?? 0; if (!played.has(t)) played.set(t, new Set()); played.get(t).add(l.card); }
    for (const t of d.turns) for (const id of t.cards) assert.ok(played.get(t.turn)?.has(id), `year ${t.turn}: ${id} appears in that year's log`);
    const bad = exp(st, E.CHU);
    bad.final.actions = bad.final.actions.slice(0, Math.floor(bad.final.actions.length / 2));
    assert.throws(() => D.buildDigest(bad), "half a game is not a finished game");
    const liar = exp(st, E.CHU);
    liar.result = { ...liar.result, winner: 1 - st.winner };
    assert.throws(() => D.buildDigest(liar), "the result must be the replay's result");
  }
}, D);

T("#138 maps: one board per year, at the end of that year, rebuilt from the actions alone", async () => {
  for (const st of GAMES) {
    const ends = D.turnEnds(exp(st, E.QIN));
    assert.equal(ends.length, st.turn);
    ends.forEach((e, i) => assert.equal(e.turn, i + 1));
    assert.equal(JSON.stringify(ends[ends.length - 1].state.inf), JSON.stringify(st.inf), "the last board is the final board");
  }
}, D);

function goodReport(d) {
  const side = (lang) => ({
    title: lang === "zh" ? "縱橫演義" : "The Tale of the Warring States",
    intro: lang === "zh" ? "話說戰國之世。" : "In the age of the Warring States.",
    chapters: d.turns.map((t) => ({
      turn: t.turn,
      heading: lang === "zh" ? `第${t.turn}回 秦楚相爭` : `Year ${t.turn}: Qin and Chu contend`,
      paragraphs: [lang === "zh" ? "是年,秦楚兩國在中原相持不下。" : "That year Qin and Chu contended across the central plain."],
      cards: t.cards.slice(0, 2),
    })),
    ending: lang === "zh" ? "全局終。" : "So the contest ended.",
  });
  return { version: 1, zh: side("zh"), en: side("en") };
}

T("#138 check: a clean report passes; wrong years, foreign cards, a missing language and game words are refused", async () => {
  const d = D.buildDigest(exp(GAMES[0], E.QIN));
  assert.deepEqual(V.validateReport(goodReport(d), d), []);
  const bad = (mutate, why) => { const r = goodReport(d); mutate(r); assert.ok(V.validateReport(r, d).length > 0, why); };
  bad((r) => r.zh.chapters.pop(), "a year is missing (zh)");
  bad((r) => r.en.chapters.reverse(), "years out of order (en)");
  bad((r) => delete r.en, "English is required");
  bad((r) => { r.zh.chapters[0].cards = ["no-such-card"]; }, "an unknown card");
  const later = d.turns.findIndex((t, i) => i > 0 && t.cards.some((c) => !d.turns[0].cards.includes(c)));
  if (later > 0) bad((r) => { r.zh.chapters[0].cards = [d.turns[later].cards.find((c) => !d.turns[0].cards.includes(c))]; }, "a card from another year");
  for (const w of ["打出", "出牌", "記分", "得分", "扶植", "奇襲", "行動點", "回合", "骰", "手牌", "棄牌"]) bad((r) => { r.zh.chapters[1].paragraphs[0] += `楚王${w}。`; }, `zh game word ${w}`);
  bad((r) => { r.zh.chapters[0].heading += " 天命 +3"; }, "a Mandate number");
  for (const w of ["played a card", "scored", "3 ops", "rolled the dice", "discarded", "in turn 4"]) bad((r) => { r.en.chapters[1].paragraphs[0] += ` Chu ${w}.`; }, `en game word ${w}`);
}, V);
