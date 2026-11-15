# Kutná Hora Solo v0.3.0 playtest: rules and release audit

**Audited:** `ramyahoo88/Kutn-_Hora_Solo`, branch `v0.3.0-playtest` at `0b28294` ("Add up to three rivals and revise rival planning"). It builds on `v0.2.3-playtest` (`f1ff79c`) and `def9312`. Shipped `Kutna_Hora_Solo.html`, SHA-256 `fcf038d05379993a74ce4577ba65d6a0f80c32c938455df60d0e640a69266ae8`. Node 22.23.4, Chromium (Playwright). Audit date: 15 Nov 2026.

## Release verdict

**Ready for playtesting with one, two or three rivals. I found no confirmed defects.**

- **3–4 player rules match printed sources.** Every rule and component the code encodes for 3–4 players matches a printed source: rounds, red-building timing, council rounds, reputation losses, guild setup rows, the large town and mine boards, edge villages, all 15 rock layouts, mine rank awards and ties, starting groschen and optional events.
- **The app holds up under testing.** The shipped page reproduces from source, all tests pass, and full 2-, 3- and 4-player games run through the app's controls. Saves from v0.2.2 and v0.2.3 load unchanged as 2-player games.
- **The revised rival is stronger** on fresh seeds and plays more like a person on taxes and rights, as claimed. It uses only public information.

**Before release:** human playtests at 2–4 players and a Safari check are still open. Then merge to `main` and tag.

| Check | Result |
| --- | --- |
| Byte-for-byte rebuild | Pass |
| Tests | 27/27 pass |
| GPT's rival study | Reproduced exactly: 29/48, +2.98 VP |
| Same study on fresh seeds | 30/48, +3.25 VP |
| `classic` policy = v0.2.3 rival | 797/797 decisions identical, 9/9 final scores identical |
| Fuzzed full games (2/3/4 players) | 450 games, 54,180 transitions, 0 invalid states |
| Preview vs applied | 138,250 actions, 0 mismatches |
| Rival information boundary (3–4 players) | 244 decisions, 0 changed |
| v0.2.2 and v0.2.3 saves | 1,064 positions load unchanged; 48 played on to a valid end |
| README playtest checks in the app | All pass in Chromium |
| Four-player skips vs the average legal alternative | −1.80 VP (SE 0.70) over 52 saved positions |

## 1. Release verification

| Check | Command | Result |
| --- | --- | --- |
| Rebuild to a separate path | `node build.mjs /home/claude/audit/rebuilt-030.html` | Written |
| Byte comparison | `cmp rebuilt-030.html Kutna_Hora_Solo.html` | **Identical** |
| Working tree | `git status --short` | Clean |
| Tests | `node --test test/*.test.mjs` | 27 pass, 0 fail |
| README study | `node test/rival-study.mjs 12 v030-check` | Every figure in the README table reproduced. 3-player Standard: 5/12, −2.17. 4-player: 6/12, +1.50. |

## 2. What should happen at 3 and 4 players (established before reading the code)

| Rule | Source | 3 players | 4 players | App |
| --- | --- | --- | --- | --- |
| Rounds | Rulebook, Rounds Track | 6 | 5 | Match |
| Red-patrician buildings enter | Rulebook, Red-Patrician Buildings | after round 3 | after round 2 | Match |
| Council scores | Rulebook, Patrician Scoring | rounds 4–6 | rounds 3–5 | Match ("Scoring rounds 3–5" shown) |
| Reputation loss in lieu of tax | Rounds track, via ludex | 1,1,1,2,2,3 | 1,1,2,2,3 | Match |
| Patricians | Rulebook | 3 per colour | 3 per colour | Match |
| Events | Rulebook | optional | optional | Off by default. With events on: 3 A + 2 B (3p), 2 A + 2 B (4p), final round empty. |
| Starting groschen | Rulebook p.6 art | 40/41/42 from the starter | 40/41/42/43 | Match for every starting seat |
| Guild sets | CGE companion, rows for 3 and 4 players | 3 sets of 3, guilds shared | 4 sets of 3, each guild twice | All 9 cards × 2 counts match |
| Town | Ludex 4-player setup render | 6 × 5 = 30 squares | same | Match |
| Edge villages | Same render | yellow F1, silver F2, red A3 and F3, yellow A4, silver A5 | same | Match (`largeEdge`) |
| Mine board | Same render | 7 columns × 4 rows, entrances B1 and F1 | same | Match |
| Rock layouts | Printed mine setup cards, bottom (3/4-player) grid | 15 layouts | same | All 15 match `largeRocks` |
| Mine row awards | Large-board labels | 0–5★ 2/1/0, 6–9★ 3/2/1, 10+★ 5/3/2 | same | Match |
| Mine ties | Rulebook, Final Scoring | Tied players take the full place value; places are used up | same | Match (probes below) |

**Mine-rank probes** (`multi_rules.mjs`):

| Players | Stars by seat (rocks) | VP | Rule |
| --- | --- | --- | --- |
| 4 | 3,3,1,0 | 3,3,1,0 | Two tie for first; the next is third |
| 4 | 5,2,2,1 | 5,3,3,0 | Tie for second and third gets second; nobody gets third or fourth |
| 3 | 2,2,2 | 3,3,3 | Three-way tie for first |
| 3 | 1,1,0 (+3 rock) | 2,2,0 | Rock stars count toward the 0–5 total |

**Shared guilds:** on 3-player Card 1, both Metallurgists seats may take Smelter rights and the third seat may not. A three-way tie on both VP and groschen is resolved as shared first place: `winners [0,1]`, `winner null`.

## 3. Materials players receive (tested in the shipped page)

All of this was run through the app's own controls in Chromium (`browser_playtest_steps.py`).

**One rival, default game:** rival rows show Builders · Grocers · Scribes, as the README says.

**Two rivals (README check: Card 6, seed `app-table-3`):**

- Three players on the 30-square town and 28-space mine, with coins 40/41/42 and no events.
- The board reads "Round 1 of 6" and "Red public buildings enter after round 3."
- Each rival's cards are shown.
- A full game through the controls ended after round 6, with red buildings entering after round 3.

**Three rivals (README check: Card 6, Rival 1 starts, seed `app-table-4`):**

- Coins were 43/40/41/42 (you, then Rivals 1–3), with Rival 1 starting on 40.
- **Play rivals** ran Rival 1, Rival 2 and Rival 3 in order, then stopped at your turn (turn 3).
- Undo restored the exact pre-rivals position. Reload kept the position, and export then import was identical.
- A full game ended after round 5, with red buildings after round 2.
- The final scoring table shows all four seats.

**Three rivals with events:** the game showed Silver Fever and Cathedral Construction (A), then Michal and Abbot (B), and played to its end.

**Phone width:** at 390 px with a 4-player save there is no horizontal overflow. No console errors in any run.

## 4. Simulations and the rival

**Fuzz** (`multi_checks.mjs`): 150 random-legal games at each count, with `checkGame` after every step and save round trips every 9th step.

| Players | Steps | Errors | Rounds | Red entered after | Tax-order checks |
| --- | ---: | ---: | ---: | ---: | --- |
| 2 | 13,036 | 0 | 6 | 3 | 1,646 correct |
| 3 | 19,553 | 0 | 6 | 3 | 2,592 correct |
| 4 | 21,591 | 0 | 5 | 2 | 2,888 correct |

**Information boundary:**

- **The new reply model** (`forecastNextCard`) reads only the next player's open hand, coins and the board.
- **The seed-based variety** (`variation`) uses the public game seed to break near-ties. It never reads deck order.
- **Scrambled re-runs:** at 3–4 players, I re-ran 244 rival decisions with RNG, deck orders, stack orders under the top tiles, future events and red order all scrambled. No decision changed.

**Old saves** (`compat.mjs`): 1,064 positions saved by v0.2.2 and v0.2.3 load in v0.3.0.

- All are identical apart from the schema bump, and all keep their guild rows.
- 48 were played on to a valid end.
- The v0.2.0 house-row save and the Ius Regale fixture both load as 2-player games.

**Is the comparison baseline genuine?** v0.3.0's `classic` policy and v0.2.3's Standard made the same choice at all 797 decisions in 9 matched 2-player games, and the final scores were identical.

**Fresh-seed confirmation** (`node test/rival-study.mjs 12 audit-fresh-nov15`):

| Measure | v0.2.3 policy | Revised Standard |
| --- | ---: | ---: |
| Wins / mean margin | 24/48, 0 | **30/48, +3.25** |
| Affordable tax bills declined | 82 / 218 | **15 / 216** |
| Mean final reputation | −0.69 | 3.98 |
| Unused rights | 1.83 | 0.90 |
| Unused plots | 0.94 | 0.63 |
| Distinct first rounds | 16 | 22 |
| Cards for no effect | 0.15 | 0.19 |

- **3-player tables:** Standard won 7/12, +2.58.
- **4-player tables:** Standard won 9/12, +0.17.

**Scripted human-style strategies against the new Standard** (12 seeds × both seats):

| Strategy | Script wins | Mean margin |
| --- | ---: | ---: |
| Greedy builder | 0/24 | −20.6 |
| Mine rush | 1/24 | −17.9 |
| Never pay tax | 0/24 | −23.5 |
| Plot blocking | 0/24 | −20.3 |
| Pelicans and public buildings | 1/24 | −26.6 |

I found no exploit.

**Behaviour profile against the v0.2.2 profile** (30 games, same seeds):

| Measure | v0.2.2 | v0.3.0 |
| --- | ---: | ---: |
| Affordable taxes declined | 54 | 15 |
| Final reputation | −1.4 | 2.5 |
| Rights held at end | 2.0 | 1.2 |
| Distinct first rounds | 14 | 21 |
| Guild and public buildings | 3.1 + 0.8 | 2.9 + 0.9 |
| Council seats per game | 0.5 | 0.6 |
| Cards for no effect | 0.1 | 0.5 |

**Cards played for no effect:** 90 of 6,000 rival cards across 2/3/4-player games (1.0%, 1.1% and 2.2%). They are mostly mid-game, and in 77 of the 90 a Build was legal.

**Four-player skip traces** ([`audit/v0.3.0/skip-traces/`](../audit/v0.3.0/skip-traces/)): every one of the 52 four-player skips is saved as an importable position. Every legal option at that position was played to the end with Standard at all seats.

| Comparison (one continuation per option) | Result |
| --- | --- |
| Skip vs the average legal alternative | **−1.80 VP** (standard error 0.70). Below average in 29 of 51 positions, above in 22. |
| Skip's rank among all options | Median percentile 0.45. Bottom quarter in 16 positions, top quarter in 8. |
| Skip vs the best alternative | −9.25 VP (24.75 vs 34.00). An alternative scored higher in 49 of 52. |
| Skip vs the highest-scoring Build | −5.45 VP. The skip was better in 7 of 42. |
| Spread of outcomes between options in one position | About 3.8 VP standard deviation |

**Correction to the first version of this report.**

- **What I said:** after tracing four skips against the first legal Build only (an expensive public building), I said the skips were "value judgements, not a planning fault".
- **What the full traces show:**
  - The skip did beat that Build in those four positions.
  - A Rights or Income action beat the skip in three of them: case 2 (Ore Market rights) by 2 VP, case 3 (Sawmill rights) by 4 VP, and case 4 (Income) by 1 VP.
  - Across all 52, a skip costs about 1.8 VP against a typical alternative.
- **What it amounts to:** about 1 VP per rival per game at 4 players. Small, but a real target for the next planner.
- **How to read the numbers:**
  - The 9 VP gap to the best alternative is mostly the effect of picking the highest of 2–80 noisy outcomes.
  - Each option's score comes from one deterministic continuation using the real hidden decks. It is a hindsight comparison, not an expected value.

## 5. Findings

**Confirmed defects:** none.

**Ruling questions** (unchanged and documented): Ius Regale with a short stack, and St. Barbara tile 8 overlapping a Grocer or Innkeeper build.

**Optional improvements:**

- **O1. Rivals don't choose guild sets or rows.** Sets and rows are assigned by seed, while the printed setup has players choose sets in reverse turn order. At 3–4 players guilds are shared, so who holds which shared guild matters more than before. A rival choice, even a simple one such as preferring sets that share fewer guilds with yours, would be more faithful. The README already documents the current behaviour.
- **O2. The rival still builds little.** It completes about four buildings and seats about 0.6 patricians per game. Taxes and rights improved, but construction and council play did not. That is the remaining gap if the goal is human-like play.
- **O3. Mid-game skips at 4 players cost about 1.8 VP each** against a typical alternative (section 4). They are not a rules fault. The 52 saved positions in `audit/v0.3.0/skip-traces/` and `skip_regression.mjs` give the next planner a regression set: judge the planner by the value of its chosen move against the alternatives, not by the pass count.
- **O4. Noisy README figure.** The README's "cards played for no effect" figure (0.31 → 0.56) did not repeat on fresh seeds (0.15 → 0.19). Calling it within noise would be more accurate. Per-game records of the fresh-seed run are in `audit/v0.3.0/fresh-seeds.json`.

## 6. Priorities and coverage gaps

**Priorities:**

1. Human playtests with one, two and three rivals, plus the Safari check.
2. Merge and tag.
3. O1 and O2 for a later rival revision.

**Not covered:**

- Safari and Firefox (Chromium only).
- Human play at any table size.
- Tabletop mirroring of 3–4-player boards.
- The large board was checked against ludex's flat setup render, not a CGE photo.
- Pelican token supply limits at 4 players were not checked.

**Evidence:** all scripts and data from this audit are in [`audit/v0.3.0/`](../audit/v0.3.0/), with a README. That includes the fresh-seed list (`fresh-seeds.json`) and the 52 four-player skip positions with every alternative scored (`skip-traces/`).

## Sources

- [CGE rulebook (EN)](https://filemanager.czechgames.com/storage/files/kutna-hora-the-city-of-silver/rules/kutna-hora-rules-en.pdf)
- [CGE companion](https://kutnahora.czechgames.com/)
- [ludex: setup](https://www.ludex.dev/kutna-hora/setup/), [end of round](https://www.ludex.dev/kutna-hora/end-of-round/), [cards and components](https://www.ludex.dev/kutna-hora/cards/)
