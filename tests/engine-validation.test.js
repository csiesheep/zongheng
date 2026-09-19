// Issue #16, the two engine observations #13 left behind.
//
// 1. Ops that arrive through `choose` — the `eventFirst` branch of an enemy
//    card, and the ops step 商旅通賈 pushes — never went through the dry run
//    `play()` does, because `validateChoice`'s `case "ops"` only looks at
//    `use`. An illegal `points` / `target` therefore came back as a TypeError
//    thrown from deep inside the rules, not as the refusal `play()` gives for
//    the same payload, and the room passed that TypeError's text on as the
//    error message. These tests demand one refusal for both doors.
//
// 2. `run()` finishes a whole turn inside one `apply` when nobody can play.
//    Rulebook 四、細則:「兩人皆無合法行動時(理論上不會),該行動回合跳過」,
//    and 三、回合結構 4「結算」 lists nothing a player decides (the 明法令
//    discard does park, and is not in play here). So there is nothing to stop
//    for and the behaviour is right; the last test pins it.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { Room } from "../src/room.js";

const { QIN, CHU } = E;

// Setup and the headline phase out of the way, with two quiet headlines, so
// every test below starts at turn 1, action round 1, with Qin to act.
function dealt(seed = 7) {
  let st = E.createGame(seed);
  while (st.pending) {
    const p = st.pending;
    st = E.apply(st, { type: "choose", side: p.who, choice: p.options.slice(0, p.n) });
  }
  // Both headlines are events that ask nothing hard, and both sides keep
  // cards afterwards so the action rounds do not skip.
  st.hands[QIN] = ["ximu", "keqing", "envoy", "chumieyue"];
  st.hands[CHU] = ["mozhe", "weiwei", "wuqi"];
  st = E.apply(st, { type: "headline", side: QIN, card: "ximu" });
  st = E.apply(st, { type: "headline", side: CHU, card: "mozhe" });
  while (st.pending) {
    const p = st.pending;
    st = E.apply(st, { type: "choose", side: p.who, choice: p.options.slice(0, p.n) });
  }
  assert.equal(st.phase, "action");
  assert.equal(st.actor, QIN);
  return st;
}

// Qin plays the Chu card 楚滅越 event first and keeps its 2 ops: the ops step
// has no payload, so the engine asks, and the answer comes back via `choose`.
function opsPending(seed = 7) {
  const st = dealt(seed);
  st.hands[QIN] = ["chumieyue"];
  const out = E.apply(st, { type: "play", side: QIN, card: "chumieyue", use: "place", order: "eventFirst" });
  assert.equal(out.pending.kind, "ops");
  assert.equal(out.pending.who, QIN);
  assert.equal(out.pending.ops, 2);
  return out;
}

const thrown = (fn) => { try { fn(); } catch (err) { return err; } return null; };

test("#16 an ops choice with no points at all is refused by the rules, not by a TypeError", () => {
  const st = opsPending();
  const err = thrown(() => E.apply(st, { type: "choose", side: QIN, choice: { use: "place" } }));
  assert.ok(err, "a place with no points must be refused");
  assert.ok(!(err instanceof TypeError), `a rules refusal, not ${err.constructor.name}: ${err.message}`);
  assert.match(err.message, /^place: /);
});

test("#16 an ops choice naming a space that is not on the board is refused the way play() refuses it", () => {
  const payload = { use: "place", points: ["atlantis"] };
  const viaChoose = thrown(() => E.apply(opsPending(), { type: "choose", side: QIN, choice: payload }));
  const withCard = dealt();
  withCard.hands[QIN] = ["keqing"]; // 客卿制度, a Qin card worth 2 ops
  const viaPlay = thrown(() => E.apply(withCard, { type: "play", side: QIN, card: "keqing", ...payload }));
  assert.ok(viaChoose && viaPlay, "both doors must refuse it");
  assert.ok(!(viaChoose instanceof TypeError), `choose gave ${viaChoose.constructor.name}: ${viaChoose.message}`);
  assert.ok(!(viaPlay instanceof TypeError), `play gave ${viaPlay.constructor.name}: ${viaPlay.message}`);
  assert.match(viaChoose.message, /atlantis/, "the refusal names the offending space");
  assert.equal(viaChoose.constructor.name, viaPlay.constructor.name, "same error type through both doors");
  assert.equal(viaChoose.message, viaPlay.message, "same refusal through both doors");
});

test("#16 a refused ops choice leaves the table untouched and the same pending still answerable", () => {
  const st = opsPending();
  const before = JSON.stringify(st);
  assert.throws(
    () => E.apply(st, { type: "choose", side: QIN, choice: { use: "place", points: ["hangu", "atlantis"] } }),
    /^Error: place: /,
  );
  assert.equal(JSON.stringify(st), before, "apply refused before anything moved");
  assert.equal(st.pending.kind, "ops");
  // The legal answer to the very same pending still goes through.
  const ok = E.apply(st, { type: "choose", side: QIN, choice: { use: "place", points: ["hangu", "hanzhong"] } });
  assert.equal(ok.pending, null);
  assert.equal(E.infOf(ok, "hangu")[QIN], E.infOf(st, "hangu")[QIN] + 1);
  assert.equal(E.infOf(ok, "hanzhong")[QIN], E.infOf(st, "hanzhong")[QIN] + 1);
});

test("#16 an ops choice that breaks a rule is refused with that rule's message, through choose as through play", () => {
  // 遼東 touches nothing Qin holds or reaches: rulebook 三、四種行動, placement
  // needs influence there already or an adjacent space under control.
  const viaChoose = thrown(() => E.apply(opsPending(), { type: "choose", side: QIN, choice: { use: "place", points: ["liaodong"] } }));
  assert.ok(viaChoose, "placing in 遼東 out of nowhere must be refused");
  assert.match(viaChoose.message, /liaodong is not reachable/);
  // 關中 has no Chu influence in it, so there is nothing to campaign against.
  const noEnemy = thrown(() => E.apply(opsPending(), { type: "choose", side: QIN, choice: { use: "campaign", target: "guanzhong" } }));
  assert.ok(noEnemy, "a campaign against nobody must be refused");
  assert.match(noEnemy.message, /no enemy influence/);
});

test("#16 the room turns an illegal ops choice into a plain refusal and keeps the table alive", async () => {
  const sent = [], closed = [];
  const sockets = [0, 1].map((side) => ({
    token: `t${side}`, side,
    send(msg) { sent.push({ to: side, msg: JSON.parse(msg) }); },
    deserializeAttachment() { return { token: `t${side}` }; },
    close(code) { closed.push({ side, code }); },
  }));
  const ctx = {
    storage: { async get() { return null; }, async put() {}, async setAlarm() {}, async deleteAlarm() {}, async deleteAll() {} },
    getWebSockets(tag) { return tag ? sockets.filter((s) => s.token === tag) : sockets; },
  };
  const room = new Room(ctx, {});
  room.room = {
    code: "TEST", phase: "game",
    seats: [0, 1].map((side) => ({ idx: side, side, name: `p${side}`, token: `t${side}`, ready: true, ai: false, lastSeen: Date.now() })),
    settings: { level: "normal", lang: "en" },
    state: opsPending(), rngState: 1, gen: 0, deadline: Date.now() + 60_000, clockKey: "", log: [], alarmAt: 0, idle: false, lastActive: Date.now(),
  };
  const was = JSON.stringify(room.room.state);
  await room.webSocketMessage(sockets[0], JSON.stringify({ type: "act", action: { type: "choose", choice: { use: "place", points: ["atlantis"] } } }));
  const err = sent.filter((m) => m.to === 0 && m.msg.type === "error").at(-1);
  assert.ok(err, "the room answers with an error");
  assert.ok(!err.msg.fatal, "a refused move is not fatal");
  assert.match(err.msg.message, /^place: .*atlantis/, "the rules message, not an internal one");
  assert.equal(JSON.stringify(room.room.state), was, "the room's state did not move");
  assert.equal(room.room.state.pending.kind, "ops", "the same decision is still on the table");
  assert.equal(closed.length, 0, "nobody was disconnected");
});

test("#16 with both hands empty the rest of the turn runs out inside the one apply that emptied them", () => {
  const st = dealt();
  // Qin holds one last card, Chu none, and the Nine Cauldrons are face down,
  // so from Chu's next action round on neither side can play anything.
  st.hands[QIN] = ["envoy"];
  st.hands[CHU] = [];
  st.jiuding = { holder: CHU, faceDown: true };
  st.round = 2;
  st.weariness = 3;
  st.inf.luoyi = [3, 0]; // 洛邑 stability 3: Qin controls it
  assert.equal(E.controller(st, "luoyi"), QIN);
  const rounds = st.rounds, mandate = st.mandate, seq = st.logSeq;

  const out = E.apply(st, { type: "play", side: QIN, card: "envoy", use: "place", points: ["hangu"] });

  const fresh = out.log.filter((l) => l.i > seq);
  // Rulebook 四、細則:「兩人皆無合法行動時…該行動回合跳過」 — every remaining
  // half-round is skipped: Chu's half of round 2, then both halves of 3..rounds.
  assert.equal(fresh.filter((l) => l.type === "skip").length, 1 + 2 * (rounds - 2));
  // 回合結構 4 結算: 疲敝軌後退 1 格, and 控制洛邑者天命 +1.
  assert.equal(out.weariness, 4);
  assert.equal(out.mandate - mandate, 1);
  assert.equal(fresh.filter((l) => l.type === "endTurn").length, 1);
  // 回合結構 1 補牌 + 2 標題階段: the next turn is dealt and waiting on both.
  assert.equal(out.turn, st.turn + 1);
  assert.equal(out.phase, "headline");
  assert.equal(out.pending, null, "nothing in the roll-over is a decision, so nothing parks");
  assert.deepEqual(E.mustAct(out), [QIN, CHU]);
});
