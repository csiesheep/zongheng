// #131 audit: the room's own lines (`say`) go to every socket -- the other seat
// and every spectator -- so they may not name a card the table cannot see.
//
// The #25 bot-retry path writes two such lines: "bot error: <the engine's
// refusal>" and "bot fallback: <who> plays <the action>". Both used to carry
// card ids verbatim:
//   - a fallback HEADLINE is named ("<card> as its headline") while the other
//     side has not picked its own yet: the headline is revealed to it early;
//   - a refused card choice reads "card: <id> not allowed", and the bot's pick
//     can be a card in its own, hidden hand.
// The fake Durable Object is the one room-bot-retry.test.js uses.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../public/shared/engine.js";
import { randomAction } from "../public/shared/bots.js";
import { Room } from "../src/room.js";

const { QIN, CHU } = E;

function fakeRoom(humans) {
  const sent = [];
  const sockets = humans.map((side) => ({
    token: `t${side}`, side,
    send(msg) { sent.push({ to: side, msg: JSON.parse(msg) }); },
    deserializeAttachment() { return { token: `t${side}` }; },
    close() {},
  }));
  const ctx = {
    storage: { async get() { return null; }, async put() {}, async setAlarm() {}, async deleteAlarm() {}, async deleteAll() {} },
    getWebSockets(tag) { return tag ? sockets.filter((s) => s.token === tag) : sockets; },
  };
  const room = new Room(ctx, {});
  const seat = (side) => ({ idx: side, side, name: side === QIN ? "Qin player" : "Chu player", token: humans.includes(side) ? `t${side}` : `ai-${side}`, ready: true, ai: !humans.includes(side), lastSeen: Date.now() });
  room.room = {
    code: "TEST", phase: "lobby", seats: [seat(QIN), seat(CHU)], settings: { level: "normal", lang: "en" },
    state: null, rngState: 1, gen: 0, deadline: 0, clockKey: "", log: [], alarmAt: 0, idle: false, lastActive: Date.now(),
  };
  // Every `say` line any socket received.
  const said = () => sent.filter((s) => s.msg.type === "say").map((s) => s.msg.text);
  return { room, sent, said };
}

// Real play from `seed` until `stop(st)`.
function playUntil(seed, stop) {
  const rng = E.makeRng(seed);
  let st = E.createGame(seed);
  for (let n = 0; n < 500 && !stop(st); n++) {
    const who = E.mustAct(st);
    st = E.apply(st, randomAction(st, who[rng.int(who.length)], rng));
  }
  assert.ok(stop(st), `seed ${seed}: position not reached`);
  return st;
}

test("#131: a bot's fallback headline is not named to the table before the headlines are revealed", async () => {
  const t = fakeRoom([QIN]); // Qin is a connected human, Chu the bot
  await t.room.startGame();
  t.room.room.state = playUntil(5, (st) => st.phase === "headline" && st.headline[QIN] == null && st.headline[CHU] == null);
  // Chu's bot is always refused, so after 3 tries the table plays a fallback for it.
  t.room.decideFor = (side) => ({ type: "play", side, card: "no-such-card", use: "event" });
  for (let i = 0; i < 3; i++) await t.room.pump();
  const st = t.room.room.state;
  assert.equal(st.phase, "headline", "Qin has not picked: the headlines are still hidden");
  const chuPick = st.headline[CHU];
  assert.ok(chuPick, "the fallback put Chu's headline in (non-vacuous)");
  const fb = t.said().filter((x) => /bot fallback/.test(x));
  assert.equal(fb.length, 1, "the fallback line was said");
  const leaks = t.said().filter((x) => new RegExp(`\\b${chuPick}\\b`).test(x));
  assert.deepEqual(leaks, [], `Chu's headline ${chuPick} is named to every socket before the reveal`);
  // Qin's view hides it, as it should: the line was the only way out.
  const lastView = t.sent.filter((s) => s.to === QIN && s.msg.type === "view").pop();
  assert.equal(lastView.msg.view.headline[CHU], "hidden");
});

test("#131: a refused bot choice does not name a card from the bot's hidden hand", async () => {
  const t = fakeRoom([CHU]); // Chu is a connected human, Qin the bot
  await t.room.startGame();
  // Qin, the bot, plays 韓非入秦 and owes its choice: discard a Chu-side card or not.
  let st = playUntil(13, (s) => s.phase === "action" && !s.pending && s.actor === QIN);
  const give = (card) => {
    for (const h of st.hands) { const i = h.indexOf(card); if (i >= 0) h.splice(i, 1); }
    for (const k of ["draw", "discard", "removed"]) { const i = st[k].indexOf(card); if (i >= 0) st[k].splice(i, 1); }
    for (const a of Object.values(st.later)) { const i = a.indexOf(card); if (i >= 0) a.splice(i, 1); }
    st.hands[QIN].push(card);
  };
  give("hanfei");
  st = E.apply(st, { type: "play", side: QIN, card: "hanfei", use: "event" });
  assert.equal(st.pending && st.pending.who, QIN);
  // The bot picks a Qin card of its own that is not an option: a refusal.
  const secret = st.hands[QIN].find((c) => !st.pending.options.includes(c));
  assert.ok(secret, "a hidden Qin card that is not an option (non-vacuous)");
  t.room.room.state = st;
  t.room.decideFor = (side) => ({ type: "choose", side, choice: [secret] });
  await t.room.pump();
  const errs = t.said().filter((x) => /bot error/.test(x));
  assert.equal(errs.length, 1, "the refusal was said");
  assert.ok(t.room.room.state.hands[QIN].includes(secret), "the card is still in Qin's hidden hand");
  assert.ok(!new RegExp(`\\b${secret}\\b`).test(errs[0]), `the refusal names Qin's hidden card to every socket: ${errs[0]}`);
});
