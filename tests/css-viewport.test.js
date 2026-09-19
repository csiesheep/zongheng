// Guard for the phone pages' height rules (orchestrator-owned, #23).
//
// Measured on the owner's iPhone (iOS Chrome, /zongheng/vp.html, 2026-09-19):
// innerHeight 669, 100svh 669, 100dvh 669, but 100vh 777 and 100lvh 777. So
// `svh` is the visible height and `vh` is 108 px taller. An emulated phone
// viewport has vh == svh and cannot see the difference, which is how two
// fixes were passed that still hid the Start button on the real phone: the
// page body had `height: 100svh` but kept the global `min-height: 100vh`,
// and min-height wins. These checks read the stylesheets instead.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const DIR = new URL("../public/", import.meta.url);
// Desktop-only sheets (everything inside min-width media) may use plain vh:
// a desktop browser has no sliding toolbars.
const DESKTOP_ONLY = new Set(["desktop.css", "landing-desktop.css"]);
const files = readdirSync(DIR).filter((f) => f.endsWith(".css"));

// Flat list of `selector { declarations }` blocks; good enough for these
// sheets (at-rule wrappers are skipped, their inner rules are still found).
function rulesOf(css) {
  const out = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    const selector = m[1].trim();
    if (selector.startsWith("@")) continue;
    const decls = m[2].split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
      const i = d.indexOf(":");
      return { prop: d.slice(0, i).trim().toLowerCase(), value: d.slice(i + 1).trim().toLowerCase() };
    });
    out.push({ selector, decls });
  }
  return out;
}
const onBody = (selector) => selector.split(",").some((s) => /^body(?![\w-])/.test(s.trim()) && !/\s/.test(s.trim().replace(/:has\([^)]*\)/g, "")));

test("a body rule that locks the page to 100svh also resets min-height", () => {
  const bad = [];
  for (const f of files) {
    for (const r of rulesOf(readFileSync(new URL(f, DIR), "utf8"))) {
      if (!onBody(r.selector)) continue;
      const locks = r.decls.some((d) => d.prop === "height" && /100svh/.test(d.value));
      const resets = r.decls.some((d) => d.prop === "min-height");
      if (locks && !resets) bad.push(`${f}: ${r.selector}`);
    }
  }
  assert.deepEqual(bad, [], "height: 100svh on body loses to the global min-height: 100vh (777 vs 669 on the owner's phone)");
});

test("phone stylesheets use 100vh only as the fallback line before the same property in svh", () => {
  const bad = [];
  for (const f of files) {
    if (DESKTOP_ONLY.has(f)) continue;
    for (const r of rulesOf(readFileSync(new URL(f, DIR), "utf8"))) {
      r.decls.forEach((d, i) => {
        if (!/(^|[^a-z])100vh/.test(d.value)) return;
        const followed = r.decls.slice(i + 1).some((n) => n.prop === d.prop && /svh/.test(n.value));
        if (!followed) bad.push(`${f}: ${r.selector} { ${d.prop}: ${d.value} }`);
      });
    }
  }
  assert.deepEqual(bad, [], "a lone 100vh is 108 px taller than the visible area on the owner's phone");
});
