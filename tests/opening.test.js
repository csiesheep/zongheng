// Guard for the opening video (orchestrator-owned, #67). public/opening.js decides WHETHER the opening plays, without a DOM;
// the files it plays are checked here too, so a missing or swapped file is a red test, not a black screen on a phone.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as O from "../public/opening.js";

test("the opening plays on every visit (owner, 2026-09-21), never for reduced motion or a room link, and ?opening forces it", () => {
  assert.equal(O.OPENING_KEY, "zh.opening");
  const p = (q = "") => new URLSearchParams(q);
  assert.equal(O.shouldPlayOpening({ seen: false, reducedMotion: false, params: p() }), true, "a first visit plays it");
  assert.equal(O.shouldPlayOpening({ seen: true, reducedMotion: false, params: p() }), true, "every visit plays it: having seen it before no longer skips it");
  assert.equal(O.shouldPlayOpening({ seen: false, reducedMotion: true, params: p() }), false, "reduced motion: straight to the landing");
  assert.equal(O.shouldPlayOpening({ seen: true, reducedMotion: false, params: p("opening") }), true, "?opening plays it");
  assert.equal(O.shouldPlayOpening({ seen: true, reducedMotion: true, params: p("opening") }), true, "an explicit ?opening wins over reduced motion");
  assert.equal(O.shouldPlayOpening({ seen: false, reducedMotion: false, params: p("room=ABCD") }), false, "a room link goes straight to the landing");
  assert.equal(O.shouldPlayOpening({ seen: false, reducedMotion: false, params: p("code=ABCD") }), false);
  assert.equal(O.shouldPlayOpening({ seen: true, reducedMotion: false, params: p("lang=en") }), true, "a language link plays it too");
  assert.doesNotThrow(() => O.shouldPlayOpening({ seen: undefined, reducedMotion: false, params: p() }));
  assert.doesNotThrow(() => O.shouldPlayOpening({}));
});

test("the files are there, small enough for a phone, and the video ends on the landing's own picture", () => {
  const v = new URL("../public/video/opening.mp4", import.meta.url), s = new URL("../public/video/opening_start.jpg", import.meta.url);
  assert.ok(fs.existsSync(v), "public/video/opening.mp4 is missing");
  assert.ok(fs.existsSync(s), "public/video/opening_start.jpg is missing");
  const vb = fs.statSync(v).size, sb = fs.statSync(s).size;
  assert.ok(vb > 1_000_000 && vb < 6_000_000, `opening.mp4 is ${vb} bytes`);
  assert.ok(sb > 20_000 && sb < 400_000, `opening_start.jpg is ${sb} bytes`);
  const head = fs.readFileSync(v).subarray(0, 64).toString("latin1");
  assert.ok(head.includes("ftyp"), "opening.mp4 is not an MP4 file");
  const buf = fs.readFileSync(v);
  assert.ok(buf.indexOf("moov") < buf.indexOf("mdat"), "the moov atom must come first (faststart), or a phone waits for the whole file before playing");
  const j = JSON.parse(fs.readFileSync(new URL("../public/video/credits.json", import.meta.url), "utf8"));
  assert.ok(j.video && j.music && Array.isArray(j.video.frames) && j.video.frames.length >= 5, "credits.json must record the key frames, the clips and the music take");
});

// #76: iPhones decode AAC only up to 48 kHz. The first opening.mp4 carried 96 kHz audio: iOS fired "error" on play and the
// landing's guard dropped straight to the page (the owner, 2026-09-21: tap, then straight to the landing). Every track's own
// timescale is read from its mdhd box; a sound track (hdlr "soun") must be at or below 48000.
test("the opening's audio track is at most 48 kHz, which iPhones can decode", () => {
  const buf = fs.readFileSync(new URL("../public/video/opening.mp4", import.meta.url));
  const rates = [];
  for (let i = buf.indexOf("mdhd"); i !== -1; i = buf.indexOf("mdhd", i + 4)) {
    const version = buf[i + 4];
    const timescale = version === 1 ? buf.readUInt32BE(i + 24) : buf.readUInt32BE(i + 16);
    const h = buf.indexOf("hdlr", i);
    const handler = h === -1 ? "" : buf.toString("latin1", h + 12, h + 16);
    if (handler === "soun") rates.push(timescale);
  }
  assert.equal(rates.length, 1, `expected one sound track, found ${rates.length}`);
  assert.ok(rates[0] <= 48000, `the audio track runs at ${rates[0]} Hz; iPhones need 48000 or less`);
});
