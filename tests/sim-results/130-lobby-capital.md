# #130 — 遊說 as a realignment roll, and losing (or moving) the home capital

**Status: PARTIAL — cells are still running. The tables below are regenerated as each cell finishes; the reading comes at the end.**

Engine options (none is a key of `DEFAULT_OPTIONS`; an absent option plays as today, byte for byte — `tests/defaults-130.test.js`):

| option | value | rule |
|---|---|---|
| `lobby` | absent | today: 局勢 > 0 removes min(ops, 局勢), no dice |
| | `realign` | any space with enemy influence; one attempt per op; each side 1d6 + (controlled neighbours) + (1 if more influence there) + (1 if in or next to its home region); the loser loses the difference there; tie nothing |
| | `realign-mild` | the same with 1d3, and a loser loses at most 2 per attempt |
| | `realign-own` | realign, only where the actor also has ≥ 1 influence of its own; the sequence ends when either side's influence there reaches 0; and 收手: after each attempt with attempts left the actor chooses continue / stop (bots: continue iff the next attempt's expected net is > 0) |
| `homeFall` | absent / `none` | today |
| | `lose` | the enemy controlling your home capital (關中 / 郢) ends the game at once, reason `homeFall` |
| | `lose-turn` | ... if it still does at the end of a turn |
| | `lose-majority` | the enemy having more influence than you there at the end of a turn |
| | `move` | 遷都: first time held at a turn end → enemy +3, capital moves (關中 → 漢中, 郢 → 陳蔡); the new one held at a later turn end loses |

Cells: `nn` = normal vs normal, `hh` = hard vs hard, 500 games each, seeds 1…500 in every cell, Node 24 on the development machine.
`base` ran on b280c84 (engine and bots byte-identical to origin/main 01b1b9d, by `tests/defaults-130.test.js`); the realign / realign-mild / homeFall cells on 5948283; the realign-own cells on 025e9c2 (5948283 + realign-own + 收手; for the options of the other cells the two builds play the same). Each from a clean `git archive` of that SHA.

```
node tests/sim.js 500 --only=lc/nn/base,lc/hh/base --chunk=5 --jobs=10 --out=tests/sim-results/130-base.txt --resume
node tests/sim.js 500 --only=lc/nn/realign,lc/nn/realign-mild,lc/nn/lose,lc/nn/lose-turn,lc/nn/lose-majority,lc/nn/move,lc/nn/realign+lose-turn,lc/hh/realign,lc/hh/realign-mild,lc/hh/lose,lc/hh/lose-turn,lc/hh/lose-majority,lc/hh/move,lc/hh/realign+lose-turn --chunk=5 --jobs=20 --out=tests/sim-results/130-cells.txt --resume
node tests/sim.js 500 --only=lc/nn/realign-own,lc/nn/realign-own+lose-turn,lc/hh/realign-own,lc/hh/realign-own+lose-turn --chunk=5 --jobs=10 --out=tests/sim-results/130-own.txt --resume
node tests/sim.js --report-130=tests/sim-results/130-base.txt.state.json,tests/sim-results/130-cells.txt.state.json,tests/sim-results/130-own.txt.state.json
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
| lc/nn/realign-own | 330 | 0 / 0 | 50.0 [44.6, 55.4] | -1.0 [-8.0, 6.0] | 5.53 ±0.21 | -0.00 [-0.28, +0.27] |
| lc/hh/base | 500 | 0 / 0 | 54.2 [49.8, 58.5] |  | 6.01 ±0.15 |  |
| lc/hh/realign | 400 | 0 / 0 | 48.0 [43.1, 52.9] | -6.2 [-12.8, 0.4] | 5.90 ±0.18 | -0.11 [-0.34, +0.12] |

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
| lc/nn/realign-own | 31.8 [27.0, 37.0] | 3.0 [1.7, 5.5] | 22.1 [18.0, 26.9] | 2.4 [1.2, 4.7] | 11.2 [8.2, 15.1] | 0.3 [0.1, 1.7] | 5.5 [3.5, 8.5] | 0 | 23.6 [19.4, 28.5] | 0 |
| lc/hh/base | 27.2 [23.5, 31.3] | 1.4 [0.7, 2.9] | 13.8 [11.1, 17.1] | 2.8 [1.7, 4.6] | 10.6 [8.2, 13.6] | 0 | 7.8 [5.8, 10.5] | 0.8 [0.3, 2.0] | 35.6 [31.5, 39.9] | 0 |
| lc/hh/realign | 27.5 [23.4, 32.1] | 1.0 [0.4, 2.5] | 12.8 [9.8, 16.4] | 2.3 [1.2, 4.2] | 16.3 [13.0, 20.2] | 0.8 [0.3, 2.2] | 7.8 [5.5, 10.8] | 0.5 [0.1, 1.8] | 31.3 [26.9, 36.0] | 0 |

End reasons by winner: games won by Qin / by Chu for each reason.

| cell | 天命 | 滅國(一統) | 相印(合縱) | 土崩 | 記分 | 記分2 | 終局(回合上限) | 平手 | 稱帝 | 國都(homeFall) |
|---|---|---|---|---|---|---|---|---|---|---|
| lc/nn/base | 90 / 81 | 8 / 0 | 0 / 83 | 5 / 2 | 59 / 13 | – | 14 / 32 | 0 / 3 | 79 / 31 | – |
| lc/nn/realign | 70 / 92 | 9 / 0 | 0 / 74 | 9 / 2 | 87 / 24 | – | 12 / 28 | 0 / 3 | 60 / 30 | – |
| lc/nn/realign-mild | 60 / 88 | 11 / 0 | 0 / 91 | 8 / 5 | 62 / 17 | 0 / 1 | 17 / 26 | 0 / 1 | 84 / 29 | – |
| lc/nn/lose | 75 / 65 | 3 / 0 | 0 / 62 | 2 / 2 | 54 / 7 | – | 6 / 12 | 0 / 2 | 38 / 9 | 78 / 85 |
| lc/nn/lose-turn | 84 / 87 | 6 / 0 | 0 / 86 | 5 / 4 | 69 / 8 | – | 16 / 22 | 0 / 2 | 60 / 23 | 8 / 20 |
| lc/nn/lose-majority | 70 / 24 | 2 / 0 | 0 / 20 | 1 / 0 | 123 / 11 | – | 2 / 7 | 0 / 2 | 16 / 8 | 84 / 130 |
| lc/nn/move | 88 / 85 | 11 / 0 | 0 / 84 | 5 / 6 | 62 / 16 | – | 12 / 28 | 0 / 2 | 71 / 26 | 1 / 3 |
| lc/nn/realign+lose-turn | 75 / 86 | 6 / 0 | 0 / 62 | 7 / 7 | 84 / 25 | 0 / 2 | 8 / 31 | – | 47 / 23 | 8 / 29 |
| lc/nn/realign-own | 55 / 50 | 10 / 0 | 0 / 73 | 6 / 2 | 32 / 5 | 0 / 1 | 8 / 10 | – | 54 / 24 | – |
| lc/hh/base | 72 / 64 | 7 / 0 | 0 / 69 | 9 / 5 | 42 / 11 | – | 17 / 22 | 0 / 4 | 124 / 54 | – |
| lc/hh/realign | 51 / 59 | 4 / 0 | 0 / 51 | 6 / 3 | 49 / 16 | 0 / 3 | 8 / 23 | 0 / 2 | 74 / 51 | – |

國都 wins by side (Qin took 郢 / Chu took 關中), and the turn they came on (turn:games), per side:

| cell | Qin wins by 國都 | turns | Chu wins by 國都 | turns |
|---|---|---|---|---|
| lc/nn/base | 0 | – | 0 | – |
| lc/nn/realign | 0 | – | 0 | – |
| lc/nn/realign-mild | 0 | – | 0 | – |
| lc/nn/lose | 78 | 1:1 2:1 4:11 5:8 6:7 7:41 8:9 | 85 | 4:40 5:35 6:4 7:5 8:1 |
| lc/nn/lose-turn | 8 | 4:1 6:3 7:3 8:1 | 20 | 4:4 5:13 7:2 8:1 |
| lc/nn/lose-majority | 84 | 1:6 2:14 3:3 4:29 5:10 6:13 7:7 8:2 | 130 | 1:2 2:3 3:12 4:51 5:50 6:7 7:4 8:1 |
| lc/nn/move | 1 | 6:1 | 3 | 6:2 7:1 |
| lc/nn/realign+lose-turn | 8 | 4:2 5:1 6:2 8:3 | 29 | 2:1 3:1 4:6 5:15 6:5 7:1 |
| lc/nn/realign-own | 0 | – | 0 | – |
| lc/hh/base | 0 | – | 0 | – |
| lc/hh/realign | 0 | – | 0 | – |

How the ops are spent, per game, both sides [95%]: share of the ops put to 扶植 (place) / 奇襲 (campaign) / 遊說 (lobby) / 變法 (reform); face values (九鼎 4). Uses per game, and the change in 奇襲 and 遊說 uses against base.

| cell | 扶植 % | 奇襲 % | 遊說 % | 變法 % | 奇襲 uses / game | 奇襲 − base | 遊說 uses / game | 遊說 − base |
|---|---|---|---|---|---|---|---|---|
| lc/nn/base | 66.5 | 20.2 | 8.0 | 5.3 | 9.01 ±0.35 |  | 6.64 ±0.42 |  |
| lc/nn/realign | 64.0 | 20.1 | 11.4 | 4.5 | 8.63 ±0.33 | -0.39 [-0.87, +0.10] | 8.38 ±0.47 | **+1.74 [+1.11, +2.37]** |
| lc/nn/realign-mild | 64.9 | 20.0 | 9.8 | 5.2 | 9.16 ±0.34 | +0.15 [-0.34, +0.64] | 7.69 ±0.42 | **+1.05 [+0.45, +1.64]** |
| lc/nn/lose | 67.8 | 20.6 | 7.3 | 4.3 | 7.90 ±0.29 | **-1.11 [-1.57, -0.66]** | 5.38 ±0.36 | **-1.26 [-1.81, -0.71]** |
| lc/nn/lose-turn | 67.4 | 19.8 | 7.8 | 4.9 | 8.51 ±0.31 | **-0.51 [-0.97, -0.04]** | 6.43 ±0.42 | -0.21 [-0.81, +0.38] |
| lc/nn/lose-majority | 66.6 | 18.5 | 12.4 | 2.5 | 6.07 ±0.22 | **-2.94 [-3.36, -2.53]** | 7.88 ±0.56 | **+1.24 [+0.54, +1.94]** |
| lc/nn/move | 66.9 | 20.1 | 7.9 | 5.1 | 8.80 ±0.34 | -0.21 [-0.70, +0.28] | 6.46 ±0.40 | -0.18 [-0.76, +0.40] |
| lc/nn/realign+lose-turn | 64.6 | 19.4 | 11.9 | 4.1 | 8.15 ±0.31 | **-0.86 [-1.33, -0.39]** | 8.46 ±0.47 | **+1.82 [+1.19, +2.44]** |
| lc/nn/realign-own | 67.6 | 20.4 | 6.7 | 5.4 | 9.05 ±0.39 | +0.04 [-0.48, +0.56] | 5.41 ±0.41 | **-1.23 [-1.82, -0.65]** |
| lc/hh/base | 60.4 | 22.4 | 8.7 | 8.6 | 10.63 ±0.36 |  | 7.30 ±0.39 |  |
| lc/hh/realign | 56.6 | 22.9 | 13.4 | 7.1 | 10.80 ±0.40 | +0.17 [-0.37, +0.71] | 10.27 ±0.52 | **+2.97 [+2.32, +3.62]** |

遊說 in detail, all games of the cell pooled. Under base there are no attempts: one 遊說 removes min(ops, 局勢) and never costs the actor. 'net / attempt' = (enemy points removed − own points lost) ÷ attempts; 'actor lost' = attempts in which the actor lost at least one point; 'nothing to lose' = 遊說 aimed where the actor had no influence of its own. CAVEAT: in the cells run before realign-own (base … realign+lose-turn) the 遊說 counted here include the scripted 遊說 of the event 縱橫家遊說 (removes 2, no dice); from realign-own on it is counted apart ('event 遊說'). Uses per game in the table above come from the plays and never include it.

| cell | 遊說 actions | by Qin / Chu | ops / 遊說 | attempts / 遊說 | enemy removed / 遊說 | own lost / 遊說 | net / attempt | net / op | attempts: actor lost % | actor won % | no change % | at 要衝 % | nothing to lose % | event 遊說 (counted apart) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| lc/nn/base | 4409 | 2714 / 1695 | 1.70 | 0.00 | 1.43 | 0.00 | – | +0.84 | – | – | – | 70.8 | 0.0 | (in the counts) |
| lc/nn/realign | 5246 | 2523 / 2723 | 1.76 | 1.22 | 1.63 | 0.22 | +1.16 | +0.80 | 11.3 | 49.0 | 39.6 | 73.1 | 36.2 | (in the counts) |
| lc/nn/realign-mild | 4920 | 2257 / 2663 | 1.76 | 1.25 | 1.80 | 0.06 | +1.40 | +0.99 | 4.4 | 73.9 | 21.7 | 70.4 | 16.7 | (in the counts) |
| lc/nn/lose | 3678 | 2242 / 1436 | 1.68 | 0.00 | 1.44 | 0.00 | – | +0.86 | – | – | – | 71.7 | 0.0 | (in the counts) |
| lc/nn/lose-turn | 4271 | 2558 / 1713 | 1.69 | 0.00 | 1.43 | 0.00 | – | +0.85 | – | – | – | 72.5 | 0.0 | (in the counts) |
| lc/nn/lose-majority | 4938 | 2114 / 2824 | 1.77 | 0.00 | 1.31 | 0.00 | – | +0.74 | – | – | – | 87.6 | 0.0 | (in the counts) |
| lc/nn/move | 4314 | 2658 / 1656 | 1.70 | 0.00 | 1.43 | 0.00 | – | +0.84 | – | – | – | 69.8 | 0.0 | (in the counts) |
| lc/nn/realign+lose-turn | 5271 | 2576 / 2695 | 1.79 | 1.26 | 1.73 | 0.23 | +1.19 | +0.84 | 11.4 | 50.4 | 38.2 | 75.4 | 36.7 | (in the counts) |
| lc/nn/realign-own | 1822 | 821 / 1001 | 1.61 | 1.29 | 1.46 | 0.36 | +0.85 | +0.68 | 22.5 | 66.5 | 11.0 | 69.7 | 0.0 | 636 |
| lc/hh/base | 4804 | 2825 / 1979 | 1.70 | 0.00 | 1.45 | 0.00 | – | +0.86 | – | – | – | 65.8 | 0.0 | (in the counts) |
| lc/hh/realign | 5014 | 2513 / 2501 | 1.79 | 1.27 | 1.60 | 0.17 | +1.13 | +0.80 | 8.8 | 49.9 | 41.3 | 71.1 | 41.7 | (in the counts) |

收手 (realign-own only asks): 遊說 the actor stopped with attempts left, % of all 遊說, and the result of the roll just before the stop (by the dice: the actor lost it / won it / tied).

| cell | 遊說 | attempts / 遊說 | ops / 遊說 | stopped early, % of 遊說 | after a lost roll | after a won roll | after a tie |
|---|---|---|---|---|---|---|---|
| lc/nn/realign | 5246 | 1.22 | 1.76 | 0.0 (0) | 0 | 0 | 0 |
| lc/nn/realign-mild | 4920 | 1.25 | 1.76 | 0.0 (0) | 0 | 0 | 0 |
| lc/nn/realign+lose-turn | 5271 | 1.26 | 1.79 | 0.0 (0) | 0 | 0 | 0 |
| lc/nn/realign-own | 1822 | 1.29 | 1.61 | 1.3 (24) | 24 | 0 | 0 |
| lc/hh/realign | 5014 | 1.27 | 1.79 | 0.0 (0) | 0 | 0 | 0 |

Per attempt: the modifier difference d = the actor's modifiers − the other side's (clamped to −5…+5), how often each occurs (% of attempts), and how the dice went (actor won / tie / actor lost, %). 'exact' is 1d6 against 1d6 at that d, for comparison. Cells whose rows predate this column show nothing.

- **lc/nn/realign-own** (2346 attempts): d=+0: 14.0% (329), 39.5 / 16.4 / 44.1 [exact 41.7 / 16.7 / 41.7]; d=+1: 35.3% (827), 57.7 / 13.1 / 29.3 [exact 58.3 / 13.9 / 27.8]; d=+2: 29.5% (691), 75.1 / 9.0 / 15.9 [exact 72.2 / 11.1 / 16.7]; d=+3: 15.7% (369), 85.1 / 7.9 / 7.0 [exact 83.3 / 8.3 / 8.3]; d=+4: 4.6% (109), 90.8 / 4.6 / 4.6 [exact 91.7 / 5.6 / 2.8]; d=+5: 0.9% (21), 95.2 / 4.8 / 0.0 [exact 97.2 / 2.8 / 0.0]

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
| lc/nn/realign-own | 11.5 [8.5, 15.4] | 1.2 [0.5, 3.1] | 0.324 | 61 / 107 | 31 / 1 | 78 / 8 | 86 / 12 | 4:14 5:18 6:6 | 5:1 7:3 | 0 / 0 |
| lc/hh/base | 8.0 [5.9, 10.7] | 1.4 [0.7, 2.9] | 0.188 | 40 / 94 | 30 / 3 | 98 / 13 | 110 / 17 | 4:12 5:17 6:8 8:3 | 5:1 7:4 8:2 | 0 / 0 |
| lc/hh/realign | 4.5 [2.9, 7.0] | 0.8 [0.3, 2.2] | 0.122 | 29 / 49 | 10 / 2 | 57 / 10 | 69 / 12 | 4:8 5:10 | 6:2 7:1 | 0 / 0 |

Distributions per cell: end turn (turn:games); final Mandate min / p5 / p25 / median / p75 / p95 / max; 遊說 actions per game (count:games); the seeds with the most 遊說 and the seeds of the 國都 ends.

- **lc/nn/base**: end turn 1:18 2:25 3:61 4:54 5:72 6:69 7:81 8:120; mandate -25 / -21 / -13 / 0 / 13 / 22 / 29; 遊說/game 0:7 1:20 2:28 3:39 4:33 5:40 6:36 7:28 8:29 9:29 10:26 11:35 12:23 13:27 14:17 15:23 16:14 17:7 18:13 19:7 20:3 21:8 22:2 23:4 25:2; most 遊說 seed 198 (25, final), seed 183 (25, emperor), seed 27 (23, final); 國都 seeds none
- **lc/nn/realign**: end turn 1:22 2:32 3:57 4:53 5:72 6:77 7:78 8:109; mandate -26 / -22 / -15 / -2 / 11 / 22 / 27; 遊說/game 0:3 1:18 2:12 3:30 4:31 5:24 6:33 7:23 8:31 9:38 10:27 11:26 12:27 13:24 14:21 15:29 16:13 17:20 18:21 19:8 20:8 21:9 22:8 23:7 24:3 25:1 26:1 27:1 28:2 30:1; most 遊說 seed 297 (30, mandate), seed 170 (28, alliance), seed 346 (28, mandate); 國都 seeds none
- **lc/nn/realign-mild**: end turn 1:11 2:33 3:42 4:57 5:80 6:67 7:95 8:115; mandate -26 / -22 / -15 / -1 / 9 / 21 / 27; 遊說/game 0:4 1:15 2:24 3:29 4:33 5:30 6:25 7:25 8:25 9:33 10:27 11:31 12:34 13:38 14:26 15:23 16:18 17:14 18:18 19:7 20:5 21:7 22:1 23:4 24:2 26:2; most 遊說 seed 117 (26, final), seed 423 (26, final), seed 253 (24, mandate); 國都 seeds none
- **lc/nn/lose**: end turn 1:19 2:25 3:61 4:91 5:96 6:68 7:87 8:53; mandate -27 / -21 / -11 / 0 / 11 / 22 / 29; 遊說/game 0:8 1:21 2:35 3:49 4:39 5:60 6:47 7:38 8:31 9:23 10:29 11:23 12:19 13:16 14:18 15:15 16:8 17:5 18:7 19:4 20:2 23:2 24:1; most 遊說 seed 391 (24, final), seed 260 (23, final), seed 441 (23, final); 國都 seeds 1 5 7 8 9 23 14 46 47 31 32 37 …
- **lc/nn/lose-turn**: end turn 1:18 2:25 3:61 4:55 5:89 6:71 7:86 8:95; mandate -27 / -22 / -13 / -1 / 11 / 22 / 29; 遊說/game 0:7 1:20 2:29 3:41 4:35 5:37 6:49 7:33 8:29 9:28 10:30 11:24 12:22 13:17 14:21 15:17 16:17 17:11 18:8 19:6 20:4 21:4 22:3 23:3 24:4 26:1; most 遊說 seed 204 (26, homeFall), seed 44 (24, final), seed 260 (24, final); 國都 seeds 31 62 95 88 162 156 198 166 204 223 193 257 …
- **lc/nn/lose-majority**: end turn 1:49 2:39 3:78 4:131 5:89 6:48 7:33 8:33; mandate -25 / -19 / -6 / 2 / 12 / 22 / 30; 遊說/game 0:7 1:23 2:36 3:33 4:31 5:26 6:33 7:29 8:26 9:41 10:25 11:23 12:20 13:15 14:18 15:19 16:10 17:9 18:16 19:5 20:9 21:6 22:4 23:9 24:4 25:2 26:4 27:8 28:2 29:1 30:2 31:1 32:2 34:1; most 遊說 seed 86 (34, scoring), seed 343 (32, mandate), seed 482 (32, emperor); 國都 seeds 12 13 14 15 83 84 44 45 46 47 50 7 …
- **lc/nn/move**: end turn 1:18 2:25 3:61 4:54 5:75 6:81 7:74 8:112; mandate -26 / -22 / -14 / 0 / 13 / 22 / 29; 遊說/game 0:7 1:20 2:28 3:37 4:33 5:38 6:40 7:33 8:34 9:31 10:30 11:25 12:26 13:21 14:16 15:24 16:15 17:10 18:10 19:9 20:5 21:4 23:3 25:1; most 遊說 seed 183 (25, emperor), seed 196 (23, mandate), seed 334 (23, alliance); 國都 seeds 8 110 153 425
- **lc/nn/realign+lose-turn**: end turn 1:22 2:33 3:58 4:61 5:81 6:81 7:66 8:98; mandate -26 / -22 / -14 / -2 / 10 / 22 / 27; 遊說/game 0:3 1:18 2:13 3:32 4:24 5:33 6:30 7:33 8:25 9:26 10:27 11:21 12:27 13:28 14:24 15:25 16:14 17:21 18:19 19:17 20:8 21:10 22:9 23:6 24:3 25:3 26:1; most 遊說 seed 22 (26, alliance), seed 99 (25, final), seed 449 (25, mandate); 國都 seeds 45 54 55 9 70 59 30 110 119 166 168 132 …
- **lc/nn/realign-own**: end turn 1:10 2:12 3:42 4:32 5:54 6:50 7:72 8:58; mandate -28 / -22 / -13 / 1 / 13 / 22 / 28; 遊說/game 0:25 1:34 2:36 3:27 4:28 5:20 6:24 7:28 8:33 9:23 10:18 11:11 12:10 13:4 14:3 15:2 16:2 17:1 18:1; most 遊說 seed 99 (18, final), seed 253 (17, mandate), seed 20 (16, final); 國都 seeds none
- **lc/hh/base**: end turn 1:10 2:8 3:36 4:41 5:80 6:84 7:125 8:116; mandate -28 / -21 / -11 / 2 / 12 / 22 / 29; 遊說/game 0:2 1:12 2:18 3:21 4:32 5:36 6:23 7:37 8:33 9:39 10:33 11:39 12:42 13:27 14:21 15:28 16:17 17:12 18:5 19:7 20:6 21:4 22:3 23:1 25:1 28:1; most 遊說 seed 379 (28, final), seed 298 (25, tie), seed 443 (23, mandate); 國都 seeds none
- **lc/hh/realign**: end turn 1:9 2:8 3:30 4:38 5:65 6:75 7:82 8:93; mandate -25 / -21 / -13 / -2 / 11 / 21 / 26; 遊說/game 1:10 2:5 3:9 4:11 5:19 6:11 7:20 8:23 9:23 10:22 11:23 12:24 13:27 14:23 15:31 16:18 17:16 18:17 19:15 20:18 21:6 22:8 23:8 24:4 25:4 26:1 28:3 29:1; most 遊說 seed 176 (29, final), seed 22 (28, emperor), seed 192 (28, mandate); 國都 seeds none
