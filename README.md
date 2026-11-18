# Kutná Hora Solo v1.1.1

An unofficial tabletop companion for Kutná Hora: The City of Silver. Play one seat against one, two or three rivals with your physical mine tiles and event cards. The app runs the rivals and tracks the town, mines, market, council and scoring. The same HTML works offline. Export and import a JSON save to move a game between copies.

Open the **Physical setup checklist** in **New game** or under **Guide → Guide**. Match the seats, guild rows, board sides and rock tiles shown in the app. Set the face-up building offers and stack positions to match **Town hall**. Keep the other tiles grouped by stack so you can find each tile the app names as an offer changes. Set aside the red buildings until the app adds them.

Shuffle your mine tiles within each printed tier and stack I above II and III. When prompted, enter the drawn tiles' values in order. The app selects a placement for a rival and asks you to discard the unplaced tiles. Unfinished mine entries survive a refresh of the same tab when browser storage is available. With events enabled, deal the base A and B event cards to the round track and enter each revealed card by title. The app applies the effects. Move the physical pieces to match the app.

Tabletop saves open in v1.1 and later tabletop builds. If this browser has an earlier digital autosave, use **New game → Export previous digital save**. To continue a digital game, import its save into a digital build such as v1.0.

To play offline, open [Kutna_Hora_Solo.html](Kutna_Hora_Solo.html) on GitHub, choose **Download raw file**, and open the downloaded file in your browser.

Open **Guide** to read the full Mincmistr rules. Use the tabs to switch to the reference cards, table reference, mine choice aid or the app guide.

Use **Tabletop game** for automated rivals and game tracking. Choose **Draw only** if you want to run the Plan deck and resolve the Mincmistr yourself at the table. Tap **Draw Plan** once per Mincmistr action card. One shared 15-card deck supports one to three Mincmistrs. **Rules and reference** opens the reference cards, full v1.2.7 rules and two printable aids. **Export deck** and **Import deck** move the deck, recent draws and five Undo steps between devices. Bookmark the page with `#draw-only` to open the deck directly.

Choose a rival count in **New game**. Pick your guild set from that player count's setup card and arrange your house rows. The seed assigns each remaining set once and determines the rivals’ house rows. At larger tables, **Play rivals** runs through consecutive rival turns and tax decisions. It pauses for physical draws, your choices and final scoring.

Choose **Mincmistr** under **Rival difficulty** to play the v1.2.7 tabletop variant directly in the app. Choose Apprentice, Journeyman, Master or Grandmaster for one to three Mincmistrs. With several Mincmistrs, choose a shared deck or one per rival. At a three-player table, Master offers the tougher rounds 3–6 option from rule 10. **Play one Plan** marks the town and mine spaces it changed and shows changes to miners, production, houses, patricians and other resources. If the Plan triggers a market removal, the review names the tile. Any automatic round-end effects appear below the Plan changes. Tap a coordinate in the review to jump to that space. **Why this move?** shows the checks and tie-breaks, including for Plans played as a batch. The journal preserves these details. Rule numbers open the relevant text offline. [Tabletop rules and printables](mincmistr/README.md)

Write observations in **Game note** in the journal. The note is saved with the game and travels with **Export game report**. When the save warning appears, **Export game and note** keeps the position and latest note from this tab. Use **Import save** to open either copy. The journal shows the original report versions and the version that re-exported it when they differ. If the report includes a previous position, choose **Load position before this step** in the journal to replay the move. **Undo** immediately afterward returns to the imported position.

The app automatically clears zero tax bills. Choose **Undo** immediately after starting a new game to restore the previous game. Tabletop game keeps up to five Undo steps after reload. Each mode uses its own autosave. If another tab advances a save, load the latest position when prompted. Draw only preserves unreadable saved decks until an explicit reset. Individual Mincmistr decks use different seat inputs even with a 64-character seed. [v0.3.4 audit](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/c6149d3350981c5507b3ca7279c579d9e767d5f6/docs/Astra_Audit_v0.3.4.md)

Choose **Planner** under **Rival difficulty** at any table size. It forecasts intervening turns before choosing its follow-up, compares five possible tile orders when leading plans are close, checks whether it can use the exact plot or right it is about to buy, and scores likely finishes once it has three cards left in the final round. Standard is the default.

| Rivals | Total players | Rounds | Board | Red buildings enter after | Events |
| ---: | ---: | ---: | --- | ---: | --- |
| 1 | 2 | 6 | 18 town spaces, 5 mine columns | Round 3 | On |
| 2 | 3 | 6 | 30 town spaces, 7 mine columns | Round 3 | Optional, default off |
| 3 | 4 | 5 | 30 town spaces, 7 mine columns | Round 2 | Optional, default off |

The larger boards use their printed rock layouts, edge villages and mine rank awards. The council scores in the last three rounds at every table. Optional events use A cards before the red buildings arrive, B cards afterward, and leave the final round empty. [CGE English rulebook](https://filemanager.czechgames.com/storage/files/kutna-hora-the-city-of-silver/rules/kutna-hora-rules-en.pdf)

The board uses original diagram styling and component facts. The banner is cropped from [St. Barbara’s Church by Txllxt TxllxT](https://commons.wikimedia.org/wiki/File:Kutn%C3%A1_Hora_-_St._Barbara%27s_Church_-_Panoramic_Photocompilation.jpg) under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The font licenses are bundled with the source and HTML.

Version 0.2.3 previews the VP cost of tax penalties and the reputation gained on St. Barbara tile 7. Open a market tile, held right or placed tile to see its details. Both player boards show the full house reward tracks, and unavailable actions say what they need. See the [second audit](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/d9340884701993512529426f72a620059fab7390/docs/Astra_Audit_2_v0.2.2.md).

Version 0.2.2 gives the rival a seeded random order for its three guild house rows. The same seed gives the same order, and the market, mine board, and decks follow their existing shuffle sequence. Existing saves keep both players’ guild orders. The Guide explains the choice of guild set.

Version 0.2.1 corrected the third row of guild houses. Builds using its four houses award 1, 3 and 4 reputation, then 8 VP, as printed on the player board. Existing saves use the corrected rewards on future builds.

Version 0.2.0 added the rival’s visible hand and both player boards, previews of market effects before placement, and recovery downloads when an autosave cannot be opened. Version 0.1.0 saves retain their deck order and migrate III–3 to its printed two stars. Starting a new game with a v0.1.0 seed uses the updated shuffle.

## Build and check

```sh
npm run build
npm test
```

The build writes `dist/index.html`. Use the [test instructions](test/README.md) to install the smoke test dependencies and verify the shipped app and print packet. [Claude’s v0.3.11 audit](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/86e9a5844f4985fbac1668188ded5eaedb8952f7/docs/Claude_Audit_v0.3.11.md) covers the release that prompted these changes.

Standard values progress toward the reputation discount, and favors rights and plots it can use together. It searches the current turn and up to one extra card, then adjusts its best plans for a likely legal card from the next player. Quick checks fewer continuations. The public game seed can vary close choices. Resuming a save reproduces the same decision. The rival estimates unseen tiles from the public position.

The v0.3.0 study uses 24 starts in two seed groups. Each starts a game with both seats on the v0.2.3 policy, and two head-to-head games with the revised Standard in each seat in turn. The v0.2.3 policy reproduced 794 decisions and final scores against the original code across nine complete games. The revised policy won 15/24 in the first group and 14/24 in the second, for 29/48 and a +2.98 VP mean margin. The scripted comparison measures outcomes against the earlier policy. Human difficulty is open for playtesting.

| Measure | v0.2.3 policy | Revised Standard |
| --- | ---: | ---: |
| Affordable nonzero tax bills declined | 63 / 204 | 14 / 211 |
| Mean final reputation | 0.10 | 5.17 |
| Mean unused rights | 1.79 | 0.88 |
| Mean unused plots | 0.88 | 0.85 |
| Mean buildings completed | 4.08 | 4.13 |
| Mean council seats / cathedral actions | 0.48 / 0.75 | 0.83 / 1.29 |
| Distinct first-round action sequences | 12 | 22 |
| Mean cards played for no effect | 0.31 | 0.56 |

The same study ran 12 three-player and 12 four-player games with Standard, Quick and specialist policies. Half of the games at each count enabled events. All 24 reached final scoring, with 3,246 state checks after transitions. Standard averaged about 9 ms per decision at three players and 10 ms at four on the test machine.

## v0.3.1 planner study

Each seed runs an all-Standard game and gives each challenger one game from every seat on the same starting board against Standard opponents. Margin is the challenger's score minus the highest opposing score. Paired changes compare that margin with the same seat in the all-Standard game. The script reports outright wins, shared wins, an interval resampled by seed and mean CPU time per decision on Node 24. These are bot matches with an approximate reply model. Human difficulty and device response times need playtesting.

```sh
node test/planner-study.mjs reply 8 reply-v031-pilot reply.json
node test/planner-study.mjs reply,sampling,closing,construction,planner 6 planner-v031-pilot variants.json
node test/planner-study.mjs sampling,construction,planner 12 planner-v031-fresh fresh.json
```

The first trial isolated reply replanning. Its paired margin changes at two, three and four players were +1.31, +0.87 and −1.13 VP. All three intervals included zero. The second pilot added each feature to reply replanning in turn and tested all four together.

| Pilot policy | 2-player paired VP | 3-player paired VP | 4-player paired VP |
| --- | ---: | ---: | ---: |
| Reply only | +1.00 | −1.22 | −2.13 |
| Reply and five tile orders | +5.25 | +1.06 | +0.79 |
| Reply and final-round scoring | +1.00 | −1.28 | −2.54 |
| Reply and build planning | +0.83 | +1.89 | +0.42 |
| Planner with all four | +1.08 | +0.06 | +0.50 |

The fresh-seed run used 12 new starting boards per table size for each policy. Rotating every seat gave 24, 36 and 48 games per policy at two, three and four players, respectively.

| Fresh-seed policy | Outright wins | 2-player paired VP | 3-player paired VP | 4-player paired VP | Mean CPU ms at 2 / 3 / 4 players |
| --- | ---: | ---: | ---: | ---: | ---: |
| Standard, all seats | 36 / 108 | 0 | 0 | 0 | 6.9 / 10.4 / 13.9 |
| Reply and five tile orders | 29 / 108 | −0.96 | −3.31 | −0.15 | 26.3 / 46.9 / 58.7 |
| Reply and build planning | 41 / 108 | +0.92 | +0.28 | +1.10 | 8.1 / 13.3 / 16.0 |
| Planner with all four | 44 / 108 | +1.42 | −0.08 | +1.40 | 29.9 / 50.8 / 62.6 |

Planner won 14/24, 12/36 and 18/48, respectively. Each of its three paired margin intervals included zero. The build-planning variant averaged 0.15–0.36 more completed buildings than Standard and had a smaller CPU cost. Planner is an optional difficulty.

The skip study uses the 52 four-player positions from the [v0.3.0 audit](https://github.com/ramyahoo88/Kutn-_Hora_Solo/tree/3895edf54ded43857156d0fc148c5c43b6c1c9e6/audit/v0.3.0/skip-traces). It replays the exact recorded card spent for no effect, then plays out the challenger’s first move with the same Standard continuation. Planner changed 23 decisions, with a mean gain of 0.60 VP and 0.02 VP of margin. Its margin averaged 1.69 VP below the average active alternative in the 51 positions with one.

```sh
node test/skip-planner-study.mjs /path/to/skip-traces reply,sampling,closing,construction,planner
node test/skip-planner-study.mjs /path/to/skip-traces standard,planner --case=4 --rescore
```

## Manual checks

- **Plan review in the digital test build.** Build with `node build.mjs dist/digital.html --digital`. Import the [market expansion save](test/fixtures/Market_Expansion_Plan.json) and choose **Play one Plan**. The review names Smelter as the tile removed by the Plan. In the [round-end Plan save](test/fixtures/Round_End_Plan.json), the Mine action adds 3 ore. Cathedral Construction then adds 2 ore and gives each player a pelican under **Automatic round-end effects**.
- **Draw only.** Draw 16 Plans and export the deck. Import it in another browser or device. Undo twice to reach draw 14 of 15, then draw twice and confirm the same two Plans appear across the reshuffle. Open **Rules and reference** to print the table reference or mine choice aid.
- **Mincmistr.** Use Card 6, seed `app-table-4`, three rivals and Grandmaster. Start a rival and choose **Play one Plan**. Check the resolved action and card, then use **Play rivals** to continue. Open an earlier Plan from the journal. Reload, Undo, and replay the batch to see the same cards. Export and reimport the save and continue to round 5. Each Mincmistr plays both remaining cards on its last turn of every round.

- **One rival.** Start as the Metallurgists, Miners, and Innkeepers on Card 1 with seed `silver-1308`. The rival’s rows should be Builders, Grocers, and Scribes.
- **Two rivals.** Use Card 6 and seed `app-table-3`. Check the larger boards, six rounds, each rival's cards and the council starting in round 4.
- **Three rivals.** Use Card 6, Rival 1 starts, seed `app-table-4` and **Planner**. Use **Play rivals** and confirm physical draws as prompted until play returns to you. Undo and then replay the last step with the same physical draw if prompted. Export and reimport a save and check that Planner is selected when opening New game. Check red buildings after round 2 and scoring after round 5.
- **Safari and physical draws.** Start a tabletop game, consult the setup checklist, and open the rival’s player board. Enter part of a mine draw, reload, and verify the draft is still there. In a round with Ius Regale Montanorum, confirm the physical discard and check that the stack count falls by the number discarded. The count should agree after reload.

## Sources and current rulings

- [v0.2.0 audit and reproduction](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/02bc7d78c83d99215b33e2c6e845adc32d4295fa/docs/Claude_Audit_v0.2.0.md) for the third-row reward fix.
- [CGE English rulebook](https://filemanager.czechgames.com/storage/files/kutna-hora-the-city-of-silver/rules/kutna-hora-rules-en.pdf), especially pp. 4–20. CGE’s [two-player article](https://www.czechgames.com/news/diving-into-the-two-player-game-experience-in-kutna-hora) shows the smaller city, board-edge dots and two-player mine award table.
- [CGE companion](https://kutnahora.czechgames.com/) for numerical prices, construction cutoffs, market increments and guild setups. [Printed component faces](https://www.ludex.dev/kutna-hora/cards/) for buildings, mine tiles, setup cards and events. Artist assets and rulebook pages are kept out of the game bundle.
- [Capek listing](https://www.zatrolene-hry.cz/spolecenska-hra/kutna-hora-mesto-stribra-14736/k-stazeni/vlastni-solo-mod-capek-18184/) and [author discussion](https://boardgamegeek.com/filepage/279202/2024-solomode-capek) were consulted. This implementation is an independent rival using base game actions. The hosted Capek PDF download requires a sign-in, so its full procedure has not been compared here.
- The game automatically continues when all tax bills are zero. Players tied for the highest VP and groschen share first place.
- **Ius Regale Montanorum:** Advance the ore track by 2 and discard the next five mine tiles from the current stack. If fewer remain, discard the rest. The next Mine draw from an empty stack triggers the reshuffle (rulebook p. 19). This is the app’s interpretation of the event card.
- When you build a red public building and have houses left, remove the leftmost house from a row of your choice. The removed house gives no reward (rulebook pp. 12 and 20). The option on p. 19 to play a card for no effect applies to the whole action. St. Barbara tile 3 specifically allows skipping its house removal.
- St. Barbara tile 8 is current until the nested Building action finishes, following the resolve-then-flip text on p. 14. If that building itself flips a cathedral tile, the build uses the current tile and its tax. The overlapping flip timing is an interpretation awaiting a published ruling. Tile 3 grants ore production without advancing the ore deck, as in the CGE companion.
