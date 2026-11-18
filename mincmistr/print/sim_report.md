# The Mincmistr: design and simulation report

15 Nov 2026 · rules version 1.2.2 · engine: Kutná Hora Solo v0.3.0 (`0b28294`, `src/` unchanged)

This report records the rules and engine used for the original study. [Current Mincmistr rules](../Mincmistr_Rules.md)

## Summary

The Mincmistr is a deck-driven opponent for two-player Kutná Hora. It plays every rule a player plays: same setup, costs, taxes, limits and scoring, with no starting points and no hidden information. Each card play takes a flip and usually one to two checks. The measured average is 1.14 goal checks per card play at Journeyman.

Four levels cover a range of about 15 points. Results are against the app's own rivals, using seeds held out from all tuning. Each Standard cell has 768 games (holdout groups `h1–h16`) and each Quick cell 384 (`h1–h8`).

| Level | vs Quick rival | vs Standard rival | What changes |
|---|---|---|---|
| Apprentice | 51.6% wins, +0.0 ± 0.5 | 19.7%, −9.1 ± 0.4 | no point calculations for plots, build spaces or mine placement |
| Journeyman | 64.3%, +3.3 ± 0.5 | 32.7%, −5.1 ± 0.4 | rules as written |
| Master | 77.3%, +7.6 ± 0.5 | 50.4%, −0.3 ± 0.4 | rounds 4–6: its last turn plays both remaining cards |
| Grandmaster | 86.7%, +12.2 ± 0.6 | 71.0%, +5.5 ± 0.4 | every round: its last turn plays both remaining cards |

Margins are the Mincmistr's points minus the rival's, ± one standard error. Apprentice and Journeyman make no exceptions to the rules. Master and Grandmaster add one extra card play in some rounds. They never add points, coins or discounts. That extra card play is the design's only concession to difficulty, and the user brief allowed minimal cheating.

The extra card play also works as a dial. Against the Standard rival (holdout, 768 games each), giving the double last turn to the last N rounds measures as follows:

| N rounds | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| Win rate | 32.7% | 39.5% | 43.8% | 50.4% | 58.1% | 66.9% | 71.0% |
| Margin | −5.1 | −3.7 | −2.1 | −0.3 | +2.2 | +4.0 | +5.5 |

Version 1.0 was measured before the two v1.1 rules, on holdout `h1–h8`. Journeyman then scored 26.6% and −6.8 against Standard, and 58.1% and +1.6 against Quick. On the same seeds, v1.1 scores 30.2% and −5.8 against Standard, and 64.3% and +3.3 against Quick.

## Test method

- **Engine.** The app's rules engine was used as is (`createGame`, `legalActions`, `transition`). The Mincmistr chooses only from the engine's legal actions, so it cannot break a rule.
- **Opponents.** The app's Standard rival is the main yardstick, with its Quick rival as a weaker reference. Journeyman was also run against the six other policies in `bot.mjs`.
- **Game design.** Each seed is played twice, with the Mincmistr in each seat. Starting player, setup card (1–9) and guild side rotate across seeds.
- **Seeds.** Tuning used groups `pl co ab cd` and later `ef gh ij kl` (192 or 384 games per variant). Fresh groups `f1–f8` confirmed each adopted change. The final numbers come from groups `h1–h16`, which no tuning decision ever saw.
- **Noise.** One reshuffle of the Plan deck shifts a 96-game result by up to 2 points. Each decision used 192 to 384 games. A gain was kept only if it held up on a second seed set, and a simplification was kept if it cost nothing measurable. Tuning groups overstated strength by about 1.8 points against fresh seeds, through selection bias. The holdout numbers above do not have that bias.
- **Equivalence.** `mincmistr.mjs` is the rules as code, written to match the rulebook clause by clause. It was checked decision by decision against the tuning implementation (`automa.mjs` plus `base.json`). The final check covered 883 to 1,029 decisions per level at all four levels and found 0 mismatches.

## Journeyman against every app policy (holdout `h1–h4`, 192 games each)

| App policy | Mincmistr win rate | Margin |
|---|---|---|
| quick (384 games) | 64.3% | +3.3 ± 0.5 |
| miner | 56.3% | +1.9 ± 0.7 |
| denial | 54.7% | +1.2 ± 0.7 |
| builder | 51.0% | −0.2 ± 0.7 |
| council | 50.5% | +0.0 ± 0.7 |
| baseline | 46.4% | −0.9 ± 0.7 |
| classic | 34.4% | −3.5 ± 0.7 |
| standard (384 games) | 30.2% | −5.8 ± 0.6 |

Results are also steady across the nine setup cards. On `h1–h8`, Journeyman against Standard ranged from −3.3 to −7.5 by setup (32–48 games each), which is within noise.

Journeyman is level with or ahead of the app's single-minded policies (miner, denial, builder, council) and the baseline search. It trails the classic and Standard rivals. The starting player makes little difference: in a Journeyman mirror match over 192 games, the starter wins 51%.

## Where the points come from (Journeyman vs Standard, holdout)

| Part | Mincmistr | Standard |
|---|---|---|
| Earned during play | 12.5 | 15.7 |
| Town | 7.2 | 8.4 |
| Mine rows | 8.0 | 11.4 |
| Income | 7.5 | 5.5 |
| Reputation | 5.4 | 4.9 |
| Rights, plots, pelicans | 2.0 | 2.4 |

The Mincmistr out-earns the rival on income and reputation. It loses most of its points in mine-row majorities and in council and public-building points. The Standard rival searches ahead and contests mine rows deliberately. Row-points placement (v1.1) narrowed the mine-row gap from about 4.1 to 3.4 points. No simple rule tried closed it further.

## How often each rule fires (Journeyman vs Standard, share of card plays)

| Rule | Share |
|---|---|
| 4.3 Construct | 52.3% |
| 4.1 Fewer than 20 g → Income | 23.1% |
| 4.3 Mine | 18.6% |
| 4.2 Pelicans → St. Barbara | 3.3% |
| 4.3 St. Barbara | 1.4% |
| 4.4 Fallbacks (Income, Mine, discard) | 1.3% |

A typical game has 30 card plays. A person running the Mincmistr also makes about 6 rights choices, with 2–3 candidates each. They make about 6 plot choices, with about 7 legal plots each, which comes to about 42 town-point checks per game. They also make about 5 mine placements, each comparing up to 4 row awards, resolve about 8 bonus steps, and check patrician edge about 3 times. The town-point checks are the main overhead. Apprentice removes them, along with the row-award comparison.

## Design history (what changed the result)

Margins are against Standard on the tuning groups at the time of each change. Later baselines differ.

1. **First draft**: a 15-card goal deck (Construct, Mine, Income, St. Barbara) with a focus and an arrow on each card, and a fixed card row. It won 1 of 24 games, at −21.6.
2. **Cash hoarding** (it ended games with 129 g): capped Income at 25 g, with an exception for seating patricians. About +5 to +6 points.
3. **Row order**: the first row used both Plot cards on Mine and Build. I enumerated all 32 distinct row behaviours, since each action has a choice between two cards. The adopted row was the best of the 32, by 0.5 points over the next.
4. **Plot choice**: most town points beat cheapest-first by about 3 points, and beat a "most neighbouring buildings" proxy by about 1 point.
5. **Cash rule**: "fewer than 20 g → Income first", with Income otherwise taken only to seat a patrician. This was simpler than the cap and worth about +2.5 points.
6. **Pelicans**: "2 or more → St. Barbara" was worth about +1 point.
7. **Bug found**: the card "focus" field never worked, because a sort compared NaN. Fixing it made the Mincmistr about 8 points weaker. The focus mechanic was removed, and Rights became "most income value among buildable guild tiles; never buy public rights".
8. **Simplifications with no loss**: never use the Joker, take Rights only while holding fewer than 2, drop the 10 g floor for Mine, drop the tax-reserve rule, drop the "next to a public building" plot tie. The Council goal fired on 0.2% of card plays, so it came off the Plan cards. Patricians are seated through any Income.
9. **St. Barbara on Plan cards**: worth about +0.8 points. With 4 of 15 cards, adding more gave no further gain.
10. **Paired rollouts against the Standard rival (v1.0 → v1.1)**. I took each card play where the Standard rival would have chosen differently, about 1,800 of them. Both choices were played to the end with the Mincmistr continuing, and I compared the final margins. On average the rival's alternative was no better (−0.2 points). The exception was St. Barbara: when the rival would contribute a single pelican, mostly in rounds 5–6, that was worth about +4 points. A blanket "use single pelicans late" rule did not capture it. The tile-specific prize-tile rule (tiles 6, 7, 8, 9, 11) did: +0.7 on tuning seeds and +1.0 on fresh seeds.
11. **Mine placement by row points gained** ("contest"). On its own this was worth +0.4 to +0.9. Together with the prize-tile rule it was worth +1.55 on tuning seeds and +1.66 on fresh seeds, so v1.1 adopts it. Apprentice keeps the simple "fewest mines" placement to keep its overhead low.
12. **Second rollout pass on v1.1**: 1,760 disagreements, mean −0.03 points. No single-move alternative from the Standard rival improves the Mincmistr on average. The only remaining signal was late-game Joker plots (+2.0, n = 47). It is small, depends on the Joker, and was not pursued.

### Tried and rejected (no gain, or worse)

- Stars-first keeping, a rich-mine trigger and Mine-heavy decks (−1 to −2). Contest placement alone was within noise before v1.1.
- Plot before rights (−3.5), build-cost caps (−5 to −12), a final-round spend-down module, cost-aware rights, and skipping St. Barbara tiles 3 and 5.
- A lower cash threshold in the last round (−0.7 to −2.5), and seating patricians at edge 0.
- Ore or technology bonuses on rights (−0.8 to −2.5), and guild-order rules.
- 12-card decks and three-goal cards (within noise, not better).
- A grid over the cash threshold (15/20/25), the rights limit (2/3) and mine placement found the adopted settings best. Contest placement was the one exception, and v1.1 adopts it.
- Economic privileges as difficulty: +10 g per Income was worth +2.7, free mine placement +3, free plots +1.3. All were weaker per unit of cheating than one extra card play, and less transparent.

## Three and four players

Version 1.2 adds play against two or three Mincmistrs. Each one compares edge against its best opponent. In a four-player game, which has five rounds, Master's extra card play covers the last three rounds (3–5). Two-player behaviour is unchanged, and the decision-by-decision check still finds 0 mismatches. All seeds below are fresh (`x1–x4`).

**You against two or three Mincmistrs.** The app's Standard rival takes your seat, which rotates through every seat. The table shows its win rate and its margin over the best Mincmistr.

| Players | Apprentice | Journeyman | Master | Grandmaster |
|---|---|---|---|---|
| 3 (fair share 33%), 288 games each (Master 576) | 70.1%, +6.2 | 57.3%, +2.4 | 39.2%, −2.8 | 18.1%, −10.3 |
| 4 (fair share 25%), 384 games each | 64.3%, +3.2 | 48.4%, +0.3 | 24.7%, −5.2 | 18.5%, −8.3 |

With the Quick rival in your seat against Journeyman Mincmistrs, it wins 15.6% at 3 players and 14.8% at 4.

**One Mincmistr at a table of Standard rivals.** The table shows the Mincmistr's win rate and its margin over the rivals' average.

| Players | Journeyman | Master |
|---|---|---|
| 3 (fair share 33%), 144 games | 11.1%, −6.6 | 29.9%, −1.1 |
| 4 (fair share 25%), 192 games | 13.5%, −3.7 | 30.2%, +0.5 |

The two-player ladder carries over, with one qualification. With four players, Master sits at fair share. This run had the rival winning 24.7%; GPT's independent audit (commit `e1712d9`) found 26% with separate Plan decks and 21% with one shared deck. With three players, Master is slightly easy. The rival won 37.2% on seeds `x1–x4` and 41.3% on `y1–y4`, and the audit found 42–44% for the Standard and Planner rivals, all against a 33% fair share. On the same `y1–y4` boards (288 games each), moving the double last turn to the last four rounds (N = 4) cut the rival's wins from 41.3% to 37.8%. Its margin over the strongest Mincmistr fell from −2.15 to −4.85, so the Mincmistrs were 2.7 points tougher. The win-rate change is less certain than the margin change. Rule 10 offers N = 4 as the tougher three-player option.

Journeyman is the gentler choice at every table size. Grandmaster's lead over the rival narrows as the player count rises.

## Audit corrections (v1.2.1–1.2.2)

GPT's audit of commit `e1712d9` found two print errors and two benchmark defects. All four are fixed:

- **Goals reference card.** It compared council points with "you" only. It now uses the most that colour gives any opponent, matching rules 6.6 and 10.
- **St. Barbara tile 9.** Rule 6.5 sent *Dig twice* to the paid Mine rule. It now says both Mine actions are free, use reserve miners first, and place for free by rule 6.4. The code was already correct.
- **Unknown rival names.** The v0.3.0 engine silently plays Standard for an unknown rival name such as `planner`. `simfinal.mjs` and `multisim.mjs` now stop with an error instead (`policies.mjs`). No published number used an unknown name.
- **Master workload.** `overhead.mjs` did not apply Master's double last turn, so it counted 30 card plays instead of 33. Fixed. The published workload figures are for Journeyman and are unchanged.
- **Follow-up (v1.2.2).** `multi.mjs` and the lab harness `sim.mjs` also reject unknown rival names now. Rule 10 calls N = 4 the tougher three-player option rather than an even game, and the multiplayer caption gives the right game counts. GPT reproduced all 576 three-player games.

## Exploit tests

I gave the Standard rival knowledge of the Mincmistr's rules and had it deny the predictable choices. Each test ran 192 holdout games (`h1–h4`); baseline Journeyman vs Standard on those seeds is −4.8.

- **Taking its next building right first.** This never came up: in two-player setups the guild sets don't overlap, so the rival can never take the Mincmistr's guild tiles.
- **Racing it to prize St. Barbara tiles.** The rival jumped in 0.23 times per game, with no measurable effect (−4.9).
- **Claiming the plot it wants next.** The rival did this about once per game, and the Mincmistr came out slightly ahead (−4.0), because blocking cost the rival more than it cost the Mincmistr.

None of these denial strategies is a usable exploit. Untested: longer-range manipulation, such as steering commodity prices to shrink its Income.

## Limitations

- **Bots, not people.** The opponents are bots, so how these numbers translate to human play is an estimate. An experienced player may well be stronger than the Standard rival. For them, Master or Grandmaster is likely the right level.
- **Player count.** Three- and four-player results are smaller samples (144–384 games per cell) than the two-player ones, and were measured only against the Standard and Quick rivals.
- **Engine interpretation.** Where the app's engine interprets the printed rules, the Mincmistr inherits that reading. Examples are paying the 10 g patrician fee from the Income being collected, and plot pricing at reputation 3+.
- **Not a regular player in two ways.** It never uses the Joker. At Master and Grandmaster it takes extra card plays.

## Files

- `Mincmistr_Print_and_Play.pdf`: the rulebook (4 pages) and card sheets (15 Plan cards, 3 reference cards, backs).
- `Mincmistr_Rules.md`: the rulebook text.
- `Mincmistr_Sample_Game.md`: two annotated rounds of a real simulated game.
- `mincmistr-source.zip`: `mincmistr.mjs` (rules as code), `simfinal.mjs`, `summarize.mjs`, `equiv.mjs`, `automa.mjs` and `base.json` (tuning lab), `print/` build scripts, and result files.

Reproduce a holdout cell with `node simfinal.mjs journeyman standard 24 h1,h2,h3,h4,h5,h6,h7,h8 out.jsonl && node summarize.mjs out.jsonl`. Run this from a folder that contains `engine/src`, copied from commit `0b28294`.

## Addendum: current engine, 16–17 Nov 2026

These runs use Kutná Hora Solo v1.1.1 (`0700c8d`) and rules 1.2.6–1.2.7. The scripts are in `exp/` and the raw results in `results/2026-11-17/`. Every comparison uses the same boards on both sides.

### Two-player results still hold

Against Standard on fresh seeds (`jg1–jg16`, 768 games), Journeyman scored 32.8% and −5.3, and Master 51.4% and −0.5. The original study measured 32.7% and −5.1, and 50.4% and −0.3. The newer engine (physical draws, mine entry, setup) did not change the Mincmistr's strength.

### Against the Planner rival (two players, `p1–p8`, 384 games each)

| Level | vs Planner | vs Standard (original study) |
|---|---|---|
| Apprentice | 14.3%, −11.2 ± 0.6 | 19.7%, −9.1 |
| Journeyman | 26.8%, −6.5 ± 0.6 | 32.7%, −5.1 |
| Master | 45.8%, −1.5 ± 0.6 | 50.4%, −0.3 |
| Grandmaster | 60.4%, +3.2 ± 0.6 | 71.0%, +5.5 |

Planner is about 1.5–2.5 points stronger than Standard at every level.

### Shared or separate Plan decks (Master, Standard in your seat, 576 games each)

| Players | Your wins, separate decks | Your wins, one shared deck | Change in your margin |
|---|---|---|---|
| 3 | 38.5% | 37.0% | +0.06 ± 0.58 |
| 4 | 26.2% | 25.7% | −0.28 ± 0.49 |

Sharing one deck makes no measurable difference, so rule 10's shared deck is fine.

### Proposals tested and rejected

In these tables, a positive change means your margin rose, so the Mincmistr got weaker.

| Proposal | Test | Fired | Change in your margin |
|---|---|---|---|
| Joker finish: final round, Joker as Plot and then Build | 2p Journeyman vs Standard, 768 games | 0.28/game | +0.27 ± 0.07 |
| | 2p Master vs Standard, 768 games | 0.31/game | +0.16 ± 0.09 |
| | 3p, rounds 3–6 doubled, vs Planner, 288 games | 0.77/game | +0.06 ± 0.18 |
| Yellow-set mine priority | 3p, rounds 3–6 doubled, vs Planner, 288 games | 0.06/game | −0.08 ± 0.06 |

The Joker finish costs reputation, last-round coins and a card play. A held right already scores 1 point at the end without being built.

### Low-effort option: Apprentice choices with the double last turn (rule 9, v1.2.7)

**Two players, 384 games each.** The table gives the Mincmistr's wins and margin.

| Setup | vs Standard (`jg1–jg8`) | vs Planner (`p1–p8`) |
|---|---|---|
| Journeyman | 29.7%, −5.8 | 26.8%, −6.5 |
| Apprentice, final two rounds | 29.7%, −6.6 | 24.5%, −7.5 |
| Apprentice, final three rounds | 31.8%, −5.1 | 32.6%, −5.7 |
| Master | 48.2%, −1.3 | 45.8%, −1.5 |
| Apprentice, final five rounds | 46.9%, −0.8 | not run |
| Apprentice, every round | 51.0%, +0.2 | 47.4%, −1.2 |

**Three and four players.** Standard took your seat for 576 games per setup (`mq1–mq8`, `mq1–mq6`), each Mincmistr with its own deck. The table gives the change in your margin over the strongest Mincmistr, on the same boards.

| Players | Final two vs Journeyman | Final three vs Journeyman | Every round vs Master |
|---|---|---|---|
| 3 | +1.35 ± 0.53 | −0.17 ± 0.54 | −0.53 ± 0.58 |
| 4 | +0.68 ± 0.41 | −0.84 ± 0.41 | +1.08 ± 0.46 |

GPT ran an independent study of 1,440 games: 72 games per cell, 36 boards, a shared deck, with both Standard and Planner in your seat. It found the final three rounds 3.1–3.6 points tougher than Journeyman at three and four players. It found the final two rounds within about 2 points of Journeyman, and every round within 1.5 points of Master. Both studies agree that every round plays like Master. On the final three rounds, the larger runs here show a smaller effect: about Journeyman at three players and 0.8 points tougher at four. Rule 9 therefore offers all three schedules. It describes the final three rounds as about Journeyman, a little tougher with three or four players, and the final two rounds as a gentler step.

### Checks

After rule 1.2.7:
- The tuning lab and the shipped code made the same decision at all four levels, with 0 mismatches in 445–521 decisions per level.
- The independent card-play flow check found 0 mismatches in 1,200 card plays.
- `npm test` passes all 46 tests.

The print-and-play PDF was **not** regenerated, because this environment has no PyMuPDF. Its rules pages still show v1.2.6 without the low-effort paragraph, and `npm run verify` will flag it until `mincmistr/print/build.py --pdf` is run.
