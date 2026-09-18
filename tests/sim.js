// Bot-vs-bot harness (M2). Plays whole games through the engine with both
// seats as bots and reports, per rules cell, the Qin win rate, how games end
// (the six ways), the mean turn of instant wins and the mean Mandate at the
// end. Cells are the rulebook's open numbers: cap=2|3, seals=4|5, mie=3,
// comp=0|2|4, homelock=4|3, luoyi=1|0.5, turns=8|9. Each cell runs in a child
// process with retries: Node 24 on the development machine dies with an
// access violation a few percent of the time on long runs.
//
//   node tests/sim.js 400                 # every cell, 400 games each
//   node tests/sim.js 2000 cap=3 seals=5  # one cell
console.log("sim: the engine (M1) and the bots (M2) are not built yet.");
process.exit(1);
