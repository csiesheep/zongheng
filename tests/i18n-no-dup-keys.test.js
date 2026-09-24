// Guard for #114 (orchestrator-owned): no key is defined twice in the same
// object of an i18n file.
//
// Both files defined `setup` twice at the top level. JavaScript keeps the last
// one and drops the first without a word, so the shadowed block sat there
// looking like live text while nothing read it; only esbuild's "Duplicate key"
// line on every build said anything. A test that imports the module cannot see
// this — by the time it is an object, the duplicate is already gone. So this
// reads the source text.
//
// Per object, not per depth: `nav` and `buttons` may both have a `back`, and
// that is fine. Only the same key twice inside the same braces is the bug.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const DIR = new URL("../public/i18n/", import.meta.url);
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".js"));

// Walks the source, keeping one key map per open object literal. Strings,
// comments and escapes are skipped. Good enough for these files, which are
// hand-written object literals; it reports what it found so a surprise is
// readable rather than a bare failure.
function duplicateKeys(src) {
  const stack = [];
  const dups = [];
  let i = 0, line = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      const e = src.indexOf("*/", i + 2);
      const skipped = src.slice(i, e < 0 ? src.length : e + 2);
      line += (skipped.match(/\n/g) || []).length;
      i = e < 0 ? src.length : e + 2; continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; else if (src[i] === "\n") line++; i++; }
      i++; continue;
    }
    if (c === "{") { stack.push(new Map()); i++; continue; }
    if (c === "}") { stack.pop(); i++; continue; }
    const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(src.slice(i));
    if (m && stack.length) {
      // Only a property position counts: the previous non-space character must
      // open the object or end the previous property. Otherwise this is a
      // label, or the middle of a ternary.
      let j = i - 1;
      while (j >= 0 && /\s/.test(src[j])) j--;
      if (src[j] === "{" || src[j] === ",") {
        const here = stack[stack.length - 1];
        if (here.has(m[1])) dups.push(`${m[1]} (line ${here.get(m[1])} and line ${line})`);
        else here.set(m[1], line);
        i += m[0].length; continue;
      }
    }
    i++;
  }
  return dups;
}

for (const file of FILES) {
  test(`i18n: ${file} defines every key once inside each object`, () => {
    const dups = duplicateKeys(readFileSync(new URL(file, DIR), "utf8"));
    assert.deepEqual(dups, [], `duplicate keys in ${file}: ${dups.join("; ")}`);
  });
}

test("i18n: the reader itself catches a duplicate, and allows the same key in two objects", () => {
  // Without this, a broken reader would pass every file silently — which is how
  // the real duplicate survived in the first place.
  assert.deepEqual(duplicateKeys('export default { a: { x: 1 }, b: 2, a: { y: 3 } };').length, 1);
  assert.deepEqual(duplicateKeys('export default { nav: { back: "x" }, buttons: { back: "y" } };'), []);
  // A colon inside a string is not a key.
  assert.deepEqual(duplicateKeys('export default { a: "x: 1, a: 2", b: 3 };'), []);
});
