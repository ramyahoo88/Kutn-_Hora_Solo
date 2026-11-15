# The Mincmistr

**A card-driven solo opponent for Kutná Hora** · Version 1.2.3 · 15 Nov 2026

Play against one, two or three Mincmistrs, using the normal board and round count for that table size. A Mincmistr starts like a player, pays every cost and either pays its taxes or loses reputation. It obeys the piece limits and scores the same way at the end. It gets no starting points and no hidden information. It makes its choices with a short checklist, a deck of 15 Plan cards and a fixed row of six action cards.

There are no dice. You flip one card per action, and most actions take one or two checks.

## Components

Print pages 5 to 8 of this file at actual size (100%), on Letter or A4, and cut out the cards. Pages 6 and 8 are optional card backs; print each one on the back of the page before it.

- 15 Plan cards.
- 3 reference cards: Card play, Goals and Choices.
- From the game box: one set of player components per Mincmistr, including six action cards per set.

## 1. Setup

1. Set up the normal game for your table size. Choose your guild set first from the matching row of the guild setup card. Shuffle the remaining sets and deal one to each Mincmistr. Give each Mincmistr its normal player components, coins and reputation. Use the normal rules for the starting player and seat order.
2. Shuffle the Mincmistr's three guilds to set their order, top to bottom, on its player board.
3. Shuffle the 15 Plan cards. Put them face down beside its board.
4. Lay its six action cards face up in a row, in the order shown in rule 2.
5. Choose a difficulty (rule 9). Journeyman is the standard game.

## 2. The row

The Mincmistr's action cards always sit in this order, left to right:

| 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|
| Mine / Joker | Rights / St. Barbara | Mine / Plot | Build / Income | Rights / Income | Build / Plot |

When it takes an action, it uses **the leftmost card still in its row that shows that action**. Remove the card from the row as it is played. At the start of each round, all six cards return to the row in the same order.

The Mincmistr **never uses the Joker**. It uses its Mine / Joker card only for Mine.

An action is **not possible** if no card in the row shows it, or if it would be illegal or unaffordable right now. Skip it and go on to the next check.

## 3. Plan cards

Each Plan card shows two **goals** in priority order and an **arrow**.

- **Construct**: Build, else Plot, else Rights (rule 5.1).
- **Mine**: take a Mine action (rule 5.2).
- **St. Barbara**: contribute a pelican (rule 5.3).
- The **arrow**, ◀ or ▶, breaks ties between spaces (rule 7).

When the deck runs out, shuffle the discards to form a new deck.

## 4. When the Mincmistr plays a card

Each time the Mincmistr must play an action card, follow these steps.

**4.0 Flip.** Flip the top Plan card face up onto the discard pile. This is the current Plan card.

**4.1 Short of cash.** If it has **fewer than 20 g**, it takes **Income** (rule 6.6). Stop here.

**4.2 Pelicans.** It contributes to **St. Barbara** if it has **2 or more pelicans**, or if it has **1 pelican** and the current St. Barbara tile is a **prize tile**. Stop here.

The prize tiles are *Seat a patrician* (tile 6), *Public neighbours* (7), *Free building* (8), *Dig twice* (9) and *Complete the cathedral* (11).

**4.3 Plan.** Try the goals on the current Plan card, top first. It does the first goal that is possible. Stop here.

**4.4 Nothing worked.** It takes Income. If that is not possible, it Mines. If that is not possible either, it discards its leftmost card with no effect.

Skip any step that is not possible. For example, if it has 12 g but has already played both Income cards this round, skip 4.1 and go to 4.2.

## 5. Goals

### 5.1 Construct

Do the first of these that is possible:

1. **Build**: if it holds at least one building right and at least one plot.
2. **Plot**: if it holds more rights than plots and has fewer than 3 plots.
3. **Rights**: if it holds fewer than 2 rights.

Each one still needs a card in the row and enough coins. Rule 6 gives its choices.

### 5.2 Mine

It takes a Mine action using a miner from its pool. If its pool is empty, it recruits as many miners as it can, up to 2, paying the permit price. Then it draws mine tiles as normal and places one (rule 6.4).

### 5.3 St. Barbara

If it has a pelican, it contributes to St. Barbara and resolves the current St. Barbara tile as normal. Rule 6.5 covers any choices on that tile.

## 6. Choices

### 6.1 Rights

It takes only **guild tiles it could build right now**. The tile must belong to one of its own guilds, that guild's row must still have a house, and the population or ore track must allow that guild's next building. It **never buys public building rights**. Like any player, it gets public rights free from its top house row.

Of those tiles, it takes the one with the highest **income value**: production × the current price of that commodity. Ties go to the cheaper tile, then the higher market row, then the tile further left.

If no qualifying tile is available to buy, Rights is not possible. Go to the next check.

### 6.2 Plot

It claims the legal plot where one of its held rights would score the **most town points**, counting the matching dots that building would score there. Ties go to the cheaper plot, then the arrow.

### 6.3 Build

It builds the held right with the **most production**. Public buildings count as 0, so it builds one only when no guild building can be built. It places the building on the plot where it scores the **most town points**. Ties go by the arrow, then to the right it took first.

### 6.4 Mine tiles

Of the tiles drawn, it keeps the one with the most **stars + ore + VP**. Ties go to more stars, then the first tile drawn.

It places that tile where it **gains the most mine-row points right now**: the award it would hold in that row after placing, minus the award it holds there now. Use the normal mine-row awards. With two players, a row with 0–3 stars in total pays 2 to the leader and 0 to the other player, 4–6 stars pays 4 and 1, and 7 or more pays 6 and 2. Tied players both take the higher award, and a player with no stars in a row scores nothing there. A tile with no stars gains nothing anywhere.

Ties go to the cheapest space, then the row where it has the fewest mines, then the arrow. If it cannot pay for any space, it discards the draw.

Free tiles from technology use the same placement rule.

### 6.5 Bonus steps

- **Free building right** (from a house row or St. Barbara tile 2): among eligible rights, take the public tile with the highest **VP + 2 per pelican + 2 per reputation**. Ties go to the first tile offered. If no public tile is eligible, a house reward gives nothing. On St. Barbara tile 2 only, fall back to the eligible tile from one of its own guilds with the highest income value. Break ties by the first tile offered. Take nothing if no tile is eligible.
- **Remove a house**: from the guild row with the most houses already removed. Ties go to the top row. It always takes optional house removals.
- **Seat a patrician from the bank**: the colour with the biggest edge (rule 6.6), even if that edge is 0 or less. Ties go green, silver, yellow, red.
- **Score a building** (St. Barbara): its building with the most town points. Ties go by the arrow.
- **Dig twice** (St. Barbara tile 9): it takes both free Mine actions, as the tile says, using miners from its reserve first. Placement is free; place each tile by rule 6.4.
- **Free plot, free building or extra Income**: use rules 6.2, 6.3 and 6.6.

### 6.6 Income and patricians

Whenever it takes Income, it seats a patrician if three things are true: one is available, it can pay the 10 g (counting the Income it collects), and that colour's **edge is at least 1**. If more than one colour qualifies, it picks the biggest edge. Ties go green, silver, yellow, red. Otherwise it takes plain Income.

**Edge** = the points one patrician of that colour gives the Mincmistr in a council scoring, minus the points it gives you. With more than two players, compare it with the best of its opponents, other Mincmistrs included.

| Colour | Points per patrician |
|---|---|
| Green | 1 for each public building next to each of its buildings |
| Silver | 3 for every 2 pelicans it has used |
| Yellow | 2 per mine in its weakest mine row, counting at most 2 |
| Red | 3 for each complete column of removed houses |

## 7. The arrow

When spaces tie, the arrow on the current Plan card decides:

- **◀**: the earliest space in reading order. Start at the top row and read left to right.
- **▶**: the latest space in reading order. Start at the bottom row and read right to left.

This applies to town plots, building placement and mine spaces.

## 8. Everything else

- **Taxes**: it pays if it can. Otherwise it loses reputation.
- **Events**: they affect it exactly as they affect a player.
- **Limits**: 3 rights, 3 plots, miners, houses and every other limit apply as normal.
- **End of game**: it scores exactly like a player. The higher total wins. Use the normal tie-breaker.

## 9. Difficulty

| Level | Change from the rules above |
|---|---|
| **Apprentice** | Skip the point calculations. Rule 6.2: it claims the cheapest plot, then by arrow. Rule 6.3: it builds the right with the most production, then places it by arrow. Rule 6.4: it places mine tiles in the row where it has the fewest mines, then the cheapest space, then by arrow. |
| **Journeyman** | None. Play the rules as written. |
| **Master** | In the last three rounds (rounds 4–6, or rounds 3–5 with four players), its last turn of the round plays **both** of its remaining cards instead of one. Each card is a full card play (rule 4). |
| **Grandmaster** | As Master, but in every round. |

Master and Grandmaster give it extra actions only. They never add points, coins or discounts.

**Fine-tuning.** For a step between levels, give the double last turn to the last N rounds only. Each extra round is worth about 1.5 to 2.5 points (see rule 12). Master is N = 3 and Grandmaster is N = 6.

## 10. Two or three Mincmistrs

To face more opponents, set up a three- or four-player game using rule 1. Give each Mincmistr its own row of action cards.

- They can share one Plan deck. Flip a new card for each card play.
- Each Mincmistr follows these rules on its own.
- Wherever a rule compares it with "you", it compares with the best of its opponents, you and the other Mincmistrs alike.
- All of them play at the same level.
- With three players, Master is slightly easy: the Standard rival won about 39% against a fair share of 33%. For a tougher three-player game, double the last turn in rounds 3–6 (rule 9, N = 4).

## 11. Example

It is round 2. The Mincmistr has 26 g and 1 pelican. It holds one building right and no plot. Its Mine / Joker card is already played. You flip a Plan card showing **Mine, then Construct**, with arrow ▶.

At 26 g it is not short of cash. It has only 1 pelican, and the current St. Barbara tile is *Free plot* (tile 4), which is not a prize tile. So it follows the plan. Mine is possible. It has a miner in its pool, so it plays Mine / Plot, the leftmost Mine card left in its row.

It draws two tiles and keeps the one with 2 stars, because it has more stars + ore + VP. You lead the top row 2 stars to 0, with 2 stars in that row. In the second row, you have 3 stars and it has 1, out of 4 stars in total. The 2-star tile in the top row gives a total of 4 stars, tied at 2 each, so it moves from 0 to the leader's 4 points: a gain of 4. In the second row it would also tie at 3 stars, but the 6-star total keeps the award at 4 and 1, so its share rises from 1 to 4: a gain of 3. It places the tile in the top row, on the cheapest space there. If two spaces tie, it takes the latest in reading order.

## 12. How strong is it?

These results come from simulated two-player games in the Kutná Hora Solo engine (v0.3.0) against the app's two rivals. All seeds were held out from tuning, and every game set covers both seats and both starting players. The Standard column uses 768 games per level and the Quick column 384. The figures are the Mincmistr's win rate and its average margin in points.

| Level | vs the app's Quick rival | vs the app's Standard rival |
|---|---|---|
| Apprentice | 52% · +0.0 | 20% · −9.1 |
| Journeyman | 64% · +3.3 | 33% · −5.1 |
| Master | 77% · +7.6 | 50% · −0.3 |
| Grandmaster | 87% · +12.2 | 71% · +5.5 |

If you usually beat the app's Standard rival, start at Master. Each level is worth about 5 points.

Against two or three Mincmistrs, here is how often the app's Standard rival wins when it takes your seat (288–576 games each):

| Opponents | Apprentice | Journeyman | Master | Grandmaster |
|---|---|---|---|---|
| 2 Mincmistrs (3 players, fair share 33%) | 70% | 57% | 39% | 18% |
| 3 Mincmistrs (4 players, fair share 25%) | 64% | 48% | 25% | 19% |

Fine-tuning against the Standard rival, by the number of final rounds with a double last turn (768 games each):

| N | 0 (Journeyman) | 1 | 2 | 3 (Master) | 4 | 5 | 6 (Grandmaster) |
|---|---|---|---|---|---|---|---|
| Win rate | 33% | 40% | 44% | 50% | 58% | 67% | 71% |
| Margin | −5.1 | −3.7 | −2.1 | −0.3 | +2.2 | +4.0 | +5.5 |

## 13. Quick reference

1. Flip a Plan card.
2. Fewer than 20 g: **Income**.
3. 2 or more pelicans, or 1 on a prize tile: **St. Barbara**.
4. Otherwise, the first possible goal on the Plan card.
5. Otherwise Income, then Mine, then discard the leftmost card.

It always uses the leftmost card in the row that shows the action, and never the Joker.
