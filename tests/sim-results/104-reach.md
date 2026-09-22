# #104 — placement reach: today's rule against Twilight Struggle 6.1

Branch `be/104-reach-ts-sim`. Engine option `reach`:

- `"control"` (the default, today's rule): place where you have influence, or next to a space you **control**; reach is re-read point by point, so a point that wins control opens that space's neighbours inside the same action.
- `"ts"` (option B, TS 6.1): place where you have influence, or next to a space where you have **any** influence; the eligible set is fixed **at the start of the place action**. Cost (2 per point into an enemy-controlled space, re-read per point) and the cap (stability + 2) are unchanged.

Runs (this machine, Node 24, `tests/sim.js`, seeds 1…n per cell, both rules on the **same seeds**):

```
node tests/sim.js 1000 --only=nn/control,nn/ts,hh/control,hh/ts --jobs=12 --out=tests/sim-results/104-1000.txt --resume
node tests/sim.js 500 --only=hqnc/control,hqnc/ts,nqhc/control,nqhc/ts --jobs=12 --out=tests/sim-results/104-500.txt --resume
node tests/sim.js --report=tests/sim-results/104-1000.txt.state.json,tests/sim-results/104-500.txt.state.json
```

`nn` = normal vs normal, `hh` = hard vs hard, `hqnc` = hard Qin vs normal Chu, `nqhc` = normal Qin vs hard Chu.
No errors, no stuck games and no probe mismatch in any cell (8 cells, 6,000 games).

<!-- the tables below are the output of `--report`, unedited -->

| cell | n | Qin win % [95%] | errors / stuck | avg turn [95%] | avg final mandate [95%] | 滅 / game | 相印 / game | place actions / game | points / action | place actions with a point outside the control start set, % (under control: chaining) | points outside the TS start set |
|---|---|---|---|---|---|---|---|---|---|---|---|
| nn/control | 1000 | 44.9 [41.8, 48.0] | 0 / 0 | 5.89 ±0.13 | +0.04 ±0.96 | 1.17 ±0.05 | 2.69 ±0.09 | 34.34 ±0.85 | 1.98 | 10.7 (3676/34335; 971 games) | 329 |
| nn/ts | 1000 | 48.5 [45.4, 51.6] | 0 / 0 | 5.78 ±0.13 | +0.60 ±1.00 | 1.23 ±0.05 | 2.54 ±0.09 | 35.72 ±0.92 | 1.93 | 23.1 (8257/35717; 997 games) | 0 |
| hh/control | 1000 | 44.4 [41.3, 47.5] | 0 / 0 | 6.27 ±0.12 | -0.03 ±0.97 | 1.15 ±0.05 | 2.64 ±0.09 | 34.76 ±0.78 | 1.98 | 9.1 (3176/34762; 950 games) | 295 |
| hh/ts | 1000 | 49.8 [46.7, 52.9] | 0 / 0 | 6.32 ±0.12 | +1.11 ±0.97 | 1.26 ±0.05 | 2.57 ±0.08 | 36.97 ±0.83 | 1.93 | 22.2 (8210/36968; 988 games) | 0 |
| hqnc/control | 500 | 64.0 [59.7, 68.1] | 0 / 0 | 5.88 ±0.19 | +6.28 ±1.29 | 1.24 ±0.07 | 2.22 ±0.12 | 33.08 ±1.24 | 2.00 | 10.2 (1688/16540; 476 games) | 225 |
| hqnc/ts | 500 | 64.0 [59.7, 68.1] | 0 / 0 | 6.15 ±0.18 | +5.46 ±1.33 | 1.39 ±0.07 | 2.30 ±0.12 | 37.01 ±1.22 | 1.93 | 23.9 (4420/18504; 498 games) | 0 |
| nqhc/control | 500 | 32.0 [28.1, 36.2] | 0 / 0 | 6.05 ±0.17 | -4.08 ±1.35 | 1.02 ±0.07 | 2.90 ±0.12 | 34.52 ±1.12 | 1.98 | 9.4 (1620/17261; 475 games) | 90 |
| nqhc/ts | 500 | 34.0 [30.0, 38.3] | 0 / 0 | 5.91 ±0.18 | -4.45 ±1.33 | 1.15 ±0.07 | 2.80 ±0.12 | 35.53 ±1.22 | 1.93 | 22.6 (4014/17764; 499 games) | 0 |

End reasons, % of games [Wilson 95%]:

| cell | 天命 | 滅國(一統) | 相印(合縱) | 土崩 | 記分 | 記分2 | 終局(回合上限) | 平手 |
|---|---|---|---|---|---|---|---|---|
| nn/control | 38.4 [35.4, 41.5] | 2.4 [1.6, 3.5] | 20.1 [17.7, 22.7] | 3.4 [2.4, 4.7] | 15.7 [13.6, 18.1] | 0.1 [0.0, 0.6] | 18.2 [15.9, 20.7] | 1.7 [1.1, 2.7] |
| nn/ts | 42.4 [39.4, 45.5] | 2.1 [1.4, 3.2] | 17.7 [15.5, 20.2] | 3.2 [2.3, 4.5] | 16.7 [14.5, 19.1] | 0.1 [0.0, 0.6] | 17.1 [14.9, 19.6] | 0.7 [0.3, 1.4] |
| hh/control | 37.8 [34.8, 40.8] | 1.8 [1.1, 2.8] | 19.0 [16.7, 21.5] | 4.7 [3.6, 6.2] | 13.3 [11.3, 15.5] | 0.2 [0.1, 0.7] | 22.0 [19.5, 24.7] | 1.2 [0.7, 2.1] |
| hh/ts | 37.1 [34.2, 40.1] | 2.7 [1.9, 3.9] | 14.8 [12.7, 17.1] | 4.3 [3.2, 5.7] | 15.2 [13.1, 17.6] | 0.5 [0.2, 1.2] | 23.9 [21.4, 26.6] | 1.5 [0.9, 2.5] |
| hqnc/control | 41.4 [37.2, 45.8] | 2.6 [1.5, 4.4] | 12.4 [9.8, 15.6] | 4.0 [2.6, 6.1] | 16.6 [13.6, 20.1] | 0.4 [0.1, 1.4] | 20.2 [16.9, 23.9] | 2.4 [1.4, 4.1] |
| hqnc/ts | 40.2 [36.0, 44.6] | 3.8 [2.4, 5.9] | 10.0 [7.7, 12.9] | 4.8 [3.2, 7.0] | 18.0 [14.9, 21.6] | 0 | 22.6 [19.2, 26.5] | 0.6 [0.2, 1.7] |
| nqhc/control | 40.0 [35.8, 44.4] | 0 | 24.4 [20.8, 28.4] | 3.6 [2.3, 5.6] | 14.0 [11.2, 17.3] | 0.4 [0.1, 1.4] | 17.0 [14.0, 20.5] | 0.6 [0.2, 1.7] |
| nqhc/ts | 39.2 [35.0, 43.5] | 1.0 [0.4, 2.3] | 20.2 [16.9, 23.9] | 2.8 [1.7, 4.6] | 14.8 [12.0, 18.2] | 0.6 [0.2, 1.7] | 20.2 [16.9, 23.9] | 1.2 [0.6, 2.6] |

Distributions (per game): end turn histogram; final mandate and place actions as min / p5 / p25 / median / p75 / p95 / max; the outlying seeds.

- **nn/control**: turn 1:22 2:46 3:92 4:105 5:147 6:132 7:92 8:364; mandate -27 / -22 / -13 / -1 / 15 / 22 / 31; place actions 3 / 11 / 24 / 35 / 47 / 53 / 61; lowest mandate seeds 646(-27,mandate) 830(-27,mandate) 947(-27,mandate), highest 806(29,mandate) 980(29,mandate) 797(31,mandate); most place actions 366(61) 719(60) 929(60)
- **nn/ts**: turn 1:33 2:46 3:113 4:88 5:142 6:143 7:81 8:354; mandate -28 / -22 / -15 / 1 / 17 / 23 / 32; place actions 4 / 10 / 24 / 37 / 49 / 56 / 63; lowest mandate seeds 21(-28,mandate) 943(-28,mandate) 393(-27,mandate), highest 561(29,mandate) 871(29,mandate) 154(32,mandate); most place actions 181(63) 545(63) 825(63)
- **hh/control**: turn 1:24 2:22 3:70 4:82 5:124 6:141 7:96 8:441; mandate -30 / -23 / -14 / -1 / 14 / 23 / 32; place actions 3 / 11 / 26 / 37 / 45 / 51 / 58; lowest mandate seeds 828(-30,mandate) 452(-29,mandate) 602(-27,mandate), highest 654(28,mandate) 84(29,mandate) 89(32,mandate); most place actions 423(58) 736(58) 493(56)
- **hh/ts**: turn 1:20 2:26 3:81 4:73 5:104 6:140 7:93 8:463; mandate -30 / -22 / -14 / 1 / 16 / 24 / 31; place actions 2 / 12 / 27 / 40 / 48 / 53 / 60; lowest mandate seeds 187(-30,mandate) 981(-29,mandate) 685(-28,mandate), highest 372(29,mandate) 686(30,mandate) 980(31,mandate); most place actions 136(60) 164(60) 844(60)
- **hqnc/control**: turn 1:15 2:28 3:52 4:42 5:62 6:68 7:37 8:196; mandate -28 / -20 / -4 / 9 / 20 / 24 / 32; place actions 2 / 9 / 21 / 35 / 46 / 52 / 56; lowest mandate seeds 305(-28,mandate) 386(-26,mandate) 70(-24,mandate), highest 156(30,mandate) 136(30,mandate) 292(32,mandate); most place actions 500(56) 125(55) 233(55)
- **hqnc/ts**: turn 1:8 2:20 3:44 4:51 5:56 6:62 7:34 8:225; mandate -27 / -21 / -6 / 9 / 20 / 24 / 30; place actions 5 / 12 / 25 / 40 / 49 / 54 / 59; lowest mandate seeds 72(-27,mandate) 70(-25,mandate) 173(-25,mandate), highest 316(29,mandate) 391(29,mandate) 137(30,mandate); most place actions 350(59) 372(59) 90(58)
- **nqhc/control**: turn 1:12 2:11 3:36 4:53 5:79 6:73 7:51 8:185; mandate -29 / -22 / -19 / -7 / 7 / 22 / 30; place actions 3 / 13 / 25 / 36 / 46 / 52 / 59; lowest mandate seeds 135(-29,mandate) 428(-28,mandate) 224(-27,mandate), highest 182(26,mandate) 215(30,mandate) 408(30,mandate); most place actions 25(59) 158(56) 377(56)
- **nqhc/ts**: turn 1:14 2:16 3:43 4:52 5:83 6:67 7:44 8:181; mandate -28 / -23 / -18 / -7 / 6 / 22 / 29; place actions 4 / 11 / 26 / 37 / 48 / 54 / 60; lowest mandate seeds 477(-28,mandate) 258(-27,mandate) 75(-26,mandate), highest 67(27,mandate) 204(28,mandate) 212(29,mandate); most place actions 6(60) 92(58) 166(58)

Difference ts − control [95%]; ** = the interval leaves out 0:

| pair | Qin win pp | turn | final mandate | 滅 | 相印 | place actions | points / action (per-game mean) | 天命 pp | 滅國(一統) pp | 相印(合縱) pp | 土崩 pp | 記分 pp | 記分2 pp | 終局(回合上限) pp | 平手 pp |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| nn | +3.6 [-0.8, 8.0] | -0.11 [-0.29, +0.07] | +0.56 [-0.83, +1.94] | +0.06 [-0.01, +0.13] | **-0.15 [-0.28, -0.03]** | **+1.38 [+0.13, +2.64]** | **-0.05 [-0.07, -0.04]** | +4.0 [-0.3, 8.3] | -0.3 [-1.6, 1.0] | -2.4 [-5.8, 1.0] | -0.2 [-1.8, 1.4] | +1.0 [-2.2, 4.2] | +0.0 [-0.3, 0.3] | -1.1 [-4.4, 2.2] | **-1.0 [-2.0, -0.0]** |
| hh | **+5.4 [1.0, 9.8]** | +0.05 [-0.12, +0.22] | +1.14 [-0.23, +2.51] | **+0.11 [+0.04, +0.19]** | -0.07 [-0.19, +0.05] | **+2.21 [+1.07, +3.35]** | **-0.05 [-0.06, -0.03]** | -0.7 [-4.9, 3.5] | +0.9 [-0.4, 2.2] | **-4.2 [-7.5, -0.9]** | -0.4 [-2.2, 1.4] | +1.9 [-1.2, 5.0] | +0.3 [-0.2, 0.8] | +1.9 [-1.8, 5.6] | +0.3 [-0.7, 1.3] |
| hqnc | +0.0 [-6.0, 6.0] | **+0.27 [+0.01, +0.53]** | -0.82 [-2.67, +1.03] | **+0.16 [+0.06, +0.26]** | +0.07 [-0.10, +0.25] | **+3.93 [+2.19, +5.67]** | **-0.07 [-0.09, -0.05]** | -1.2 [-7.3, 4.9] | +1.2 [-1.0, 3.4] | -2.4 [-6.3, 1.5] | +0.8 [-1.7, 3.3] | +1.4 [-3.3, 6.1] | -0.4 [-1.0, 0.2] | +2.4 [-2.7, 7.5] | **-1.8 [-3.3, -0.3]** |
| nqhc | +2.0 [-3.8, 7.8] | -0.14 [-0.38, +0.11] | -0.37 [-2.26, +1.52] | **+0.13 [+0.03, +0.23]** | -0.10 [-0.27, +0.06] | +1.01 [-0.65, +2.66] | **-0.05 [-0.07, -0.03]** | -0.8 [-6.9, 5.3] | **+1.0 [0.1, 1.9]** | -4.2 [-9.4, 1.0] | -0.8 [-3.0, 1.4] | +0.8 [-3.6, 5.2] | +0.2 [-0.7, 1.1] | +3.2 [-1.6, 8.0] | +0.6 [-0.6, 1.8] |

## Pooled win rates and the chaining counts

```
mirror (nn+hh, 2000 each): control 44.6% (893/2000) vs ts 49.1% (983/2000) -> ts - control 4.5pp [1.4, 7.6]
all four cells (3000 each): control 45.8% (1373/3000) vs ts 49.1% (1473/3000) -> ts - control 3.3pp [0.8, 5.9]
nn/control: games with >=1 chained action 97.1%; chained actions 3676/34335 (10.7%); chained points 4677/68090 (6.9%); per-game share median 11.1% p95 25.0% max 50.0%
hh/control: games with >=1 chained action 95.0%; chained actions 3176/34762 (9.1%); chained points 4120/68813 (6.0%); per-game share median 9.1% p95 22.2% max 60.0%
hqnc/control: games with >=1 chained action 95.2%; chained actions 1688/16540 (10.2%); chained points 2179/33105 (6.6%); per-game share median 10.0% p95 27.3% max 50.0%
nqhc/control: games with >=1 chained action 95.0%; chained actions 1620/17261 (9.4%); chained points 2100/34166 (6.1%); per-game share median 9.4% p95 22.0% max 57.1%
nn/ts: actions using the wider start set 8257/35717 (23.1%); points there 11286/68807 (16.4%); actions outside the TS start set 0 (must be 0)
hh/ts: actions using the wider start set 8210/36968 (22.2%); points there 11190/71350 (15.7%); actions outside the TS start set 0 (must be 0)
hqnc/ts: actions using the wider start set 4420/18504 (23.9%); points there 6030/35798 (16.8%); actions outside the TS start set 0 (must be 0)
nqhc/ts: actions using the wider start set 4014/17764 (22.6%); points there 5476/34241 (16.0%); actions outside the TS start set 0 (must be 0)
```

## How the ops are spent (separate probe, seeds 1…400 normal / 1…100 hard Qin vs normal Chu)

Scratch probe over the real `place` log entries (`spent` vs number of points); not committed, the numbers are reproducible from the log by anyone replaying those seeds.

```
h/control    games 100 | place acts/game 30.11 | points/act 2.013 | ops spent/act 2.464 | ops per point 1.224 | points into enemy-controlled 22.4% | acts with a 2-cost point 42.9% | points into a space the side had none in (approx) 22.8% | jin 62.8% east 11.4% west 11.2% north 7.5% south 5.6% zhou 1.5%
h/ts         games 100 | place acts/game 37.14 | points/act 1.925 | ops spent/act 2.446 | ops per point 1.271 | points into enemy-controlled 27.1% | acts with a 2-cost point 49.0% | points into a space the side had none in (approx) 24.5% | jin 62.5% east 11.1% west 10.8% north 7.2% south 6.8% zhou 1.6%
n/control    games 400 | place acts/game 33.30 | points/act 1.992 | ops spent/act 2.473 | ops per point 1.242 | points into enemy-controlled 24.2% | acts with a 2-cost point 45.6% | points into a space the side had none in (approx) 20.2% | jin 64.9% east 12.3% west 9.2% north 6.9% south 5.3% zhou 1.4%
n/ts         games 400 | place acts/game 36.66 | points/act 1.917 | ops spent/act 2.461 | ops per point 1.284 | points into enemy-controlled 28.4% | acts with a 2-cost point 50.8% | points into a space the side had none in (approx) 23.0% | jin 64.2% east 11.7% west 9.8% south 6.7% north 6.3% zhou 1.3%
```

## Reading

**What B changes mechanically.** Two opposite changes land at once: eligibility gets *wider* (any influence next door, not control) and *shallower* (no chaining inside the action). In these games the widening dominates: today 9–11 % of place actions put a point where the action's own earlier points opened the way, while under B 22–24 % of place actions put a point somewhere today's rule would not have allowed at the start of that action. The counts say chaining is not an exotic trick today — 95–97 % of games use it at least once — but it is a small part of the total: 6–7 % of all points placed, median 9–11 % of a game's place actions, and only rarely twice over (329 of 68,090 points in `nn/control`, 0.5 %, reached a space that not even B's start set contained).

**Bigger than the interval.** Pooled over the two mirror cells (2,000 games each, same seeds), Qin wins 44.6 % under today's rule and 49.1 % under B: **+4.5 pp [1.4, 7.6]**. Per cell only `hh` clears its own interval (+5.4 pp [1.0, 9.8]); `nn` is +3.6 pp [−0.8, 8.0], `nqhc` +2.0 pp [−3.8, 7.8], `hqnc` +0.0 pp [−6.0, 6.0]. So: a Qin-ward shift of roughly 3–5 pp, visible in the pool, not resolvable cell by cell at these n.

Also outside their intervals, and in the same direction in every cell:

- **more place actions per game** (+1.0 to +3.9) and **fewer points per action** (−0.05, and per-game means −0.05 to −0.07);
- **more 滅** (+0.11 to +0.16 states per game in `hh`, `hqnc`, `nqhc`);
- **fewer 相印 endings** in `hh` (合縱 19.0 % → 14.8 %, −4.2 pp [−7.5, −0.9]) and fewer 相印 per game in `nn` (−0.15 [−0.28, −0.03]).

Everything else — average turn (except `hqnc`, +0.27), final mandate, the 天命 / 土崩 / 記分 / 終局 shares — stays inside its interval.

**Why the numbers moved.** Under B the eligible spaces at the start of an action are the neighbours of *every* point you own, including single loose points, and those neighbours are much more often spaces the enemy controls. The ops probe shows it: points paid at the enemy-controlled price rise from 24.2 % to 28.4 % of all points (normal) and 22.4 % → 27.1 % (hard Qin), so an op buys 1.242 → 1.284 ops per point — the same ops produce fewer points, spread over more, smaller actions. That is the whole "more actions, fewer points each" row.

The asymmetry is in who that helps. Qin's board is a dense home block pushing east; its loose influence in 三晉 already sits next to Chu-held spaces, so the wider start set mostly hands Qin cheaper *contact* — and contact is what 滅國 needs (all of a state's spaces controlled), which is why 滅 per game goes up in three cells. Chu's win condition is the opposite shape: 相印 needs Chu to *hold* enemy capitals at the cap, which is a deep, repeated push into one space — exactly what chaining inside one action pays for today, and exactly what B takes away. That combination — Qin gains breadth, Chu loses depth — is the most economical reading of a +4.5 pp Qin shift with 滅 up and 相印 down.

**What this does not say.** Both seats are bots, and both bots were adapted to the option in the same way (`greedyPlacement` and `randomPoints` take the start set). A human, or a bot rewritten for B, could use the fixed set better than this greedy one does — for instance by spending an earlier action to seed influence next to a target, which is exactly the planning B rewards and this bot never does deliberately. The numbers measure the rule as played by today's bots, not the rule's ceiling.
