// #135 (D1, 遠交): the engine option `qinFarStart: n` gives Qin n influence in 臨淄 (linzi) and n in 薊 (ji) with its
// fixed setup, before the free placement.
// #142 (owner, 2026-09-27, 「好 採用D1」): it is the default, `DEFAULT_OPTIONS.qinFarStart = 1`. A new game names it;
// `qinFarStart: 0` is the setup without the foothold. A game whose own options lack the key (a save or an export from
// before #142) was set up without it and keeps that: createGame's merge runs once, for a new game, and E.replay uses
// the recorded options exactly.
//
// Every expected number here is copied from the rulebook (Projects/zongheng/zongheng - rulebook.md), not read from
// board.js / engine.js: 起始配置 (the fixed points), the space table (安定值, 相鄰) and 控制 = 我方 ≥ 對方 + S. The
// foothold (1 in 臨淄, 1 in 薊) is #142's text.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";

// 起始配置 without the foothold: 秦 關中 4、函谷關 3、漢中 1、義渠 1;楚 郢 4、陳蔡 2、黔中 1、淮泗 1.
const RULEBOOK_START = {
  guanzhong: [4, 0], hangu: [3, 0], hanzhong: [1, 0], yiqu: [1, 0],
  ying: [0, 4], chencai: [0, 2], qianzhong: [0, 1], huaisi: [0, 1],
};
// #142: 遠交, 秦 臨淄 1、薊 1.
const FOOTHOLD = { linzi: [1, 0], ji: [1, 0] };
// The space table: 臨淄 and 薊 both have 安定值 3; neighbours as listed there.
const S_LINZI = 3, S_JI = 3;
const LINZI_ADJ = ["jimo", "ju", "xue", "zhongshan"], JI_ADJ = ["zhongshan", "dai", "liaodong"];
// Every space on the map (the table's 26 rows), so a stray point anywhere is seen.
const ALL = ["guanzhong", "hangu", "hanzhong", "bashu", "yiqu", "yiyang", "xinzheng", "hedong", "daliang", "shangdang", "handan", "luoyi",
  "linzi", "jimo", "ju", "xue", "song", "ying", "huaisi", "wuyue", "qianzhong", "chencai", "ji", "liaodong", "zhongshan", "dai"];
// A game's options as createGame wrote them before #142 (DEFAULT_OPTIONS at a24b244, copied from that commit): no
// qinFarStart key. This is what an old save's or an old export's `options` holds.
const PRE_142_OPTIONS = { cap: 2, seals: 5, mie: 3, comp: 0, homeLock: 4, luoyi: 1, turns: 8, scoringSplit: "homes", sealAt: "cap", tie: "chu", hangu: 3, wuguo: "nonbg", westBonus: true, yue: "none", reach: "ts", emperor: "win-lead", lobby: "realign-own", homeFall: "lose-turn" };

const board = (st) => Object.fromEntries(ALL.map((id) => [id, E.infOf(st, id).slice()]));
const expect = (extra = {}) => Object.fromEntries(ALL.map((id) => [id, (extra[id] || RULEBOOK_START[id] || [0, 0]).slice()]));
const noOptions = (st) => { const { options: _o, inf: _i, ...rest } = st; return rest; };
const OFF = { qinFarStart: 0 };
// Both free placements, the same choices in every game of a test.
const QIN_FREE = ["hangu", "hanzhong", "yiqu", "yiyang"];
const SETUP_ACTIONS = (chuFree) => [{ type: "choose", side: E.QIN, choice: QIN_FREE }, { type: "choose", side: E.CHU, choice: chuFree }];
function setUp(options, chuFree) {
  let st = E.createGame(7, options);
  assert.equal(st.pending?.tag, "setup"); assert.equal(st.pending.who, E.QIN);
  st = E.apply(st, SETUP_ACTIONS(chuFree)[0]);
  assert.equal(st.pending?.tag, "setup"); assert.equal(st.pending.who, E.CHU);
  return E.apply(st, SETUP_ACTIONS(chuFree)[1]);
}

test("D1: the map has all 26 spaces the test watches (the population is the whole board)", () => {
  assert.deepEqual(ALL.slice().sort(), E.SPACES.map((s) => s.id).sort());
});

test("D1 (#142): the default -- a new game names qinFarStart 1 and starts with Qin 1 in 臨淄 and 1 in 薊", () => {
  assert.equal(E.DEFAULT_OPTIONS.qinFarStart, 1);
  for (const seed of [1, 2, 3, 99]) {
    const st = E.createGame(seed);
    assert.equal(st.options.qinFarStart, 1, `seed ${seed}: written into the game's own options`);
    assert.deepEqual(board(st), expect(FOOTHOLD), `seed ${seed}: the rulebook's fixed setup plus the foothold`);
  }
});

test("D1: qinFarStart 0 is the setup without the foothold, and nothing else differs", () => {
  for (const seed of [1, 2, 3, 99]) {
    const a = E.createGame(seed, OFF), b = E.createGame(seed);
    assert.deepEqual(board(a), expect(), `seed ${seed}: nothing in 臨淄 or 薊`);
    assert.deepEqual(board(b), expect(FOOTHOLD), `seed ${seed}: the board`);
    assert.equal(JSON.stringify(noOptions(b)), JSON.stringify(noOptions(a)), `seed ${seed}: decks, hands, tracks, plan and the pending choice`);
    assert.deepEqual(b.options, { ...a.options, qinFarStart: 1 });
  }
});

test("D1 (#142): an export recorded before the change replays with no foothold (E.replay uses the recorded options)", () => {
  const chu = ["linzi", "linzi", "jimo", "wuyue"];
  const st = E.replay(7, PRE_142_OPTIONS, SETUP_ACTIONS(chu));
  assert.ok(!("qinFarStart" in st.options), "the recorded options are not merged over today's defaults");
  assert.deepEqual(E.infOf(st, "linzi"), [0, 2], "臨淄: Chu's 2 free points, no Qin point");
  assert.deepEqual(E.infOf(st, "ji"), [0, 0]);
  // The same game as one played with the foothold switched off, action for action.
  assert.deepEqual(board(st), board(setUp(OFF, chu)));
  // And a game recorded after the change replays with it.
  const now = E.replay(7, E.createGame(7).options, SETUP_ACTIONS(chu));
  assert.deepEqual(board(now), board(setUp({}, chu)));
  assert.deepEqual(E.infOf(now, "linzi"), [1, 2]);
});

test("D1 (#142): a saved game from before the change keeps its board -- its own options, without the key, go on as they are", () => {
  // A save is a state; loading it runs no merge. Play on from the setup: no foothold appears later.
  const saved = JSON.parse(JSON.stringify(E.replay(7, PRE_142_OPTIONS, SETUP_ACTIONS(["linzi", "linzi", "jimo", "wuyue"]))));
  assert.ok(!("qinFarStart" in saved.options));
  assert.deepEqual(E.infOf(saved, "ji"), [0, 0]);
  assert.equal(saved.phase, "headline", "the game goes on from the save, at turn 1's headline");
  assert.equal(saved.winner, null);
});

test("D1: the foothold is there before the free placement, which it does not change (Qin: 西土 / 三晉 only)", () => {
  const a = E.createGame(4, OFF), b = E.createGame(4);
  assert.deepEqual(b.pending.options, a.pending.options, "Qin's free placement offers the same spaces");
  assert.ok(!b.pending.options.includes("linzi") && !b.pending.options.includes("ji"));
  assert.deepEqual(E.infOf(b, "linzi"), [1, 0], "already on the board when Qin is asked");
});

test("D1: after both free placements the only difference is Qin's 1 in 臨淄 and 1 in 薊", () => {
  const chu = ["linzi", "linzi", "jimo", "wuyue"];
  const a = setUp(OFF, chu), b = setUp({}, chu);
  const da = board(a), db = board(b);
  for (const id of ALL) {
    const want = id === "linzi" || id === "ji" ? [da[id][0] + 1, da[id][1]] : da[id];
    assert.deepEqual(db[id], want, id);
  }
});

test("D1: Chu may still put free points in 臨淄; 3 there no longer controls it, 4 does (控制 = 我方 ≥ 對方 + S)", () => {
  const three = ["linzi", "linzi", "linzi", "wuyue"], four = ["linzi", "linzi", "linzi", "linzi"];
  // Without the foothold: Chu 3 ≥ Qin 0 + 3.
  assert.equal(E.controller(setUp(OFF, three), "linzi"), 3 >= 0 + S_LINZI ? E.CHU : null);
  assert.equal(E.controller(setUp(OFF, three), "linzi"), E.CHU);
  // D1: Chu 3 < Qin 1 + 3, and Qin 1 < Chu 3 + 3: nobody.
  const d3 = setUp({}, three);
  assert.deepEqual(E.infOf(d3, "linzi"), [1, 3]);
  assert.equal(E.controller(d3, "linzi"), null);
  // D1: Chu 4 ≥ 1 + 3.
  const d4 = setUp({}, four);
  assert.deepEqual(E.infOf(d4, "linzi"), [1, 4]);
  assert.equal(E.controller(d4, "linzi"), E.CHU);
  // 薊 is not in Chu's free regions (南方 / 東方): Qin's 1 there faces nobody, and 1 < 0 + 3 controls nothing.
  assert.deepEqual(E.infOf(d4, "ji"), [1, 0]);
  assert.equal(E.controller(d4, "ji"), 1 >= 0 + S_JI ? E.QIN : null);
});

test("D1: under reach B Qin can place from the foothold (臨淄, 薊 and their neighbours); without it it cannot", () => {
  const chu = ["linzi", "linzi", "jimo", "wuyue"];
  const far = ["linzi", "ji", ...LINZI_ADJ, ...JI_ADJ];
  const off = new Set(E.opsOptions(setUp(OFF, chu), E.QIN).placeOptions.map((o) => o.id));
  const d1 = new Set(E.opsOptions(setUp({}, chu), E.QIN).placeOptions.map((o) => o.id));
  for (const id of far) assert.ok(d1.has(id), `D1: Qin may place in ${id}`);
  // Without it only 代 is in reach (next to 義渠, where Qin starts); the rest of the far spaces are not.
  for (const id of far) assert.equal(off.has(id), id === "dai", `without D1: ${id}`);
});

test("D1: under realign-own Qin may 遊說 臨淄 once Chu is there too (its own influence there); without D1 it may not", () => {
  const chu = ["linzi", "linzi", "jimo", "wuyue"];
  const lob = (opts) => E.opsOptions(setUp({ lobby: "realign-own", ...opts }, chu), E.QIN).lobbyTargets.map((t) => t.id);
  assert.ok(lob({}).includes("linzi"));
  assert.ok(!lob(OFF).includes("linzi"));
  assert.ok(!lob({}).includes("jimo"), "即墨: Chu only, Qin has nothing of its own there");
});
