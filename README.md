# Kutná Hora Solo v0.2.2 playtest

An unofficial browser playtest for Kutná Hora: The City of Silver. Play one seat of the base two-player game against a rival. The app owns the city, mines, market, council and game draws. The same HTML works offline. Players can mirror its placements on the table. A game in progress can be moved between the hosted and offline copies by exporting and importing its JSON save.

To play offline, open [Kutna_Hora_Solo.html](Kutna_Hora_Solo.html) on GitHub, choose **Download raw file**, and open the downloaded file in your browser.

Start with the game already on screen, or use **New game** to choose a seed, one of the nine setup cards, a seat, house order, starting player and rival setting. The current default is card 1, the Metallurgists, Miners and Innkeepers seat, and Standard. The board uses original diagram styling and component facts. The banner is cropped from [St. Barbara’s Church by Txllxt TxllxT](https://commons.wikimedia.org/wiki/File:Kutn%C3%A1_Hora_-_St._Barbara%27s_Church_-_Panoramic_Photocompilation.jpg) under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The font licenses are bundled with the source and HTML.

Version 0.2.2 gives the rival a seeded random order for its three guild house rows. The same seed gives the same order, and the market, mine board, and decks follow their existing shuffle sequence. Existing saves keep both players’ guild orders. The Guide explains the choice of guild set.

Version 0.2.1 corrected the third row of guild houses. Builds using its four houses award 1, 3 and 4 reputation, then 8 VP, as printed on the player board. Existing saves use the corrected rewards on future builds.

Version 0.2.0 added the rival’s visible hand and both player boards, previews of market effects before placement, and recovery downloads when an autosave cannot be opened. Version 0.1.0 saves retain their deck order and migrate III–3 to its printed two stars. Starting a new game with a v0.1.0 seed uses the updated shuffle.

## Reproduce

```sh
node build.mjs
cmp dist/index.html Kutna_Hora_Solo.html
node --test test/engine.test.mjs
node test/arena.mjs 12 baseline,quick,builder,miner,council,denial kutna-v020-fresh
```

The engine and browser use the same legal actions and state transitions. Standard considers the current turn and, when available, one more card. It values both players’ town and mine scores, income, reputation, money and council prospects. It samples unseen mine faces and market orders from the public position. It treats the other player’s current board as fixed during its short lookahead. Quick searches fewer continuations. Neither uses score bonuses or starting resources beyond the ordinary two-player setup.

In the v0.2.2 benchmark, Standard won 91 of 144 games and averaged +3.39 VP. Each pairing used 12 seeds, with Standard assigned to both seats in separate games. The benchmark uses scripted policies and measures relative performance in that environment. Human difficulty and tabletop usability still need playtests.

| Opponent | Standard wins / games | Mean VP difference |
| --- | ---: | ---: |
| Earlier planning evaluator | 16 / 24 | +3.21 |
| Quick | 14 / 24 | +4.08 |
| City construction | 14 / 24 | +2.04 |
| Mining | 17 / 24 | +4.29 |
| Council | 13 / 24 | +1.58 |
| Denial | 17 / 24 | +5.13 |

## Playtest checks

- **Game 1.** Start as the Metallurgists, Miners, and Innkeepers on Card 1 with seed `silver-1308`. The rival’s rows should be Builders, Grocers, and Scribes. Play through final scoring.
- **Game 2.** Use Card 6, the second guild set, Rival starts, and seed `kutna-v022-playtest-2`. The rival’s rows should be Scribes, Miners, and Innkeepers. Export and reimport a save before finishing.
- **Safari.** Start a game, open the rival’s player board, and reload. Import the [Ius Regale short-stack save](test/fixtures/Ius_Regale_Short_Stack.json). Use **Play a card with no effect** and confirm the last card of Round 1. The event raises ore by 2 and discards all three remaining mine tiles. The journal reports the discard count. Your next Mine draw refills the stack from the discards.

## Sources and current rulings

- [v0.2.0 audit and reproduction](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/02bc7d78c83d99215b33e2c6e845adc32d4295fa/docs/Claude_Audit_v0.2.0.md) for the third-row reward fix.
- [CGE English rulebook](https://filemanager.czechgames.com/storage/files/kutna-hora-the-city-of-silver/rules/kutna-hora-rules-en.pdf), especially pp. 4–20. CGE’s [two-player article](https://www.czechgames.com/news/diving-into-the-two-player-game-experience-in-kutna-hora) shows the smaller city, board-edge dots and two-player mine award table.
- [CGE companion](https://kutnahora.czechgames.com/) for numerical prices, construction cutoffs, market increments and guild setups. [Printed component faces](https://www.ludex.dev/kutna-hora/cards/) for buildings, mine tiles, setup cards and events. Artist assets and rulebook pages are kept out of the game bundle.
- [Capek listing](https://www.zatrolene-hry.cz/spolecenska-hra/kutna-hora-mesto-stribra-14736/k-stazeni/vlastni-solo-mod-capek-18184/) and [author discussion](https://boardgamegeek.com/filepage/279202/2024-solomode-capek) were consulted. This implementation is an independent rival using base game actions. The hosted Capek PDF download requires a sign-in, so its full procedure has not been compared here.
- The game automatically continues through a round where both tax bills are zero. It accepts a draw after a VP and groschen tie. Promo events and importing an externally shuffled physical game are outside this build.
- **Ius Regale Montanorum:** Advance the ore track by 2 and discard the next five mine tiles from the current stack. If fewer remain, discard the rest. The next Mine draw from an empty stack triggers the reshuffle (rulebook p. 19). This is the app’s interpretation of the event card.
- When you build a red public building and have houses left, remove the leftmost house from a row of your choice. The removed house gives no reward (rulebook pp. 12 and 20). The option on p. 19 to play a card for no effect applies to the whole action. St. Barbara tile 3 specifically allows skipping its house removal.
- St. Barbara tile 8 is current until the nested Building action finishes, following the resolve-then-flip text on p. 14. If that building itself flips a cathedral tile, the build uses the current tile and its tax. The overlapping flip timing is an interpretation awaiting a published ruling. Tile 3 grants ore production without advancing the ore deck, as in the CGE companion.
