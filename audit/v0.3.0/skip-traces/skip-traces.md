# Four-player skip traces

Scores are one deterministic continuation per option with Standard at every seat (hindsight on hidden decks).

Summary: 52 cases; skip scored at least as well as every legal alternative in 3; an alternative scored higher in 49.

| Case | Save | Round · turn | Seat | Skipped card | Skip VP (margin) | Best alternative | Its VP (margin) | Best non-skip | Its VP |
| ---: | --- | --- | ---: | --- | ---: | --- | ---: | --- | ---: |
| 1 | `skip-4p-g00-s052.json` | R2 · T9 | 2 | skip [rights/barbara] | 38 (-4) | skip [build/plot] | 38 (-4) | rights Airshaft 6 g [rights/barbara] | 37 |
| 2 | `skip-4p-g00-s078.json` | R3 · T8 | 2 | skip [rights/barbara] | 38 (-4) | rights Ore Market 18 g [rights/barbara] | 40 (+1) | rights Ore Market 18 g [rights/barbara] | 40 |
| 3 | `skip-4p-g00-s082.json` | R3 · T11 | 1 | skip [rights/barbara] | 33 (-9) | rights Sawmill 1 g [rights/barbara] | 37 (-5) | rights Sawmill 1 g [rights/barbara] | 37 |
| 4 | `skip-4p-g01-s098.json` | R4 · T6 | 1 | skip [build/plot] | 47 (+3) | income 10 g [build/income] | 48 (-7) | income 10 g [build/income] | 48 |
| 5 | `skip-4p-g02-s056.json` | R2 · T11 | 1 | skip [build/plot] | 21 (-18) | skip [rights/barbara] | 21 (-18) | plot @12 4 g [build/plot] | 20 |
| 6 | `skip-4p-g02-s075.json` | R3 · T6 | 1 | skip [build/plot] | 21 (-18) | plot @13 4 g [build/plot] | 22 (-23) | plot @13 4 g [build/plot] | 22 |
| 7 | `skip-4p-g02-s083.json` | R3 · T11 | 2 | skip [build/plot] | 25 (-14) | rights Airshaft 6 g as rights (Joker) [mine/joker] | 38 (-3) | rights Airshaft 6 g as rights (Joker) [mine/joker] | 38 |
| 8 | `skip-4p-g02-s111.json` | R4 · T10 | 2 | skip [build/plot] | 25 (-14) | plot @13 4 g [build/plot] | 28 (-10) | plot @13 4 g [build/plot] | 28 |
| 9 | `skip-4p-g07-s043.json` | R2 · T5 | 1 | skip [rights/barbara] | 18 (-20) | plot @13 5 g [mine/plot] | 37 (-9) | plot @13 5 g [mine/plot] | 37 |
| 10 | `skip-4p-g07-s053.json` | R2 · T10 | 2 | skip [build/plot] | 19 (-19) | rights Butcher’s 1 g [rights/barbara] | 21 (-19) | rights Butcher’s 1 g [rights/barbara] | 21 |
| 11 | `skip-4p-g07-s066.json` | R3 · T4 | 1 | skip [build/plot] | 18 (-20) | plot @13 5 g [mine/plot] | 23 (-8) | plot @13 5 g [mine/plot] | 23 |
| 12 | `skip-4p-g07-s067.json` | R3 · T5 | 2 | skip [rights/barbara] | 19 (-19) | mine 0 g [mine/joker] | 20 (-22) | mine 0 g [mine/joker] | 20 |
| 13 | `skip-4p-g07-s082.json` | R3 · T11 | 0 | skip [rights/barbara] | 28 (-10) | rights Church of St. Bartholomew 1 g [rights/barbara] | 30 (-3) | rights Church of St. Bartholomew 1 g [rights/barbara] | 30 |
| 14 | `skip-4p-g07-s083.json` | R4 · T0 | 2 | skip [mine/joker] | 19 (-19) | income as income (Joker) [mine/joker] | 20 (-13) | income as income (Joker) [mine/joker] | 20 |
| 15 | `skip-4p-g07-s094.json` | R4 · T4 | 2 | skip [mine/plot] | 19 (-19) | rights Church of St. Bartholomew 1 g [rights/barbara] | 20 (-12) | rights Church of St. Bartholomew 1 g [rights/barbara] | 20 |
| 16 | `skip-4p-g07-s095.json` | R4 · T4 | 2 | skip [rights/barbara] | 19 (-19) | rights Church of St. Bartholomew 1 g [rights/barbara] | 20 (-15) | rights Church of St. Bartholomew 1 g [rights/barbara] | 20 |
| 17 | `skip-4p-g07-s100.json` | R4 · T7 | 1 | skip [build/plot] | 18 (-20) | plot @17 5 g as plot (Joker) [mine/joker] | 24 (-14) | plot @17 5 g as plot (Joker) [mine/joker] | 24 |
| 18 | `skip-4p-g08-s078.json` | R3 · T8 | 2 | skip [rights/barbara] | 32 (-8) | plot @20 3 g [build/plot] | 35 (-10) | plot @20 3 g [build/plot] | 35 |
| 19 | `skip-4p-g10-s014.json` | R1 · T5 | 2 | skip [build/plot] | 18 (-15) | plot @6 5 g [build/plot] | 60 (+9) | plot @6 5 g [build/plot] | 60 |
| 20 | `skip-4p-g10-s048.json` | R2 · T8 | 2 | skip [build/plot] | 18 (-15) | rights Limekiln 5 g [rights/barbara] | 34 (-5) | rights Limekiln 5 g [rights/barbara] | 34 |
| 21 | `skip-4p-g10-s052.json` | R2 · T11 | 1 | skip [build/plot] | 27 (-6) | build Pump @5 9 g [build/plot] | 37 (+5) | build Pump @5 9 g [build/plot] | 37 |
| 22 | `skip-4p-g10-s071.json` | R3 · T7 | 2 | skip [rights/barbara] | 18 (-15) | build Sawmill @12 16 g as build (Joker) [mine/joker] | 31 (-3) | build Sawmill @12 16 g as build (Joker) [mine/joker] | 31 |
| 23 | `skip-4p-g10-s075.json` | R3 · T9 | 0 | skip [build/plot] | 31 (-2) | plot @25 7 g [build/plot] | 34 (+7) | plot @25 7 g [build/plot] | 34 |
| 24 | `skip-4p-g10-s076.json` | R3 · T10 | 1 | skip [rights/barbara] | 27 (-6) | build Pump @5 12 g [build/plot] | 30 (-5) | build Pump @5 12 g [build/plot] | 30 |
| 25 | `skip-4p-g10-s098.json` | R4 · T6 | 2 | skip [rights/barbara] | 18 (-15) | plot @11 6 g as plot (Joker) [mine/joker] | 21 (-12) | plot @11 6 g as plot (Joker) [mine/joker] | 21 |
| 26 | `skip-4p-g11-s011.json` | R1 · T4 | 1 | skip [mine/joker] | 24 (-17) | rights Furnace 4 g [rights/barbara] | 55 (+5) | rights Furnace 4 g [rights/barbara] | 55 |
| 27 | `skip-4p-g11-s073.json` | R3 · T7 | 2 | skip [rights/barbara] | 36 (-5) | build St. John’s Chapel @6 27 g [build/plot] | 43 (-6) | build St. John’s Chapel @6 27 g [build/plot] | 43 |
| 28 | `skip-4p-g11-s078.json` | R3 · T10 | 1 | skip [build/plot] | 24 (-17) | build St. Mary Magdalene’s Chapel @17 27 g [build/plot] | 31 (-10) | build St. Mary Magdalene’s Chapel @17 27 g [build/plot] | 31 |
| 29 | `skip-4p-g12-s020.json` | R1 · T7 | 1 | skip [rights/barbara] | 37 (-7) | mine 0 g [mine/joker] | 51 (-7) | mine 0 g [mine/joker] | 51 |
| 30 | `skip-4p-g12-s047.json` | R2 · T8 | 3 | skip [build/plot] | 42 (-2) | plot @23 8 g [build/plot] | 58 (+5) | plot @23 8 g [build/plot] | 58 |
| 31 | `skip-4p-g12-s076.json` | R3 · T8 | 0 | skip [rights/barbara] | 35 (-9) | rights Mason’s 1 g [rights/barbara] | 50 (+0) | rights Mason’s 1 g [rights/barbara] | 50 |
| 32 | `skip-4p-g12-s114.json` | R4 · T11 | 0 | skip [build/plot] | 35 (-9) | build St. George’s Chapel @6 36 g [build/plot] | 38 (-8) | build St. George’s Chapel @6 36 g [build/plot] | 38 |
| 33 | `skip-4p-g15-s009.json` | R1 · T4 | 3 | skip [rights/barbara] | 11 (-21) | plot @9 5 g as plot (Joker) [mine/joker] | 45 (+14) | plot @9 5 g as plot (Joker) [mine/joker] | 45 |
| 34 | `skip-4p-g15-s018.json` | R1 · T7 | 2 | skip [build/plot] | 23 (-9) | rights Tavern 5 g [rights/barbara] | 41 (+22) | rights Tavern 5 g [rights/barbara] | 41 |
| 35 | `skip-4p-g15-s043.json` | R2 · T7 | 3 | skip [build/plot] | 11 (-21) | plot @13 8 g [mine/plot] | 31 (-6) | plot @13 8 g [mine/plot] | 31 |
| 36 | `skip-4p-g15-s066.json` | R3 · T6 | 3 | skip [rights/barbara] | 11 (-21) | build Ore Market @11 24 g as build (Joker) [mine/joker] | 18 (-10) | build Ore Market @11 24 g as build (Joker) [mine/joker] | 18 |
| 37 | `skip-4p-g15-s107.json` | R4 · T9 | 3 | skip [build/plot] | 11 (-21) | plot @25 8 g [build/plot] | 15 (-22) | plot @25 8 g [build/plot] | 15 |
| 38 | `skip-4p-g15-s132.json` | R5 · T8 | 3 | skip [mine/plot] | 11 (-21) | skip [build/plot] | 11 (-21) | — | — |
| 39 | `skip-4p-g17-s051.json` | R2 · T10 | 3 | skip [rights/barbara] | 31 (-18) | rights Furnace 5 g [rights/barbara] | 37 (-12) | rights Furnace 5 g [rights/barbara] | 37 |
| 40 | `skip-4p-g18-s037.json` | R2 · T4 | 2 | skip [build/plot] | 22 (-13) | build Mason’s @10 15 g [build/income] | 38 (-11) | build Mason’s @10 15 g [build/income] | 38 |
| 41 | `skip-4p-g18-s049.json` | R2 · T8 | 2 | skip [rights/barbara] | 22 (-13) | mine 0 g [mine/plot] | 34 (-3) | mine 0 g [mine/plot] | 34 |
| 42 | `skip-4p-g18-s052.json` | R2 · T11 | 1 | skip [build/plot] | 22 (-13) | plot @16 8 g [build/plot] | 38 (+0) | plot @16 8 g [build/plot] | 38 |
| 43 | `skip-4p-g18-s063.json` | R3 · T3 | 2 | skip [mine/plot] | 22 (-13) | build Mason’s @10 20 g [build/plot] | 35 (+1) | build Mason’s @10 20 g [build/plot] | 35 |
| 44 | `skip-4p-g18-s078.json` | R3 · T10 | 1 | skip [rights/barbara] | 22 (-13) | rights Assay Office 1 g [rights/barbara] | 29 (-5) | rights Assay Office 1 g [rights/barbara] | 29 |
| 45 | `skip-4p-g18-s099.json` | R4 · T6 | 2 | skip [mine/plot] | 22 (-13) | rights Town Hall 6 g as rights (Joker) [mine/joker] | 25 (-12) | rights Town Hall 6 g as rights (Joker) [mine/joker] | 25 |
| 46 | `skip-4p-g18-s104.json` | R4 · T9 | 1 | skip [build/plot] | 22 (-13) | rights St. Mary Magdalene’s Chapel 12 g [rights/barbara] | 27 (-11) | rights St. Mary Magdalene’s Chapel 12 g [rights/barbara] | 27 |
| 47 | `skip-4p-g19-s079.json` | R3 · T11 | 2 | skip [rights/barbara] | 30 (-19) | build Hospital @14 24 g [build/plot] | 38 (-12) | build Hospital @14 24 g [build/plot] | 38 |
| 48 | `skip-4p-g20-s013.json` | R1 · T5 | 3 | skip [build/plot] | 37 (+9) | plot @4 5 g as plot (Joker) [mine/joker] | 59 (+9) | plot @4 5 g as plot (Joker) [mine/joker] | 59 |
| 49 | `skip-4p-g20-s082.json` | R3 · T9 | 1 | skip [rights/barbara] | 24 (-13) | rights Bathhouse 1 g [rights/barbara] | 28 (-1) | rights Bathhouse 1 g [rights/barbara] | 28 |
| 50 | `skip-4p-g20-s083.json` | R3 · T10 | 2 | skip [build/plot] | 28 (-9) | rights Coal Market 1 g [rights/barbara] | 37 (+1) | rights Coal Market 1 g [rights/barbara] | 37 |
| 51 | `skip-4p-g22-s012.json` | R1 · T5 | 0 | skip [build/plot] | 27 (-2) | mine 0 g as mine (Joker) [mine/joker] | 48 (-2) | mine 0 g as mine (Joker) [mine/joker] | 48 |
| 52 | `skip-4p-g23-s038.json` | R2 · T4 | 0 | skip [mine/joker] | 31 (-11) | mine 6 g as mine (Joker) [mine/joker] | 39 (-1) | mine 6 g as mine (Joker) [mine/joker] | 39 |
