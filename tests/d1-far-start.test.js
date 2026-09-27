// #135 (D1, 遠交): the engine option `qinFarStart: n` gives Qin n influence in 臨淄 (linzi) and n in 薊 (ji) with its
// fixed setup, before the free placement. It is NOT a key of DEFAULT_OPTIONS: an absent option plays as today.
//
// Every expected number here is copied from the rulebook (Projects/zongheng/zongheng - rulebook.md), not read from
// board.js / engine.js: 起始配置 (the fixed points), the space table (安定值, 相鄰) and 控制 = 我方 ≥ 對方 + S.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";

// 起始配置: 秦 關中 4、函谷關 3、漢中 1、義渠 1;楚 郢 4、陳蔡 2、黔中 1、淮泗 1.
const RULEBOOK_START = {
  guanzhong: [4, 0], hangu: [3, 0], hanzhong: [1, 0], yiqu: [1, 0],
  ying: [0, 4], chencai: [0, 2], qianzhong: [0, 1], huaisi: [0, 1],
};
// The space table: 臨淄 and 薊 both have 安定值 3; neighbours as listed there.
const S_LINZI = 3, S_JI = 3;
const LINZI_ADJ = ["jimo", "ju", "xue", "zhongshan"], JI_ADJ = ["zhongshan", "dai", "liaodong"];
// Every space on the map (the table's 26 rows), so a stray point anywhere is seen.
const ALL = ["guanzhong", "hangu", "hanzhong", "bashu", "yiqu", "yiyang", "xinzheng", "hedong", "daliang", "shangdang", "handan", "luoyi",
  "linzi", "jimo", "ju", "xue", "song", "ying", "huaisi", "wuyue", "qianzhong", "chencai", "ji", "liaodong", "zhongshan", "dai"];

const board = (st) => Object.fromEntries(ALL.map((id) => [id, E.infOf(st, id).slice()]));
const expect = (extra = {}) => Object.fromEntries(ALL.map((id) => [id, (extra[id] || RULEBOOK_START[id] || [0, 0]).slice()]));
const noOptions = (st) => { const { options: _o, inf: _i, ...rest } = st; return rest; };
// Both free placements, the same choices in every game of a test.
const QIN_FREE = ["hangu", "hanzhong", "yiqu", "yiyang"];
function setUp(options, chuFree) {
  let st = E.createGame(7, options);
  assert.equal(st.pending?.tag, "setup"); assert.equal(st.pending.who, E.QIN);
  st = E.apply(st, { type: "choose", side: E.QIN, choice: QIN_FREE });
  assert.equal(st.pending?.tag, "setup"); assert.equal(st.pending.who, E.CHU);
  return E.apply(st, { type: "choose", side: E.CHU, choice: chuFree });
}

test("D1: the map has all 26 spaces the test watches (the population is the whole board)", () => {
  assert.deepEqual(ALL.slice().sort(), E.SPACES.map((s) => s.id).sort());
});

test("D1: qinFarStart is not a default -- a new game without it does not name it, and plays today's setup", () => {
  assert.ok(!("qinFarStart" in E.DEFAULT_OPTIONS));
  const st = E.createGame(1);
  assert.ok(!("qinFarStart" in st.options), "an absent option is not written into the save");
  assert.deepEqual(board(st), expect(), "the fixed setup is the rulebook's, nothing in 臨淄 or 薊");
});

test("D1: qinFarStart 1 gives Qin exactly 1 in 臨淄 and 1 in 薊 at the start, and nothing else changes", () => {
  for (const seed of [1, 2, 3, 99]) {
    const a = E.createGame(seed), b = E.createGame(seed, { qinFarStart: 1 });
    assert.deepEqual(board(b), expect({ linzi: [1, 0], ji: [1, 0] }), `seed ${seed}: the board`);
    assert.equal(JSON.stringify(noOptions(b)), JSON.stringify(noOptions(a)), `seed ${seed}: decks, hands, tracks, plan and the pending choice`);
    assert.deepEqual(b.options, { ...a.options, qinFarStart: 1 });
  }
});

test("D1: qinFarStart 0 is the same game as no option", () => {
  const a = E.createGame(5), b = E.createGame(5, { qinFarStart: 0 });
  assert.deepEqual(board(b), board(a));
  assert.equal(JSON.stringify(noOptions(b)), JSON.stringify(noOptions(a)));
});

test("D1: the foothold is there before the free placement, which it does not change (Qin: 西土 / 三晉 only)", () => {
  const a = E.createGame(4), b = E.createGame(4, { qinFarStart: 1 });
  assert.deepEqual(b.pending.options, a.pending.options, "Qin's free placement offers the same spaces");
  assert.ok(!b.pending.options.includes("linzi") && !b.pending.options.includes("ji"));
  assert.deepEqual(E.infOf(b, "linzi"), [1, 0], "already on the board when Qin is asked");
});

test("D1: after both free placements the only difference is Qin's 1 in 臨淄 and 1 in 薊", () => {
  const chu = ["linzi", "linzi", "jimo", "wuyue"];
  const a = setUp({}, chu), b = setUp({ qinFarStart: 1 }, chu);
  const da = board(a), db = board(b);
  for (const id of ALL) {
    const want = id === "linzi" || id === "ji" ? [da[id][0] + 1, da[id][1]] : da[id];
    assert.deepEqual(db[id], want, id);
  }
});

test("D1: Chu may still put free points in 臨淄; 3 there no longer controls it, 4 does (控制 = 我方 ≥ 對方 + S)", () => {
  const three = ["linzi", "linzi", "linzi", "wuyue"], four = ["linzi", "linzi", "linzi", "linzi"];
  // Today: Chu 3 ≥ Qin 0 + 3.
  assert.equal(E.controller(setUp({}, three), "linzi"), 3 >= 0 + S_LINZI ? E.CHU : null);
  assert.equal(E.controller(setUp({}, three), "linzi"), E.CHU);
  // D1: Chu 3 < Qin 1 + 3, and Qin 1 < Chu 3 + 3: nobody.
  const d3 = setUp({ qinFarStart: 1 }, three);
  assert.deepEqual(E.infOf(d3, "linzi"), [1, 3]);
  assert.equal(E.controller(d3, "linzi"), null);
  // D1: Chu 4 ≥ 1 + 3.
  const d4 = setUp({ qinFarStart: 1 }, four);
  assert.deepEqual(E.infOf(d4, "linzi"), [1, 4]);
  assert.equal(E.controller(d4, "linzi"), E.CHU);
  // 薊 is not in Chu's free regions (南方 / 東方): Qin's 1 there faces nobody, and 1 < 0 + 3 controls nothing.
  assert.deepEqual(E.infOf(d4, "ji"), [1, 0]);
  assert.equal(E.controller(d4, "ji"), 1 >= 0 + S_JI ? E.QIN : null);
});

test("D1: under reach B Qin can place from the foothold (臨淄, 薊 and their neighbours); today it cannot", () => {
  const chu = ["linzi", "linzi", "jimo", "wuyue"];
  const far = ["linzi", "ji", ...LINZI_ADJ, ...JI_ADJ];
  const today = new Set(E.opsOptions(setUp({}, chu), E.QIN).placeOptions.map((o) => o.id));
  const d1 = new Set(E.opsOptions(setUp({ qinFarStart: 1 }, chu), E.QIN).placeOptions.map((o) => o.id));
  for (const id of far) assert.ok(d1.has(id), `D1: Qin may place in ${id}`);
  // Today only 代 is in reach (next to 義渠, where Qin starts); the rest of the far spaces are not.
  for (const id of far) assert.equal(today.has(id), id === "dai", `today: ${id}`);
});

test("D1: under realign-own Qin may 遊說 臨淄 once Chu is there too (its own influence there); without D1 it may not", () => {
  const chu = ["linzi", "linzi", "jimo", "wuyue"];
  const lob = (opts) => E.opsOptions(setUp({ lobby: "realign-own", ...opts }, chu), E.QIN).lobbyTargets.map((t) => t.id);
  assert.ok(lob({ qinFarStart: 1 }).includes("linzi"));
  assert.ok(!lob({}).includes("linzi"));
  assert.ok(!lob({ qinFarStart: 1 }).includes("jimo"), "即墨: Chu only, Qin has nothing of its own there");
});
