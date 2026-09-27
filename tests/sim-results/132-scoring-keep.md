# #132: Chu keeps a scoring card at its last action and loses by 記分 (base vs fix)

Default rules (`E.DEFAULT_OPTIONS`) on today's engine. Normal vs normal (nn) and hard vs hard (hh), 500 games each, seeds 1…500.
- **base** is the bot of main 1d73cc4, run from an untracked copy: `git show 1d73cc4:public/shared/bots.js > public/shared/__orch_bots_base.js`, then `SIM_BOTS=public/shared/__orch_bots_base.js`.
- **fix** is `public/shared/bots.js` of this branch (blob 2d849ac), frozen as `__orch_bots_fix.js` for the run.

```
SIM_BOTS=public/shared/__orch_bots_base.js node tests/sim.js 500 --only=k132/nn,k132/hh --out=tests/sim-results/132-base.txt --resume --jobs=14
SIM_BOTS=public/shared/__orch_bots_fix.js  node tests/sim.js 500 --only=k132/nn,k132/hh --out=tests/sim-results/132-fix.txt  --resume --jobs=14
node tests/sim.js --report-132=tests/sim-results/132-base.txt.state.json@base,tests/sim-results/132-fix.txt.state.json@fix
```

Instrument check: the base cells reproduce #130's `lc/nn/base` and `lc/hh/base` game for game. Both have 255 and 271 Qin wins of 500, and the ROW and EMP_ROW columns (winner, reason, turn, Mandate, markers, placements, reform) match on all 500 seeds of each. The #130 lobby columns differ because #130 changed how it counted the event 遊說 after those base rows were recorded. The new columns read the state only and draw no random numbers.

One base game (nn seed 141) crashed Node in the batch. The machine's Node dies at random; see the head of sim.js. It was replayed alone, and its row went into the state file in place of the error. The row is identical to #130's for that seed.

## Result

The fix moves Qin's win rate toward Chu:
- nn: 51.0 → 44.2, **−6.8 pp [−13.0, −0.6]**.
- hh: 54.2 → 46.6, **−7.6 pp [−13.8, −1.4]**.

Chu's losses by 記分 fall from 59 to 25 (nn) and from 42 to 15 (hh).

The keeps that remain are almost all forced: playing the scoring card there hands Qin the game at once, so keeping it and hoping Qin holds one too is the only chance. Chu's avoidable keeps fall from 5.8 % to 0.9 % of its last actions holding a scoring card (nn), and from 6.8 % to 0.4 % (hh). The three avoidable keeps that were lost (nn 39 and 485, hh 195) were traced. Each was on turn 8, with the end-of-turn discard perk pending before the final scoring, which Qin wins either way: Mandate +11, +10 and +1 after the scoring. The avoidability check does not look past a pending choice, so the column is an upper bound.

| cell | n | errors / stuck | Qin win % [95%] | Qin win − base, pp [95%] | avg end turn [95%] |
|---|---|---|---|---|---|
| k132/nn@base | 500 | 0 / 0 | 51.0 [46.6, 55.4] |  | 5.54 ±0.18 |
| k132/nn@fix | 500 | 0 / 0 | 44.2 [39.9, 48.6] | **-6.8 [-13.0, -0.6]** | 5.94 ±0.15 |
| k132/hh@base | 500 | 0 / 0 | 54.2 [49.8, 58.5] |  | 6.01 ±0.15 |
| k132/hh@fix | 500 | 0 / 0 | 46.6 [42.3, 51.0] | **-7.6 [-13.8, -1.4]** | 6.23 ±0.14 |

### 記分 endings by side

| cell | 記分 won by Qin (Chu held) | 記分 won by Chu (Qin held) | 記分2 (Chu wins) | all 記分 ends, % [95%] | Chu's 記分 losses, % [95%] | − base, pp [95%] |
|---|---|---|---|---|---|---|
| k132/nn@base | 59 | 13 | 0 | 14.4 [11.6, 17.7] | 11.8 [9.3, 14.9] |  |
| k132/nn@fix | 25 | 18 | 3 | 9.2 [7.0, 12.1] | 5.0 [3.4, 7.3] | **-6.8 [-10.2, -3.4]** |
| k132/hh@base | 42 | 11 | 0 | 10.6 [8.2, 13.6] | 8.4 [6.3, 11.2] |  |
| k132/hh@fix | 15 | 21 | 1 | 7.4 [5.4, 10.0] | 3.0 [1.8, 4.9] | **-5.4 [-8.3, -2.5]** |

Chu's 記分 losses by the turn they came on (turn:games):
- nn base: 1:18 2:10 3:14 4:6 5:5 6:5 8:1.
- nn fix: 2:1 3:12 4:4 5:1 6:4 7:1 8:2.
- hh base: 1:10 2:4 3:12 4:6 5:6 6:4.
- hh fix: 3:3 4:2 5:4 6:5 8:1.

The turn-1 losses are gone entirely: base had 18 (nn) and 10 (hh) games over on turn 1, all Chu 記分 losses; the fix has none.

### How often a bot keeps a scoring card at its last action of a turn

The table counts every last action of a turn (round = rounds) where the side holds a scoring card it may play. Columns:
- **kept**: the side played something else.
- **avoidable**: some playable scoring card would not have lost the game at once when played on the true state. This is an upper bound; see above.
- **foe held**: the other side truly held one too.

| cell | Qin: held / kept / avoidable | Qin kept → lost by 記分 | Chu: held / kept / avoidable | Chu kept, % of held [95%] | Chu avoidable keeps, % of held [95%] | foe held | kept → lost by 記分 | kept → won (記分2) | Chu avoidable keeps / game |
|---|---|---|---|---|---|---|---|---|---|
| k132/nn@base | 977 / 17 / 3 | 13 | 711 / 61 / 41 | 8.6 [6.7, 10.9] | 5.8 [4.3, 7.7] | 0 | 59 | 0 | 0.082 |
| k132/nn@fix | 1055 / 25 / 3 | 21 | 752 / 30 / 7 | 4.0 [2.8, 5.6] | 0.9 [0.5, 1.9] | 3 | 25 | 3 | 0.014 |
| k132/hh@base | 585 / 12 / 6 | 10 | 443 / 42 / 30 | 9.5 [7.1, 12.6] | 6.8 [4.8, 9.5] | 0 | 42 | 0 | 0.060 |
| k132/hh@fix | 607 / 23 / 1 | 22 | 449 / 16 / 2 | 3.6 [2.2, 5.7] | 0.4 [0.1, 1.6] | 1 | 15 | 1 | 0.004 |

On base, Qin never truly held a scoring card when Chu kept one ("foe held" 0 of 61 and 0 of 42). This confirms the Caveats line of #130: Qin plays its own scoring card before its last action is over, so the real chance that it still holds one is near 0, not the ~15–20 % a uniform guess gives.

Qin's keeps are not part of this issue and are almost all forced (3 and 1 avoidable). They rise with the fix (17 → 25, 12 → 23) because more games reach the later turns.

### End reasons, % of games [Wilson 95%], won by Qin / by Chu

| cell | 天命 | 滅國(一統) | 相印(合縱) | 土崩 | 記分 | 記分2 | 終局(回合上限) | 平手 | 稱帝 | 國都(homeFall) |
|---|---|---|---|---|---|---|---|---|---|---|
| k132/nn@base | 34.2 [30.2, 38.5] (90 / 81) | 1.6 [0.8, 3.1] (8 / 0) | 16.6 [13.6, 20.1] (0 / 83) | 1.4 [0.7, 2.9] (5 / 2) | 14.4 [11.6, 17.7] (59 / 13) | 0 | 9.2 [7.0, 12.1] (14 / 32) | 0.6 [0.2, 1.7] (0 / 3) | 22.0 [18.6, 25.8] (79 / 31) | 0 |
| k132/nn@fix | 33.0 [29.0, 37.2] (84 / 81) | 2.4 [1.4, 4.1] (12 / 0) | 16.6 [13.6, 20.1] (0 / 83) | 2.2 [1.2, 3.9] (9 / 2) | 8.6 [6.4, 11.4] (25 / 18) | 0.6 [0.2, 1.7] (0 / 3) | 10.6 [8.2, 13.6] (21 / 32) | 0.2 [0.0, 1.1] (0 / 1) | 25.8 [22.2, 29.8] (70 / 59) | 0 |
| k132/hh@base | 27.2 [23.5, 31.3] (72 / 64) | 1.4 [0.7, 2.9] (7 / 0) | 13.8 [11.1, 17.1] (0 / 69) | 2.8 [1.7, 4.6] (9 / 5) | 10.6 [8.2, 13.6] (42 / 11) | 0 | 7.8 [5.8, 10.5] (17 / 22) | 0.8 [0.3, 2.0] (0 / 4) | 35.6 [31.5, 39.9] (124 / 54) | 0 |
| k132/hh@fix | 23.8 [20.3, 27.7] (66 / 53) | 0.8 [0.3, 2.0] (4 / 0) | 16.6 [13.6, 20.1] (0 / 83) | 4.0 [2.6, 6.1] (15 / 5) | 7.2 [5.2, 9.8] (15 / 21) | 0.2 [0.0, 1.1] (0 / 1) | 10.6 [8.2, 13.6] (17 / 36) | 1.0 [0.4, 2.3] (0 / 5) | 35.8 [31.7, 40.1] (116 / 63) | 0 |

### Seed for seed, and distributions

A fix game follows the base game on the same seed until the first decision that differs.

- **nn**: the winner changed on 164 of 500 seeds: Qin → Chu 99, Chu → Qin 65.
  - End turn, base: 1:18 2:25 3:61 4:54 5:72 6:69 7:81 8:120.
  - End turn, fix: 2:15 3:49 4:51 5:64 6:95 7:107 8:119.
  - Chu kept-and-lost seeds, base: 4 15 17 31 41 44 45 59 78 101 124 129 137 142 143 … (59).
  - Chu kept-and-lost seeds, fix: 4 25 38 39 76 109 124 129 137 176 182 208 212 219 227 … (25).
- **hh**: the winner changed on 148 of 500 seeds: Qin → Chu 93, Chu → Qin 55.
  - End turn, base: 1:10 2:8 3:36 4:41 5:80 6:84 7:125 8:116.
  - End turn, fix: 2:5 3:23 4:49 5:82 6:93 7:112 8:136.
  - Chu kept-and-lost seeds, fix: 7 14 22 89 99 123 132 137 143 195 239 296 313 417 500.

The sim's own check marks the rest of the fix's keep-losses as forced. I traced one of them by hand: nn seed 25 on turn 4, where playing 東方記分 lost at once in both worlds of Qin's hand, so the bot valued it at −1000 and keeping it at −667.

## What this changes for earlier measurements

Every earlier balance number (#104, #121, #125, #130) was measured with the old bot. That bot gave Qin about 7 pp through this weakness at both levels. The default game now measures 44.2 % (nn) and 46.6 % (hh) for Qin. #130's recommendation (its picks tilt the game about 4 pp further toward Chu) was measured on the old bot as well. I have not rerun any of them.
