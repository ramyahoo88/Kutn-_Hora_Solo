# Claude audit: Kutná Hora Solo v0.3.5 and Mincmistr v1.2.2

**15 November 2026 · Verdict: pass for playtesting and for wider release of the app. The paper rules pass for physical playtesting. Two small text fixes are recommended for the next rules revision.**

I found **no rules, save or release defect in the app**. The three defects from the v0.3.4 audit are fixed, and each fix and a nearby case were verified in Chromium. I confirmed **two low-severity defects in the printed Mincmistr rules** (P1, P2) and **one cosmetic layout defect** (P3). This is a bounded result, not a proof that every position is correct. Section 9 lists the gaps.

Evidence, scripts and importable positions are in [`audit/v0.3.5/`](../audit/v0.3.5/README.md). The audit changes no application source, shipped HTML or printed rules.

## 1. Exact release and sources

| Material | Reviewed version |
|---|---|
| Repository | `ramyahoo88/Kutn-_Hora_Solo` |
| Branch / commit | `v0.3.5-playtest` / `6a6f00e4fe9c6bce205ee55df8d0291023c6b00b` |
| Git tree | `b1b5487fba9e7e26888030313d0553efd0e322bd` |
| App / save schema | v0.3.5 / schema 3, setup version 2 |
| Paper rules | Mincmistr v1.2.2, 15 Nov 2026 (PDF unchanged since the v0.3.4 audit: same SHA-256) |
| New paper aids in v0.3.5 | `mincmistr/print/mine-aid.md`, `mincmistr/print/app-reference.html` (offline reference in Draw only) |
| Base rules | CGE English *Rules of Play* (20 pp.) |
| Variants | Mincmistr levels, tougher three-player Master, shared or individual Plan decks, optional events at 3–4 players, the README's documented rulings |

**Release verification: PASS.**

| Check | Result |
|---|---|
| `node build.mjs /separate/path` then `cmp` | Byte-identical, 583,454 bytes, SHA-256 `117eccb1…0a56f8` |
| `build.py --app-reference` then `cmp` | Byte-identical |
| Plan sprite re-cropped from the shipped PDF | Byte-identical (`d440fa80…76a2`) |
| PDF rebuilt from `rules.md` + `cards.json` | All 8 pages: identical extracted text and identical pixels at 60 dpi. Byte comparison is impossible because Chrome embeds the creation time. |
| `export_cards.mjs` | `cards.json` unchanged |
| `node --test test/*.test.mjs` | 38/38 pass |
| `test/browser-smoke.mjs` (Chromium) | 6/6 pass |
| `mincmistr/equiv.mjs`, `flowcheck.mjs` | 2,109 and 1,200 decisions, 0 mismatches |
| `samplegame.mjs sample-12 2` | Byte-identical to `Mincmistr_Sample_Game.md` |
| `test/rival-study.mjs 12 v030-check` | Reproduces every figure in the README's v0.3.0 study table |
| Standard and Quick vs v0.3.0 source | 24 complete games identical, so the published strength tables still use the same baseline |
| `test/dom-smoke.mjs`, Firefox, WebKit | **Not run.** jsdom and those engines could not be installed here. |

**Rendered pages read:** all eight PDF pages at 110 dpi: the four rules pages, all 15 Plan fronts, the three reference cards and both back sheets. I also read the printed mine aid (Letter and A4, one page each) and the in-app Plan text, reference dialog and Guide. All 15 in-app Plan faces were screenshotted in Draw only and matched to the correct crop of the PDF sprite.

**Sources consulted:** the [CGE English rulebook](https://filemanager.czechgames.com/storage/files/kutna-hora-the-city-of-silver/rules/kutna-hora-rules-en.pdf) (round structure, Income and patricians, Joker, mine action and permits, technology, St. Barbara tiles 1–11, taxes, guild-set choice, house effects, end scoring), the [v1.2.2 rules](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/6a6f00e4fe9c6bce205ee55df8d0291023c6b00b/mincmistr/Mincmistr_Rules.md), the reference cards and mine aid, the [Astra v0.3.4 audit](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/c6149d3350981c5507b3ca7279c579d9e767d5f6/docs/Astra_Audit_v0.3.4.md), the [Claude v0.3.0 audit](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/3895edf54ded43857156d0fc148c5c43b6c1c9e6/docs/Claude_Audit_v0.3.0.md), and the README's current rulings. **Limit:** the workspace proxy refused a direct download of the CGE PDF. I read it through a text-extraction fetch, so I did not inspect its diagrams, board images or the printed rounds and reputation tracks (section 9).

## 2. What should happen

I derived the expected behaviour from the printed text before checking the matching code. The main expectations:

- **Turn structure.** Each player plays 2, 2 and 1 cards per round (5 of 6). Four players play 5 rounds; two and three players play 6. Red buildings arrive after round 2 or 3. The council scores in the last three rounds, after taxes.
- **Mincmistr card play, rules 4–7.** Flip, then check cash (<20 g → Income), then pelicans (2+, or 1 on tiles 6, 7, 8, 9 or 11 → St. Barbara), then the Plan goals in order, then the Income → Mine → discard fallbacks. Use the leftmost row card that shows the action; never the Joker.
- **Choices, rule 6.** Rights: buildable own-guild tiles only, highest production × price, then cheaper, higher row, further left. Plot: most town points for a held right, then cheaper, then arrow. Build: most production (public = 0), then most town points, then arrow, then the earliest right. Mine: keep stars + ore + VP, ties more stars then first drawn; place for the largest award gain, then cheapest, then fewest own mines in the row, then arrow. Bonuses as rule 6.5. Income seats the largest edge ≥ 1 against the **best** opponent.
- **Rule 9.** Master doubles the last turn in rounds 4–6, or 3–5 at four players. Tougher three-player Master adds round 3. Grandmaster doubles every round.
- **Base-rule anchors quoted from the rulebook:** "Patrician tokens are limited to 3 of each color." A permit is required only when the pool is empty, and "You are allowed to pay full price to add only 1 miner." Tile 9 and technology mines use miners outside the pool; a pool miner is used "only when there are no others left on your board." Players choose guild sets "in reverse order… starting with the last player". "The house effect that lets you take a building tile for free only applies to public buildings."

I wrote an **independent decision oracle** from rules 2, 4–7 and 9 (`scripts/oracle.mjs`). It imports neither `src/mincmistr.mjs` nor its helpers. It uses the engine only for legal moves and for lookups of printed prices, construction limits and market positions. It computes town points, mine awards, council edges and tie-breaks itself. I also wrote an independent scorer for council points, final scores and winners (`scripts/fuzz.mjs`).

## 3. Confirmed findings

Severity reflects player impact. None of these blocks playtesting.

### P1 · Low · Printed rule 6.5 gives the paper Mincmistr a guild tile from a public-only house reward

**Player impact.** In rare games the tabletop Mincmistr takes a free right that no player could take. It is not even limited to its own guilds. The app does the right thing, so app and paper play diverge in that position. Frequency: 1 of 486 house-row free rights (0.2%) in 180 simulated games, all table sizes.

**Rule.** Base game: "The house effect that lets you take a building tile for free only applies to public buildings." Mincmistr rule 6.5 says: "Free building right (from a house row or St. Barbara): the public tile with the highest… If no public tile is offered, it takes the guild tile with the highest income value." The fallback applies to both sources and does not say "its own guilds."

**Reproduction.** Import `audit/v0.3.5/positions/House_Right_No_Public_Card_Play.json`. This is a four-player Master game with seed `hr-4-22`, Card 5 and events on, in round 5 with Rival 1 to act. Press **Play one Plan**. Rival 1 flips Plan 7 and builds the Butcher's at B4, its third Grocer house. That house's printed reward is a free public right, but the offer holds only Airshaft, Sawmill and Tavern.

- **Expected (base rules):** no tile is taken.
- **Observed in the app:** correct. Rival 1 still holds only the Hospital, and the review shows only "Built Butcher's at town B4 for 24 g."
- **Observed following the printed rule literally:** take the Tavern (2 × 7 g = 14). The Innkeepers are not its guild. Read as "own guild," it would take the Sawmill (9).

`node audit/v0.3.5/scripts/p1-assert.mjs` asserts all of this on `House_Right_No_Public_Pending.json`.

**Source.** `mincmistr/Mincmistr_Rules.md:116`. The identical `mincmistr/print/rules.md:116` feeds the PDF (page 2–3) and the offline reference. The app restricts house rewards correctly at `src/engine.mjs:268` and `:496`, and resolves them at `src/mincmistr.mjs:185–190`.

**Smallest fix (rules text only).** Replace the last sentence with: "If the right comes from St. Barbara tile 2 and no public tile is offered, it takes the tile from **its own guilds** with the highest income value. A house-row right is public only. If none is offered, it takes nothing." No code change is needed.

### P2 · Low · The paper rules do not say how a Mincmistr gets its guild set

**Player impact.** At setup, a tabletop player has to improvise. The base game has players choose sets in reverse turn order. So when you are the starting player, every Mincmistr chooses before you, and the rules give no choice procedure. Different tables will resolve this differently, and the published strength figures assume the app's method.

**Rule / expected behaviour.** Rule 1.1 says "Give the Mincmistr everything a player receives: a guild set…" and rule 10 says "Give each Mincmistr a player's components." Neither says how the set is picked. The app's method: you choose your set from the setup card first, and the seed deals each remaining set once (`src/engine.mjs:96–98`). All strength results in rule 12 and the README use that method.

**Reproduction (tabletop).** Two players, setup card 1, you start. Rule 1 does not say whether you pick first or how the Mincmistr picks.

**Source.** `mincmistr/Mincmistr_Rules.md:19` and `:167`.

**Smallest fix.** Add to rule 1.1: "You choose your guild set first. Deal the remaining sets to the Mincmistrs at random." Optionally note that this differs from the base game's reverse-order choice.

### P3 · Cosmetic · Mine-board labels break mid-word at 390 px on the larger boards

**Player impact.** On a phone at three or four players, the entrance cells read "Entran / ce." Nothing is hidden, and play is unaffected.

**Reproduction.** Use a 390 × 844 viewport and import any three- or four-player game. Cells B1 and F1 of the Mines panel break mid-word (`results/browser/phone-mines.png`). The two-player 5-column board was not affected in the screenshots taken.

**Source.** `src/style.css:178` (`.cell b { … overflow-wrap: anywhere; }`) with the label from `src/app.mjs:550`.

**Smallest fix.** Use `overflow-wrap: break-word; hyphens: auto;` for `.cell b`. Alternatively, shorten the mine label to "Entry" below about 420 px.

## 4. Ambiguous rulings (questions, not defects)

- **A1 · When is Rights "possible" for the Mincmistr?** Rule 2 defines "not possible" as illegal or unaffordable. Rule 6.1 then forbids every legal choice when no buildable own-guild tile is on offer, because buying a public tile would be legal. The app and my oracle both treat Rights as not possible and continue to the next check. Suggest adding to 6.1: "If no tile qualifies, Rights is not possible."
- **A2 · Carried from earlier audits and unchanged:** the Ius Regale short stack and St. Barbara tile 8 overlapping a Grocer or Innkeeper build (README rulings). I found no new published ruling.
- **A3 · A Visit from the King doubles plot surcharges as well as the tax rate** (`src/engine.mjs:390`). That is a reasonable reading of "Double taxes for this round." I did not verify it against the card face.

Rulings I rechecked and found consistent with the rulebook text:

- Topping up a one-miner pool at full permit price.
- Tile 9 and technology mines taking reserve miners first, falling back to the pool only when no others remain.
- Ties for a mine place skipping the next place.
- Income seating from the pool while tile 6 seats from the bank.

## 5. What I tested directly

| Area | Scope and result |
|---|---|
| Independent Mincmistr oracle vs shipped `playMincmistr` | 352 complete digital games covering all 22 configurations (2/3/4 players × 4 levels × shared/individual decks × tougher Master), half against a random human and half against Standard, with events mixed. **33,352 decisions and 22,864 card plays: 0 mismatches.** Every branch fired: 4.3 Construct 11,928 · 4.1 cash 4,942 · 4.3 Mine 4,212 · 4.2 pelicans 812 · 4.4 discard 334 · 4.4 Income 217 · 4.3 St. Barbara 214 · 4.4 Mine 205. Card plays per Mincmistr per round matched rule 9 in all 4,224 seat-rounds. 751 save round trips. |
| Engine fuzz with independent scoring | 240 games (80 per table size) with Standard, Quick, Mincmistr and Planner rivals, against random, Standard and skip-heavy humans. 29,640 steps; 2,583 `checkGame` validations; 2,160 round-end council scorings and all 240 final scores and winners recomputed independently. **0 discrepancies and 0 input-state mutations.** |
| Full games through the shipped controls (Chromium) | Three games played only with on-page buttons: 2-player Master, 4-player Standard with events, and 3-player Grandmaster with individual decks. Each reached final scoring. The rendered totals equalled the engine result for the stored position. Undo restored the exact prior position, then replay continued. No page errors. |
| Undo, reload, save recovery | Digital Undo after reload is exactly 5 steps. Draw only Undo after reload is exactly 5. New deck Cancel keeps the deck and Reset clears its history. Undo after New game restores the previous game (see Q5). |
| v0.3.4 F1/F2/F3 fixes and nearby cases | **F1:** in both modes a stale tab is stopped before it writes (repository smoke), and a stale digital tab's New game is also refused (new probe). **F2:** a read failure at startup preserves the existing save in both the digital game (new) and Draw only. A corrupt save or deck is protected until an explicit New game or New deck; the unreadable-save download works. Another tab clearing storage recovers cleanly. **F3:** a 64-character seed entered through the New game dialog gives three different decks. 52, 53 and 64 characters all give distinct decks, a 65-character seed is cut to 64, and shared decks stay single. |
| Other past fixes rechecked | Third-row rewards 1/3/4 reputation then 8 VP, with the nearby top-row case giving a public right instead. Reputation-floor tax penalty at −5, −4 and −3. Ius Regale with 3, 7 and 0 tiles left. Tile 7 overflow. Tile 9 reserve-then-pool. Edge against the best opponent at four players, with a nearby case that flips the choice. v0.1.0 III–3 migration. Master/tougher card totals. All pass (`results/past-fixes.txt`). |
| Hidden information | Concealed mine faces (within tiers), stack tails, future events, red order and RNG were perturbed consistently with the public position. Standard, Quick and Planner made the same decision in all 548 positions × 2 perturbations. The Mincmistr made the same decision in all 526 positions. The only log differences were the next round's revealed event. |
| Printed and on-screen materials | All 15 Plan faces match the data (goals and arrows). The reference cards, mine aid, Plan text, prize tiles and thresholds match the code. The mine aid prints on one page at Letter and A4. No horizontal overflow at 390 px in the 4-player digital game. Only one control is under 24 px: the skip link, which shows on focus. |
| README checks | The one-rival rows for `silver-1308`, the two-rival setup for `app-table-3`, and the Ius Regale fixture (discards 3, ore +2) all behave as written. |

## 6. Purposeful play and difficulty

**Strategies.** A human-seat challenger played against the shipped Mincmistr (`playMincmistr`, rivals in seats 1–3) on matched seeds, rotating the starting player. Each cell has 24 discovery and 24 fresh-seed games, 1,536 games in all. "Tax dodge" is Standard that declines every tax bill. The table shows human outright wins, discovery + fresh, and the mean margin against the best Mincmistr.

| Challenger | 2p vs Journeyman | 2p vs Master | 4p vs Journeyman | 4p vs Master |
|---|---:|---:|---:|---:|
| Standard | 34/48 · +5.0 | 23/48 · +0.6 | 25/48 · +0.9 | 12/48 · −4.7 |
| Quick | 18/48 · −3.0 | 10/48 · −8.1 | 7/48 · −8.4 | 1/48 · −13.0 |
| Builder | 28/48 · +1.9 | 17/48 · −5.4 | 15/48 · −4.0 | 5/48 · −10.3 |
| Miner | 19/48 · −2.3 | 9/48 · −9.2 | 14/48 · −4.7 | 5/48 · −11.2 |
| Council | 21/48 · −0.6 | 19/48 · −4.0 | 15/48 · −2.9 | 10/48 · −6.6 |
| Denial | 19/48 · −3.1 | 14/48 · −6.7 | 21/48 · −0.4 | 11/48 · −7.1 |
| Tax dodge | 19/48 · −1.8 | 14/48 · −7.9 | 6/48 · −7.6 | 3/48 · −12.5 |
| Random legal | 0/48 · −39.8 | 0/48 · −45.1 | 0/48 · −39.9 | 0/48 · −44.4 |

- **The published ladder reproduces through the shipped digital path on fresh seeds.** Standard wins 71% against Journeyman (printed: Mincmistr 33%) and 48% against Master (printed 50%) at two players. At four players it wins 52% against three Journeymen (printed 48%) and 25% against three Masters (printed 25%).
- **No repeatable exploit.** Standard had the best mean margin in all eight cells, on discovery and fresh seeds alike, so no specialist approach beat general play. Declining every tax bill was worse than Standard at every table. The Mincmistr's no-effect cards stay rare: 0.03–0.05 per game at Journeyman and 0.44–0.60 at Master. In a 40-game check, all 16 of Master's no-effect cards came on its doubled last turn, when nothing was possible for the final card. That cost is already included in its measured strength.
- **Limits.** These are scripted policies that share the legal-move engine. They measure resistance to these approaches, not to a strong human. Cells of 48 games carry roughly ±14 percentage points of sampling error. Planner was not used as a challenger here; Astra's v0.3.4 audit covered it.

## 7. Tabletop workload (per Mincmistr, per game)

Measured on the printed procedure, with the Standard rival in your seat and 8 seeds per row (`results/workload.json`).

| Table / level | Plan flips | Bonus steps | Taxes | Mine placements (rows compared) | Plots (spaces × rights) | Builds (options) | Builds decided by arrow |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2p Journeyman | 30 | 7.5 | 4.8 | 5.1 (2.2) | 6.1 (7.4) | 5.5 (1.7) | 45% |
| 2p Master | 33 | 8.4 | 4.8 | 5.9 (2.2) | 6.9 (7.1) | 6.0 (1.7) | 48% |
| 3p Master | 33 | 10.4 | 4.5 | 6.8 (2.8) | 6.5 (11.2) | 6.1 (1.8) | 52% |
| 4p Master | 28 | 7.7 | 4.3 | 5.2 (2.5) | 5.2 (10.4) | 4.7 (1.6) | 41% |

The deck routine is light: one flip per card, with no tracking beyond a normal player's pieces. The recurring work is plot scoring, about 7 to 11 plot/right comparisons per plot, and mine-row award comparisons, two to three rows per placement, which the mine aid now covers. About half of all builds end on the arrow because several plots tie on town points. A three-Master table makes about 84 flips and 23 bonus steps per game in total.

## 8. Optional quality-of-life improvements (untested suggestions)

**Digital app**

- **Q1.** **Show which rule fired** ("4.1 short of cash," "Goal 1 Construct → Plot," "4.4 fallback") in the **Play one Plan** review and the journal. `samplegame.mjs` already computes this. It is the most direct help for people learning to run the paper Mincmistr.
- **Q2.** **Journal silently skipped bonuses.** In the P1 position the free right is skipped with no line at all. Something like "No public building rights available" would explain it.
- **Q3.** **Open the offline Rules and reference from the digital game too**, from the Guide and the Mincmistr panel. The Guide's rules link is online only (`src/page.html:117`), although the full offline copy is bundled.
- **Q4.** **Auto-pay a zero tax bill.** When your own bill is 0 g but another player's is not, you are still asked to choose between "Pay 0 g" and losing reputation.
- **Q5.** **Explain Undo after New game.** It restores the previous game, which is a useful safety net. Import uses the same save path, so it presumably does the same; I did not test that. The Guide doesn't mention it, and the button gives no hint.
- **Q6.** Fix P3 at the same time.

**Draw only**

- **Q7.** **Optional seat tags** for 2–3 paper Mincmistrs ("next draw for M1/M2/M3"), so the recent strip shows who drew each Plan.
- **Q8.** **Separate deck slots** for rule 10's individual decks. There is one slot today, and two Draw only tabs used as two decks would conflict.

**Paper**

- **Q9.** **Add the mine choice aid to the PDF**, as page 9 or a fourth reference card. It is currently printable only from the app.
- **Q10.** **Wording:** the introduction still says "a normal two-player game." The fine-tuning line says "Grandmaster is N = 6," but four players have only five rounds. The Choices card omits a few tie-breaks (Rights "further left," Build "earliest right," House "top row"); a "see rule 6" note would cover them.
- **Q11.** Fix P1 and P2, and add A1's one-line clarification, in v1.2.3.

**Tooling**

- **Q12.** **Add a `package.json`** with pinned dev dependencies (jsdom, Playwright) and scripts for `test`, `smoke`, `build` and `verify`, plus CI.
- **Q13.** **Let `build.py` take the Chrome path from an environment variable.** It currently hard-codes `/usr/bin/google-chrome`.
- **Q14.** **Add a PDF verification step**, either `audit/v0.3.5/scripts/pdf-compare.py` or a fixed `CreationDate`, so the PDF can be checked like the HTML.

## 9. Coverage gaps

- **Base-rule sources.** I read the CGE rulebook through text extraction only. I did not recheck the board images, price-card cells, the setup-card montage, the 15 two-player and 15 large-board rock layouts, the reputation score track or the tax-penalty track against printed components. Those rest on earlier audits and the source data.
- **Browsers.** Chromium only. No Firefox, WebKit, Safari or iPhone run. The jsdom DOM smoke was not run.
- **Physical play.** No print, duplex-alignment or cutting trial, and no human tabletop session. The workload figures are counts, not minutes.
- **Opponents.** No second independent implementation of the base-game rules. Legal-move generation is shared by every simulation, and my oracle and scorer reduce but do not remove that dependency. Capek was not compared.
- **Calibration.** No new calibration of the tougher three-player Master beyond verifying its card allowance.

## Release verdict

**App v0.3.5: pass.** The shipped HTML rebuilds byte for byte, and every repository check I could run passes. An independent oracle agrees with the shipped Mincmistr on 33,352 decisions. Independent scoring agrees on 240 complete games. Three full games through the real controls ended in correct final tables. The v0.3.4 defects F1–F3 are fixed in Chromium, including the nearby cases. Bots and the Mincmistr stayed within public information in every perturbation. Remaining caveats: no Safari, Firefox or physical-device pass, and no human playtest.

**Paper Mincmistr v1.2.2: pass for physical playtesting.** The cards, reference cards and mine aid match the implementation, and the strength ladder reproduces on fresh seeds. Before wider distribution, fix P1 (the house-row fallback, which is rare but rule-breaking) and P2 (guild-set assignment) in a v1.2.3 text revision. Then prioritise Q1 and Q9.

**Priority order:** P1 → P2 → A1 wording → Q1 → Q9 → P3 → remaining QoL.
