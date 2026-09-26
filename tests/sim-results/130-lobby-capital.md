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
| lc/nn/realign-mild | 500 | 0 / 0 | 48.4 [44.0, 52.8] | -2.6 [-8.8, 3.6] | 5.64 ±0.17 | +0.10 [-0.15, +0.35] |
| lc/nn/lose | 500 | 0 / 0 | 51.2 [46.8, 55.6] | +0.2 [-6.0, 6.4] | 5.07 ±0.16 | **-0.46 [-0.71, -0.22]** |
| lc/nn/lose-turn | 500 | 0 / 0 | 49.6 [45.2, 54.0] | -1.4 [-7.6, 4.8] | 5.41 ±0.18 | -0.13 [-0.38, +0.12] |
| lc/nn/lose-majority | 500 | 0 / 0 | 59.6 [55.2, 63.8] | **+8.6 [2.5, 14.7]** | 4.23 ±0.16 | **-1.31 [-1.55, -1.07]** |
| lc/nn/move | 500 | 0 / 0 | 50.0 [45.6, 54.4] | -1.0 [-7.2, 5.2] | 5.48 ±0.18 | -0.05 [-0.31, +0.20] |
| lc/nn/realign+lose-turn | 500 | 0 / 0 | 47.0 [42.7, 51.4] | -4.0 [-10.2, 2.2] | 5.29 ±0.18 | -0.25 [-0.51, +0.01] |
| lc/hh/base | 500 | 0 / 0 | 54.2 [49.8, 58.5] |  | 6.01 ±0.15 |  |
| lc/hh/realign | 5 | 0 / 0 | 40.0 [11.8, 76.9] | -14.2 [-57.4, 29.0] | 4.40 ±0.48 | **-1.61 [-2.11, -1.11]** |

End reasons, % of games [Wilson 95%]; 國都 = the new end reason `homeFall`:

| cell | 天命 | 滅國(一統) | 相印(合縱) | 土崩 | 記分 | 記分2 | 終局(回合上限) | 平手 | 稱帝 | 國都(homeFall) |
|---|---|---|---|---|---|---|---|---|---|---|
| lc/nn/base | 34.2 [30.2, 38.5] | 1.6 [0.8, 3.1] | 16.6 [13.6, 20.1] | 1.4 [0.7, 2.9] | 14.4 [11.6, 17.7] | 0 | 9.2 [7.0, 12.1] | 0.6 [0.2, 1.7] | 22.0 [18.6, 25.8] | 0 |
| lc/nn/realign | 32.4 [28.4, 36.6] | 1.8 [0.9, 3.4] | 14.8 [12.0, 18.2] | 2.2 [1.2, 3.9] | 22.2 [18.8, 26.0] | 0 | 8.0 [5.9, 10.7] | 0.6 [0.2, 1.7] | 18.0 [14.9, 21.6] | 0 |
| lc/nn/realign-mild | 29.6 [25.8, 33.7] | 2.2 [1.2, 3.9] | 18.2 [15.1, 21.8] | 2.6 [1.5, 4.4] | 15.8 [12.9, 19.3] | 0.2 [0.0, 1.1] | 8.6 [6.4, 11.4] | 0.2 [0.0, 1.1] | 22.6 [19.2, 26.5] | 0 |
| lc/nn/lose | 28.0 [24.2, 32.1] | 0.6 [0.2, 1.7] | 12.4 [9.8, 15.6] | 0.8 [0.3, 2.0] | 12.2 [9.6, 15.4] | 0 | 3.6 [2.3, 5.6] | 0.4 [0.1, 1.4] | 9.4 [7.1, 12.3] | 32.6 [28.6, 36.8] |
| lc/nn/lose-turn | 34.2 [30.2, 38.5] | 1.2 [0.6, 2.6] | 17.2 [14.1, 20.8] | 1.8 [0.9, 3.4] | 15.4 [12.5, 18.8] | 0 | 7.6 [5.6, 10.3] | 0.4 [0.1, 1.4] | 16.6 [13.6, 20.1] | 5.6 [3.9, 8.0] |
| lc/nn/lose-majority | 18.8 [15.6, 22.5] | 0.4 [0.1, 1.4] | 4.0 [2.6, 6.1] | 0.2 [0.0, 1.1] | 26.8 [23.1, 30.8] | 0 | 1.8 [0.9, 3.4] | 0.4 [0.1, 1.4] | 4.8 [3.2, 7.0] | 42.8 [38.5, 47.2] |
| lc/nn/move | 34.6 [30.6, 38.9] | 2.2 [1.2, 3.9] | 16.8 [13.8, 20.3] | 2.2 [1.2, 3.9] | 15.6 [12.7, 19.0] | 0 | 8.0 [5.9, 10.7] | 0.4 [0.1, 1.4] | 19.4 [16.2, 23.1] | 0.8 [0.3, 2.0] |
| lc/nn/realign+lose-turn | 32.2 [28.3, 36.4] | 1.2 [0.6, 2.6] | 12.4 [9.8, 15.6] | 2.8 [1.7, 4.6] | 21.8 [18.4, 25.6] | 0.4 [0.1, 1.4] | 7.8 [5.8, 10.5] | 0 | 14.0 [11.2, 17.3] | 7.4 [5.4, 10.0] |
| lc/hh/base | 27.2 [23.5, 31.3] | 1.4 [0.7, 2.9] | 13.8 [11.1, 17.1] | 2.8 [1.7, 4.6] | 10.6 [8.2, 13.6] | 0 | 7.8 [5.8, 10.5] | 0.8 [0.3, 2.0] | 35.6 [31.5, 39.9] | 0 |
| lc/hh/realign | 20.0 [3.6, 62.4] | 0 | 40.0 [11.8, 76.9] | 0 | 20.0 [3.6, 62.4] | 0 | 0 | 0 | 20.0 [3.6, 62.4] | 0 |

國都 wins by side (Qin took 郢 / Chu took 關中), and the turn they came on (turn:games):

| cell | Qin wins by 國都 | Chu wins by 國都 | turn |
|---|---|---|---|
| lc/nn/base | 0 | 0 | – |
| lc/nn/realign | 0 | 0 | – |
| lc/nn/realign-mild | 0 | 0 | – |
| lc/nn/lose | 78 | 85 | 1:1 2:1 4:51 5:43 6:11 7:46 8:10 |
| lc/nn/lose-turn | 8 | 20 | 4:5 5:13 6:3 7:5 8:2 |
| lc/nn/lose-majority | 84 | 130 | 1:8 2:17 3:15 4:80 5:60 6:20 7:11 8:3 |
| lc/nn/move | 1 | 3 | 6:3 7:1 |
| lc/nn/realign+lose-turn | 8 | 29 | 2:1 3:1 4:8 5:16 6:7 7:1 8:3 |
| lc/hh/base | 0 | 0 | – |
| lc/hh/realign | 0 | 0 | – |

How the ops are spent, per game, both sides [95%]: share of the ops put to 扶植 (place) / 奇襲 (campaign) / 遊說 (lobby) / 變法 (reform); face values (九鼎 4). Uses per game, and the change in 奇襲 and 遊說 uses against base.

| cell | 扶植 % | 奇襲 % | 遊說 % | 變法 % | 奇襲 uses / game | 奇襲 − base | 遊說 uses / game | 遊說 − base |
|---|---|---|---|---|---|---|---|---|
| lc/nn/base | 66.5 | 20.2 | 8.0 | 5.3 | 9.01 ±0.35 |  | 8.82 ±0.47 |  |
| lc/nn/realign | 64.0 | 20.1 | 11.4 | 4.5 | 8.63 ±0.33 | -0.39 [-0.87, +0.10] | 10.49 ±0.53 | **+1.67 [+0.97, +2.38]** |
| lc/nn/realign-mild | 64.9 | 20.0 | 9.8 | 5.2 | 9.16 ±0.34 | +0.15 [-0.34, +0.64] | 9.84 ±0.48 | **+1.02 [+0.35, +1.70]** |
| lc/nn/lose | 67.8 | 20.6 | 7.3 | 4.3 | 7.90 ±0.29 | **-1.11 [-1.57, -0.66]** | 7.36 ±0.41 | **-1.46 [-2.09, -0.84]** |
| lc/nn/lose-turn | 67.4 | 19.8 | 7.8 | 4.9 | 8.51 ±0.31 | **-0.51 [-0.97, -0.04]** | 8.54 ±0.47 | -0.28 [-0.95, +0.39] |
| lc/nn/lose-majority | 66.6 | 18.5 | 12.4 | 2.5 | 6.07 ±0.22 | **-2.94 [-3.36, -2.53]** | 9.88 ±0.61 | **+1.06 [+0.28, +1.83]** |
| lc/nn/move | 66.9 | 20.1 | 7.9 | 5.1 | 8.80 ±0.34 | -0.21 [-0.70, +0.28] | 8.63 ±0.46 | -0.19 [-0.85, +0.47] |
| lc/nn/realign+lose-turn | 64.6 | 19.4 | 11.9 | 4.1 | 8.15 ±0.31 | **-0.86 [-1.33, -0.39]** | 10.54 ±0.53 | **+1.72 [+1.02, +2.43]** |
| lc/hh/base | 60.4 | 22.4 | 8.7 | 8.6 | 10.63 ±0.36 |  | 9.61 ±0.43 |  |
| lc/hh/realign | 51.5 | 25.5 | 12.7 | 10.3 | 8.20 ±2.18 | **-2.43 [-4.64, -0.22]** | 7.60 ±2.37 | -2.01 [-4.41, +0.40] |

遊說 in detail, all games of the cell pooled. Under base there are no attempts: one 遊說 removes min(ops, 局勢) and never costs the actor. 'net / attempt' = (enemy points removed − own points lost) ÷ attempts; 'actor lost' = attempts in which the actor lost at least one point; 'nothing to lose' = 遊說 aimed where the actor had no influence of its own.

| cell | 遊說 actions | by Qin / Chu | ops / 遊說 | attempts / 遊說 | enemy removed / 遊說 | own lost / 遊說 | net / attempt | net / op | attempts: actor lost % | actor won % | no change % | at 要衝 % | nothing to lose % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| lc/nn/base | 4409 | 2714 / 1695 | 1.70 | 0.00 | 1.43 | 0.00 | – | +0.84 | – | – | – | 70.8 | 0.0 |
| lc/nn/realign | 5246 | 2523 / 2723 | 1.76 | 1.22 | 1.63 | 0.22 | +1.16 | +0.80 | 11.3 | 49.0 | 39.6 | 73.1 | 36.2 |
| lc/nn/realign-mild | 4920 | 2257 / 2663 | 1.76 | 1.25 | 1.80 | 0.06 | +1.40 | +0.99 | 4.4 | 73.9 | 21.7 | 70.4 | 16.7 |
| lc/nn/lose | 3678 | 2242 / 1436 | 1.68 | 0.00 | 1.44 | 0.00 | – | +0.86 | – | – | – | 71.7 | 0.0 |
| lc/nn/lose-turn | 4271 | 2558 / 1713 | 1.69 | 0.00 | 1.43 | 0.00 | – | +0.85 | – | – | – | 72.5 | 0.0 |
| lc/nn/lose-majority | 4938 | 2114 / 2824 | 1.77 | 0.00 | 1.31 | 0.00 | – | +0.74 | – | – | – | 87.6 | 0.0 |
| lc/nn/move | 4314 | 2658 / 1656 | 1.70 | 0.00 | 1.43 | 0.00 | – | +0.84 | – | – | – | 69.8 | 0.0 |
| lc/nn/realign+lose-turn | 5271 | 2576 / 2695 | 1.79 | 1.26 | 1.73 | 0.23 | +1.19 | +0.84 | 11.4 | 50.4 | 38.2 | 75.4 | 36.7 |
| lc/hh/base | 4804 | 2825 / 1979 | 1.70 | 0.00 | 1.45 | 0.00 | – | +0.86 | – | – | – | 65.8 | 0.0 |
| lc/hh/realign | 38 | 14 / 24 | 1.84 | 1.29 | 1.37 | 0.26 | +0.86 | +0.60 | 12.2 | 44.9 | 42.9 | 65.8 | 47.4 |

The home capitals. 'fell' = became enemy-controlled at some marker check (the moment `lose` reads); games % [95%]. Falls / game; falls retaken before the end of the same turn (the grace `lose-turn` gives); games in which the enemy held it at a turn end (what `lose-turn` / `move` read) and had more influence there at a turn end (what `lose-majority` reads); the turn of the first fall (turn:games); capital moved (`move`), games.

| cell | 關中 fell (Chu took it), games % | 郢 fell (Qin took it), games % | falls / game | retaken in the turn / falls | held at a turn end: 關中 / 郢, games | enemy majority at a turn end: 關中 / 郢, games | enemy majority at any check: 關中 / 郢, games | first fall turn, 關中 | first fall turn, 郢 | moved: Qin / Chu, games |
|---|---|---|---|---|---|---|---|---|---|---|
| lc/nn/base | 8.0 [5.9, 10.7] | 1.6 [0.8, 3.1] | 0.206 | 52 / 103 | 29 / 2 | 92 / 22 | 110 / 26 | 4:15 5:17 6:6 7:1 8:1 | 6:1 7:7 | 0 / 0 |
| lc/nn/realign | 7.0 [5.1, 9.6] | 1.8 [0.9, 3.4] | 0.182 | 50 / 91 | 27 / 2 | 77 / 16 | 87 / 25 | 4:18 5:11 6:2 7:1 8:3 | 5:1 7:8 | 0 / 0 |
| lc/nn/realign-mild | 8.4 [6.3, 11.2] | 0.4 [0.1, 1.4] | 0.172 | 49 / 86 | 29 / 1 | 86 / 5 | 102 / 7 | 4:15 5:19 6:6 7:1 8:1 | 7:2 | 0 / 0 |
| lc/nn/lose | 17.0 [14.0, 20.5] | 15.6 [12.7, 19.0] | 0.326 | 0 / 163 | 0 / 0 | 35 / 13 | 169 / 104 | 4:40 5:35 6:4 7:5 8:1 | 1:1 2:1 4:11 5:8 6:7 7:41 8:9 | 0 / 0 |
| lc/nn/lose-turn | 16.6 [13.6, 20.1] | 7.6 [5.6, 10.3] | 0.406 | 163 / 203 | 21 / 13 | 82 / 42 | 174 / 85 | 4:36 5:37 6:4 7:5 8:1 | 1:1 2:1 4:9 5:3 6:12 7:10 8:2 | 0 / 0 |
| lc/nn/lose-majority | 14.6 [11.8, 18.0] | 4.2 [2.8, 6.3] | 0.224 | 37 / 112 | 55 / 9 | 141 / 133 | 226 / 361 | 4:25 5:39 6:4 7:4 8:1 | 2:2 4:5 5:1 6:1 7:5 8:7 | 0 / 0 |
| lc/nn/move | 13.0 [10.3, 16.2] | 4.0 [2.6, 6.1] | 0.446 | 155 / 223 | 42 / 6 | 88 / 22 | 99 / 35 | 4:18 5:27 6:16 7:2 8:2 | 5:4 6:4 7:8 8:4 | 40 / 6 |
| lc/nn/realign+lose-turn | 20.8 [17.5, 24.6] | 12.4 [9.8, 15.6] | 0.914 | 402 / 457 | 31 / 11 | 77 / 47 | 168 / 91 | 2:1 3:1 4:35 5:49 6:14 7:3 8:1 | 2:1 3:1 4:10 5:8 6:13 7:22 8:7 | 0 / 0 |
| lc/hh/base | 8.0 [5.9, 10.7] | 1.4 [0.7, 2.9] | 0.188 | 40 / 94 | 30 / 3 | 98 / 13 | 110 / 17 | 4:12 5:17 6:8 8:3 | 5:1 7:4 8:2 | 0 / 0 |
| lc/hh/realign | 0.0 [-0.0, 43.4] | 0.0 [-0.0, 43.4] | 0.000 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | – | – | 0 / 0 |

Distributions per cell: end turn (turn:games); final Mandate min / p5 / p25 / median / p75 / p95 / max; 遊說 actions per game (count:games); the seeds with the most 遊說 and the seeds of the 國都 ends.

- **lc/nn/base**: end turn 1:18 2:25 3:61 4:54 5:72 6:69 7:81 8:120; mandate -25 / -21 / -13 / 0 / 13 / 22 / 29; 遊說/game 0:7 1:20 2:28 3:39 4:33 5:40 6:36 7:28 8:29 9:29 10:26 11:35 12:23 13:27 14:17 15:23 16:14 17:7 18:13 19:7 20:3 21:8 22:2 23:4 25:2; most 遊說 seed 198 (25, final), seed 183 (25, emperor), seed 27 (23, final); 國都 seeds none
- **lc/nn/realign**: end turn 1:22 2:32 3:57 4:53 5:72 6:77 7:78 8:109; mandate -26 / -22 / -15 / -2 / 11 / 22 / 27; 遊說/game 0:3 1:18 2:12 3:30 4:31 5:24 6:33 7:23 8:31 9:38 10:27 11:26 12:27 13:24 14:21 15:29 16:13 17:20 18:21 19:8 20:8 21:9 22:8 23:7 24:3 25:1 26:1 27:1 28:2 30:1; most 遊說 seed 297 (30, mandate), seed 170 (28, alliance), seed 346 (28, mandate); 國都 seeds none
- **lc/nn/realign-mild**: end turn 1:11 2:33 3:42 4:57 5:80 6:67 7:95 8:115; mandate -26 / -22 / -15 / -1 / 9 / 21 / 27; 遊說/game 0:4 1:15 2:24 3:29 4:33 5:30 6:25 7:25 8:25 9:33 10:27 11:31 12:34 13:38 14:26 15:23 16:18 17:14 18:18 19:7 20:5 21:7 22:1 23:4 24:2 26:2; most 遊說 seed 117 (26, final), seed 423 (26, final), seed 253 (24, mandate); 國都 seeds none
- **lc/nn/lose**: end turn 1:19 2:25 3:61 4:91 5:96 6:68 7:87 8:53; mandate -27 / -21 / -11 / 0 / 11 / 22 / 29; 遊說/game 0:8 1:21 2:35 3:49 4:39 5:60 6:47 7:38 8:31 9:23 10:29 11:23 12:19 13:16 14:18 15:15 16:8 17:5 18:7 19:4 20:2 23:2 24:1; most 遊說 seed 391 (24, final), seed 260 (23, final), seed 441 (23, final); 國都 seeds 1 5 7 8 9 23 14 46 47 31 32 37 …
- **lc/nn/lose-turn**: end turn 1:18 2:25 3:61 4:55 5:89 6:71 7:86 8:95; mandate -27 / -22 / -13 / -1 / 11 / 22 / 29; 遊說/game 0:7 1:20 2:29 3:41 4:35 5:37 6:49 7:33 8:29 9:28 10:30 11:24 12:22 13:17 14:21 15:17 16:17 17:11 18:8 19:6 20:4 21:4 22:3 23:3 24:4 26:1; most 遊說 seed 204 (26, homeFall), seed 44 (24, final), seed 260 (24, final); 國都 seeds 31 62 95 88 162 156 198 166 204 223 193 257 …
- **lc/nn/lose-majority**: end turn 1:49 2:39 3:78 4:131 5:89 6:48 7:33 8:33; mandate -25 / -19 / -6 / 2 / 12 / 22 / 30; 遊說/game 0:7 1:23 2:36 3:33 4:31 5:26 6:33 7:29 8:26 9:41 10:25 11:23 12:20 13:15 14:18 15:19 16:10 17:9 18:16 19:5 20:9 21:6 22:4 23:9 24:4 25:2 26:4 27:8 28:2 29:1 30:2 31:1 32:2 34:1; most 遊說 seed 86 (34, scoring), seed 343 (32, mandate), seed 482 (32, emperor); 國都 seeds 12 13 14 15 83 84 44 45 46 47 50 7 …
- **lc/nn/move**: end turn 1:18 2:25 3:61 4:54 5:75 6:81 7:74 8:112; mandate -26 / -22 / -14 / 0 / 13 / 22 / 29; 遊說/game 0:7 1:20 2:28 3:37 4:33 5:38 6:40 7:33 8:34 9:31 10:30 11:25 12:26 13:21 14:16 15:24 16:15 17:10 18:10 19:9 20:5 21:4 23:3 25:1; most 遊說 seed 183 (25, emperor), seed 196 (23, mandate), seed 334 (23, alliance); 國都 seeds 8 110 153 425
- **lc/nn/realign+lose-turn**: end turn 1:22 2:33 3:58 4:61 5:81 6:81 7:66 8:98; mandate -26 / -22 / -14 / -2 / 10 / 22 / 27; 遊說/game 0:3 1:18 2:13 3:32 4:24 5:33 6:30 7:33 8:25 9:26 10:27 11:21 12:27 13:28 14:24 15:25 16:14 17:21 18:19 19:17 20:8 21:10 22:9 23:6 24:3 25:3 26:1; most 遊說 seed 22 (26, alliance), seed 99 (25, final), seed 449 (25, mandate); 國都 seeds 45 54 55 9 70 59 30 110 119 166 168 132 …
- **lc/hh/base**: end turn 1:10 2:8 3:36 4:41 5:80 6:84 7:125 8:116; mandate -28 / -21 / -11 / 2 / 12 / 22 / 29; 遊說/game 0:2 1:12 2:18 3:21 4:32 5:36 6:23 7:37 8:33 9:39 10:33 11:39 12:42 13:27 14:21 15:28 16:17 17:12 18:5 19:7 20:6 21:4 22:3 23:1 25:1 28:1; most 遊說 seed 379 (28, final), seed 298 (25, tie), seed 443 (23, mandate); 國都 seeds none
- **lc/hh/realign**: end turn 4:3 5:2; mandate -18 / -18 / -11 / -9 / 14 / 20 / 20; 遊說/game 5:1 6:1 7:1 8:1 12:1; most 遊說 seed 53 (12, scoring), seed 55 (8, alliance), seed 54 (7, emperor); 國都 seeds none
