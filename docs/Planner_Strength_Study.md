# Planner strength trials

These trials start from Kutná Hora Solo v0.3.1 playtest. The experiment patch adds policy names for the command-line study. The downloadable app on this branch is the v0.3.1 build with the Standard, Quick and Planner difficulty choices. [Base commit](https://github.com/ramyahoo88/Kutn-_Hora_Solo/commit/9d1dfd839234a01521ae9fb4c372da6c23351b16)

| Trial policy | Change from v0.3.1 Planner |
| --- | --- |
| `shortlist` | Keep up to five finalists. Give distinctly different actions room in the search, and merge plans that reach the same board with the same remaining hands. Keep the previous shortlist horizon and reply scoring. |
| `build-sequence` | Compare the whole next turn for each finalist through legal play, following the public turn order through taxes if the next turn falls in a new round. Also search a line that completes a build using a newly acquired plot or right. That line can spend a card gaining income or the missing right or plot. Use the better projection over the same card budget. |
| `contested-reply` | When the forecasted follow-up depends on an opportunity rivals can change, test a credible alternative reply that changes that opportunity. Replan on the alternate board and give that result one-third of the weight. Covers selected within-round replies before the exact closing search. |

The build trial changes the follow-up horizon for every finalist, so its result measures the full sequence search together with the construction constraint. Forecasts use sampled public-information-consistent tiles and events. Scoring for earlier rounds estimates future points and taxes. The final outcome comes from the existing engine.

## Matched games

On each starting board, one candidate plays from every seat against v0.3.1 Planner opponents. The comparison game uses v0.3.1 Planner in all seats. Margin is the candidate seat's final VP minus the highest opposing VP. A paired margin subtracts the control margin for that same seat and start. Approximate 95% intervals resample starting boards as clusters. Outright wins use the printed cash tiebreak, and shared wins are counted separately.

The pilot used six boards per table size. The fresh run used twelve different boards per size. The pilot results are exploratory.

| Pilot policy | 2 players | 3 players | 4 players |
| --- | ---: | ---: | ---: |
| Shortlist | +6.08 VP | +4.17 VP | −0.21 VP |
| Build sequence | +4.58 VP | +2.39 VP | −0.25 VP |
| Contested reply | 0.00 VP | +0.94 VP | +1.38 VP |

Each policy played 108 seat comparisons on the 36 fresh starting boards. The all-Planner controls produced 12 outright wins across the rotated seats at each table size. The only shared first place was for build sequence at four players.

| Fresh policy | Players | Outright wins | Paired margin change (95% interval) | Mean CPU ms, trial / control |
| --- | ---: | ---: | ---: | ---: |
| Shortlist | 2 | 14 / 24 | +1.67 VP [−2.21, +5.71] | 34.1 / 31.3 |
| Shortlist | 3 | 12 / 36 | −0.33 VP [−3.81, +3.22] | 55.4 / 52.4 |
| Shortlist | 4 | 13 / 48 | +2.83 VP [+1.19, +4.40] | 68.2 / 63.7 |
| Build sequence | 2 | 17 / 24 | +3.96 VP [+0.42, +7.58] | 47.9 / 31.3 |
| Build sequence | 3 | 17 / 36 | +5.56 VP [+2.03, +8.81] | 77.9 / 52.4 |
| Build sequence | 4 | 14 / 48 | +1.46 VP [−1.15, +4.17] | 97.2 / 63.7 |
| Contested reply | 2 | 12 / 24 | 0.00 VP [0, 0] | 32.0 / 31.3 |
| Contested reply | 3 | 13 / 36 | 0.00 VP [−1.42, +1.61] | 53.3 / 52.4 |
| Contested reply | 4 | 12 / 48 | +0.48 VP [−0.52, +1.58] | 72.5 / 63.7 |

Build sequence won 48 of 108 outright and shared one, compared with 36 outright wins for the matched controls. It completed 0.08–0.14 more buildings per game. Its extra search added 17–34 ms of CPU time per decision on the test machine. Shortlist won 39, gained the most four-player margin and left 0.22–0.73 fewer unused plots and rights per game across the three sizes. The contested reply trial won 37 and had little effect on margin.

## Builder, miner and council rivals

Shortlist and build sequence led the pilot for margin at two and three players. A separate set of six boards per size tested them against the game's builder, miner and council policies. For each tested seat, v0.3.1 Planner and both contenders play with the same opponents in the same seats. Each specialist's position rotates with the board and tested seat.

| Trial policy | Players | Trial wins | Planner wins | Paired margin change (95% interval) | Change in unused plots and rights |
| --- | ---: | ---: | ---: | ---: | ---: |
| Shortlist | 2 | 8 / 12 | 8 / 12 | +0.67 VP [−8.17, +9.17] | −0.42 |
| Shortlist | 3 | 11 / 18 | 10 / 18 | +0.67 VP [−3.39, +5.11] | −0.67 |
| Shortlist | 4 | 14 / 24 | 15 / 24 | −0.29 VP [−3.25, +2.63] | −0.33 |
| Build sequence | 2 | 7 / 12 | 8 / 12 | +0.33 VP [−5.58, +6.92] | +0.58 |
| Build sequence | 3 | 11 / 18 | 10 / 18 | +3.67 VP [+0.83, +7.22] | −0.50 |
| Build sequence | 4 | 14 / 24 | 15 / 24 | +0.79 VP [−2.29, +4.71] | +0.04 |

Shortlist and Planner each won 33 of 54 games against these opponents. Build sequence won 32. Build sequence's biggest margin gain against the specialists was at three players. Shortlist finished with fewer unused plots and rights at every table size. These opponents are scripted profiles. Human play remains a separate measure of difficulty.

## Four-player audit replays

The 52 audit saves come from positions where v0.3.0 Standard passed. The script reproduced the exact card spent and the audit's VP and margin in every position. It then played each trial policy's first move and used Standard for every later decision. The table compares each new choice against v0.3.1 Planner with that same Standard continuation. [Audit saves](https://github.com/ramyahoo88/Kutn-_Hora_Solo/tree/3895edf54ded43857156d0fc148c5c43b6c1c9e6/audit/v0.3.0/skip-traces)

| Policy | Changed choices | Passes | Mean margin change vs Planner |
| --- | ---: | ---: | ---: |
| v0.3.1 Planner | 0 | 30 | 0.00 VP |
| Shortlist | 10 | 22 | +0.79 VP |
| Build sequence | 12 | 32 | +0.12 VP |
| Contested reply | 0 | 30 | 0.00 VP |

In case 33, seed `skips-4-15`, the broader shortlist adds the Hammer Works right and buys it. The right never reached the original shortlist. This gains 26 VP of margin over Planner's pass with this continuation, accounting for 26 of the total 41 VP gained across the 52 replays. The remainder averages +0.29 VP. In case 27, shortlist mines where Planner passes and loses 8 VP of margin.

In case 4, seed `skips-4-1`, all four policies play the `Build / Income` card for Income with a yellow patrician. With Standard continuing, this line scores 48 VP at a −7 VP margin. The original `Build / Plot` pass scores 47 VP at +3. With Planner continuing, the Income line scores 39 VP at −18 and the pass scores 46 VP at −3. A four-player save replay gives a conditional comparison of those two moves.

## Recommendation

The build sequence trial is the strongest candidate for a tougher Planner, especially for three players. Its three-player margin gain appeared in both the fresh Planner matches and the specialist panel. The two-player margin gain appeared against Planner with wider uncertainty against the specialists. An equal-depth comparison could measure what the construction constraint adds.

Shortlist was cheaper and showed a four-player margin gain against Planner. Its similar win counts at that table size and the specialist results leave the strength effect open. Contested replies changed none of the 52 audit choices and produced only small gains in complete games. These findings support keeping the three prototypes in the trial patch for review.

## Reproduce

Use Node 24 to report mean thread CPU time. Apply the patch to a detached checkout of the exact playtest build. Use a separate checkout of `claude-audit-v0.3.0` for the audit saves.

```sh
git worktree add --detach ../kutna-planner-trials 9d1dfd839234a01521ae9fb4c372da6c23351b16
git -C ../kutna-planner-trials apply "$PWD/audit/planner-strength/experiments.patch"
git worktree add --detach ../kutna-skip-audit 3895edf54ded43857156d0fc148c5c43b6c1c9e6
cd ../kutna-planner-trials
node --test test/*.test.mjs
KUTNA_CONTROL=planner node test/planner-study.mjs shortlist,build-sequence,contested-reply 6 planner-strength-pilot pilot.json
KUTNA_CONTROL=planner node test/planner-study.mjs shortlist,build-sequence,contested-reply 12 planner-strength-fresh fresh.json
KUTNA_CONTROL=planner KUTNA_OPPONENTS=builder,miner,council node test/planner-study.mjs shortlist,build-sequence 6 planner-strength-specialists specialists.json
node test/skip-planner-study.mjs ../kutna-skip-audit/audit/v0.3.0/skip-traces planner,shortlist,build-sequence,contested-reply --case=4 --rescore
node test/skip-planner-study.mjs ../kutna-skip-audit/audit/v0.3.0/skip-traces planner,shortlist,build-sequence,contested-reply
```

All 30 tests passed. The three trial policies reproduced saved decisions after scrambling concealed order at each player count. The four policies also made 208 matching decisions after scrambling the 52 audit saves. Nine full control games using Standard, Quick and Planner matched 1,105 exact v0.3.1 decisions. Every game in the study checked legality and save invariants after each play. A separate rebuild of the v0.3.1 HTML matches the branch download byte for byte.

The recorded summaries, scores by seeded start and individual audit decisions are in [results.jsonl](../audit/planner-strength/results.jsonl).
