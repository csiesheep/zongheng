// #125: 稱帝 under the owner's ruling is the default rule.
//
// Owner, 2026-09-26 (issue #125): 「Wins only if ahead on 天命」 -- "the first side to reach reform box 6 (稱帝) wins at
// once if it leads the Mandate at that moment; otherwise it gets 天命 +3 as today (the second side still +1)."
// The numbers below are copied from that ruling and from the rulebook's 變法軌 table (Projects/zongheng/zongheng -
// rulebook.md: box 6 稱帝, threshold 4, first / second = 3 / 1, weariness recovers 1 box on arrival). "Leads" is
// #121's reading: Qin above 0, Chu below 0; level is not leading. None of them is read from the engine.
//
// Old saves: a state saved before this change carries an `options` object with no `emperor` key. It must keep
// playing as it did (+3, never a win), so the default lives in DEFAULT_OPTIONS (merged only by createGame) and never
// in the reading of an absent key.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as E from "../public/shared/engine.js";
import * as B from "../public/shared/bots.js";
import * as A from "../public/shared/advisor.js";
import EN from "../public/i18n/en.js";
import ZH from "../public/i18n/zh-Hant.js";

const { QIN, CHU } = E;
const FIRST_VP = 3, SECOND_VP = 1, LEAD = 4;
const signed = (side, n) => (side === QIN ? n : -n);

// Random play (the easy bot) until `side` must take an action round on turn `turn`.
function actionRound(options, side, turn) {
  for (let seed = 1; seed < 400; seed++) {
    const rng = E.makeRng(seed * 7919);
    let st = E.createGame(seed, options);
    for (let steps = 0; st.winner == null && steps < 3000 && st.turn <= turn; steps++) {
      if (st.phase === "action" && st.turn === turn && st.actor === side && !st.pending && E.mustAct(st).includes(side)) return st;
      const who = E.mustAct(st), s = who[rng.int(who.length)];
      st = E.apply(st, B.randomAction(st, s, rng));
    }
  }
  throw new Error(`no action round for side ${side} on turn ${turn}`);
}
// `side` at box 5 holding 長平之戰 (4 ops, box 6's threshold), no reform used this turn, the Mandate at `m` (signed
// for `side`: positive = `side` leads), the other side at `otherBox`.
function atBox5(st0, side, m, otherBox = 0) {
  const st = E.clone(st0);
  st.log = [];
  for (const pile of [st.hands[0], st.hands[1], st.draw, st.discard, st.removed, ...Object.values(st.later)]) {
    const i = pile.indexOf("changping"); if (i >= 0) pile.splice(i, 1);
  }
  st.hands[side].push("changping");
  st.reform[side] = 5; st.reform[1 - side] = otherBox; st.reformUsed = [0, 0];
  st.reformFirst = {};
  for (let b = 1; b <= 5; b++) st.reformFirst[b] = side;
  if (otherBox === 6) st.reformFirst[6] = 1 - side;
  st.mandate = signed(side, m); st.weariness = 3;
  return st;
}
const reform = (st, side) => E.apply(st, { type: "play", side, card: "changping", use: "reform" });
// A save as app.js writes it (JSON.stringify of the state) from before #125: no `emperor` key in its options.
function oldSave(st) {
  const s = JSON.parse(JSON.stringify(st));
  delete s.options.emperor;
  return s;
}

test("default: a new game plays emperor = win-lead", () => {
  assert.equal(E.DEFAULT_OPTIONS.emperor, "win-lead");
  assert.equal(E.createGame(1).options.emperor, "win-lead");
  assert.equal(E.createGame(2, {}).options.emperor, "win-lead");
});

test(`default game: the first to 稱帝 while leading the Mandate wins at once, reason emperor`, () => {
  for (const side of [QIN, CHU]) for (const turn of [2, 6]) {
    const st = reform(atBox5(actionRound({}, side, turn), side, LEAD), side);
    assert.equal(st.reform[side], 6);
    assert.equal(st.winner, side, `side ${side} turn ${turn}`);
    assert.equal(st.reason, "emperor");
    assert.equal(st.phase, "over");
    assert.ok(st.log.some((l) => l.type === "over" && l.reason === "emperor" && l.winner === side));
  }
});

test(`default game: the first to 稱帝 level or behind gets +${FIRST_VP}, weariness recovers 1, the game goes on`, () => {
  for (const side of [QIN, CHU]) for (const m of [0, -LEAD]) {
    const st = reform(atBox5(actionRound({}, side, 3), side, m), side);
    assert.equal(st.winner, null, `side ${side} mandate ${m}`);
    assert.equal(st.mandate, signed(side, m + FIRST_VP));
    assert.equal(st.weariness, 4);
    assert.equal(st.reformFirst[6], side);
  }
});

test(`default game: the second to 稱帝, even leading, gets +${SECOND_VP} and does not win`, () => {
  for (const side of [QIN, CHU]) {
    const st = reform(atBox5(actionRound({}, side, 5), side, LEAD, 6), side);
    assert.equal(st.winner, null);
    assert.equal(st.mandate, signed(side, LEAD + SECOND_VP));
  }
});

test(`old save (no emperor key): the first to 稱帝 while leading gets +${FIRST_VP} as before and the game goes on`, () => {
  for (const side of [QIN, CHU]) {
    const saved = oldSave(atBox5(actionRound({}, side, 4), side, LEAD));
    assert.equal("emperor" in saved.options, false, "the save models one from before #125");
    const st = reform(saved, side);
    assert.equal(st.winner, null, `side ${side}`);
    assert.equal(st.mandate, signed(side, LEAD + FIRST_VP));
    assert.equal("emperor" in st.options, false, "playing on does not write the new default into an old save");
  }
});

test("old save: an absent key and emperor=vp still play the same game, move for move", () => {
  for (const seed of [3, 11]) {
    const play = (mk) => {
      const rng = E.makeRng(seed);
      let st = mk(E.createGame(seed));
      for (let steps = 0; st.winner == null && steps < 3000; steps++) {
        const who = E.mustAct(st), s = who[rng.int(who.length)];
        st = E.apply(st, B.randomAction(st, s, rng));
      }
      const { options: _o, ...rest } = st;
      return JSON.stringify(rest);
    };
    const a = play(oldSave), b = play((st) => ({ ...st, options: { ...st.options, emperor: "vp" } }));
    assert.ok(JSON.parse(a).winner != null, "the game finished");
    assert.equal(a, b, `seed ${seed}`);
  }
});

// ---------- every place an end reason is read, in both languages ----------
// The reasons are taken from the engine's source (every `win(st, …, "<reason>")`), not from the i18n files, so a
// reason the copy forgot is caught here. Views: the end screen (title / body, and the line for the winner, the loser
// and a spectator: over.reasons.<r>.{win,lose,watch}); the prompt's end line (the same .win/.lose/.watch); the log's
// over row and the room's system line (ends.<r>).
const ENGINE_REASONS = [...new Set([...readFileSync(new URL("../public/shared/engine.js", import.meta.url), "utf8")
  .matchAll(/\bwin\(st, [^;]*?"(\w+)"\)/g)].map((m) => m[1]))].sort();
const fill = (s, p) => s.replace(/\{(\w+)\}/g, (_, k) => p[k] ?? `{${k}}`);

test("end reasons: the engine's list is the one this test expects to cover, emperor included", () => {
  assert.ok(ENGINE_REASONS.includes("emperor"), ENGINE_REASONS.join(","));
  assert.ok(ENGINE_REASONS.length >= 9, `only ${ENGINE_REASONS.length} reasons read: ${ENGINE_REASONS.join(",")}`);
});

for (const [lang, L] of [["zh-Hant", ZH], ["en", EN]]) {
  test(`end reasons (${lang}): every reason renders a string in every view -- winner, loser, spectator, log`, () => {
    const p = { winner: L.sides.qin, loser: L.sides.chu };
    const bad = [];
    for (const r of ENGINE_REASONS) {
      for (const f of ["title", "body", "win", "lose", "watch"]) {
        const s = L.over.reasons[r]?.[f];
        if (typeof s !== "string" || !s.trim()) { bad.push(`over.reasons.${r}.${f} missing`); continue; }
        if (/\{\w+\}/.test(fill(s, p))) bad.push(`over.reasons.${r}.${f} leaves a placeholder: ${s}`);
      }
      const e = L.ends[r];
      if (typeof e !== "string" || !e.trim()) bad.push(`ends.${r} missing`);
      else if (/\{\w+\}/.test(e)) bad.push(`ends.${r} has a placeholder the log cannot fill: ${e}`);
    }
    assert.deepEqual(bad, []);
  });
}

test("end reasons: a spectator's emperor line never says you", () => {
  assert.doesNotMatch(ZH.over.reasons.emperor.watch, /你/);
  assert.doesNotMatch(EN.over.reasons.emperor.watch, /\byou\b/i);
});

// ---------- the advisor ----------
// The winning move is usually 長平 for reform; a side may also hold an event that moves its own track (吳起變法 for
// Chu), which wins the same way. Either is right; what is checked is that the move wins by 稱帝 and says so.
test("advisor: a move that reaches 稱帝 while leading is recommended, and its reason is emperor with copy in both languages", () => {
  const got = [];
  for (const side of [QIN, CHU]) for (const turn of [3, 6]) {
    const st = atBox5(actionRound({}, side, turn), side, LEAD);
    const adv = A.advise(E.view(st, side), side, E.makeRng(turn));
    const after = E.apply(st, { ...adv.action, side });
    got.push(`${side}/${turn}: ${adv.card} ${adv.use} ${adv.reason.key} -> ${after.reason}`);
    assert.equal(after.reason, "emperor", got.at(-1));
    assert.equal(after.winner, side, got.at(-1));
    assert.equal(adv.reason.key, "emperor", got.at(-1));
  }
  assert.ok(got.some((g) => / changping reform /.test(g)), `長平 for reform was never the move: ${got.join("; ")}`);
  for (const L of [ZH, EN]) assert.ok(typeof L.advisor.reasons.emperor === "string" && L.advisor.reasons.emperor.trim());
});

// ---------- the one-line hint, both languages ----------
test("hint: the one-step-from-稱帝 hint has a lead and a not-lead line in both languages", () => {
  for (const L of [ZH, EN]) for (const k of ["lead", "notLead"]) {
    const s = L.sheet.emperor?.[k];
    assert.ok(typeof s === "string" && s.trim(), `sheet.emperor.${k}`);
    assert.doesNotMatch(s, /\{\w+\}/);
  }
  assert.match(ZH.sheet.emperor.notLead, /3/);
  assert.match(EN.sheet.emperor.notLead, /3/);
});
