# Kutná Hora Solo v0.2.0: rules and release audit

**Audited:** `ramyahoo88/Kutn-_Hora_Solo`, `main` at `48fccc5` ("Add Kutná Hora Solo v0.2.0 source and build instructions"). Shipped file `Kutna_Hora_Solo.html`, SHA-256 `eacc454c7744314bd3d0aad623648908739e99349c4179d689582990d567eb23`. Node 22.23.4. Audit date: 14 Nov 2026.

## Release verdict

**Do not tag v0.2.0 as rules-accurate.** One rules error is confirmed: the third house row on the player board pays the wrong rewards. It affects reputation, and therefore points, for any player whose third row reaches its second house. The fix is one line of data plus one regression test. I applied both to a scratch copy, and all 13 tests passed there. Everything else I checked matches the rulebook and the printed cards.

**Release v0.2.1 once F1 is fixed.** The build, tests, saves, previews and rival's information boundary all held up under the checks below.

| Area | Result |
| --- | --- |
| Byte-for-byte rebuild | Pass |
| Shipped test suite | 12/12 pass |
| README benchmark | Reproduced exactly |
| Component data against printed sources | One error (F1) |
| Preview vs applied result | 73,529 actions, 0 mismatches |
| Fuzzed full games | 600 games, 0 invalid states |
| Rival information boundary | 317 decisions, 0 leaks |
| Exploit search against the rival | None found |

## 1. Release verification

| Check | Command | Result |
| --- | --- | --- |
| Rebuild to a separate path | `node build.mjs /home/claude/audit/rebuilt.html` | Written |
| Byte comparison | `cmp rebuilt.html Kutna_Hora_Solo.html` | **Identical** (same SHA-256 as above) |
| Working tree | `git status --short` | Clean |
| Tests | `node --test test/engine.test.mjs` | 12 pass, 0 fail |
| README benchmark | `node test/arena.mjs 12 baseline,quick,builder,miner,council,denial kutna-v020-fresh` | 84/144 wins, +3.00 mean VP difference. Every opponent row matches the README table. |

## 2. Sources and how each was checked

- **CGE English rulebook (PDF).** I checked the text, plus the page art on p.6 (player setup board) and p.12 (house diagram under "The Building Action"). I viewed both pages zoomed in a browser.
- **CGE companion app bundle** (`kutnahora.czechgames.com/static/js/main.2dea7b0b.js`). I compared all six price tables, the per-column `[build demand, town build]` thresholds, and the two-player rows of guild setup cards 1–9 against `src/prices.mjs` and `src/data.mjs`.
- **ludex.dev component pages.** I used its building, mine, St. Barbara, event, reputation and tax tables and its FAQ. I also used its images of all 15 mine setup cards (top grid for two players) and the printed mine tile III–3.
- **CGE two-player article photo** (`DSC06225.jpeg`, the two-player board side). From it I read the mine-row award labels and the four board-edge villages.
- **Not available:** the Capek PDF needs a sign-in, so it was not compared, as the README already says. I found no published errata beyond the ludex FAQ's official rulings.

One source conflict is resolved: ludex's text table lists mine III–3 as "no stars". The **printed tile image shows two stars**, 2 ore and cost 2, so v0.2.0's change to two stars is correct.

## 3. Confirmed findings

### F1. The third house row pays 1/2/3/4 reputation + 8 VP instead of the printed 1/3/4 reputation, then 8 VP

- **Severity:** High. This affects scoring.
- **Player impact:** Whichever guild sits in your third house row gets the following:

  | Building in that guild | Printed reward | App gives |
  | --- | --- | --- |
  | 2nd | +3 reputation | +2 reputation |
  | 3rd | +4 reputation | +3 reputation |
  | 4th | 8 VP | +4 reputation and 8 VP |

  The rival's third printed guild is affected the same way. The difference changes when a player reaches the 3+ plot discount and the 6+ free Joker. It also changes final reputation points, which are worth 1/2/4/6/8/10/13 at 3–9. In 24 Standard-vs-Standard games on the shipped engine, 11 of 48 seats took two or more houses from row 3, and 8 of the 24 games were decided by 3 VP or less.
- **Rule:** Rulebook p.6, Player Setup board art: row 3 prints reputation flags **3** (2nd space) and **4** (3rd space), then **8** points (4th space). The p.12 house diagram shows the first space as reputation **1**. Rows 1 and 2 print public rights or a pelican, then +1 VP, +3 VP and 8 VP, and the app has those correct.
- **Reproduction (importable save):** Import [`audit/v0.2.0/Kutna_Audit_HouseRow3.json`](../audit/v0.2.0/Kutna_Audit_HouseRow3.json). It is card 1 with you on Metallurgists, Miners and Innkeepers, with Innkeepers in row 3. One Innkeepers house is already gone, reputation is 1, you hold Tavern, and you have a plot at C3.
  1. Open **Player board**. The Innkeepers row shows **Next build reward: +2 reputation**.
  2. Pick **Building** on the Building/Income card. The target is Tavern at C3 for 15 g. The preview reads "… Reputation +2 …".
  3. Confirm.
- **Expected:** Reputation 1 → 4. **Observed:** Reputation 1 → 3. I confirmed this in the shipped HTML through its controls (Chromium).
- **Source:** `src/data.mjs:45`
- **Smallest fix:**
  ```diff
  -  [{rep:1},{rep:2},{rep:3},{rep:4,vp:8}],
  +  [{rep:1},{rep:3},{rep:4},{vp:8}],
  ```
  The player-board "Next build reward" text and the build preview read this table, so they correct themselves.
- **Runnable assertion:** It is included in [`audit/v0.2.0/house-row-3-fix.diff`](../audit/v0.2.0/house-row-3-fix.diff), which `git apply --check` accepts against `main`.
  ```js
  test('third house row pays the printed 1, 3 and 4 reputation, then 8 points',()=>{
    const observed=[];
    for (let removed=0; removed<4; removed++) {
      const game=createGame({seed:'house-row-3'});
      const p=game.players[0];
      p.houses[2]=removed; p.coins=200; p.held=['tavern']; game.city[14]={plot:0};
      const next=play(game,{kind:'build',id:'tavern',space:14,card:2});
      observed.push([next.players[0].rep-p.rep,next.players[0].vp-p.vp]);
    }
    assert.deepEqual(observed,[[1,0],[3,0],[4,0],[0,8]]);
  });
  ```
  The test fails on v0.2.0 (`[1,0],[2,0],…`). With the fix, all 13 tests pass and the build succeeds.
- **README follow-up:** With the fix, the README benchmark seeds give **87/144 wins, +3.40** (previously 84/144, +3.00). The README results table needs updating.

## 4. Rulings to settle (ambiguous, not counted as defects)

**Q1. Is the red-patrician building's "remove a house" optional?**
The app forces it. When removal comes from a red building, the house choice offers no "Continue" (`src/engine.mjs:257`, triggered at `:363`). The rulebook allows "Whenever you take an action, you can choose for it to have no effect." It states optional parts only for St. Barbara tile 3 and the house reward for free public rights. For red buildings, it shows only the "Remove 1 house" icon.

- **Impact:** With houses at `[3,3,3]`, every row's next house sits on an 8 VP space. The player must remove one and give that space up permanently, although removal also completes a red-patrician column.
- **Repro:** Run `node probe_edges.mjs` in [`audit/v0.2.0/`](../audit/v0.2.0/). Line `1` prints house choices `silver, ore, beer` and no skip option.
- **Suggested change, if you rule it optional:** Make line 257 `return [...choices,skip];`. Only tile 3 and red buildings create a house choice.

**Q2. St. Barbara tile 8 overlapping a Grocer or Innkeeper build.**
This is already documented in the README. Observed: tile 8 plus a Bakery ends with tile 9 current and tax +1, the tax printed on tile 8. Leave it as is until CGE rules on it.

**Q3. Ius Regale Montanorum with fewer than five mine tiles left.**
`src/engine.mjs:559-562` discards only what remains. With 3 left, the result is deck 0 and discard 27. The rulebook says to reshuffle the discards "if you try to draw a mining tile and can't", but it does not say whether "discard the next five" continues through that reshuffle. This is rarely reachable, because Ius only appears in rounds 1–3. If you rule that it continues, discard through `popMine` five times.

**Checked, no change needed:** A mine entrance beside an existing mine costs a flat 2 wood. The rulebook and FAQ both say "a mine entrance costs 2 wood", and other squares take the highest neighbouring cost.

## 5. Optional improvements

- **S1. Let the rival choose its house rows.** Its row order is always the printed order (`src/engine.mjs:46-48`), while you choose yours. Row rewards differ (public rights / pelican / reputation), so a rival choice or a seeded random order would be more faithful. Also, the printed setup has the second player choose a guild set first. The app lets you pick both seat and set, which is fine as a setup option but worth one line in the Guide.
- **S2. Undo history is lost on reload.** Autosave restores the position, but Undo is disabled afterward (`src/app.mjs:35`, in memory only). Either mention this in the Guide or persist the last few positions.
- **S3. Show the actual tile 7 amount.** The St. Barbara tile 7 preview could state the reputation it will give ("+N reputation"), not just the rule text.

## 6. Everything verified as correct

| Area | Checked against | Result |
| --- | --- | --- |
| 24 guild buildings: wood, plot, production, population, dots, flip icon | ludex tables | Match. All Grocers and Innkeepers flip St. Barbara. |
| 12 public buildings: points, pelicans, reputation, population, tax, dots, house removal | ludex tables | Match |
| 27 mine tiles and 4 technology tiles | ludex tables, plus printed image for III–3 | Match. III–3 = 2★, 2 ore, cost 2. |
| Price tables for all six commodities | Companion bundle | Match |
| Red-X and town-build thresholds | Companion `[demand, build]` pairs | Match |
| Ore priced by the Metallurgists' price indicator | Companion | Match |
| Guild setup cards 1–9 (two players) | Companion | Match |
| 15 rock layouts (two-player grid) | Printed mine setup cards | Match |
| Mine-row awards 0–3★ 2/0, 4–6★ 4/1, 7+★ 6/2; rock stars counted; ties take full value; 0★ scores nothing | Two-player board photo, FAQ | Match |
| Town edge villages: blue, yellow, silver, red | Board photo | Colours match. Placement is only consistent with a perspective photo, not exactly measured. |
| St. Barbara tiles 1–11: effects and taxes 0,1,1,1,2,3,2,1,1,1,–; after tile 11, +2 reputation | ludex, FAQ | Match |
| 10 events: values, reveal-time tax, round-end effects before taxes | ludex, FAQ | Match |
| Reputation −5..9 points; ±2 VP per step beyond the track; tax losses 1,1,1,2,2,3 | Board art, ludex | Match |
| Plot surcharge 3/8; tax cap 25; King doubles track and plot tax; Land Rush skips all taxes | ludex, FAQ | Match |
| 2/2/1 cards per turn; 40/41 starting groschen; 1+8 miners; 3 plots; refill rules; technology miner from reserve | Rulebook, FAQ | Match |
| Plot adjacency and pricing, 3+ reputation discount, Joker reputation loss before pricing | Rulebook, ludex | Match |
| Building without a needed house has no effect | Rulebook ("entire action … no effect") | Match (offered as illegal) |
| Free public-rights house reward can be skipped and its VP still kept | Rulebook | Match |
| Patrician scoring formulas; rounds 4–6 after taxes; red buildings arrive after round 3 | Rulebook, ludex | Match |
| Final scoring categories and groschen tiebreak | Rulebook, ludex | Match |

## 7. Play-through and boundary testing

**Shipped HTML, driven through its own controls** (Chromium via Playwright):

- **Screens and controls:** start screen, both player boards, the Rights panel, rival turn, and the New game dialog.
- **Mine draw and placement:** The preview read "Ore production +2 · Population +1 · Ore deck +2 · Wood 2 → 3 g · Beer 5 → 6 g · Ore 3 → 2 g · Silver 4 → 5 g". It matched the applied result: 40 → 36 g, ore production 0 → 2, population 0 → 1, ore deck 0 → 2.
- **Undo and reload:** Undo restored the drawn tile, and reload restored the autosave.
- **Saves:** Export and import round-tripped. A corrupted import was rejected ("Save has an invalid shared tracks"). A corrupted autosave showed the warning banner and the "Download unreadable save" button.
- **Console and phone width:** There were no console errors, and a 390 px phone width has no horizontal overflow.

**Preview vs commit:** I tested every legal action in 150 random games. All 73,529 matched; round-ending moves are excluded by design, because the preview leaves out round-end steps.

**Fuzzed full games:** I ran 600 complete random-legal games (52,193 transitions). `checkGame` ran after every step, and saves round-tripped every 7th step. There were 0 errors. The runs covered 79 mine-stack reshuffles, technology level 3, and a completed cathedral.

**Information boundary mid-game:** I re-ran 317 rival decisions with all hidden information scrambled: RNG, tile order within each mine tier and after reshuffles, stack order under the top tiles, future events, and red order. **No decision changed.**

**Scripted strategies against Standard** (12 seeds, each played with the script in both seats):

| Strategy | Script wins | Mean margin | Rival VP |
| --- | ---: | ---: | ---: |
| Greedy builder | 0/24 | −20.8 | 51.7 |
| Mine rush | 1/24 | −14.6 | 36.8 |
| Never pay tax | 1/24 | −27.8 | 53.7 |
| Plot blocking | 0/24 | −22.0 | 52.0 |
| Pelicans and public buildings | 0/24 | −27.8 | 56.2 |

I found no farmable loop or forced wasted turns. Contesting mines is the most effective way to hold the rival's score down.

**Rival strength on fresh seeds** (`audit-fresh-nov14`, 36 seeds × both seats):

- **Standard vs Quick:** 49/72, +4.88. Standard is clearly stronger.
- **Standard vs the earlier evaluator:** 38/72, +0.69. v0.2.0's planning change shows no measurable gain. The README's 13/24, +1.29 is within noise.

## 8. Priorities and coverage gaps

**Fix order:**

1. F1 plus its test. Then rebuild and update the README benchmark.
2. Rule on Q1.
3. Q3 and S1–S3 when convenient.

**Not covered:**

- No human playtest and no tabletop mirroring session.
- Chromium only; Firefox and Safari were not tested.
- The two-player town shape and edge-village placement were checked only against a perspective photo.
- v0.1.0 save migration was checked only through the repo's own test.
- The scripted strategies are simple, so a strong human may find lines they don't.

## Handoff for v0.2.1

This branch leaves `src/` and `Kutna_Hora_Solo.html` unchanged, so `main`'s byte-for-byte rebuild of v0.2.0 still holds. The fix ships as a patch for the next release.

1. Apply the F1 patch from the repository root: `git apply audit/v0.2.0/house-row-3-fix.diff`. It changes `src/data.mjs:45` and adds one test.
2. Bump `VERSION` in `src/data.mjs` to `0.2.1`, run `node build.mjs`, and copy `dist/index.html` over `Kutna_Hora_Solo.html`.
3. Run `node --test test/engine.test.mjs`. 13 tests should pass.
4. Rerun the README benchmark and update its table. With only the F1 fix, the result is 87/144 wins and +3.40, and the per-opponent rows change.
5. Decide Q1 (red-building house removal), and record the ruling in the README's "Sources and current rulings" list.
6. Optional: S1–S3 and Q3.

The evidence scripts are in [`audit/v0.2.0/`](../audit/v0.2.0/). After the fix, `node probe_houses.mjs` there should print PASS.

## Sources

- [CGE rulebook (EN)](https://filemanager.czechgames.com/storage/files/kutna-hora-the-city-of-silver/rules/kutna-hora-rules-en.pdf)
- [CGE companion app](https://kutnahora.czechgames.com/)
- [CGE two-player article](https://www.czechgames.com/news/diving-into-the-two-player-game-experience-in-kutna-hora)
- [ludex: cards and components](https://www.ludex.dev/kutna-hora/cards/), [buildings and St. Barbara](https://www.ludex.dev/kutna-hora/buildings/), [end of round](https://www.ludex.dev/kutna-hora/end-of-round/), [scoring](https://www.ludex.dev/kutna-hora/scoring/), [FAQ](https://www.ludex.dev/kutna-hora/faq/)
