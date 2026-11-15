# Kutná Hora Solo — Astra second audit

**Reviewed 2026-11-15. Target: v0.2.2 playtest, commit `def9312a06641648afbcec32cb07a92cb53a136d`.**

No new rules, scoring, state-transition or save-loss defect was confirmed. The candidate passes the technical checks described below. Six optional usability improvements are documented with reproduction steps and source locations. Actual browser/device testing and human playtesting remain open; this is a pass for continued playtesting, not a claim of complete release certification.

This audit leaves the application and shipped HTML unchanged. Reproduction scripts, fixtures and recorded results are in [audit/astra-v0.2.2](../audit/astra-v0.2.2/README.md).

## 1. Exact target and independent expectations

| Item | Reviewed version |
| --- | --- |
| Repository | [ramyahoo88/Kutn-_Hora_Solo](https://github.com/ramyahoo88/Kutn-_Hora_Solo) |
| Candidate | [`def9312`](https://github.com/ramyahoo88/Kutn-_Hora_Solo/commit/def9312a06641648afbcec32cb07a92cb53a136d), branch `v0.2.2-playtest` |
| Source tree | `4623758d67ce7c685ae1f22a5ad7f040a5c52653` |
| Released main at review | v0.2.1, `67fb341963bfdfd751f81b592b197ce29b684aa5` |
| Claude's preceding audit | [`62c1a71`, report](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/62c1a71/docs/Claude_Audit_v0.2.2.md), covering playtest commit `2615392` |
| Rules | CGE English base-game rulebook, October 2023, 20 pages; two-player setup and six-round game |
| Save format | Schema 2, setup version 2; schema-1 migration also tested |

Compared with main, the candidate changes seeded rival house-row order, the Ius short-stack interpretation and count in the journal, setup wording, version, tests and documentation. The latest follow-up changes the New game label and Ius journal, not the rival evaluator. I reviewed those changes and the surrounding code, rather than assuming earlier audit conclusions remained valid.

Sources consulted:

- [CGE rulebook](https://filemanager.czechgames.com/storage/files/kutna-hora-the-city-of-silver/rules/kutna-hora-rules-en.pdf). Local PDF SHA-256: `63a1ec150dc1d01c1c7027a628d44e5f9e9472de08f67921bfc1b71992a65bbf`. All 20 rendered pages were inspected, including both columns of pp. 19–20. Page numbers below are the printed numbers. The layout establishes that the general permission to omit an action and the specific optional portions of cathedral effects are different provisions.
- [CGE two-player article](https://www.czechgames.com/news/diving-into-the-two-player-game-experience-in-kutna-hora), including the smaller town and mine scoring table. Town shape/edge villages still rely on the available angled photograph, not a new straight-on board scan.
- [CGE companion](https://kutnahora.czechgames.com/). All 1,080 app-supported price cells, construction thresholds and automatic town-build thresholds matched an independently extracted numeric oracle. All nine two-player guild sets match its setup array, including card 6.
- [Component reference](https://www.ludex.dev/kutna-hora/cards/): inspected the available faces for 36 buildings, 27 ordinary mines, 15 mine setup cards, eight readable guild setup cards, and ten base events. The two-player rows of setup cards were distinguished from their three/four-player rows. Cathedral effects were checked against the complete appendix on p. 20. Guild card 6's mapping was verified in the official companion, not a newly inspected printed face.
- [FAQ/reference index](https://www.ludex.dev/kutna-hora/faq/) and current CGE search results were consulted for clarifications. I did not find a new publisher ruling resolving either ambiguity below. The CGE pre-release marketing FAQ is not a living-rules errata document.
- [Capek listing](https://www.zatrolene-hry.cz/spolecenska-hra/kutna-hora-mesto-stribra-14736/k-stazeni/vlastni-solo-mod-capek-18184/) remains outside procedural verification: its full PDF requires sign-in. This app implements an independent rival taking base-game actions; it does not claim to reproduce Capek's bot cards.

Expectations were derived from these materials before comparing the affected transitions: setup and public information (pp. 4–7), action/card timing (pp. 8–9), mine/rights/plot/build/income/cathedral/Joker actions (pp. 10–14), price/reputation changes (p. 15), events/taxes/council (p. 16), scoring/ties (p. 17), and limited supplies/optional effects (pp. 19–20).

## 2. Release reproduction and regression checks

All **22 original repository files** matched the blobs returned for the exact reviewed commit. A fresh build to a separate path matched the shipped `Kutna_Hora_Solo.html` **byte for byte**:

```text
Bytes:   411252
SHA-256: 399f4d88776800c410bf48a83559e41790a825f4b34babc00c71eed5b85b02e7
Git blob: b7d6fa108ededecae9090d0e330d0042ea003560
```

`release.mjs` reproduces this in a temporary directory and never overwrites the shipped page. **16/16 existing tests passed.** The independent audit added **29 focused check groups**, all passing. Some boundary groups deliberately construct artificial unit positions; only the supplied save fixtures are claimed as importable positions.

The README benchmark reproduced every opponent row:

| Opponent | Standard wins / 24 | Mean Standard VP margin |
| --- | ---: | ---: |
| Earlier evaluator | 16 | +3.21 |
| Quick | 14 | +4.08 |
| City construction | 14 | +2.04 |
| Mining | 17 | +4.29 |
| Council | 13 | +1.58 |
| Denial | 17 | +5.13 |
| **Total** | **91 / 144** | **+3.39** |

Reproduction: `node test/arena.mjs 12 baseline,quick,builder,miner,council,denial kutna-v020-fresh`. Recorded output: [readme-benchmark.jsonl](../audit/astra-v0.2.2/evidence/readme-benchmark.jsonl). This reproduces the existing benchmark; it is not a fresh-seed strength comparison between releases.

Past fixes and nearby cases were rechecked:

- **III–3's two stars:** correct data, row award and adjacent control III–2. Zero-star ownership still receives no mine award; ties and thresholds at 3/4/6/7 stars match the printed two-player table.
- **Third house row:** Claude's Tavern save imports; player-board preview says +3 reputation; building moves reputation **1 → 4** and changes the next reward to +4. Undo restores 1 and reload preserves 4. This was exercised through shipped handlers in jsdom.
- **Shuffle:** two fresh groups of 10,000 setups each reach all 12 distinct rock-star orders and all 720 first-tier mine permutations. This is a coverage/regression observation, not a statistical proof of ideal randomness.
- **Seeded rival rows:** repository tests confirm determinism, all six orders, explicit-order preservation and unchanged board/deck shuffles; shipped setup label identifies the list as a guild set whose row order comes from the seed.
- **Ius:** zero, one, three and five remaining tiles are covered by the current regression. The shipped short-stack save discards three, raises ore by two, logs three and survives reload. Recycling happens on the next draw, as documented.
- **Recovery:** damaged autosave bytes survive attempted play and can be exported exactly; simulated quota failure shows a persistent warning and preserves the earlier save. Invalid import preserves the current game. A pending draw survives reload and resumes identically.
- **Old saves:** two actual v0.1.0 files migrate with RNG/deck/market/event/row order preserved. III–3 changes from zero to two stars. One resumed through **89 further legal transitions** to a completed game with validation and save round-trips after every step. A completed old save recalculates to **50–42**.

## 3. Normal play, boundaries and automation

A complete six-round game used the unmodified shipped HTML in jsdom, with the app's card, target, confirm, rival and tax handlers. Seed `astra-v022-controls-full`, setup 6, rival starts: **43–34**, human win. Every human commit matched the engine transition. It required **47 human commits, 24 rival-turn/tax buttons and 141 simulated input operations** including selection changes. This measures control operations only; reading, scrolling, thinking time and physical-board administration were not measured.

The app automates prices, stock, taxes, council scoring and round advancement. Recurring player work is choosing a card/target, resolving any bonus choice, confirming it, and asking the rival to act. Mirroring a physical board still needs a human playtest; the operation count above is not a tabletop burden estimate.

Focused boundary coverage includes all ten event end effects; event-before-tax timing; King doubling plot surcharges; Land Rush skipping taxes; tax cap 25; population/ore caps; reputation floor/ceiling VP conversion; finite miners/houses/patricians; reserve-first free miners and pool fallback; free rights/plot and holding limits; mandatory red-building removal versus optional tile-3 removal; Barbara 8's current nested-build interpretation; Barbara 9's two mines without extra cards; cathedral completion; stale-card rejection; final cash tiebreak and exact draw. A fully legal all-no-effect game used all 60 cards and still reached final scoring, so voluntary inactivity does not strand the game.

Preview checks covered **7,672 legal choices** across four full six-round games, with **zero semantic mismatches** for immediate action effects:

| Round | Compared choices |
| --- | ---: |
| 1 | 1,806 |
| 2 | 990 |
| 3 | 1,037 |
| 4 | 1,266 |
| 5 | 1,321 |
| 6 | 1,252 |

Another **453 choices** at tax/phase/round boundaries were counted separately, not asserted equal to a planning copy. The preview intentionally excludes automatic round-end resolution; event/tax expectations were tested separately. These comparisons verify effects, not the presence of every effect in visible preview text. Q1 and Q3 below identify missing text despite correct calculation.

**Earlier audit tooling gap:** `audit/v0.2.0/preview_check.mjs:10` continues only while `phase==='action'`, so each random walk stops at its first tax phase. Its large action count must not be read as uniform six-round coverage. The new script traverses taxes and reports per-round counts. This is a testing limitation, not an app defect; the smallest general repair is to continue until `phase==='end'` and separately classify automatic boundaries.

## 4. Purposeful strategies and hidden information

Four independently written evaluation policies challenged Standard: income/construction, mining, council investment and denial of the opponent's position. They do not call Standard's evaluator. They do share its legal-transition engine and public-information sampler, and use a narrower, short-horizon search; they are imperfect synthetic players.

Discovery seeds were `astra-v022-discovery-0` through `-8`; confirmation seeds were `astra-v022-confirm-0` through `-8`. Each group covers all nine guild sets, both guild sides and starting-player settings. Every matchup was played with Standard in each seat. Policies were frozen before both groups; no tuning occurred on the confirmation results.

| Opposing strategy | Discovery: Standard wins / 18 | Fresh confirmation: Standard wins / 18 | Combined mean Standard margin |
| --- | ---: | ---: | ---: |
| Income/construction | 15 | 14 | +10.47 VP |
| Mining | 16 | 15 | +10.81 VP |
| Council | 17 | 16 | +13.31 VP |
| Denial | 15 | 15 | +10.28 VP |

All **144 games** completed; **12,123 transitions** passed state checks. Standard won **123/144** with no draws. No tested policy produced a repeatable dominant exploit. This does not prove the absence of one, and the weaker challenger policies make the high win rate unsuitable as a human-difficulty claim. Results share setup seeds across strategies, so they are not 144 independent estimates of human performance. No release-to-release strength claim is made.

On **315 decisions**, changing hidden mine order, market tails, future events, red-building order and the stored RNG word left Standard's chosen action unchanged. Revealed faces and public state were retained. This is affirmative evidence for the tested information boundary, not exhaustive noninterference proof. Every chosen action was legal. Planning purity was also checked during the 89-action old-save continuation.

Raw skip counts include declining optional bonuses and discarding drawn mines; they must not be described as wasted turns. The experiment did not establish a forced-waste exploit or a benefit-farming loop. Stronger opponent-response search would be a future design experiment, not a correction justified by this audit.

## 5. Confirmed optional usability improvements

These are **nonblocking improvements**, not incorrect rules outcomes. All source line references refer to `def9312`. The DOM observations are reproducible with `node audit/astra-v0.2.2/dom.mjs`; they are not assertions about an actually tested phone browser.

### Q1 — Show the VP cost of a tax penalty at the reputation floor

**Priority: high usability. Impact:** a player can accept a penalty without seeing its immediate points cost.

**Expected behavior/rule:** p. 15 converts every lost reputation step below −5 into −2 VP. A decision preview should show this computed consequence.

**Reproduction:** import [Tax_At_Reputation_Floor.json](../audit/astra-v0.2.2/fixtures/Tax_At_Reputation_Floor.json). Seed `astra-v022-tax-floor`, round 6 taxes, human reputation −5, earned VP −2, tax 7 g. Choose **Take −3 reputation**, inspect the preview, then confirm. This save is reached through legal all-no-effect play; `recovery.mjs` reconstructs it.

**Observed:** the label says −3 reputation and `.choice-info` is empty. Applying it correctly keeps reputation at −5 and changes earned VP **−2 → −8**. The missing 6 VP loss is a display omission.

**Location:** [src/app.mjs:171](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/def9312a06641648afbcec32cb07a92cb53a136d/src/app.mjs#L171), [src/app.mjs:176](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/def9312a06641648afbcec32cb07a92cb53a136d/src/app.mjs#L176); correct conversion is [src/engine.mjs:101](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/def9312a06641648afbcec32cb07a92cb53a136d/src/engine.mjs#L101).

**Smallest proposed fix:** add a penalty preview showing the bounded reputation change and overflow VP separately; also show final reputation-score change where useful. Calculate the choice's own delta without folding unrelated end-of-round council/final scoring into it. Regression: this fixture displays “Reputation unchanged at −5; lose 6 VP”; a nearby reputation-0 case displays “Reputation −3” without an overflow loss.

### Q2 — Make market and held-building details inspectable by tap and keyboard

**Priority: high usability, especially phones. Impact:** costs/effects are harder to compare before committing to an action type.

**Expected behavior:** public component information should be available through a normal inspect control, independent of whether that tile is currently a legal target.

**Reproduction:** start seed `silver-1308`, select no card, inspect the Bathhouse market entry. Compare its visible text with its HTML `title`. Then inspect the held-rights area after acquiring a right.

**Observed:** Bathhouse's normal market element is a nonfocusable `DIV`; visible text contains its name, guild, wood cost and remaining count, while production/population/cathedral effects are in the hover title. Held rights are plain names. Legal selected Rights choices do show details, but the ordinary inspection path is missing. Native touch behavior was not tested.

**Location:** [src/app.mjs:394](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/def9312a06641648afbcec32cb07a92cb53a136d/src/app.mjs#L394) (`renderMarket`), especially `:402`–`:408`; board inspection has a similar restriction in `mapCell`, `:364`.

**Smallest proposed fix:** add one reusable tile-details dialog with an explicit inspect button for every public market, held and placed tile. Keep inspect separate from target selection. Include full effects, costs, ownership and current matching-dot score where applicable. Do not expose unrevealed stack faces.

### Q3 — Compute the St. Barbara tile 7 reputation preview

**Priority: medium. Impact:** the player must manually count the same public adjacency the app already computes.

**Expected behavior/rule:** p. 20 tile 7 grants reputation for public-building adjacency to each owned building; repeated adjacency to one public tile counts for each owned building.

**Reproduction:** import [Barbara_7_Preview.json](../audit/astra-v0.2.2/fixtures/Barbara_7_Preview.json), then choose St. Barbara on the Rights/St. Barbara card. This small synthetic import-valid position has your Smelter at C1, public St. George's Chapel at D1 and your Pump at D2. Tile 7 is current and one pelican is available.

**Observed:** preview gives only the generic counting instruction. Confirming correctly grants **+2 reputation**. The two owned buildings each count the shared public neighbor once.

**Location:** [src/app.mjs:182](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/def9312a06641648afbcec32cb07a92cb53a136d/src/app.mjs#L182); correct engine calculation is [src/engine.mjs:413](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/def9312a06641648afbcec32cb07a92cb53a136d/src/engine.mjs#L413) and `:512`.

**Smallest proposed fix:** append `appliedEffects(a)` for tile 7, retaining its rule text. Show VP overflow when reputation is already at its ceiling. Test the supplied +2 position and a nearby no-public-neighbor position that grants zero.

### Q4 — Explain or persist Undo across reload

**Priority: medium. Impact:** a player resuming on a phone may expect to reverse the last move, but the history has disappeared.

**Expected behavior:** describe Undo's lifetime accurately; persistence is an optional feature, not a printed game rule.

**Reproduction:** start `astra-v022-undo`; choose Mine on the Mine/Joker card and draw. Undo is enabled. Reload with the same autosave.

**Observed:** the pending draw restores correctly; Undo is disabled. Whole-rival-turn Undo, ordinary Undo and pending-action Undo work during the original session.

**Location:** [src/app.mjs:35](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/def9312a06641648afbcec32cb07a92cb53a136d/src/app.mjs#L35), `:442`, `:603`; the resume paragraph at [src/page.html:93](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/def9312a06641648afbcec32cb07a92cb53a136d/src/page.html#L93) does not mention this limit.

**Smallest proposed fix:** add “Undo history lasts until this page is reloaded” to the Guide. If persistence is desired, store a small, versioned history envelope and validate every restored snapshot; do not silently change the current save schema's assumptions.

### Q5 — Explain why a card action is unavailable

**Priority: medium. Impact:** new players must infer whether the obstacle is a spent card, money, a missing right/plot, house supply, demand cutoff or a pelican.

**Expected behavior:** legal restrictions remain enforced, with an accessible reason beside unavailable choices.

**Reproduction:** start a new default game. Building and St. Barbara are unavailable. Inspect their labels; later acquire a right without a plot and inspect Building again.

**Observed:** `cardControl` adds `disabled` but no reason. The Guide explains the general build sequence; it does not identify the current missing requirement. Source inspection confirms this; no real-device accessibility session was conducted.

**Location:** [src/app.mjs:278](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/def9312a06641648afbcec32cb07a92cb53a136d/src/app.mjs#L278)–`:285`, with eligibility derived by [src/engine.mjs:235](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/def9312a06641648afbcec32cb07a92cb53a136d/src/engine.mjs#L235).

**Smallest proposed fix:** add a short reason panel for unavailable actions, starting with “Needs a pelican,” “Needs a held right and a plot,” and “Card already played.” Derive reasons from shared eligibility checks so explanatory text cannot drift from legality. Avoid relying solely on tooltips on disabled buttons.

### Q6 — Show the remaining house-row rewards together

**Priority: low. Impact:** planning a red-building removal or a sequence of guild builds still requires knowing rewards beyond the next house.

**Expected behavior/rule:** the printed player board exposes all four spaces; p. 12 uses the next leftmost house. The app can present the same public planning information.

**Reproduction:** import the Tavern fixture and open your Player board. The third row correctly shows +3 as the next reward. Compare what is visible with the printed four-space track.

**Observed:** the dialog shows houses remaining and **only the next build reward**. The following +4 reputation and 8 VP are not displayed until they become next.

**Location:** [src/app.mjs:216](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/def9312a06641648afbcec32cb07a92cb53a136d/src/app.mjs#L216)–`:238`; reward data already exists in [src/data.mjs:42](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/def9312a06641648afbcec32cb07a92cb53a136d/src/data.mjs#L42).

**Smallest proposed fix:** render four compact reward cells per guild row, marking used cells and highlighting the next one. Reuse `HOUSE_EFFECTS`; no engine change is needed.

Additional ideas, **not evaluated as findings**: a current-game information/copy-report control containing version, seed, guild order and round; and an optional warning before a player with zero income spends their last usable cash on public construction (the rulebook itself warns about this trap on p. 13). Neither should restrict legal play or add confirmation to routine turns.

## 6. Rules questions kept separate from defects

**R1 — Ius Regale with fewer than five tiles.** The event face says to discard five; the general recycling instruction on p. 19 concerns drawing when the mine stack is exhausted. The app discards the remaining stack and postpones recycling until a later draw. This is documented, consistent and tested. No new CGE ruling was found. Keep the interpretation labeled; do not change behavior merely to make an edge-case test pass. Location: [src/engine.mjs:565](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/def9312a06641648afbcec32cb07a92cb53a136d/src/engine.mjs#L565).

**R2 — Tile 8 and a Grocer/Innkeeper build.** The p. 14 resolve-then-flip sequence and the building's own cathedral flip overlap. The app keeps tile 8 current during its free build, uses that tile's tax if the building flips it, and prevents an additional outer flip. Tavern versus Pump is checked explicitly: both end at tile 9; only Tavern adds the tile's 1 g tax. This remains the documented interpretation awaiting a published clarification. Locations: [src/engine.mjs:414](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/def9312a06641648afbcec32cb07a92cb53a136d/src/engine.mjs#L414), `:479`.

**Red-building house removal:** the current mandatory-removal interpretation is defensible. P. 19 explicitly makes tile 3's removal optional and permits omitting a whole action; it does not explicitly list the red-building removal as an independently optional subeffect. Tests distinguish mandatory red removal, optional tile-3 removal, and having no houses left. This is not a new publisher ruling. The relevant support is the building/house explanation, component face and appendix together, rather than asserting that p. 20 alone settles it.

## 7. Important coverage limits and release verdict

**Directly executed:** Node tests, independent boundary/strategy scripts, original shipped HTML in jsdom, import/export Blob contents, damaged-save recovery, Undo/reload simulations, and full six-round action traces. **Directly read:** rendered rulebook pages, available component faces, current code and the previous audit.

**Not executed here:** a successful real Chromium session, Firefox, Safari/iPhone, native download/file-picker behavior, visual responsive layout, screen-reader interaction, human playtests, or a full physical-board mirrored game. Local Chromium failed to launch because of process/socket restrictions; the cloud browser rejected local-file access. No workaround was used. Claude's earlier Chromium observations are prior evidence, not this audit's own execution. The town-board photograph and full Capek procedure remain source-coverage limits.

**Recommended order:** implement the two numeric previews (Q1/Q3), add touch/keyboard tile inspection (Q2), document Undo's lifetime (Q4), then add disabled-action reasons and complete house tracks (Q5/Q6). These are small presentation improvements. Before expanding AI search, run the README's two human games and a Safari/iPhone session; include a physical-board comparison of town shape/edge villages when possible.

**Release verdict: PASS for continued v0.2.2 playtesting. No confirmed blocking rules or scoring defect.** Evidence is the exact-byte rebuild, all 16 repository tests, 29 independent focused groups, 13 shipped-HTML DOM checks, reproduced 144-game README benchmark, 144 fresh strategy games with 12,123 valid transitions, 7,672 preview comparisons and 315 hidden-information comparisons. The two documented rulings and optional usability omissions do not require withholding playtesting. Real-browser/device and human validation remain necessary evidence before describing v0.2.2 as fully verified for public release.
