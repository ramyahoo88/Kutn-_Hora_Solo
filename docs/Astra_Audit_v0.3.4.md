# Astra audit — Kutná Hora Solo v0.3.4 and Mincmistr v1.2.2

**15 November 2026 · Verdict: conditional pass for playtesting. Fix the two save-preservation defects before promoting this build to a broader release.**

I found **three reproducible defects**: two ways to lose saved progress and one long-seed defect that gives separate Mincmistr decks identical orders. I found no new base-game rules violation or disagreement between the printed Mincmistr decision rules and its implementation in the checks below. That is a bounded result, not a proof that every position is correct.

The audit adds evidence and reproduction scripts only. The reviewed application, rules, and shipped HTML remain unchanged.

## 1. Exact release and sources

| Material | Reviewed version |
|---|---|
| Repository | `ramyahoo88/Kutn-_Hora_Solo` |
| App branch / commit | `v0.3.4-playtest` / `5ec3ca8814cb7df04ff9a52a2fcfecfc0bc0878e` |
| Git tree | `288b9129b3a1d07b52286c22f0a0e339fd6175f0` |
| App / save schema | v0.3.4 / schema 3, setup version 2 |
| Paper rules | Mincmistr v1.2.2, dated 15 November 2026; earlier reviewed source at `e6806e63babe71706650ba80d6fbe96e6da5a806` |
| Base rules | CGE English *Rules of Play*, copyright October 2023, 20 pages |
| Variants | Printed Mincmistr difficulty levels; optional tougher three-player Master; shared or individual Plan decks; optional events at 3–4 players; the README's existing timing interpretations |

**App release verification: PASS.** A new build to a separate path is byte-for-byte identical to the shipped 542,122-byte HTML. All 36 repository tests pass. Every one of the 68 downloaded release files matches its GitHub blob hash, including every app source file, build input, shipped asset, test, and paper rules/build input used here. Twenty-one historical study files were not downloaded; they are listed in the evidence and were not used to generate these results.

| File | SHA-256 |
|---|---|
| Shipped and independently rebuilt HTML | `c012bec1cb9ea80c02d631fa670515891648168ee3d050e67f6b79f5e1fd262b` |
| Mincmistr PDF | `5c9e94b8d0223f11fdb67ee78ea2e4f15d719970b611be364a67d56ff44e8d80` |
| Printed Plan sprite | `d440fa8052675364629c11d2ba46a2119c3f225febdcdb8c3eb8157baa0d76a2` |
| CGE rulebook copy read | `63a1ec150dc1d01c1c7027a628d44e5f9e9472de08f67921bfc1b71992a65bbf` |

I rendered and read **all 20 base-rulebook pages and all eight paper-PDF pages**, including both columns, setup diagrams, scoring tables, all 15 Plan faces, the three reference cards, and backs. I also inspected the cached component-face sheets for the ten events, building and mine values, and setup layouts. The smaller setup-card montage is not a substitute for high-resolution checking of every cell; see coverage limits.

The printed Plan data, action-card row, and difficulty definitions match the app's data. Re-cropping pages 5 and 7 of the shipped PDF produces a byte-identical app sprite. The two Markdown copies of the paper rules are identical. I rebuilt the paper **HTML**, but could not regenerate the PDF: its builder requires Chromium, which cannot start here. I do not claim a byte-for-byte PDF rebuild.

Sources consulted:

- [CGE English rulebook](https://filemanager.czechgames.com/storage/files/kutna-hora-the-city-of-silver/rules/kutna-hora-rules-en.pdf), especially pp. 4–7, 9–14 and 16–20. Expectations were taken from the rendered layout before checking the corresponding engine branches.
- [Mincmistr rules at the reviewed release](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/5ec3ca8814cb7df04ff9a52a2fcfecfc0bc0878e/mincmistr/Mincmistr_Rules.md), its shipped PDF and reference cards; rules 2–10 govern the independent flow checks.
- [Component faces](https://www.ludex.dev/kutna-hora/cards/) and [event faces](https://www.ludex.dev/kutna-hora/events/). These are secondary reproductions; I used the pictures rather than treating the site's prose as authoritative.
- [Rules FAQ index](https://www.ludex.dev/kutna-hora/faq/) and searches for later rulings. I found no accessible authoritative update resolving the two timing questions below. The BGG confirmation threads returned 403, and the separate official English player-aid download was inaccessible. The base book's appendix and the paper bot's three aids were directly reviewed; the separate base-game aid was **not** independently verified.

Evidence and executable commands are in [audit/v0.3.4](../audit/v0.3.4/README.md). All source line references below refer to the pinned release, not a later working tree.

## 2. Confirmed findings

### F1 — P2: a stale tab can silently rewind the saved game or Plan deck

**Player impact.** Someone opens the app twice, continues in one tab, then returns to the older tab. Its next action overwrites the newer save without a warning. Reload can lose a completed mine placement; Draw only can repeat a previously drawn Plan. This affects both modes.

**Expected behavior.** A stale tab must detect that the stored position has changed before replacing it. It should offer to load the latest position or preserve/export the local branch. The README promises that the current game/deck can be resumed; normal interaction with an older tab should not silently replace that progress.

**Exact digital reproduction.** Start a two-player game with seed `astra034-tabs`, then open the same saved page in a second tab. In tab A, select Mine on the Mine/Joker card, confirm the draw, and confirm placement. In tab B, select Mine on that card and confirm the draw. Reload tab A.

**Observed.** The stored position goes from one placed miner to zero placed miners and a pending `mine-place` choice. Both save warnings are empty. The preserved before/after saves are `positions/two-tabs-before.json` and `positions/two-tabs-after.json`.

**Exact deck reproduction.** Open the same Draw only deck in A and B. Draw twice in A, then once in B. The deterministic harness starts after Plan 5, then A draws Plans 3 and 6. B overwrites that progress with the earlier sequence `[5, 3]`. The stored discard count falls from three to two with no warning. This does not depend on those particular Plan numbers.

**Source.** `src/app.mjs:43–54` reads only on initial entry; `src/app.mjs:60–79` writes without checking for another tab's changes. The corresponding deck paths are `src/paper.mjs:27–39` and `src/paper.mjs:52–67`. Neither mode handles storage changes from another tab.

**Smallest proposed fix.** Remember the last stored revision/serialized value. Before each move, Undo, or deck draw, check that it is still current; on a mismatch, pause and offer to load the newer save. Also handle the browser's `storage` event. Explicit New game/New deck replacement can follow its existing user action. Apply the guard separately to the two storage keys.

**Runnable proof.** `node audit/v0.3.4/storage-repros.mjs`, cases `two-paper-tabs` and `two-digital-tabs`. This runs the **unmodified shipped HTML** with two simulated documents sharing storage. It confirms the handler defect; it is not a live-browser recording.

### F2 — P2: Draw only overwrites an existing deck after a temporary storage-read failure

**Player impact.** A valid deck can disappear when storage is inaccessible at launch but becomes available before the next draw. The replacement deck may repeat cards already used at the physical table. The full digital game already protects the old save in this situation; Draw only does not.

**Expected behavior.** Failure to read a save is not evidence that no save exists. Preserve it until a successful reread or an explicit New deck reset. The first ordinary Draw Plan action should not authorize replacement of an unreadable prior deck.

**Exact reproduction.** Make an eight-draw deck with seed `astra034-recovery`. In the test harness, make `localStorage.getItem` throw during startup, then restore access before clicking Draw Plan. No New deck or reset confirmation is used.

**Observed.** Startup displays a warning and prepares a fresh in-memory deck. The ordinary draw replaces the original eight-draw save with a one-draw deck and clears the warning. A nearby control performs the same failure/recovery sequence in the digital game: its earlier saved bytes are preserved and autosave is paused.

**Source.** `src/paper.mjs:27–39` converts every read/parse failure into a fresh deck; `src/paper.mjs:52–59` writes it without rereading or protecting the prior value. The existing safer pattern is `src/app.mjs:60–79`.

**Smallest proposed fix.** Track an unreadable/temporarily inaccessible saved deck, retry the read before the first write, and refuse automatic replacement when prior data exists. Reserve replacement for the confirmed New deck action. Keeping a recovery download would be a useful companion improvement.

**Runnable proof.** `storage-repros.mjs`, case `paper-read-recovery`, plus its digital-game control. This is a **confirmed fault-injection recovery defect**, not a claim that I reproduced a particular Safari/private-mode failure.

### F3 — P3: long seeds collapse individual Mincmistr decks to the same shuffle

**Player impact.** At three or four players, choosing one deck per Mincmistr can produce identical Plan sequences and identical future reshuffles. That reduces the intended variety of separate decks and makes another rival's upcoming Plans predictable from the first rival's reveals. Normal short generated seeds and the shared-deck mode are unaffected.

**Expected behavior.** Separate seeded decks should retain their seat-specific seed input. Identical shuffles can occur by chance; the error here is that **every** sufficiently long seed discards the distinguishing seat number.

**Exact reproduction.** New game: four players, Mincmistr Master, one deck per Mincmistr, seed consisting of 53 uppercase `A` characters. The importable opening save is `positions/identical-individual-decks.json`.

**Observed.** All three decks have exactly the same order and RNG word. Their first five Plans are **10, 14, 3, 4, 6**. A neighboring test with 52 `A` characters gives different deck orders.

**Source.** `src/engine.mjs:35` truncates every hashed string to 64 characters. `src/engine.mjs:42` hashes `mincmistr/<user seed>/<seat>`, placing the seat after the cutoff once the user seed reaches 53 characters. The UI permits these seeds.

**Smallest proposed fix.** Put the seat before the potentially truncated user seed, or use a full-length internal-context hash while retaining the existing user-input length limit. Do not rewrite saved deck orders. A change to the seeding formula should be described as affecting newly created decks; preserving short-seed sequences is possible by limiting the repair to long inputs.

**Runnable proof.** `node audit/v0.3.4/seed-repro.mjs`. Its assertions reproduce the defect and check the 52-character neighboring case.

## 3. What I tested directly

| Check | Result and scope |
|---|---|
| Release | Separate-path HTML build byte-identical; 36/36 repository tests |
| Random and integrated games | 240 complete games, 80 at each table size; 180 random-action games and 60 integrated Mincmistr games; 29,344 decisions; no invalid states, input-state mutation, save-roundtrip failure, or stalled game |
| Preview calculations | 117,512 legal-action comparisons matched the applied effects. These compare engine calculations used by previews, not 117,512 rendered UI previews. 3,089 phase/round-boundary comparisons were excluded because planning intentionally suppresses advancement |
| Targeted boundaries | 1,008 independent mine-ranking expectations; zero stars, rocks, tied ranks and occupied places; exhausted figures/plot markers; mid-draw reshuffle; capped tracks; exact ties and cash tiebreaks; legacy saves |
| Hidden information | Quick, Standard and Planner each retained the same decision in 180 paired concealed-order perturbations; Mincmistr did so in 6,182 decisions. Revealed draws/Plans were kept fixed |
| Paper procedure | 72 complete fresh games; 4,266 card plays agreed with an independently written action-priority/leftmost-card oracle. This oracle shares the legal-action engine; it is not an independent implementation of every base-game rule |
| Paper/app parity | 44 matched games against the prior v1.2.2 implementation: 5,999 decisions and 2,858 Plan draws matched, covering all levels, shared/individual decks, and tougher three-player Master |
| Shipped controls | 21 passing regression scenarios, including five complete games through the shipped handlers, ordinary/pending Undo, rival-batch Undo, reload, export/import, corrupt-save preservation and storage-write failure |
| Actual card display | All 15 faces, all 90 Plan journal entries in a four-player Grandmaster game, latest-Plan links, offline embedded image and replay after Undo checked |
| Draw only | 30 draws covering two complete decks; exhaustion/reshuffle; persistent one-step Undo through reload; reset/cancel; direct `#draw-only` entry; mode switching; separation from the digital save |

**Important execution limit:** Chromium aborts here with a socket-permission error. The control checks execute the shipped HTML and its real event handlers in jsdom with browser API stubs. They verify behavior, not browser layout, rendering, touch input, or native file pickers. No current-build Chromium, Firefox, Safari, or iPhone pass is claimed.

The representative control games reached these final scores in seat order:

| Table / rivals | Final scores | Notes |
|---|---|---|
| 2-player Standard | 40, 36 | Seed `astra-v022-controls-full`; 47 human decisions, 24 rival-button batches; full action trace and final save included |
| 3-player Quick | 49, 38, 42 | Six rounds, two rivals |
| 4-player Planner | 31, 38, 39, 47 | Five rounds, three rivals |
| 3-player tougher Master | 38, 42, 51 | 68 Plan flips across the two Mincmistrs |
| 4-player Grandmaster | 27, 33, 55, 40 | 90 Plan flips across the three Mincmistrs |

Past fixes rechecked include the Tavern's 1→4 reputation change, all four third-row house rewards, tile 7's actual reputation/overflow preview, tax penalties at and near the reputation floor, Ius Regale's actual discard count, two free tile-9 mines using reserve miners first, multiplayer patrician comparisons against the best opponent, Master extra-card totals, and old-save migration. Tests include nearby alternatives: empty reserve versus available reserve, a tied opponent versus no opposing score, reputation just below versus at its limit, and a 52-character versus 53-character seed.

## 4. Purposeful play and difficulty

I ran **1,872 competitive games** in addition to the validity, rule-flow and control checks. All policy comparisons use identical starting seeds and rotate the evaluated seat around the table. Raw records include every seed, setup, starter, score, coin tiebreak and winner. Three/four-player competitive runs use events off; stress/flow runs also exercise events on.

### Mincmistr levels: new small-sample check

These are the **Standard rival's outright wins when it takes the human seat**, not Mincmistr wins or predicted human win rates. Each cell uses 12 new starting boards and every seat: 24, 36 or 48 games. One additional four-player Apprentice result was a shared win.

| Players | Apprentice | Journeyman | Master | Grandmaster |
|---|---:|---:|---:|---:|
| 2 | 19/24 (79%) | 17/24 (71%) | 15/24 (63%) | 8/24 (33%) |
| 3 | 24/36 (67%) | 21/36 (58%) | 17/36 (47%) | 6/36 (17%) |
| 4 | 32/48 (67%) | 23/48 (48%) | 10/48 (21%) | 12/48 (25%) |

The overall ladder works, but this sample is too small to calibrate close levels. The four-player Master/Grandmaster win-rate reversal is not persuasive: Standard's mean margin worsens from −5.42 to −8.88 VP against Grandmaster. Master's approximate 95% bootstrap win intervals, resampling whole starting boards, are **46–79%, 31–67%, and 10–31%** at 2/3/4 players. Keep the existing cautious three-player wording; do not relabel Master as precisely balanced or retune from these cells alone. These intervals describe sampled synthetic matchups, not uncertainty about human play.

### Independent strategy challenges

The four challengers below have their own short-horizon evaluator, not the app rival's scoring weights. They still share the legal engine and public-information filter. Each cell combines four discovery and four fresh confirmation boards, with all seats rotated. The per-batch results are in `results/summary.json`; no policy was tuned between batches.

| Challenger strategy | Standard: 2 / 3 / 4 players | Planner: 2 / 3 / 4 players | Paper Master: 2 / 3 / 4 players |
|---|---|---|---|
| Construction and income | 1/16 / 2/24 / 1/32 | 3/16 / 1/24 / 0/32 | 2/16 / 1/24 / 1/32 |
| Mining | 1/16 / 1/24 / 0/32 | 2/16 / 0/24 / 2/32 | 1/16 / 0/24 / 0/32 |
| Council and cathedral | 2/16 / 0/24 / 0/32 | 1/16 / 0/24 / 0/32 | 1/16 / 1/24 / 0/32 |
| Denial | 2/16 / 0/24 / 0/32 | 2/16 / 0/24 / 1/32 | 0/16 / 0/24 / 1/32 |

Entries are **challenger wins / games**, in 2-, 3-, then 4-player order. The construction, mining, council and denial approaches did not produce a repeatable winning exploit. They are weak, shallow synthetic players: these results establish resistance to these particular attacks, not that the opponents are unexploitable, stronger than experienced humans, or equivalent to each other.

I also tested Quick, the app's builder/miner/council/denial policies, Planner, and a targeted cheap-right interception policy against paper Master. Compared with Standard on the **same eight starting boards**, interception changed the challenger's mean margin by **−3.00 VP at two players, +1.87 at three and +0.56 at four**. Board-cluster 95% intervals were [−5.31, −0.69], [−1.67, +5.25], and [−3.94, +4.22]. The shared-guild attack is not a confirmed exploit. Raw outcomes by strategy are preserved, including tactical interception counts.

No conclusion about skip quality is drawn from skip counts. I did **not** rescore the earlier 52 four-player skip positions with all alternatives in this audit. Their mean-alternative comparison remains a useful future planner regression, not evidence supplied by this run.

## 5. Paper workload

From six fresh games at each table size, the following averages are **per Master Mincmistr**, not per whole table:

| Work | 2 players | 3 players | 4 players |
|---|---:|---:|---:|
| Plan flips / action-card plays | 33 | 33 | 28 |
| Bonus-choice steps | 10.5 | 9.8 | 8.5 |
| Plot locations examined by the enumerator | 40.2 | 59.9 | 50.2 |
| Plot/right town-point combinations evaluated | 51.5 | 67.9 | 57.6 |
| Mine placements | 6.3 | 6.4 | 5.6 |
| Available council-colour candidates on chosen Income actions | 2.2 | 4.5 | 3.3 |

The routine deck operation is simple. Placement comparisons are the main workload. A player can shortcut equivalent spaces, so these enumerations are **not a measured count of human lookups or minutes**. In a four-player game, the three Masters together make 84 Plan flips plus about 25.5 bonus choices. A shared deck reduces materials, not the number of decisions. The description that most actions need one or two checks should be understood as the top-level priority checks, not the entire arithmetic and bookkeeping cost.

## 6. Optional quality-of-life improvements

These are suggestions, not additional confirmed rules defects. Preserve the existing difficulty choices and the deliberately minimal Draw only mode.

1. **Embed the three reference cards and the paper rules in Draw only.** A small Rules/Reference button should work offline and return to the same face. Currently `src/page.html:119–149` offers the Plan and deck buttons but no reference access; the rules link is in the digital Guide at line 113. This is the most useful addition for people avoiding printing.
2. **Show recent revealed Plans and allow a few steps of Undo in Draw only.** Keep future cards hidden. A visible draw number and recent-history strip would help catch accidental double taps or uncertainty about which rival just drew. The current one-step persistent Undo works as described; deeper history is optional (`src/paper.mjs:24–25,52–69`).
3. **Persist a small digital Undo history.** Reload currently discards it, exactly as the Guide says (`src/app.mjs:31,626–627`; `src/page.html:109`). Preserve perhaps the last five validated moves with the save, after F1 is repaired. Whole rival-batch Undo already works.
4. **Offer an optional “one Plan at a time” rival review.** Complete its bonus chain before pausing, then show the printed Plan and the action it produced. Keep Play rivals as the fast path. This would make Mincmistr's behavior easier to follow without forcing extra clicks (`src/app.mjs:641–685`).
5. **Provide full selectable card text.** `src/paper.mjs:10` gives a short accessible description but omits the detailed Construct substeps, prize-tile numbers and fallback sequence. A text version would help screen readers, zoom users and players with a small display. No screen-reader session was performed in this audit.
6. **Add a compact mine-choice aid for paper play.** Show the applicable award table, tied-place reminder and the ordered placement tiebreaks together. Give Apprentice its explicit alternate order. The current Choices card summarizes these but requires consulting rules 6.4/9 for some details (`mincmistr/print/build.py:89–100`). This addresses more recurring work than adding another tracking system.
7. **Add a portable browser smoke-test command to the repo.** Keep engine tests fast, and separately test real desktop/mobile browser controls, file import, storage recovery, mode switching and overlays. The audit's jsdom scripts are a useful start but must not be labelled browser-rendering tests.

## 7. Ambiguous rulings and remaining coverage

**R1 — Ius Regale short stack: interpretation, not a new defect.** The app discards the remaining stack and reshuffles on the next attempted Mine draw. Its behavior, count in the journal and regression case match the documented ruling. The event face and appendix do not explicitly settle continuing a discard across exhaustion. Keep the README caveat pending an authoritative clarification (`src/engine.mjs:684–690`).

**R2 — St. Barbara 8 plus Grocer/Innkeeper construction: interpretation, not a new defect.** The app keeps tile 8 current during the nested build and applies the overlapping flip accordingly. The README labels this interpretation. I found no accessible later ruling that settles it (`src/engine.mjs:522–530,588`).

The red-building house removal interpretation is supported by the appendix's specific optional exceptions and the printed effect. It is already documented, and this audit does not reopen it as an unresolved question.

Remaining gaps:

- No live-browser check on this host, mobile touch/viewport test, Safari/Firefox run, physical print/duplex trial, or human tabletop session.
- No independent second implementation of the base-game rules. State validation and legal-action generation are shared dependencies of the simulations; the independent flow/ranking checks reduce but do not eliminate that limitation.
- No exhaustive re-transcription of every economy card, every setup-grid cell, or both physical board shapes in this pass. Existing source data and earlier checks were inspected; the nine-guild-set and fifteen-rock-layout claims from earlier audits are not presented as newly independently proved here.
- No new calibration of the optional tougher three-player Master setting, although its card allowance, saved-game behavior, parity and complete control game were checked.
- Legacy migration was checked with real v0.1.0 fixtures, a v0.2.3 pending-mine save and repository tests, not an exhaustive corpus of every old save.
- Capek is a different solo system and was not tested. Inaccessible official player-aid and BGG clarification sources are noted above.
- No phone timing benchmark or rerun of every historical README strength/skip-trace study. These are fresh audit runs, not a claim to reproduce every published performance table.

## Release verdict and priorities

**Conditional pass for playtesting; hold promotion to a broader release until F1 and F2 are fixed and exercised in a real browser.** Fix F3 alongside them, then prioritize offline reference access. The paper v1.2.2 rules and cards remain suitable for physical playtesting; no new printed-rule correction was confirmed.

Evidence for that verdict: an exact HTML rebuild; 36 passing repository tests; 240 valid stress games; 117,512 matching preview calculations; 1,008 independent mine-ranking checks; 4,266 independently checked paper priority decisions; 5,999 exact paper/app parity decisions; five complete games through the shipped controls; and 1,872 competitive games. Evidence against an unconditional release verdict: the three saved reproductions above and the missing real-browser/physical-play checks. Retain the present difficulty selection and gather human playtest feedback before further strength tuning.
