# Claude audit: Kutná Hora Solo v0.3.11 and Mincmistr v1.2.5

**15 November 2026 · Verdict: pass. I found no rules, save or release defect in the app or in the printed rules. One cosmetic layout defect carries over from v0.3.5, and one release check (the documented PDF rebuild) could not be run here.**

Both printed-rule findings from my v0.3.5 audit are fixed in v1.2.5, and the ambiguity I raised then (when Rights is "possible") is now answered in rule 6.1. The Mincmistr plays exactly as it did in v0.3.5: 60 matched games produce identical journals and scores under both versions. This is a bounded result, not a proof that every position is correct. Section 9 lists the gaps.

Evidence, scripts and importable positions are in [`audit/v0.3.11/`](../audit/v0.3.11/README.md). The audit changes no application source, shipped HTML or printed rules.

## 1. Exact release and sources

| Material | Reviewed version |
|---|---|
| Repository | `ramyahoo88/Kutn-_Hora_Solo` |
| Branch / commit | `v0.3.11-playtest` / `1cfde4513f5d214f284d90051e21e95336588590` |
| Git tree | `8b96f1a1bfb31cb520c0bbd38089d64f2be152c7` |
| App / save schema | v0.3.11 / schema 3, setup version 2 |
| Paper rules | Mincmistr v1.2.5, 15 Nov 2026 |
| Paper aids | Print-and-play PDF (8 pages), one-page table reference, mine choice aid, offline reference in the app |
| Base rules | CGE English *Rules of Play* |
| Changes since my last audit | v0.3.6–v0.3.11: "Why this move?" explanations with rule links, Plan change lists and round-end effects, playtest notes and reports with replay, deck export and import, the table reference, and rules v1.2.3–v1.2.5 |

**Release verification: PASS, with one check not run.**

| Check | Result |
|---|---|
| `node build.mjs /separate/path` then `cmp` | Byte-identical, 617,357 bytes, SHA-256 `d95e1896…f41eba` |
| `build.py --app-reference` then `cmp` | Byte-identical |
| Plan sprite re-cropped from the shipped PDF | Byte-identical (`d02c8395…e752`) |
| `build.py --refresh-copy` (the documented PDF rebuild) | **Not run.** It needs PyMuPDF, which is not installed here and could not be installed. |
| PDF content against its sources (`pdf-content-check.py`) | Pages 1–4 carry `rules.md` character for character, apart from 13 list numbers the layout adds. Page 7 carries every sentence of the three reference cards. All 15 Plan cards carry the current header. |
| `build.py --table-reference letter` and `a4` | One page each |
| `Mincmistr_Rules.md` vs `print/rules.md`; `export_cards.mjs` | Identical; `cards.json` unchanged |
| `node --test test/*.test.mjs` | 41/41 pass |
| `mincmistr/flowcheck.mjs`, `equiv.mjs` | 1,200 card plays and 2,109 decisions, 0 mismatches |
| `samplegame.mjs sample-12 2` | Byte-identical to `Mincmistr_Sample_Game.md` |
| `test/browser-smoke.mjs` (Chromium) | 10/10 pass |
| `test/rival-study.mjs` | Not rerun. `bot.mjs`, `prices.mjs` and `random.mjs` are unchanged since v0.3.5, where it reproduced every README figure. |
| `test/dom-smoke.mjs`, Firefox, WebKit | **Not run.** jsdom and those engines are not installed here. |

**Rendered pages read:** all eight PDF pages (rules pages at 110 dpi, card sheets at up to 150 dpi), covering the four rules pages, all 15 Plan fronts, the three reference cards and both back sheets. I also read the table reference PDF, the mine aid and table reference as printed from the app (Letter and A4, one page each), and the in-app review, journal and reference dialog. All 15 in-app Plan faces were screenshotted and matched to the correct crop of the PDF.

**Sources consulted:** the [CGE English rulebook](https://filemanager.czechgames.com/storage/files/kutna-hora-the-city-of-silver/rules/kutna-hora-rules-en.pdf), the [v1.2.5 rules](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/1cfde4513f5d214f284d90051e21e95336588590/mincmistr/Mincmistr_Rules.md), the reference cards, table reference and mine aid, my [v0.3.5 audit](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/claude-audit-v0.3.5/docs/Claude_Audit_v0.3.5.md), and the README's current rulings. As before, I read the CGE rulebook as extracted text, so I did not inspect its diagrams or printed tracks.

## 2. What should happen

I rechecked the base-rule points that v1.2.3–v1.2.5 newly state. The rulebook agrees with each of them:

- **Mine ties.** Players tied for a place each score that place in full.
- **St. Barbara tile 2.** It is a free Rights action, so it can take a public tile or a tile from one of the player's own guilds, never another guild's.
- **House rewards.** The free tile from a house applies to public buildings only.
- **Patricians.** Yellow pays 2 points for a mine in every row and 4 for two in every row. Silver pays 3 per pair of used pelicans. Green pays 1 per public neighbour of each owned building. Red pays 3 per column of removed houses.
- **Permits.** One permit fee moves up to two miners into the pool.
- **Limits.** Three plots and three building tiles.

For the Mincmistr, I updated my independent decision oracle (`scripts/oracle.mjs`) to the v1.2.5 text. Rule 6.5 now ranks public tiles by printed rewards, lets tile 2 fall back to the Mincmistr's own guilds, gives nothing for a house reward with no public tile, and breaks ties in market reading order. The oracle still imports nothing from `src/mincmistr.mjs` and computes town points, mine awards, edges and tie-breaks itself.

## 3. Status of earlier findings

| v0.3.5 item | Status in v0.3.11 |
|---|---|
| **P1** Rule 6.5 gave a house reward a guild tile | **Fixed.** Rule 6.5 and the Choices card now limit house rewards to public tiles and tile 2's fallback to own guilds. On the original P1 position the app takes nothing and explains why. Recast as a tile 2 right, the same market gives the Sawmill, never the Tavern (`results/free-right-cases.txt`). |
| **P2** No rule for a Mincmistr's guild set | **Fixed.** Rule 1.1: you choose first and the rest are dealt at random. |
| **P3** Mine labels split mid-word on phones | **Partly fixed.** See F1. |
| **A1** When Rights is "possible" | **Answered** in rule 6.1. |
| Q1–Q3 (rule shown, skipped bonuses explained, offline rules from the game) | **Done** through "Why this move?" and rule links. |
| Q10 wording, Q13 Chrome path | **Done.** |
| Q4, Q5, Q7, Q8, Q9, Q12, Q14 | Open. Carried into section 8. |

## 4. Confirmed findings

### F1 · Cosmetic · Board labels still split mid-word on phones

**Player impact.** On a phone, some town and mine labels break inside a word, such as "Reserv / ed plot", "Smelte / r", "Airshaf / t" and "Techn / ology". Nothing is hidden and play is unaffected.

**Expected behaviour.** Labels wrap between words, or hyphenate.

**Reproduction.** Run `scripts/wrap-check.mjs`, or open any late-game position at these widths:

| Width | 2 players | 4 players |
|---|---|---|
| 360 px | Brewery, Technology | Reserved, Smelter, Airshaft, Technology |
| 390 px | Technology | Reserved, Technology |
| 430 px | none | Technology |

**Observed.** `results/wrap-check.json` and `results/browser/phone-360-boards-4p.png`. The "Entrance" label from v0.3.5 no longer split in these checks.

**Source.** `src/style.css:192`: `.cell b { … overflow-wrap: anywhere; }`.

**Smallest fix.** Replace `overflow-wrap: anywhere` with `overflow-wrap: break-word; hyphens: auto;`. The page already declares `lang="en"`, so hyphenation works. Shortening "Reserved plot" to "Plot" and "Technology" to "Tech" below about 430 px would remove the remaining cases.

## 5. Ambiguous rulings and paper usability (not defects)

- **A1 · "Eligible" in rule 6.5 is not defined.** Rule 6.5, the Choices card and the table reference say "eligible public" and "eligible own-guild" rights. Rule 6.1 says its house and demand checks apply only when buying, so "eligible" must mean only "on offer and within the three-right limit". The app plays it that way: a free tile 2 right can be a guild tile the Mincmistr can no longer build. One clause in 6.5 would settle it, for example "eligible means on offer, with a rights slot free".
- **A2 · Two last tie-breaks need table order that setup never asks you to keep.** Rule 6.3 ends on "the earliest acquired right" and rule 6.4 on "the first tile drawn". In 240 simulated Mincmistr games at Master, the right order decided about 0.12 builds per game and the draw order about 0.33 tile choices per game (`results/last-tiebreaks.json`; estimates read from the app's own explanations). Suggested sentence for rule 1 or 6: "Keep its rights in the order it took them, and lay drawn mine tiles out in the order drawn."
- **A3 · Carried and unchanged:** the Ius Regale short stack, tile 8 overlapping a Grocer or Innkeeper build, and A Visit from the King doubling plot surcharges. I found no new published ruling.

## 6. What I tested directly

| Area | Scope and result |
|---|---|
| Independent v1.2.5 oracle vs shipped `playMincmistr` | 352 complete digital games covering all 22 configurations (2/3/4 players × 4 levels × shared or individual decks × tougher Master), half against a random human and half against Standard. **33,318 decisions and 22,864 card plays: 0 mismatches.** Every branch fired: 4.3 Construct 11,853 · 4.1 cash 4,971 · 4.3 Mine 4,161 · 4.2 pelicans 834 · 4.4 discard 384 · 4.4 Mine 239 · 4.3 St. Barbara 215 · 4.4 Income 207. Card plays per Mincmistr per round matched rule 9 in all 4,224 seat-rounds. 774 save round trips. |
| "Why this move?" labels | For all 22,864 card plays, the journal's rule label (4.1, 4.2, 4.3 with goal number, 4.4) and the named action card agree with the oracle. |
| Same play as v0.3.5 | 60 games (all table sizes and levels) played with the v0.3.5 sources and the v0.3.11 sources give identical journals and final scores. This supports the release note that v1.2.5 changes wording only. |
| Free rights (rule 6.5) | All 552 free rights in 180 games (511 house rewards, 41 tile 2) matched the printed rule, including 2 ties settled by market order. The rare branches did not occur naturally, so I built them from the v0.3.5 P1 position: house reward with no public tile, tile 2 with no public tile, and three rights held. All three behave as printed. |
| Engine fuzz with independent scoring | 240 games (80 per table size) with Standard, Quick, Mincmistr and Planner rivals. 29,596 steps, 2,584 `checkGame` validations, 2,160 round-end council scorings and all 240 final scores and winners recomputed independently. **0 discrepancies, 0 input-state mutations.** |
| Past fixes and nearby cases | Third-row rewards and the top-row contrast, long seeds (52, 53, 64, 65 characters), tile 9 reserve-then-pool, reputation floor, Ius Regale with 3, 7 and 0 tiles, tile 7 overflow, edge against the best opponent with a nearby flip, v0.1.0 migration, and Master and tougher card totals. All 9 groups pass. |
| Full games through the shipped controls (Chromium) | Three games played only with on-page buttons (2-player Master, 4-player Standard with events, 3-player Grandmaster with individual decks). Final tables equal the engine result. Undo restored the exact prior position. |
| Plan review vs applied result | Two more full games (2-player Master, 4-player Grandmaster) using **Play one Plan** for every Mincmistr card: 123 Plans reviewed. For the 116 without round-end effects, the "Changed by this Plan" list and the marked spaces equal an independent diff of the saved positions. 0 differences. |
| Playtest report | Note survives reload and export. The report records app v0.3.11, rules v1.2.5 and the earlier position. In a fresh browser profile, **Load position before this step** then **Play one Plan** reproduces the reported position exactly, and Undo returns to the import. |
| Rule links | In the tested review, each cited rule (2, 4.1, 4.2, 5.1, 6.2) opened the offline reference with that rule focused and in view. The reference has 26 rule anchors, including every rule number the explanations can cite. |
| Draw only | Deck export after a reshuffle imports into a second profile with the same deck and the same next draw. A game save offered as a deck, and a deck offered as a game, are both refused with a clear message and change nothing. Undo depth after reload is 5. All 15 Plan faces match the PDF. |
| Save protection | Stale-tab New game refused. Startup read failure, a corrupt save and a corrupt deck are each preserved until an explicit replacement. Recovery after another tab clears storage works. |
| Explanation limits | Across 7,920 explained Plans the longest explanation has 12 lines against a cap of 32, and the longest line is 188 characters against a save limit of 300. No explanation can be truncated or make a save unreadable in normal play. |
| Hidden information | Standard, Quick and Planner made the same decision in all 548 positions under two perturbations of concealed state each. The Mincmistr's own moves were identical in all 526 positions; the 4 journal differences are the next round's revealed event. |
| Layout and print | No horizontal overflow at 360 px or 390 px in the digital game, the open journal, the review with explanations or any reference tab. The table reference and mine aid each print on one page at Letter and A4. |
| README checks | The `silver-1308` and `app-table-3` setups, the market-expansion and round-end fixtures, the Ius Regale fixture and the Grandmaster card counts all behave as written (`results/readme-claims.json`). |

## 7. Purposeful play, difficulty and workload

**Strategies.** A human-seat challenger played against the shipped Mincmistr on matched seeds, rotating the starting player. Each cell has 48 games in two batches of 24 on new seeds, 1,536 games in all. The table shows human outright wins and the mean margin against the best Mincmistr.

| Challenger | 2p vs Journeyman | 2p vs Master | 4p vs Journeyman | 4p vs Master |
|---|---:|---:|---:|---:|
| Standard | 26/48 · +2.1 | 20/48 · −1.9 | 14/48 · −3.2 | 11/48 · −7.4 |
| Quick | 18/48 · −3.0 | 8/48 · −9.3 | 7/48 · −7.5 | 2/48 · −13.6 |
| Builder | 21/48 · −2.4 | 12/48 · −7.8 | 23/48 · −0.5 | 11/48 · −6.0 |
| Miner | 25/48 · −0.4 | 18/48 · −5.2 | 11/48 · −7.1 | 4/48 · −10.9 |
| Council | 24/48 · +0.7 | 15/48 · −3.9 | 19/48 · −0.9 | 9/48 · −6.5 |
| Denial | 23/48 · −1.0 | 14/48 · −7.3 | 16/48 · −2.1 | 7/48 · −8.2 |
| Tax dodge | 15/48 · −3.8 | 6/48 · −10.2 | 9/48 · −9.1 | 2/48 · −15.2 |
| Random legal | 0/48 · −39.2 | 0/48 · −43.2 | 0/48 · −36.9 | 0/48 · −44.7 |

- **One promising result did not survive fresh seeds.** At four players, Builder had a better margin than Standard in both batches. I reran both on 24 new seeds (96 games each): Standard won 40/96 at −1.66 and Builder 26/96 at −4.72. The paired difference is −3.06 VP for Builder, with a 95% interval of −5.07 to −1.03. Builder is not an exploit.
- **No repeatable way to farm the Mincmistr.** Declining every tax bill was worse than Standard in every cell. The Mincmistr spends 0.03–0.04 cards per game for no effect at Journeyman and 0.46 at Master. In a 40-game check, all 16 of Master's no-effect cards came on its doubled last turn.
- **Difficulty.** Pooled with my v0.3.5 run (same Mincmistr behaviour), Standard has won 60/96 against one Journeyman, 43/96 against one Master, 79/192 against three Journeymen and 23/96 against three Masters. The rules no longer print strength figures; the README's are 67%, 50%, 48% and 25% for the same matchups. Three agree within sampling error. The four-player Journeyman figure is lower here (41% against 48%), which may come from my harness always putting the challenger in the first seat, or from chance.
- **Limits.** These are scripted policies sharing the legal-move engine. Cells of 48 games carry roughly ±14 percentage points.

**Tabletop workload per Mincmistr per game** (Standard in your seat, 8 seeds per row, `results/workload.json`):

| Table / level | Plan flips | Bonus steps | Taxes | Mine placements (rows compared) | Plots (plot × right checks) | Builds (options) | Builds decided by arrow |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2p Journeyman | 30 | 9.1 | 4.8 | 6.4 (2.1) | 5.8 (7.9) | 5.3 (1.6) | 43% |
| 2p Master | 33 | 9.3 | 4.8 | 6.3 (2.1) | 6.4 (8.1) | 5.8 (1.8) | 46% |
| 3p Master | 33 | 9.7 | 4.4 | 6.8 (2.6) | 6.5 (9.0) | 6.1 (1.8) | 48% |
| 4p Master | 28 | 8.3 | 4.3 | 5.4 (2.6) | 5.2 (10.1) | 4.7 (1.9) | 42% |

The routine is unchanged from v0.3.5: one flip per card and no tracking beyond a normal player's pieces, apart from the two orderings in A2. Plot scoring remains the heaviest recurring lookup.

## 8. Optional quality-of-life improvements (untested suggestions)

**Digital app**

- **Q1. Tidy the free-right explanation.** It reads "Best Printed VP + 2 × pelicans granted + 2 × reputation granted (8 vs 6). Printed VP + … 8." A short label such as "reward value" would say the same in a third of the space (`src/mincmistr.mjs:298`).
- **Q2. State the cash check when it fires.** When rule 4.1 succeeds, "Why this move?" starts at the Income line. A first line such as "Has 2 g, fewer than 20" would match what it shows when the check fails. The successful pelican check (4.2) already has its line.
- **Q3. Auto-pay a zero tax bill** (carried). When your own bill is 0 g but another player's is not, you still choose between "Pay 0 g" and losing reputation.
- **Q4. Mention in the Guide that Undo after New game restores the previous game** (carried).
- **Q5.** Fix F1.

**Draw only**

- **Q6. Optional seat tags** for two or three paper Mincmistrs, so the recent strip shows who drew each Plan (carried).
- **Q7. Separate deck slots** for rule 10's one-deck-per-Mincmistr option (carried).

**Paper**

- **Q8.** Add the A1 and A2 sentences in the next rules revision.
- **Q9. Put the mine choice aid and table reference in the PDF** (carried). Both are printable only from the app, or by script for the table reference.

**Tooling and documents**

- **Q10. Make the PDF reproducible from source alone.** The v1.2.5 PDF is built by patching the previous release's PDF, so verifying it needs that older file and PyMuPDF. A pinned `requirements.txt`, or card sheets kept as their own source file, would let anyone rebuild and compare it. `scripts/pdf-content-check.py` is a stopgap that needs only Poppler.
- **Q11. Add a `package.json`** with pinned jsdom and Playwright and `test`, `smoke`, `build` and `verify` scripts, plus CI (carried).
- **Q12. Refresh stale version notes.** `Mincmistr_Sim_Report.md` and its print copy are headed "rules version 1.2.2"; keep that as the version tested and add a note linking to the current rules. `src/data.mjs:13` and `mincmistr/mincmistr.mjs:1` say v1.2.2. `mincmistr/README.md` still says it was developed against v0.3.0. `src/mincmistr.mjs:283` cites a rule 6.7 that does not exist. The root README links only the v0.3.4 audit.

## 9. Coverage gaps

- **PDF rebuild.** I could not run `build.py --refresh-copy`, so the PDF is verified by content and by eye, not by regeneration.
- **Base-rule sources.** The CGE rulebook was read as extracted text. I did not recheck board images, price-card cells, setup cards, rock layouts or printed tracks against components. Those rest on earlier audits.
- **Browsers.** Chromium only. No Firefox, WebKit, Safari or iPhone run, and no jsdom DOM smoke.
- **Physical play.** No print, duplex or cutting trial and no human tabletop session. Workload figures are counts, not minutes.
- **Opponents.** Legal-move generation is shared by every simulation. My oracle and scorer reduce that dependency but do not remove it. Capek was not compared.
- **Round-end reviews.** For the 7 reviewed Plans that also ended a round, I did not independently diff the split between Plan changes and round-end effects. The repository's own smoke test covers one such fixture.

## Release verdict

**App v0.3.11: pass.** The shipped HTML rebuilds byte for byte and every repository check I could run passes. An independent v1.2.5 oracle agrees with the shipped Mincmistr on 33,318 decisions and on all 22,864 rule labels. Independent scoring agrees on 240 complete games. Five full games through the real controls ended correctly, with every compared Plan review matching the applied result. Reports replay exactly, decks move between devices, and the save protections hold. The only confirmed defect is cosmetic (F1).

**Paper Mincmistr v1.2.5: pass.** Both v0.3.5 rule findings are fixed, the new wording agrees with the base rulebook on every point I checked, and the PDF, cards and aids match their sources and the app. A1 and A2 are small clarifications for the next revision, not blockers.

**Priority order:** F1 → A2 → A1 → Q10 → Q12 → Q1–Q3 → remaining suggestions.
