// Diagnostics over random games: where the Mandate comes from. Not a test.
//   node tests/diag.js 200
import * as E from "../public/shared/engine.js";
import { playRandomGame } from "./driver.js";

const N = Number(process.argv[2] || 200);
const byRegion = {}, ends = {}, byType = {};
let qinWins = 0, mieTotal = 0, sealTotal = 0, turns = 0, finalMandate = 0;
for (let seed = 1; seed <= N; seed++) {
  const { st } = playRandomGame(seed);
  if (st.winner === E.QIN) qinWins++;
  ends[st.reason] = (ends[st.reason] || 0) + 1;
  turns += st.turn; finalMandate += st.mandate;
  mieTotal += Object.keys(st.mieVp).length; sealTotal += Object.keys(st.sealVp).length;
  for (const l of st.log) {
    if (l.type === "score") {
      const r = byRegion[l.region] || (byRegion[l.region] = { n: 0, qin: 0, chu: 0 });
      r.n++; r.qin += l.qin.total; r.chu += l.chu.total;
    }
    if (l.type === "vp") {
      const k = byType[l.side === E.QIN ? "toQin" : "toChu"] || 0;
      byType[l.side === E.QIN ? "toQin" : "toChu"] = k + l.n;
    }
  }
}
console.log(`${N} random games: Qin wins ${qinWins} (${(100 * qinWins / N).toFixed(0)}%), mean turn ${(turns / N).toFixed(1)}, mean final mandate ${(finalMandate / N).toFixed(1)}`);
console.log("ends", ends);
console.log(`滅 paid ${(mieTotal / N).toFixed(2)} per game, 相印 paid ${(sealTotal / N).toFixed(2)} per game`);
console.log("vp by side (all sources)", byType);
for (const [r, v] of Object.entries(byRegion)) {
  console.log(`${r.padEnd(6)} scored ${(v.n / N).toFixed(2)}x per game, mean Qin ${(v.qin / v.n).toFixed(1)}, mean Chu ${(v.chu / v.n).toFixed(1)}, net ${((v.qin - v.chu) / v.n).toFixed(1)}`);
}
