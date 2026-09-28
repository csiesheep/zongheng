// #51: the influence disc's "what does this show" decision, pulled out of
// renderMap() so it can be tested without a DOM. This module knows NOTHING
// about markup or colour — those live in app.js (classes/markup) and
// style.css (the actual tones, --qin-inf/--chu-inf and #0e0e0e/#a31c15). It
// only answers, from the two influence counts and who controls the space,
// which of the three shapes the owner's V2 滿盤 decision describes applies:
//   - "empty": nobody has influence -- the plain paper disc.
//   - "lone": only one side is present -- the WHOLE disc takes that side's
//     tone, one centred numeral.
//   - "split": both sides are present -- left half Qin's tone, right half
//     Chu's tone, blended in the middle, a numeral centred in each half.
// `controlled` on a lone/split part is exactly `ctl === that side`, which is
// what decides light tone (uncontrolled: grey/pink) vs dark tone (in
// control: black/red) -- see the owner's table in issue #51.
//
// #129: `atCap` adds a FOURTH, optional argument and a per-numeral flag --
// design D from the owner's cap_design_D.png (top row): a short bar over a
// side's own number once that side's influence there equals its cap
// (stability + 2, E.capOf). It is computed here (not passed in as a class) so
// the same rule that decides shape/tone also decides the bar, and the "only
// the full side's number gets it in a split disc" rule falls out for free --
// a side only gets `atCap: true` when ITS OWN count reached ITS OWN cap, so
// the other half of a split disc is untouched even if it happens to be the
// one under a different rule (e.g. controlled) at the same time.
//
// `capOf` is OPTIONAL and left out of the returned parts entirely when
// omitted (not even `atCap: false`) -- tests/disc-view.test.js (orchestrator,
// #51, predates this issue) calls discParts() with the old 3-arg signature
// and asserts deepEqual against objects with no `atCap` key at all; adding
// the key unconditionally would fail every one of those on a key it never
// asked about. Every real call from app.js's renderMap() passes `capOf`.
import { QIN, CHU } from "./shared/engine.js";

export function discParts(q, c, ctl, capOf) {
  const cap = (n) => (capOf == null ? {} : { atCap: n >= capOf });
  if (!q && !c) return { kind: "empty" };
  if (q && !c) return { kind: "lone", side: QIN, n: q, controlled: ctl === QIN, ...cap(q) };
  if (c && !q) return { kind: "lone", side: CHU, n: c, controlled: ctl === CHU, ...cap(c) };
  return {
    kind: "split",
    qin: { n: q, controlled: ctl === QIN, ...cap(q) },
    chu: { n: c, controlled: ctl === CHU, ...cap(c) },
  };
}

// #144: the disc's own markup from discParts()'s output -- moved here from
// app.js (its one private, unexported helper) so report.js can share it
// instead of keeping its own copy (report.js used to carry a byte-for-byte
// duplicate, flagged in its own top comment as "the one piece copied rather
// than imported"). Pure function of discParts()'s shape plus whether this
// node is a capital (`cap`, squared corners, style.css's `.sq`) -- no DOM,
// same rule as discParts() itself. Tone is CSS (.lone-q/.lone-c/.split/.ctl*,
// style.css); this only says which classes and how many numerals. `atCap`
// (#129) adds the `atcap` class to a numeral once that side's own influence
// there is at its own cap.
export function discHTML(parts, cap) {
  const base = "disc" + (cap ? " sq" : "");
  if (parts.kind === "empty") return `<span class="${base}"></span>`;
  if (parts.kind === "lone") {
    const side = parts.side === QIN ? "q" : "c";
    const cls = `${base} lone-${side}${parts.controlled ? " ctl" : ""}`;
    return `<span class="${cls}"><i${parts.atCap ? ` class="atcap"` : ""}>${parts.n}</i></span>`;
  }
  const cls = `${base} split${parts.qin.controlled ? " ctl-q" : ""}${parts.chu.controlled ? " ctl-c" : ""}`;
  return `<span class="${cls}"><i class="q${parts.qin.atCap ? " atcap" : ""}">${parts.qin.n}</i><i class="c${parts.chu.atCap ? " atcap" : ""}">${parts.chu.n}</i></span>`;
}
