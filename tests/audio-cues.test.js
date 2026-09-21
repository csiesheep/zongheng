// Guard for the audio cue map (orchestrator-owned, #62). public/audio-cues.js decides WHAT sounds, without a DOM:
// which piece of music belongs to which screen and seat, which sound a log entry makes, when the warning drum plays.
// The API was fixed in the issue before any code existed; this file is that contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as E from "../public/shared/engine.js";
import { fallbackFor } from "../public/shared/fallback.js";
import * as A from "../public/audio-cues.js";

const manifest = JSON.parse(fs.readFileSync(new URL("../public/audio/manifest.json", import.meta.url), "utf8"));
const has = (cue) => Object.prototype.hasOwnProperty.call(manifest.cues, cue);

// ---------- part 1: the music ----------
test("every screen has its piece, and the table's piece follows the era and the seat", () => {
  assert.equal(A.sceneFor({ page: "landing" }), "bgm.landing");
  assert.equal(A.sceneFor({ page: "rules" }), null);
  for (const era of ["reform", "alliance", "conquest"]) {
    assert.equal(A.sceneFor({ page: "table", era, me: 0 }), `bgm.table.${era}.qin`);
    assert.equal(A.sceneFor({ page: "table", era, me: 1 }), `bgm.table.${era}.chu`);
    assert.equal(A.sceneFor({ page: "table", era, me: null }), `bgm.table.${era}.qin`, "a spectator hears the Qin version");
  }
  assert.equal(A.sceneFor({ page: "setup" }), "bgm.setup");
  assert.equal(A.sceneFor({ page: "lobby" }), "bgm.setup");
  assert.equal(A.sceneFor({ page: "table", era: "reform", me: 1, tutorial: true }), "bgm.tutorial");
});

test("the ending: the winner and a spectator hear the winner's piece, the loser hears their own defeat", () => {
  assert.equal(A.sceneFor({ page: "over", me: 0, winner: 0 }), "bgm.win.qin");
  assert.equal(A.sceneFor({ page: "over", me: 1, winner: 1 }), "bgm.win.chu");
  assert.equal(A.sceneFor({ page: "over", me: 0, winner: 1 }), "bgm.lose.qin");
  assert.equal(A.sceneFor({ page: "over", me: 1, winner: 0 }), "bgm.lose.chu");
  assert.equal(A.sceneFor({ page: "over", me: null, winner: 0 }), "bgm.win.qin");
  assert.equal(A.sceneFor({ page: "over", me: null, winner: 1 }), "bgm.win.chu");
});

test("every cue the map can ask for is in the manifest", () => {
  // until #63 the setup and tutorial pieces were not made yet and this list held those two
  assert.deepEqual([...A.missingCues(manifest)].sort(), []);
  // and the manifest is not lying about itself
  for (const [cue, m] of Object.entries(manifest.cues)) {
    assert.ok(fs.existsSync(new URL("../public/audio/" + m.file, import.meta.url)), `${cue}: ${m.file} is not in public/audio`);
    assert.equal(m.kind, cue.startsWith("bgm.") ? "bgm" : "sfx", `${cue}: wrong kind`);
  }
});

// ---------- part 2: the sounds (skipped until the three functions exist) ----------
const part2 = typeof A.cuesForLog === "function" && typeof A.controlCues === "function" && typeof A.dangerFlags === "function";

test("a log entry makes the sound the issue says it makes", { skip: !part2 }, () => {
  const qinCard = Object.keys(E.CARD).find((c) => E.CARD[c].side === E.QIN && !E.CARD[c].scoring);
  const chuCard = Object.keys(E.CARD).find((c) => E.CARD[c].side === E.CHU && !E.CARD[c].scoring);
  const neutral = Object.keys(E.CARD).find((c) => E.CARD[c].side == null && !E.CARD[c].scoring);
  const scoring = Object.keys(E.CARD).find((c) => E.CARD[c].scoring);
  const one = (entry, me = 0) => A.cuesForLog([entry], { me });
  assert.deepEqual(one({ type: "headline", cards: [qinCard, chuCard], first: 0 }), ["sfx.card.reveal"]);
  assert.deepEqual(one({ type: "play", side: 0, card: qinCard, use: "event" }), ["sfx.card.event.qin"]);
  assert.deepEqual(one({ type: "play", side: 0, card: chuCard, use: "event" }), ["sfx.card.event.chu"], "the sound follows the CARD's side, not the player's");
  assert.deepEqual(one({ type: "play", side: 1, card: neutral, use: "event" }), ["sfx.card.event.neutral"]);
  assert.deepEqual(one({ type: "play", side: 1, card: scoring, use: "event" }), ["sfx.card.event.neutral"]);
  assert.deepEqual(one({ type: "play", side: 0, card: qinCard, use: "place" }, 0), [], "my own ops play already sounded under my finger");
  assert.deepEqual(one({ type: "play", side: 1, card: chuCard, use: "place" }, 0), ["sfx.card.ops"], "the other side spends a card of its own for ops");
  assert.deepEqual(one({ type: "play", side: 1, card: neutral, use: "campaign" }, 0), ["sfx.card.ops"]);
  assert.deepEqual(one({ type: "play", side: 0, card: qinCard, use: "lobby" }, null), ["sfx.card.ops"], "a spectator hears either side's ops play");
  assert.deepEqual(one({ type: "play", side: 1, card: qinCard, use: "reform" }, 0), ["sfx.card.ops"], "reform never fires the event, even with the enemy's card");
  // #66: an enemy card played for place / campaign / lobby fires THAT side's event: its sound, for every listener, the player included
  assert.deepEqual(one({ type: "play", side: 0, card: chuCard, use: "place" }, 0), ["sfx.card.enemyEvent.chu"]);
  assert.deepEqual(one({ type: "play", side: 1, card: qinCard, use: "campaign" }, 0), ["sfx.card.enemyEvent.qin"]);
  assert.deepEqual(one({ type: "play", side: 1, card: qinCard, use: "lobby" }, null), ["sfx.card.enemyEvent.qin"]);
  assert.deepEqual(one({ type: "place", side: 1, points: ["hangu"], spent: 1 }, 0), ["sfx.map.opponent"]);
  assert.deepEqual(one({ type: "place", side: 0, points: ["hangu"], spent: 1 }, 0), [], "my own placement already sounded under my finger");
  assert.deepEqual(one({ type: "place", side: 0, points: ["hangu"], spent: 1 }, null), ["sfx.map.opponent"], "a spectator hears both sides' moves");
  assert.deepEqual(one({ type: "lobby", side: 1, target: "hangu", ops: 2, removed: 1 }, 0), ["sfx.map.lobby"], "a lobby has its own sound; it replaces the opponent tick");
  assert.deepEqual(one({ type: "lobby", side: 0, target: "hangu", ops: 2, removed: 1 }, 0), ["sfx.map.lobby"]);
  const key = Object.keys(E.SPACE).find((id) => E.SPACE[id].battleground), plain = Object.keys(E.SPACE).find((id) => !E.SPACE[id].battleground);
  assert.deepEqual(one({ type: "campaign", side: 0, target: plain, ops: 2, removed: 1, placed: 0 }, 0), ["sfx.map.campaign"]);
  assert.deepEqual(one({ type: "campaign", side: 1, target: plain, ops: 2, removed: 1, placed: 0 }, 0), ["sfx.map.campaign"]);
  assert.deepEqual(one({ type: "campaign", side: 1, target: key, ops: 2, removed: 1, placed: 0 }, 0), ["sfx.map.campaign", "sfx.map.campaign.key"], "a battleground adds the horn");
  assert.deepEqual(one({ type: "vp", side: 0, n: 2, mandate: 3 }), ["sfx.track.mandate.qin"]);
  assert.deepEqual(one({ type: "vp", side: 1, n: 2, mandate: -1 }), ["sfx.track.mandate.chu"]);
  assert.deepEqual(one({ type: "seal", state: "han" }), ["sfx.seal.gain"]);
  assert.deepEqual(one({ type: "unseal", state: "han" }), ["sfx.seal.lose"]);
  assert.deepEqual(one({ type: "mie", state: "han" }), ["sfx.mie"]);
  assert.deepEqual(one({ type: "turn", turn: 2, era: "reform" }), ["sfx.turn.new", "sfx.card.deal", "sfx.turn.headline"], "the bell, the cards are dealt, the horn calls the headline phase");
  // S5: the tracks and the scoring
  assert.deepEqual(one({ type: "tire", to: 4, by: 1 }), ["sfx.track.weariness"]);
  assert.deepEqual(one({ type: "reform", side: 1, box: 2 }), ["sfx.track.reform"]);
  assert.deepEqual(one({ type: "reform", side: 0, box: 1 }, 0), ["sfx.track.reform"], "my own advance too: nothing sounded under the finger for it");
  assert.deepEqual(one({ type: "restore", state: "han" }), ["sfx.restore"]);
  assert.deepEqual(one({ type: "score", region: "south", qin: { total: 0 }, chu: { total: 5 } }), ["sfx.score.count"]);
  assert.deepEqual(one({ type: "jiuding", to: 1 }), ["sfx.card.jiuding"]);
  assert.deepEqual(one({ type: "era", era: "alliance" }), ["sfx.turn.era"]);
  assert.deepEqual(one({ type: "over", winner: 0, reason: "mandate" }, 0), ["sfx.end.win.qin"]);
  assert.deepEqual(one({ type: "over", winner: 0, reason: "mandate" }, 1), ["sfx.end.lose.chu"]);
  assert.deepEqual(one({ type: "over", winner: 1, reason: "alliance" }, null), ["sfx.end.win.chu"]);
  for (const type of ["setup", "skip", "reshuffle", "endTurn", "discard", "bog", "opsLost", "something-new"]) assert.deepEqual(one({ type, side: 0 }), [], `${type} should be silent for now`);
});

test("a big batch keeps the four most important sounds in order, and a repeated sound once", { skip: !part2 }, () => {
  const c = Object.keys(E.CARD).find((k) => E.CARD[k].side === E.QIN && !E.CARD[k].scoring);
  const batch = [{ type: "play", side: 1, card: c, use: "event" }, { type: "place", side: 1, points: ["hangu"], spent: 1 }, { type: "campaign", side: 1, target: Object.keys(E.SPACE).find((id) => E.SPACE[id].battleground), ops: 2, removed: 1, placed: 0 },
    { type: "vp", side: 1, n: 1, mandate: -1 }, { type: "seal", state: "han" }, { type: "mie", state: "wei" }, { type: "turn", turn: 5, era: "alliance" }];
  const out = A.cuesForLog(batch, { me: 0 });
  assert.equal(out.length, 4);
  assert.deepEqual(out, ["sfx.track.mandate.chu", "sfx.seal.gain", "sfx.mie", "sfx.turn.new"], "the four kept are the Mandate, the seal, the destroyed state and the new turn, in the order they happened");
  // importance: the Cauldrons outrank a new turn; the deal and the ops click are the first to go
  const low = A.cuesForLog([{ type: "play", side: 1, card: Object.keys(E.CARD).find((k) => E.CARD[k].side === E.CHU && !E.CARD[k].scoring), use: "place" }, { type: "place", side: 1, points: ["hangu"], spent: 1 },
    { type: "jiuding", to: 0 }, { type: "turn", turn: 3, era: "reform" }, { type: "vp", side: 0, n: 1, mandate: 1 }], { me: 0 });
  assert.deepEqual(low, ["sfx.map.opponent", "sfx.card.jiuding", "sfx.turn.new", "sfx.track.mandate.qin"], "ops and the deal drop first; the opponent tick outranks only them");
  // a scoring card: count the rods, then the Mandate moves; a campaign on a battleground tires the land
  const scored = A.cuesForLog([{ type: "play", side: 1, card: Object.keys(E.CARD).find((k) => E.CARD[k].scoring), use: "event" }, { type: "score", region: "south", qin: { total: 0 }, chu: { total: 5 } }, { type: "vp", side: 1, n: 5, mandate: -5 }], { me: 0 });
  assert.deepEqual(scored, ["sfx.card.event.neutral", "sfx.score.count", "sfx.track.mandate.chu"]);
  const bg = Object.keys(E.SPACE).find((id) => E.SPACE[id].battleground);
  const tired = A.cuesForLog([{ type: "campaign", side: 1, target: bg, ops: 3, removed: 2, placed: 1 }, { type: "tire", to: 4, by: 1 }], { me: 0 });
  assert.deepEqual(tired, ["sfx.map.campaign", "sfx.map.campaign.key", "sfx.track.weariness"]);
  const twice = A.cuesForLog([{ type: "vp", side: 0, n: 1, mandate: 1 }, { type: "vp", side: 0, n: 1, mandate: 2 }], { me: 0 });
  assert.deepEqual(twice, ["sfx.track.mandate.qin"]);
});

test("every sound the map can return is in the manifest: a whole game on fallbacks, heard from each seat", { skip: !part2 }, () => {
  for (const me of [0, 1, null]) {
    let st = E.createGame(11), seen = 0, heard = new Set();
    while (st.winner == null) {
      const side = E.mustAct(st)[0]; const fb = fallbackFor(st, side); assert.ok(fb);
      const last = st.log.length ? st.log[st.log.length - 1].i : -1;
      const fresh = fb.state.log.filter((l) => l.i > last);
      for (const cue of A.cuesForLog(fresh, { me })) { heard.add(cue); assert.ok(has(cue), `${cue} is not in the manifest`); }
      for (const cue of A.controlCues(st, fb.state, me)) { heard.add(cue); assert.ok(has(cue), `${cue} is not in the manifest`); }
      st = fb.state; seen++;
    }
    assert.ok(heard.size >= 6, `seat ${me}: only ${[...heard].join(", ")} in a whole game`);
    if (me == null) assert.ok(![...heard].some((c) => c.startsWith("sfx.map.control.")), "a spectator controls nothing");
  }
});

test("control: gaining and losing a space, each at most once per change", { skip: !part2 }, () => {
  let found = { gain: false, lose: false };
  for (let seed = 1; seed <= 12 && !(found.gain && found.lose); seed++) {
    let st = E.createGame(seed);
    while (st.winner == null) {
      const fb = fallbackFor(st, E.mustAct(st)[0]); if (!fb) break;
      for (const me of [0, 1]) {
        const cues = A.controlCues(st, fb.state, me);
        assert.ok(cues.length <= 2 && new Set(cues).size === cues.length, `a cue twice in one call: ${cues.join(", ")}`);
        for (const c of cues) assert.ok(c === "sfx.map.control.gain" || c === "sfx.map.control.lose", c);
        if (cues.includes("sfx.map.control.gain")) found.gain = true;
        if (cues.includes("sfx.map.control.lose")) found.lose = true;
      }
      assert.deepEqual(A.controlCues(st, st, 0), [], "nothing changed, nothing sounds");
      st = fb.state;
    }
  }
  assert.ok(found.gain && found.lose, "twelve games never gained or never lost a space: this test proves nothing");
});

test("danger flags: each condition alone, and none at the start of a game", { skip: !part2 }, () => {
  const st = E.createGame(3);
  assert.deepEqual(A.dangerFlags(st), []);
  const w = (patch) => A.dangerFlags({ ...JSON.parse(JSON.stringify(st)), ...patch });
  const states = Object.keys(E.STATES);
  assert.deepEqual(w({ seals: Object.fromEntries(states.slice(0, st.options.seals - 1).map((s) => [s, true])) }), ["seals"]);
  assert.deepEqual(w({ seals: Object.fromEntries(states.slice(0, st.options.seals - 2).map((s) => [s, true])) }), []);
  assert.deepEqual(w({ mie: Object.fromEntries(states.slice(0, st.options.mie - 1).map((s) => [s, true])) }), ["mie"]);
  assert.deepEqual(w({ mandate: 15 }), ["mandateQin"]);
  assert.deepEqual(w({ mandate: 14 }), []);
  assert.deepEqual(w({ mandate: -15 }), ["mandateChu"]);
  assert.deepEqual(w({ weariness: 2 }), ["weariness"]);
  assert.deepEqual(w({ weariness: 3 }), []);
  assert.deepEqual(w({ turn: st.options.turns }), ["lastTurn"]);
  assert.deepEqual(w({ mandate: -16, weariness: 2, turn: st.options.turns }), ["lastTurn", "mandateChu", "weariness"], "sorted");
});

// ---------- #64: the tension layer ----------
test("the tension layer: on while any one-step-from-the-end flag holds, off at the start and off once the game is over", { skip: typeof A.tensionFor !== "function" }, () => {
  const st = E.createGame(3);
  assert.equal(A.tensionFor(st), false, "a fresh game is calm");
  const w = (patch) => ({ ...JSON.parse(JSON.stringify(st)), ...patch });
  assert.equal(A.tensionFor(w({ mandate: 15 })), true);
  assert.equal(A.tensionFor(w({ mandate: -15 })), true);
  assert.equal(A.tensionFor(w({ mandate: 14 })), false);
  assert.equal(A.tensionFor(w({ weariness: 2 })), true);
  assert.equal(A.tensionFor(w({ turn: st.options.turns })), true);
  assert.equal(A.tensionFor(w({ mandate: 20, winner: 0 })), false, "the ending's piece plays alone");
  assert.equal(A.tensionFor(w({ weariness: 2, winner: 1 })), false);
  assert.equal(A.tensionFor(null), false);
  // it is exactly "dangerFlags is not empty" for a live game: a whole game on fallbacks
  let s2 = E.createGame(5), on = 0, off = 0;
  while (s2.winner == null) { assert.equal(A.tensionFor(s2), A.dangerFlags(s2).length > 0); A.tensionFor(s2) ? on++ : off++; s2 = fallbackFor(s2, E.mustAct(s2)[0]).state; }
  assert.equal(A.tensionFor(s2), false, "over");
  assert.ok(on > 0 && off > 0, `a whole game should be calm at times and tense at times (on ${on}, off ${off})`);
});
