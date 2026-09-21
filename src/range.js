// Byte-range support in front of the static-asset handler (#70).
//
// The asset handler answers `Range: bytes=...` with 200 and the whole file
// (measured on production, 2026-09-21). iPhones will not play a <video> (or
// stream an <audio>) unless the server answers with 206 Partial Content, so we
// turn a full 200 into the right partial response here.
//
// Pure: Request + Response in, Response out. Runs in the Worker and in Node.
// Never throws; anything it cannot or should not slice passes through.
//
//   no Range / not a 200 / HEAD      -> unchanged (a media 200 gains Accept-Ranges)
//   one bytes range, satisfiable     -> 206 with the slice and Content-Range
//   one bytes range, start >= total  -> 416 with Content-Range: bytes */total
//   several ranges / other unit /    -> the full 200 (a legal answer)
//   malformed / If-Range mismatch
//
// The body is read whole (arrayBuffer); the largest asset is ~3.9 MB.

const MEDIA = /^(video|audio)\//i;
const KEEP = ["content-type", "etag", "cache-control", "last-modified", "expires", "vary"];

function isMedia(response) {
  return MEDIA.test(response.headers.get("content-type") || "");
}

function withHeaders(response, set) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(set)) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function passthrough(response) {
  if (response.status === 200 && isMedia(response)) return withHeaders(response, { "accept-ranges": "bytes" });
  return response;
}

// RFC 9110 13.1.5: If-Range holds an entity tag (strong comparison only) or a
// date (must equal Last-Modified exactly). Anything else is a mismatch.
function ifRangeMatches(request, response) {
  const cond = request.headers.get("if-range");
  if (cond === null) return true;
  const c = cond.trim();
  if (c.startsWith('"') || c.startsWith("W/")) {
    const etag = (response.headers.get("etag") || "").trim();
    return !c.startsWith("W/") && !etag.startsWith("W/") && etag !== "" && c === etag;
  }
  const lm = response.headers.get("last-modified");
  return lm !== null && lm.trim() === c;
}

// Returns {start, end} (inclusive), "unsatisfiable", or null (ignore the header).
function parseRange(header, total) {
  const m = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(header);
  if (!m) return null; // other unit, several ranges, junk
  const [, a, b] = m;
  if (a === "" && b === "") return null;
  if (a === "") {
    const n = Number(b);
    if (!Number.isSafeInteger(n)) return null;
    if (n === 0 || total === 0) return "unsatisfiable";
    return { start: Math.max(0, total - n), end: total - 1 };
  }
  const start = Number(a);
  if (!Number.isSafeInteger(start)) return null;
  let end = b === "" ? Infinity : Number(b);
  if (Number.isNaN(end)) return null;
  if (end < start) return null; // invalid range-spec (e.g. 5-3): ignore the header
  if (start >= total) return "unsatisfiable";
  return { start, end: Math.min(end, total - 1) };
}

export async function withRange(request, response) {
  try {
    const range = request && request.headers ? request.headers.get("range") : null;
    if (!response || response.status !== 200 || range === null) return passthrough(response);
    if (request.method !== "GET") return passthrough(response);
    // A content-coded body would be sliced after decoding: wrong offsets. Leave it.
    const enc = (response.headers.get("content-encoding") || "identity").trim().toLowerCase();
    if (enc !== "identity") return response;
    if (!ifRangeMatches(request, response)) return passthrough(response);

    const buf = await response.arrayBuffer();
    const total = buf.byteLength;
    const whole = () => {
      const r = new Response(buf, { status: 200, statusText: response.statusText, headers: response.headers });
      return passthrough(r);
    };
    const spec = parseRange(range, total);
    if (spec === null) return whole();

    const headers = new Headers();
    for (const k of KEEP) {
      const v = response.headers.get(k);
      if (v !== null) headers.set(k, v);
    }
    headers.set("accept-ranges", "bytes");
    if (spec === "unsatisfiable") {
      headers.delete("content-type");
      headers.set("content-range", `bytes */${total}`);
      headers.set("content-length", "0");
      return new Response(null, { status: 416, statusText: "Range Not Satisfiable", headers });
    }
    const slice = buf.slice(spec.start, spec.end + 1);
    headers.set("content-range", `bytes ${spec.start}-${spec.end}/${total}`);
    headers.set("content-length", String(slice.byteLength));
    return new Response(slice, { status: 206, statusText: "Partial Content", headers });
  } catch {
    return response;
  }
}
