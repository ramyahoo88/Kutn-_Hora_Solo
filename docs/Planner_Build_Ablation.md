# Equal-depth test of Planner's build search

The experiment starts from Kutná Hora Solo v0.3.1 and the full-turn build candidate in the earlier strength study. Both policies start from the same current-turn shortlist and use the same opponent forecast, evaluator and sampling procedure. Both search the entire next legal turn before the final round, including the tax and round transition when needed. They use the same width-four open search over the same card budget. [Earlier study and patch](https://github.com/ramyahoo88/Kutn-_Hora_Solo/blob/5c2b0fc244e5fbf2842b46df45138ad4234e7edd/docs/Planner_Strength_Study.md)

| Trial | Follow-up search |
| --- | --- |
| `full-turn` | Searches the upcoming turn for the best legal sequence. |
| `build-sequence` | Runs the identical open search. When a new right or plot survives this turn, also runs a width-four search for a sequence that builds with one of those assets. Uses the higher score. |

The second search can preserve a plan that starts with Income, a right or a plot and finishes the named building with the remaining card. Equal depth controls how far the policies look, and the second search adds compute. Measured cost is thread CPU time on Node 24.

## Test design

- The main group uses 18 fresh starting boards at each table size. Both trials rotate through every seat with the rest of the table playing v0.3.1 Planner. One game with all seats on v0.3.1 Planner supplies the corresponding margin and wins for the original policy on that same board.
- A second group uses nine fresh boards per table size and the existing builder, miner and council policies. Each matched pair has the same specialist seats. These policies give a second comparison with different competitive priorities.
- The pair plays a common position until the first difference. Then both choices are applied and each game continues with its own policy. The records include the first different move and an importable pre-move save. Timings compare calls made from the same position, including at the first difference. The full games check state invariants after every transition.
- Margin is the tested seat's VP minus the highest opposing VP. A policy change is the margin difference on the same seed and seat. The 95% intervals resample entire boards with their seat rotations together. Wins use the cash tiebreak and record shared wins separately.

## Fresh games against Planner

Each trial played 162 games on these starts. There were zero shared first places. The right-hand columns show the change from adding the dedicated build search to the open full-turn search.

| Players | Games per policy | v0.3.1 Planner wins | Open full-turn wins | Dedicated build wins | Paired margin change (95% interval) | Matched CPU ms, open / dedicated |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | 36 | 18 | 18 | 18 | +0.69 VP [−1.53, +3.42] | 49.1 / 53.2 |
| 3 | 54 | 18 | 18 | 22 | +1.19 VP [−0.13, +2.56] | 83.7 / 89.6 |
| 4 | 72 | 18 | 20 | 20 | −0.03 VP [−0.76, +0.78] | 114.0 / 120.9 |

At least one choice differed in 51 of 162 games. The dedicated search raised the final margin in 25 of those games, lowered it in 23 and left the margin tied in three. Both trials completed about the same number of buildings. The dedicated search added 0.06, 0.13 and 0.08 buildings per game across the three sizes.

Against the all-Planner control, the open search changed margins by +0.06, −0.74 and −0.26 VP. The dedicated search changed them by +0.75, +0.44 and −0.29 VP. The previous study's +5.56 VP three-player gain for the dedicated search did not repeat on these boards.

## Fresh games against specialists

| Players | Games per policy | Open full-turn wins | Dedicated build wins | Paired margin change (95% interval) |
| ---: | ---: | ---: | ---: | ---: |
| 2 | 18 | 14 | 14 | +0.28 VP [−2.72, +3.94] |
| 3 | 27 | 18 | 19 | +1.15 VP [−0.89, +2.85] |
| 4 | 36 | 19 | 16 | −1.47 VP [−3.19, −0.25] |

The search changed a move in 27 of 81 specialist games. Both panels together covered 243 paired games and 7,257 decisions from common positions. The search gained roughly 1.2 VP of three-player margin in both panels, with intervals that include zero. At four players the dedicated search lost margin against the specialists and was near even with open search against Planner.

## Checks and examples

- All 30 tests passed, including the hidden-order and save check with the new policy. On the 52 saved four-player skip positions, both equal-depth trials picked the same move. The dedicated trial also matched all 52 original `build-sequence` choices.
- On a replay of the first three boards per size from the earlier fresh-seed run, all 27 dedicated build scores and winners matched the earlier recorded ones. The three 3-player boards from that replay favored the dedicated version by +5.89 VP. They verify the policy and illustrate why a promising result on a small set of starts can differ from a new batch.
- Seed `planner-build-ablation-fresh-4-0`, seat 0, round 2, turn 11. The open policy bought the Coal Market right for 1 g. The dedicated search claimed E2 for 4 g. The resulting margins were −10 and −5 VP. Both finished behind the highest opposing seat. [Match and save in the evidence archive](../audit/planner-strength/build-ablation/Planner_Build_Ablation_Evidence.zip)
- Seed `planner-build-ablation-specialists-4-4`, seat 0, round 1, first card. Open search took Mine and recruited for 4 g. Dedicated search bought the Mining Office right for 1 g. The dedicated route finished at −1 VP of margin, and the open route won at +19. The example is a complete-game comparison from a common starting position.

## Recommendation

The dedicated search has a modest three-player signal and adds about 4–7 ms per decision in the Planner panel. The open full-turn search is the simpler general candidate. The new controlled margins give limited evidence for promoting either trial over v0.3.1 Planner. Use the three-player result for a targeted follow-up if a tougher setting is wanted. The results here describe simulated opponents.

## Reproduce

From a checkout containing the study branch, create a detached worktree and apply the two trial patches there. Use Node 24 for thread CPU timing. Each output path is replaced at the start of its run.

```sh
git worktree add --detach ../kutna-build-trial 5c2b0fc244e5fbf2842b46df45138ad4234e7edd
git -C ../kutna-build-trial apply "$PWD/audit/planner-strength/experiments.patch"
git -C ../kutna-build-trial apply "$PWD/audit/planner-strength/build-ablation/ablation.patch"
cd ../kutna-build-trial
node --test test/*.test.mjs
node test/planner-build-ablation.mjs planner 18 planner-build-ablation-fresh /tmp/build-fresh.jsonl
node test/planner-build-ablation.mjs control 18 planner-build-ablation-fresh /tmp/build-control.jsonl
node test/planner-build-ablation.mjs specialists 9 planner-build-ablation-specialists /tmp/build-specialists.jsonl
node test/planner-build-ablation.mjs planner 3 planner-strength-fresh /tmp/build-replay.jsonl
```

Extract the evidence archive for the paired records, scores, statistics script and representative saves. Recompute the tables with `python summarize.py fresh.jsonl specialists.jsonl --control control.jsonl` from the extracted evidence folder. [Evidence archive](../audit/planner-strength/build-ablation/Planner_Build_Ablation_Evidence.zip)
