# Mincmistr automa — lab notebook

Goal (user, 23:12 CST 14 Nov): card-driven tabletop solo opponent for Kutná Hora. Low overhead, competitive,
difficulty modes, no dice, plays like a normal player, no starting VP boosts. Refine overnight; deliver ~07:15.

Reference opponent: the app's `standard` bot (v0.3.0 engine, `engine/src/`). Evaluate with `sweep.mjs`
(24 seeds x 2 seats = 48 games per group; SE ~1.6 VP). Decide on two groups; confirm on a fresh group.

## Structure
- Plan deck: 15 cards, each = 3 goals in priority order + focus (commodity/public) + arrow (low/high).
- Goals: C Construct (Build > Plot > Rights), M Mine, I Income, S St. Barbara.
- Fixed action-card row (v2): Mine/Joker, Rights/StB, Mine/Plot, Build/Income, Rights/Income, Build/Plot.
  Use the leftmost card in the row that shows the action.
- Fallbacks: Joker for first goal, then Income, then Mine, then play leftmost card for nothing.

## Results log (margin vs Standard, automa minus Standard; per 48 games)
| config | group pl | group co | notes |
|---|---|---|---|
| v1 first draft | -21.6 (ord, 24) | | 1/24 wins |
| row v2 + incomeCap25 + rights 'two' + income value + dots + patrician 1/5 + taxReserve + publics prefer@30 | -18.27 | -17.23 | "base" |
| + relative patrician edge | -17.04 | -17.00 | |
| + mine placement spread | -15.81 | -16.56 | |
| + plot tie dotsFirst (most town dots, then cheapest) | -13.21 | -14.94 | 9/48 and 5/48 wins |
| + public weights rep x2 | -10.75 | -13.06 | |
| + Mine needs >= 10 g | -8.04 | -10.98 | |
| + broke rule: coins < 20 -> Income first; card Income only to seat patrician (cap 20) | -6.83 | -8.54 | simpler AND better |
| + pelicans >= 2 -> St. Barbara first | -6.96 | -7.25 | 4 groups (pl co ab cd): -6.67 |
| drop tax reserve (no effect) | | | 4 groups: -6.69 |

BUG FOUND 00:40: card 'focus' never worked (NaN sort). Fixing it made the automa much worse (-14.7).
=> focus removed from the design. Rights = buildable guild tile with highest income value (production x price),
   never buy public rights (they come free from house rows). Identical results (-6.69, 4 groups).

Noise warning: deck reshuffles alone move results ~2 VP on 96 games. Use 4 groups (192 games) for decisions.

Tested, no gain: mine contest/stars keep/rich-mine trigger/Mine-heavy decks, council-first rule (bases too low),
final-round spend module (-1.2), construct cash floor, last-round no-income.
Decks: mixed C-first/M-first all ~-7; pure decks ~-11/-12.

vs other app bots (base, 96 games): Quick +1.8 (51% wins), miner -1.3, council -1.4, denial -3.5, builder -4.4,
baseline -5.6, classic -7.2, standard -6.7.

## Diagnosis (vs Standard, per game)
- Council: automa base green 1.0 / silver 0.75 / yellow 0.5 / red 2.5; Standard 2.4 / 1.1 / 2.0 / 0.7.
  Automa seats ~0.6 patricians/game, late (r5-r6); Standard ~1.3, from r3-r4.
- Cash: automa takes Income with ~9 g in hand (gross 39); Standard with ~25 g (gross 26).
- Mining: automa 5.8 Mine cards, refills paid 1.9, placed 5.1, discarded 0.7; Standard 6.6 / 4.3 / 6.5 / 0.3.
- Builds: automa builds more (5.5 vs 4.1) but scores less town/council.
- Reputation: automa 1.5-2 vs Standard 5.

## Next
- Council: seat earlier / more often (relative edge, lower coin floor).
- Reputation: Joker cost, public rep.
- Mining: afford placement; refill when pool empty.
- Difficulty modes via rule modules (not VP).

## 01:00-01:50
- Fixed NaN sort in free-right choice and made seat-from-bank use edge: +1.1.
- Never use the Joker: no loss (simpler). Rights only if holding fewer than 2 rights: no loss (simpler).
- Mine needs 10 g: redundant with cash rule -> removed. Plot tie 'next to public' removed (noise).
- 32 row policies enumerated (all distinct row behaviours): v2 is best (-6.69 vs next -7.22).
- Clean rules module mincmistr.mjs written; decision-by-decision equivalence with lab automa: 0 mismatches, all 4 levels.
- Fresh seeds f1-f8 (384 games each), results_v1.txt: Journeyman vs Standard -7.0 (25% wins), vs Quick +1.95 (58%).
  Apprentice ~ Quick (-0.35). Master (extra card r4-6) -2.2 vs Standard (44%). Grandmaster +2.2 (60%).
  Checks per card 1.35. Tuning groups were ~1.8 VP optimistic (selection bias).
- Council goal fires on 0.2% of card plays -> removed from plan cards (noI deck identical: -5.51 vs -5.49, 8 groups).
  St. Barbara on cards is worth ~0.8 VP (zeroS -6.32). More S or 3-goal cards: no gain.
- Guild order rules (price asc/desc) no better than random.

## 01:30-02:10 — v1.0 frozen, deliverables checkpoint
- Two-goal deck adopted (Council goal removed; CM x7, MC x4, CS x3, SC x1). Clean module updated; equivalence 0 mismatches.
- HOLDOUT h1-h8 (384 games/cell): Apprentice Q -0.7 (47%) / S -9.5 (20%); Journeyman Q +1.6 (58%) / S -6.8 (27%);
  Master Q +6.1 (74%) / S -2.0 (47%); Grandmaster Q +10.5 (87%) / S +2.9 (63%). checks/card 1.13.
  Journeyman vs other policies h1-h4: miner +0.4, denial -1.1, builder -1.6, council -1.9, baseline -3.2, classic -5.3.
- Overhead per game: 30 card plays, ~6 rights choices (2-3 candidates), ~6 plot choices (~7 legal plots, ~43 town-point checks),
  ~5.5 mine placements, ~8 bonus steps, ~3 edge checks.
- Deliverables in out/: PDF (8 pp), rules md, sim report md, sample game md, source zip.
- Rejected after v1: public-build priority, build-cost caps (very bad), last-round cash 0/10, ore bonus, guild order rules,
  plot-first, Mine-heavier deck. Contest placement +0.9 (tuning) / +0.4 (f-groups): not worth the overhead.
- 3p/4p with several Mincmistrs runs without stalls (balance untested).

## 02:20-03:10 — v1.1
- Paired-rollout analysis (rollout.mjs): at each card play where Standard would choose differently, play out both
  choices with the Mincmistr continuing; d = margin(Standard's choice) - margin(Mincmistr's choice). v1.0: mean d -0.19
  over 1794 disagreements, but St. Barbara suggestions +4.2 (n=52) and Joker-St.Barbara +5.2 (n=45), mostly with 1 pelican,
  rounds 5-6, prize tiles 6,7,8,9,11.
- Blanket single-pelican rules (rounds 4-6 etc.): within noise. Tile-specific "1 pelican on tile 6/7/8/9/11": +0.7 tuning,
  +1.0 fresh. With contest placement: +1.55 tuning, +1.66 fresh. Adopted both (v1.1). Apprentice keeps simple placement.
- Rollouts with v1.1: mean d -0.03 (n=1760); no Standard single-move deviation is better on average. J-plot +2.0 (n=47,
  late-game, no plot held) is the only residual signal; small and Joker-dependent, not pursued.
- Rejected: cost-aware rights, avoiding St. Barbara tiles 3/5.

## 03:10 — v1.1 holdout (h1-h8, 384 games/cell) — FINAL NUMBERS
Apprentice Q +0.0 (51.6%) / S -8.9 (21.4%); Journeyman Q +3.3 (64.3%) / S -5.8 (30.2%);
Master Q +7.6 (77.3%) / S -1.0 (50.3%); Grandmaster Q +12.2 (86.7%) / S +4.5 (70.3%).
Ladder vs S by N final rounds with double last turn: 0 -5.8, 1 -4.4, 2 -2.6, 3 -1.0, 4 +1.6, 5 +3.7, 6 +4.5.
Journeyman vs others (h1-h4): miner +1.9, denial +1.2, council 0.0, builder -0.2, baseline -0.9, classic -3.5.
Equivalence final: 0 mismatches, 883-1029 decisions per level. Per-setup margins within noise.
Deliverables rebuilt with ./package.sh -> out/.

## 03:30 — wrap-up
- Second holdout set h9-h16 added for vs-Standard cells (768 games): Apprentice -9.1 (19.7%), Journeyman -5.1 (32.7%),
  N1 -3.7, N2 -2.1, Master -0.3 (50.4%), N4 +2.2, N5 +4.0, Grandmaster +5.5 (71.0%).
- Targeted rollouts for plot/build choices: plot choice d=+0.2±0.4 (fine); build: Standard sometimes builds the public
  building first (+2.5, n=23) but blanket public-first rules give nothing (tested all rounds and rounds 5-6).
- Reversing plan goals in late/early rounds: no gain. Independent flow check of rule 4: 0 mismatches in 1200 card plays.
- v1.1 is final. Deliverables in out/ (./package.sh rebuilds everything).

## 03:30 — check-ins 1 and 2 arrived late (after delivery)
Their asks (balance across levels, overhead, fresh-seed confirmation) are already covered above: 768-game holdout ladder,
overhead per game, f-group confirmation of every v1.1 change. No change to v1.1.

## 03:55 — check-in 3: exploit tests (exploit.mjs, h1-h4, 192 games; baseline J vs S -4.81)
- Rights denial: impossible in 2p (guild sets never overlap) -> 0 denials.
- Prize St. Barbara racing: 0.23/game, -4.85 (no effect).
- Plot blocking (its next best plot, >=2 town points, cost <=6): 1.04/game, -4.04 (helps the Mincmistr).
- Wording re-read: no changes needed; equivalence and flow checks still pass. Report gains an "Exploit tests" section.

## 05:20 — check-in 4
PDF (8 pp: rules 1-4, cards 5-8), rules md, report (with exploit section), sample game and source zip were already built
and delivered at 03:30/03:55. Re-verified: deliverables present, equivalence 0 mismatches, flow check 0 mismatches. No changes.

## 06:51 — final check-in 5
- Fresh seeds z1-z4 (192 games): Journeyman vs Standard -5.6 ±0.8 (29.7%); Master -1.2 ±0.8 (44.8%). Consistent with holdout.
- Rules = code: equivalence 0 mismatches at all four levels; flow check 0 mismatches (1200 card plays).
- PDF re-rendered and reviewed: 8 pages, rules 1-4, card fronts/backs 5-8, no overflow.
- Deliverables re-sent. v1.1 final.

## 07:15-08:00 — v1.2 (multi-player), pushed to claude-mincmistr
- Extra-card rounds now counted as in a 6-round game (4p: Master = rounds 3-5). 2p unchanged (equivalence 0 mismatches).
- multisim.mjs (fresh seeds x1-x4). Standard as you vs 2/3 Mincmistrs, win rate (fair 33/25%):
  Apprentice 70.1/64.3, Journeyman 57.3/48.4, Master 37.2/24.7, Grandmaster 18.1/18.5. Quick as you vs Journeyman 15.6/14.8.
- One Mincmistr vs 2/3 Standard: Journeyman 11.1%/13.5%, Master 29.9%/30.2%.
- Rules 1.2: section 10 "Two or three Mincmistrs", edge vs best opponent, Master = last three rounds.
