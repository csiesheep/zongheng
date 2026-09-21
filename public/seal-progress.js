// Seal progress per state (#89, DOM-free). Owner, 2026-09-21: 相印 needs Chu's
// control of the capital AND a full stack there (stability + options.cap) when
// options.sealAt is "cap". This computes { capital, chuControls, have, need,
// sealed } for each of the five states so the map can show the gap.
import * as E from "./shared/engine.js";
import { STATES } from "./shared/board.js";

export function sealProgress(st) {
  if (!st || !st.inf) return {};
  const out = {};
  for (const [id, s] of Object.entries(STATES)) {
    const capital = s.capital;
    const chuControls = E.controller(st, capital) === E.CHU;
    const have = E.infOf(st, capital)[E.CHU] || 0;
    const need = E.capOf(st, capital);
    const sealed = !!(st.seals && st.seals[id]);
    out[id] = { capital, chuControls, have, need, sealed };
  }
  return out;
}
