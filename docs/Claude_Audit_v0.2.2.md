# Kutná Hora Solo v0.2.2 playtest: rules and release audit

**Audited:** `ramyahoo88/Kutn-_Hora_Solo`, branch `v0.2.2-playtest` at `2615392` ("Prepare v0.2.2 for playtesting"), compared with tag `v0.2.1` (`67fb341`). Shipped `Kutna_Hora_Solo.html`, SHA-256 `a40133d37ea74b96896f4dba426367cf10b9f5017b88feba2148cf0bfded0cda`. Node 22.23.4, Chromium (Playwright). Audit date: 14 Nov 2026.

## Release verdict

**Ready for playtesting. I found no confirmed defects.** The two changes, a seeded rival house-row order and the Ius Regale short-stack ruling, behave as the README and Guide describe. The v0.2.1 house-row fix still holds. Saves from v0.2.0 and v0.2.1 load unchanged and keep their guild rows. The README playtest steps all work as written in the shipped page.

**Not on `main` or tagged yet.** Merge and tag it after the two human playtests and the Safari check, which I could not run here.

| Check | Result |
| --- | --- |
| Byte-for-byte rebuild | Pass |
| Tests | 16/16 pass |
| README benchmark | Reproduced exactly: 91/144, +3.39, every row |
| v0.2.1 fix (third house row) | Still passes |
| Old saves (v0.2.0 and v0.2.1) | 1,073 positions load unchanged; 48 played on to a valid end |
| Fuzzed full games | 600 games, 52,219 transitions, 0 invalid states |
| Preview vs applied | 73,209 actions, 0 mismatches |
| Rival information boundary | 312 decisions, 0 changed |
| README playtest steps in the app | All pass in Chromium |

## 1. Release verification

| Check | Command | Result |
| --- | --- | --- |
| Rebuild to a separate path | `node build.mjs /home/claude/audit/rebuilt-022.html` | Written |
| Byte comparison | `cmp rebuilt-022.html Kutna_Hora_Solo.html` | **Identical** |
| Working tree | `git status --short` | Clean |
| Tests | `node --test test/engine.test.mjs` | 16 pass, 0 fail |
| README benchmark | `node test/arena.mjs 12 baseline,quick,builder,miner,council,denial kutna-v020-fresh` | 91/144, +3.39. All six rows match the README. |

**What changed since v0.2.1:**

- **`src/engine.mjs:41-57`:** when no order is given, the rival's three house rows are shuffled with a separate generator seeded from `rival-houses/<seed hash>/<card>/<set>`, so the market, mines and decks keep their seeded order.
- **`src/engine.mjs:566-571`:** only a comment changed. The Ius Regale code is the same as in v0.2.1.
- **Text:** the event text in `src/data.mjs` and a new Guide paragraph.
- **Tests:** three new tests and an updated first test.
- **New fixture:** `test/fixtures/Ius_Regale_Short_Stack.json`.
- **Shipped page:** differs from v0.2.1 only in those lines.

## 2. Rules review of the changes

**Rival house rows.** Setup (rulebook p.7) says each player places their guild tiles in the rows of their choice. A seeded random order is a reasonable stand-in for a rival that doesn't choose by evaluation. The new Guide paragraph correctly says that the printed setup has the second player pick a guild set first, and that the app lets you choose either set.

**Ius Regale ruling.** The event card says to discard the next five mine tiles. The rulebook says that "if you try to draw a mining tile and can't," the whole discard pile is reshuffled. The app discards up to five from the current stack and reshuffles at the next draw. That is a defensible reading, and the README labels it as the app's interpretation. The other literal reading, reshuffling immediately and continuing to discard up to five, is not ruled out. This stays a **ruling question**, not a defect.

**Nearby cases** (`ius_nearby.mjs`):

| Tiles left before Ius | Draw size | Result |
| --- | --- | --- |
| 6 | 1 | One tile survives. The next draw takes it with no reshuffle. |
| 6 | 2 | The draw takes the surviving tile, then reshuffles the 25 discards for the second tile. |
| 5 | 1 | Stack empty. The next draw reshuffles all 26. |

All three follow the draw-time reshuffle rule.

**Rechecked fixes:**

- **Third house row:** the v0.2.0 audit probe still prints PASS (1, 3, 4 reputation, then 8 VP).
- **Red-building house removal:** still mandatory, as recorded in the README.

## 3. Materials players receive (tested in the shipped page)

All of this was run through the app's own controls in Chromium (`browser_playtest_steps.py`).

**README Game 1** (default game, Card 1, seed `silver-1308`):

- Rival rows show **Builders, Grocers, Scribes**, on the player line and on the rival's player board. That matches the README.
- The Guide shows the new guild-setup paragraph.

**README Game 2** (New game: Card 6, second set, Rival starts, seed `kutna-v022-playtest-2`):

- The game starts with you on Metallurgists, Builders and Grocers.
- Rival rows show **Scribes, Miners, Innkeepers**, matching the README. The rival played its turn.
- Export then import gave a byte-identical state.

**README Safari steps** (run in Chromium):

1. The fixture imports. The event panel shows Ius Regale with the new text, and the mine panel shows "3 in stack".
2. **Play a card with no effect** offers the two remaining cards. "Continue with no effect" ends Round 1: ore goes 0 → 2, the stack 3 → 0 and the discards 24 → 27.
3. You start Round 2. The next Mine draw reshuffles: the stack shows 26, with one tile drawn.
4. Undo steps back through the draw, then the round end (round 1, stack 3). Reload restores the autosave. No console errors.

**General regression** (same script as the v0.2.0 audit):

- Mine preview matched the applied result.
- Undo, reload and the rival turn all worked.
- Export and import worked. A damaged import was rejected, and a corrupted autosave showed the recovery banner and download.
- At 390 px phone width there is no horizontal overflow.

## 4. Simulations and the rival

**Old saves:** saves written by the v0.2.0 and v0.2.1 engines at every position of 12 bot games load in v0.2.2.

- All 1,073 positions loaded unchanged, and every one kept both players' guild rows.
- Every 25th position, 48 in all, was continued on v0.2.2 to a valid final score.
- This is in addition to GPT's 1,440 positions.

**Fuzz, previews and information boundary:**

- 600 complete random-legal games produced no invalid states.
- Previews matched the applied result on all 73,209 actions tested.
- None of 312 rival decisions changed when RNG, deck orders, stack orders under the top tiles, future events and red order were scrambled.

**Scripted strategies against Standard** (12 seeds, each played with the script in both seats):

| Strategy | Script wins | Mean margin |
| --- | ---: | ---: |
| Greedy builder | 1/24 | −21.9 |
| Mine rush | 1/24 | −15.0 |
| Never pay tax | 1/24 | −24.5 |
| Plot blocking | 1/24 | −23.5 |
| Pelicans and public buildings | 0/24 | −24.5 |

I found no exploit. The results are in line with v0.2.0.

**Does the random row order make the rival weaker or stronger?** I played 24 seeds with each of the rival's six orders: Standard rival against Standard with printed rows, 144 games (`row_orders.mjs`).

- The rival's best and worst order on a seed differ by about 18 VP on average.
- The seeded order's mean margin was −0.04, about even with the stand-in player.
- The apparent best guild for the reputation row (Metallurgists, +5.3) did not hold on 24 fresh seeds (−0.3). Builders swung from +1.6 to −5.3.

So the spread is game-to-game variation, not a systematic handicap: **no finding**.

## 5. Findings

**Confirmed defects:** none.

**Ruling questions** (unchanged; no action needed unless CGE rules):

- **Q-A. Ius Regale, short stack.** As described in section 2. The README records the app's interpretation.
- **Q-B. St. Barbara tile 8 with a Grocer or Innkeeper build.** Already documented as awaiting a published ruling.

**Optional improvements:**

- **O1. Show the rival's real row order in New game.** The dialog note reads "Rival guilds · Innkeepers · Scribes · Miners" (printed set order, `src/app.mjs:514`). Game 2's README check expects the rival's rows to be Scribes, Miners, Innkeepers, which appear only after starting.
  - **Impact:** a playtester may think the order is wrong.
  - **Smallest fix:** label it "Rival guild set (row order set by seed)". Alternatively, compute the order from the seed field with the same `rival-houses/…` generator.
- **O2. Log how many mine tiles Ius discarded.** The journal says only "Ius Regale Montanorum resolved." (`src/engine.mjs:582`). The Safari step asks testers to confirm three tiles were discarded, which they can only infer from the stack count.
  - **Smallest fix:** in the `code` case, log ``Discarded ${discarded.length} mine tiles.``
- **O3. The fixture is an artificial position.** Its discard pile holds 24 tiles in Round 1 with no mines placed. That's fine for testing the event, but a sentence in the README would stop testers wondering about it.
- **O4. Carried over:** Undo history is lost on reload, and the St. Barbara tile 7 preview doesn't show the actual reputation amount.

## 6. Priorities and coverage gaps

**Priorities:**

1. Run the two human playtests and the Safari check from the README.
2. Optionally, make O1 and O2 before playtesters start; both are text changes.
3. Merge to `main` and tag v0.2.2.

**Not covered:**

- Safari and Firefox (Chromium only).
- Human play.
- Tabletop mirroring.
- The two-player town layout beyond an angled photo.
- The Capek variant (its PDF needs a sign-in).

**Evidence scripts:** all scripts used in this audit are in [`audit/v0.2.2/`](../audit/v0.2.2/), with a README. The browser steps are in `browser_playtest_steps.py`.
