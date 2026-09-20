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
import { QIN, CHU } from "./shared/engine.js";

export function discParts(q, c, ctl) {
  if (!q && !c) return { kind: "empty" };
  if (q && !c) return { kind: "lone", side: QIN, n: q, controlled: ctl === QIN };
  if (c && !q) return { kind: "lone", side: CHU, n: c, controlled: ctl === CHU };
  return {
    kind: "split",
    qin: { n: q, controlled: ctl === QIN },
    chu: { n: c, controlled: ctl === CHU },
  };
}
