// Guard for byte-range responses (orchestrator-owned, #70). iPhones (Safari, and Chrome on iOS which is Safari underneath)
// will not play a <video> or stream an <audio> unless the server answers `Range: bytes=...` with 206 Partial Content.
// The static-asset handler behind the Worker answered 200 with the whole file (measured on production, 2026-09-21),
// so src/range.js turns a full 200 into the right partial response. Pure function over Request/Response: runs in Node.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withRange } from "../src/range.js";

const BODY = new Uint8Array(5000).map((_, i) => i % 251);
const full = (type = "video/mp4", status = 200) => new Response(status === 200 ? BODY : null, { status, headers: { "content-type": type, "content-length": String(BODY.length), etag: '"abc"' } });
const req = (range, method = "GET") => new Request("https://x/zongheng/video/opening.mp4", { method, headers: range ? { range } : {} });
const bytes = async (res) => new Uint8Array(await res.arrayBuffer());

test("no Range header: the response passes through, and media advertises Accept-Ranges", async () => {
  const r = await withRange(req(null), full());
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("accept-ranges"), "bytes");
  assert.equal((await bytes(r)).length, BODY.length);
  const html = await withRange(req(null), full("text/html"));
  assert.equal(html.status, 200);
});

test("bytes=a-b, bytes=a- and bytes=-n give 206 with the right slice and headers", async () => {
  let r = await withRange(req("bytes=0-1023"), full());
  assert.equal(r.status, 206);
  assert.equal(r.headers.get("content-range"), "bytes 0-1023/5000");
  assert.equal(r.headers.get("content-length"), "1024");
  assert.equal(r.headers.get("accept-ranges"), "bytes");
  assert.equal(r.headers.get("content-type"), "video/mp4");
  assert.deepEqual(await bytes(r), BODY.slice(0, 1024));
  r = await withRange(req("bytes=4000-"), full());
  assert.equal(r.status, 206);
  assert.equal(r.headers.get("content-range"), "bytes 4000-4999/5000");
  assert.deepEqual(await bytes(r), BODY.slice(4000));
  r = await withRange(req("bytes=-500"), full());
  assert.equal(r.headers.get("content-range"), "bytes 4500-4999/5000");
  assert.deepEqual(await bytes(r), BODY.slice(4500));
  r = await withRange(req("bytes=4990-99999"), full());
  assert.equal(r.headers.get("content-range"), "bytes 4990-4999/5000", "an end past the file is clamped");
  r = await withRange(req("bytes=0-1"), full());
  assert.equal(r.headers.get("content-range"), "bytes 0-1/5000", "Safari's first probe is bytes=0-1");
  assert.equal((await bytes(r)).length, 2);
});

test("an unsatisfiable range gives 416 with bytes */total", async () => {
  const r = await withRange(req("bytes=6000-"), full());
  assert.equal(r.status, 416);
  assert.equal(r.headers.get("content-range"), "bytes */5000");
});

test("anything it cannot or should not slice passes through untouched", async () => {
  for (const status of [404, 304]) {
    const r = await withRange(req("bytes=0-10"), full("video/mp4", status));
    assert.equal(r.status, status, `a ${status} must pass through`);
  }
  const multi = await withRange(req("bytes=0-1,5-6"), full());
  assert.equal(multi.status, 200, "multiple ranges: the whole file is a valid answer");
  const junk = await withRange(req("items=0-1"), full());
  assert.equal(junk.status, 200, "a unit other than bytes: the whole file");
  const head = await withRange(req("bytes=0-1023", "HEAD"), new Response(null, { status: 200, headers: { "content-type": "video/mp4", "content-length": "5000" } }));
  assert.ok(head.status === 200 || head.status === 206, "a HEAD request never throws");
});
