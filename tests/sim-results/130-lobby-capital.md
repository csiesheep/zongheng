# #130 — 遊說 as a realignment roll, and losing (or moving) the home capital

**Status: PARTIAL — cells are still running. The tables below are regenerated as each cell finishes; the reading comes at the end.**

Engine options (none is a key of `DEFAULT_OPTIONS`; an absent option plays as today, byte for byte — `tests/defaults-130.test.js`):

| option | value | rule |
|---|---|---|
| `lobby` | absent | today: 局勢 > 0 removes min(ops, 局勢), no dice |
| | `realign` | any space with enemy influence; one attempt per op; each side 1d6 + (controlled neighbours) + (1 if more influence there) + (1 if in or next to its home region); the loser loses the difference there; tie nothing |
| | `realign-mild` | the same with 1d3, and a loser loses at most 2 per attempt |
| `homeFall` | absent / `none` | today |
| | `lose` | the enemy controlling your home capital (關中 / 郢) ends the game at once, reason `homeFall` |
| | `lose-turn` | ... if it still does at the end of a turn |
| | `lose-majority` | the enemy having more influence than you there at the end of a turn |
| | `move` | 遷都: first time held at a turn end → enemy +3, capital moves (關中 → 漢中, 郢 → 陳蔡); the new one held at a later turn end loses |

Cells: `nn` = normal vs normal, `hh` = hard vs hard, 500 games each, seeds 1…500 in every cell, Node 24 on the development machine.
`base` ran on b280c84 (engine and bots byte-identical to origin/main 01b1b9d, by `tests/defaults-130.test.js`); every other cell on 5948283 (the #130 engine and bots), each from a clean `git archive` of that SHA.

```
node tests/sim.js 500 --only=lc/nn/base,lc/hh/base --chunk=5 --jobs=10 --out=tests/sim-results/130-base.txt --resume
node tests/sim.js 500 --only=lc/nn/realign,lc/nn/realign-mild,lc/nn/lose,lc/nn/lose-turn,lc/nn/lose-majority,lc/nn/move,lc/nn/realign+lose-turn,lc/hh/realign,lc/hh/realign-mild,lc/hh/lose,lc/hh/lose-turn,lc/hh/lose-majority,lc/hh/move,lc/hh/realign+lose-turn --chunk=5 --jobs=20 --out=tests/sim-results/130-cells.txt --resume
node tests/sim.js --report-130=tests/sim-results/130-base.txt.state.json,tests/sim-results/130-cells.txt.state.json
```

<!-- below: the output of --report-130, unedited -->

| cell | n | errors / stuck | Qin win % [95%] | Qin win − base, pp [95%] | avg end turn [95%] | end turn − base |
|---|---|---|---|---|---|---|
| lc/nn/base | 500 | 0 / 0 | 51.0 [46.6, 55.4] |  | 5.54 ±0.18 |  |
| lc/nn/realign | 500 | 0 / 0 | 49.4 [45.0, 53.8] | -1.6 [-7.8, 4.6] | 5.42 ±0.18 | -0.12 [-0.38, +0.14] |
| lc/nn/realign-mild | 185 | 0 / 0 | 46.5 [39.4, 53.7] | -4.5 [-12.9, 3.9] | 5.48 ±0.29 | -0.06 [-0.40, +0.28] |
| lc/hh/base | 500 | 0 / 0 | 54.2 [49.8, 58.5] |  | 6.01 ±0.15 |  |

End reasons, % of games [Wilson 95%]; 國都 = the new end reason `homeFall`:

| cell | 天命 | 滅國(一統) | 相印(合縱) | 土崩 | 記分 | 記分2 | 終局(回合上限) | 平手 | 稱帝 | 國都(homeFall) |
|---|---|---|---|---|---|---|---|---|---|---|
| lc/nn/base | 34.2 [30.2, 38.5] | 1.6 [0.8, 3.1] | 16.6 [13.6, 20.1] | 1.4 [0.7, 2.9] | 14.4 [11.6, 17.7] | 0 | 9.2 [7.0, 12.1] | 0.6 [0.2, 1.7] | 22.0 [18.6, 25.8] | 0 |
| lc/nn/realign | 32.4 [28.4, 36.6] | 1.8 [0.9, 3.4] | 14.8 [12.0, 18.2] | 2.2 [1.2, 3.9] | 22.2 [18.8, 26.0] | 0 | 8.0 [5.9, 10.7] | 0.6 [0.2, 1.7] | 18.0 [14.9, 21.6] | 0 |
| lc/nn/realign-mild | 29.7 [23.6, 36.7] | 1.6 [0.6, 4.7] | 20.0 [14.9, 26.3] | 3.2 [1.5, 6.9] | 16.8 [12.1, 22.8] | 0 | 6.5 [3.7, 11.0] | 0.5 [0.1, 3.0] | 21.6 [16.3, 28.1] | 0 |
| lc/hh/base | 27.2 [23.5, 31.3] | 1.4 [0.7, 2.9] | 13.8 [11.1, 17.1] | 2.8 [1.7, 4.6] | 10.6 [8.2, 13.6] | 0 | 7.8 [5.8, 10.5] | 0.8 [0.3, 2.0] | 35.6 [31.5, 39.9] | 0 |

國都 wins by side (Qin took 郢 / Chu took 關中), and the turn they came on (turn:games):

| cell | Qin wins by 國都 | Chu wins by 國都 | turn |
|---|---|---|---|
| lc/nn/base | 0 | 0 | – |
| lc/nn/realign | 0 | 0 | – |
| lc/nn/realign-mild | 0 | 0 | – |
| lc/hh/base | 0 | 0 | – |

How the ops are spent, per game, both sides [95%]: share of the ops put to 扶植 (place) / 奇襲 (campaign) / 遊說 (lobby) / 變法 (reform); face values (九鼎 4). Uses per game, and the change in 奇襲 and 遊說 uses against base.

| cell | 扶植 % | 奇襲 % | 遊說 % | 變法 % | 奇襲 uses / game | 奇襲 − base | 遊說 uses / game | 遊說 − base |
|---|---|---|---|---|---|---|---|---|
| lc/nn/base | 66.5 | 20.2 | 8.0 | 5.3 | 9.01 ±0.35 |  | 8.82 ±0.47 |  |
| lc/nn/realign | 64.0 | 20.1 | 11.4 | 4.5 | 8.63 ±0.33 | -0.39 [-0.87, +0.10] | 10.49 ±0.53 | **+1.67 [+0.97, +2.38]** |
| lc/nn/realign-mild | 65.1 | 20.0 | 10.0 | 5.0 | 8.82 ±0.56 | -0.20 [-0.85, +0.46] | 9.56 ±0.79 | +0.74 [-0.18, +1.66] |
| lc/hh/base | 60.4 | 22.4 | 8.7 | 8.6 | 10.63 ±0.36 |  | 9.61 ±0.43 |  |

遊說 in detail, all games of the cell pooled. Under base there are no attempts: one 遊說 removes min(ops, 局勢) and never costs the actor. 'net / attempt' = (enemy points removed − own points lost) ÷ attempts; 'actor lost' = attempts in which the actor lost at least one point; 'nothing to lose' = 遊說 aimed where the actor had no influence of its own.

| cell | 遊說 actions | by Qin / Chu | ops / 遊說 | attempts / 遊說 | enemy removed / 遊說 | own lost / 遊說 | net / attempt | net / op | attempts: actor lost % | actor won % | no change % | at 要衝 % | nothing to lose % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| lc/nn/base | 4409 | 2714 / 1695 | 1.70 | 0.00 | 1.43 | 0.00 | – | +0.84 | – | – | – | 70.8 | 0.0 |
| lc/nn/realign | 5246 | 2523 / 2723 | 1.76 | 1.22 | 1.63 | 0.22 | +1.16 | +0.80 | 11.3 | 49.0 | 39.6 | 73.1 | 36.2 |
| lc/nn/realign-mild | 1768 | 842 / 926 | 1.77 | 1.28 | 1.82 | 0.06 | +1.37 | +0.99 | 4.8 | 73.5 | 21.7 | 70.8 | 16.5 |
| lc/hh/base | 4804 | 2825 / 1979 | 1.70 | 0.00 | 1.45 | 0.00 | – | +0.86 | – | – | – | 65.8 | 0.0 |

The home capitals. 'fell' = became enemy-controlled at some marker check (the moment `lose` reads); games % [95%]. Falls / game; falls retaken before the end of the same turn (the grace `lose-turn` gives); games in which the enemy held it at a turn end (what `lose-turn` / `move` read) and had more influence there at a turn end (what `lose-majority` reads); the turn of the first fall (turn:games); capital moved (`move`), games.

| cell | 關中 fell (Chu took it), games % | 郢 fell (Qin took it), games % | falls / game | retaken in the turn / falls | held at a turn end: 關中 / 郢, games | enemy majority at a turn end: 關中 / 郢, games | enemy majority at any check: 關中 / 郢, games | first fall turn, 關中 | first fall turn, 郢 | moved: Qin / Chu, games |
|---|---|---|---|---|---|---|---|---|---|---|
| lc/nn/base | 8.0 [5.9, 10.7] | 1.6 [0.8, 3.1] | 0.206 | 52 / 103 | 29 / 2 | 92 / 22 | 110 / 26 | 4:15 5:17 6:6 7:1 8:1 | 6:1 7:7 | 0 / 0 |
| lc/nn/realign | 7.0 [5.1, 9.6] | 1.8 [0.9, 3.4] | 0.182 | 50 / 91 | 27 / 2 | 77 / 16 | 87 / 25 | 4:18 5:11 6:2 7:1 8:3 | 5:1 7:8 | 0 / 0 |
| lc/nn/realign-mild | 9.2 [5.8, 14.2] | 0.0 [0.0, 2.0] | 0.151 | 16 / 28 | 10 / 0 | 33 / 1 | 40 / 2 | 4:5 5:7 6:3 7:1 8:1 | – | 0 / 0 |
| lc/hh/base | 8.0 [5.9, 10.7] | 1.4 [0.7, 2.9] | 0.188 | 40 / 94 | 30 / 3 | 98 / 13 | 110 / 17 | 4:12 5:17 6:8 8:3 | 5:1 7:4 8:2 | 0 / 0 |

Distributions per cell: end turn (turn:games); final Mandate min / p5 / p25 / median / p75 / p95 / max; 遊說 actions per game (count:games); the seeds with the most 遊說 and the seeds of the 國都 ends.

- **lc/nn/base**: end turn 1:18 2:25 3:61 4:54 5:72 6:69 7:81 8:120; mandate -25 / -21 / -13 / 0 / 13 / 22 / 29; 遊說/game 0:7 1:20 2:28 3:39 4:33 5:40 6:36 7:28 8:29 9:29 10:26 11:35 12:23 13:27 14:17 15:23 16:14 17:7 18:13 19:7 20:3 21:8 22:2 23:4 25:2; most 遊說 seed 198 (25, final), seed 183 (25, emperor), seed 27 (23, final); 國都 seeds none
- **lc/nn/realign**: end turn 1:22 2:32 3:57 4:53 5:72 6:77 7:78 8:109; mandate -26 / -22 / -15 / -2 / 11 / 22 / 27; 遊說/game 0:3 1:18 2:12 3:30 4:31 5:24 6:33 7:23 8:31 9:38 10:27 11:26 12:27 13:24 14:21 15:29 16:13 17:20 18:21 19:8 20:8 21:9 22:8 23:7 24:3 25:1 26:1 27:1 28:2 30:1; most 遊說 seed 297 (30, mandate), seed 170 (28, alliance), seed 346 (28, mandate); 國都 seeds none
- **lc/nn/realign-mild**: end turn 1:6 2:11 3:18 4:25 5:28 6:23 7:39 8:35; mandate -25 / -22 / -16 / -1 / 7 / 22 / 24; 遊說/game 0:2 1:4 2:13 3:14 4:11 5:9 6:8 7:8 8:14 9:10 10:10 11:11 12:11 13:17 14:9 15:8 16:4 17:7 18:7 19:2 21:3 22:1 23:1 26:1; most 遊說 seed 117 (26, final), seed 105 (23, final), seed 137 (22, emperor); 國都 seeds none
- **lc/hh/base**: end turn 1:10 2:8 3:36 4:41 5:80 6:84 7:125 8:116; mandate -28 / -21 / -11 / 2 / 12 / 22 / 29; 遊說/game 0:2 1:12 2:18 3:21 4:32 5:36 6:23 7:37 8:33 9:39 10:33 11:39 12:42 13:27 14:21 15:28 16:17 17:12 18:5 19:7 20:6 21:4 22:3 23:1 25:1 28:1; most 遊說 seed 379 (28, final), seed 298 (25, tie), seed 443 (23, mandate); 國都 seeds none
