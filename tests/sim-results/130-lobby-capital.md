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
`base` ran on b280c84 (engine and bots byte-identical to origin/main 01b1b9d, by `tests/defaults-130.test.js`).

```
node tests/sim.js 500 --only=lc/nn/base,lc/hh/base --chunk=5 --jobs=10 --out=tests/sim-results/130-base.txt --resume
node tests/sim.js --report-130=tests/sim-results/130-base.txt.state.json[,...]
```

<!-- below: the output of --report-130, unedited -->

| cell | n | errors / stuck | Qin win % [95%] | Qin win − base, pp [95%] | avg end turn [95%] | end turn − base |
|---|---|---|---|---|---|---|
| lc/nn/base | 500 | 0 / 0 | 51.0 [46.6, 55.4] |  | 5.54 ±0.18 |  |
| lc/hh/base | 500 | 0 / 0 | 54.2 [49.8, 58.5] |  | 6.01 ±0.15 |  |

End reasons, % of games [Wilson 95%]; 國都 = the new end reason `homeFall`:

| cell | 天命 | 滅國(一統) | 相印(合縱) | 土崩 | 記分 | 記分2 | 終局(回合上限) | 平手 | 稱帝 | 國都(homeFall) |
|---|---|---|---|---|---|---|---|---|---|---|
| lc/nn/base | 34.2 [30.2, 38.5] | 1.6 [0.8, 3.1] | 16.6 [13.6, 20.1] | 1.4 [0.7, 2.9] | 14.4 [11.6, 17.7] | 0 | 9.2 [7.0, 12.1] | 0.6 [0.2, 1.7] | 22.0 [18.6, 25.8] | 0 |
| lc/hh/base | 27.2 [23.5, 31.3] | 1.4 [0.7, 2.9] | 13.8 [11.1, 17.1] | 2.8 [1.7, 4.6] | 10.6 [8.2, 13.6] | 0 | 7.8 [5.8, 10.5] | 0.8 [0.3, 2.0] | 35.6 [31.5, 39.9] | 0 |

國都 wins by side (Qin took 郢 / Chu took 關中), and the turn they came on (turn:games):

| cell | Qin wins by 國都 | Chu wins by 國都 | turn |
|---|---|---|---|
| lc/nn/base | 0 | 0 | – |
| lc/hh/base | 0 | 0 | – |

How the ops are spent, per game, both sides [95%]: share of the ops put to 扶植 (place) / 奇襲 (campaign) / 遊說 (lobby) / 變法 (reform); face values (九鼎 4). Uses per game, and the change in 奇襲 and 遊說 uses against base.

| cell | 扶植 % | 奇襲 % | 遊說 % | 變法 % | 奇襲 uses / game | 奇襲 − base | 遊說 uses / game | 遊說 − base |
|---|---|---|---|---|---|---|---|---|
| lc/nn/base | 66.5 | 20.2 | 8.0 | 5.3 | 9.01 ±0.35 |  | 8.82 ±0.47 |  |
| lc/hh/base | 60.4 | 22.4 | 8.7 | 8.6 | 10.63 ±0.36 |  | 9.61 ±0.43 |  |

遊說 in detail, all games of the cell pooled. Under base there are no attempts: one 遊說 removes min(ops, 局勢) and never costs the actor. 'net / attempt' = (enemy points removed − own points lost) ÷ attempts; 'actor lost' = attempts in which the actor lost at least one point; 'nothing to lose' = 遊說 aimed where the actor had no influence of its own.

| cell | 遊說 actions | by Qin / Chu | ops / 遊說 | attempts / 遊說 | enemy removed / 遊說 | own lost / 遊說 | net / attempt | net / op | attempts: actor lost % | actor won % | no change % | at 要衝 % | nothing to lose % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| lc/nn/base | 4409 | 2714 / 1695 | 1.70 | 0.00 | 1.43 | 0.00 | – | +0.84 | – | – | – | 70.8 | 0.0 |
| lc/hh/base | 4804 | 2825 / 1979 | 1.70 | 0.00 | 1.45 | 0.00 | – | +0.86 | – | – | – | 65.8 | 0.0 |

The home capitals. 'fell' = became enemy-controlled at some marker check (the moment `lose` reads); games % [95%]. Falls / game; falls retaken before the end of the same turn (the grace `lose-turn` gives); games in which the enemy held it at a turn end (what `lose-turn` / `move` read) and had more influence there at a turn end (what `lose-majority` reads); the turn of the first fall (turn:games); capital moved (`move`), games.

| cell | 關中 fell (Chu took it), games % | 郢 fell (Qin took it), games % | falls / game | retaken in the turn / falls | held at a turn end: 關中 / 郢, games | enemy majority at a turn end: 關中 / 郢, games | enemy majority at any check: 關中 / 郢, games | first fall turn, 關中 | first fall turn, 郢 | moved: Qin / Chu, games |
|---|---|---|---|---|---|---|---|---|---|---|
| lc/nn/base | 8.0 [5.9, 10.7] | 1.6 [0.8, 3.1] | 0.206 | 52 / 103 | 29 / 2 | 92 / 22 | 110 / 26 | 4:15 5:17 6:6 7:1 8:1 | 6:1 7:7 | 0 / 0 |
| lc/hh/base | 8.0 [5.9, 10.7] | 1.4 [0.7, 2.9] | 0.188 | 40 / 94 | 30 / 3 | 98 / 13 | 110 / 17 | 4:12 5:17 6:8 8:3 | 5:1 7:4 8:2 | 0 / 0 |

Distributions per cell: end turn (turn:games); final Mandate min / p5 / p25 / median / p75 / p95 / max; 遊說 actions per game (count:games); the seeds with the most 遊說 and the seeds of the 國都 ends.

- **lc/nn/base**: end turn 1:18 2:25 3:61 4:54 5:72 6:69 7:81 8:120; mandate -25 / -21 / -13 / 0 / 13 / 22 / 29; 遊說/game 0:7 1:20 2:28 3:39 4:33 5:40 6:36 7:28 8:29 9:29 10:26 11:35 12:23 13:27 14:17 15:23 16:14 17:7 18:13 19:7 20:3 21:8 22:2 23:4 25:2; most 遊說 seed 198 (25, final), seed 183 (25, emperor), seed 27 (23, final); 國都 seeds none
- **lc/hh/base**: end turn 1:10 2:8 3:36 4:41 5:80 6:84 7:125 8:116; mandate -28 / -21 / -11 / 2 / 12 / 22 / 29; 遊說/game 0:2 1:12 2:18 3:21 4:32 5:36 6:23 7:37 8:33 9:39 10:33 11:39 12:42 13:27 14:21 15:28 16:17 17:12 18:5 19:7 20:6 21:4 22:3 23:1 25:1 28:1; most 遊說 seed 379 (28, final), seed 298 (25, tie), seed 443 (23, mandate); 國都 seeds none
