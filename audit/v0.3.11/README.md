# Evidence for the Claude v0.3.11 audit

Report: [docs/Claude_Audit_v0.3.11.md](../../docs/Claude_Audit_v0.3.11.md). Reviewed `v0.3.11-playtest` at `1cfde4513f5d214f284d90051e21e95336588590`.

Run every command from the repository root with Node.js 22 or 24. The scripts import `src/` relative to this folder and never modify the application.

## Release

```sh
node build.mjs /tmp/rebuilt.html && cmp /tmp/rebuilt.html Kutna_Hora_Solo.html
python3 mincmistr/print/build.py --app-reference /tmp/app-reference.html && cmp /tmp/app-reference.html mincmistr/print/app-reference.html
python3 -I audit/v0.3.11/scripts/export_plans_audit.py /tmp/plans.webp && cmp /tmp/plans.webp src/assets/mincmistr-plans.webp
python3 audit/v0.3.11/scripts/pdf-content-check.py     # PDF text against rules.md and the reference cards
node --test test/*.test.mjs && node mincmistr/flowcheck.mjs
```

`results/release.json` records hashes and every release check, including the ones not run (`build.py --refresh-copy`, jsdom, Firefox, WebKit).

## Finding and questions

| Item | Reproduction |
|---|---|
| F1 mid-word label wrap | `scripts/wrap-check.mjs` → `results/wrap-check.json`, `results/browser/phone-360-boards-4p.png` |
| A2 tie-breaks needing table order | `scripts/last-tiebreaks.mjs` → `results/last-tiebreaks.json` |
| v0.3.5 P1, now fixed | `scripts/free-right-cases.mjs` on `positions/House_Right_No_Public_Pending.json` → `results/free-right-cases.txt` |

## Studies

| Script | What it does | Recorded result |
|---|---|---|
| `oracle.mjs`, `parity.mjs 16 claude0311` | Independent v1.2.5 oracle shadowing every Mincmistr decision and rule label in 352 games | `results/parity.txt`, `parity.json` |
| `same-as-v035.mjs <v0.3.5 checkout> 20` | Same games under v0.3.5 and v0.3.11 sources | `results/same-as-v035.json` |
| `free-rights.mjs 60` | Every free right in 180 games against rule 6.5; saves one position per case | `results/free-rights.json`, `positions/Free_Right_*.json` |
| `fuzz.mjs 40 fz11-a`, `40 fz11-b` | Random and bot games with independent council and final scoring | `results/fuzz-a.txt`, `fuzz-b.txt` |
| `past-fixes.mjs` | Earlier fixes plus a nearby differing case | `results/past-fixes.txt` |
| `hidden-info.mjs` | Concealed-state perturbations | `results/hidden-info.json` |
| `explain-length.mjs` | Explanation lengths against the 32-line cap | `results/explain-length.json` |
| `readme-claims.mjs` | README playtest checks on the fixtures | `results/readme-claims.json` |
| `strategy.mjs`, `summarize-strategy.py` | Human-seat strategies on matched seeds; Builder confirmation on fresh seeds | `results/strategy-all.jsonl`, `strategy-summary.txt`, `strat-confirm-4-journeyman.jsonl` |
| `workload.mjs 8 wl11`, `master-discards.mjs` | Paper workload; where Master's no-effect cards fall | `results/workload.json` |
| `browser-probe.mjs`, `browser-probe2.mjs` | Full games via controls, Undo, Plan faces, Draw only, 390 px, print, long seeds, save protection | `results/browser/results.json`, `results2.json` |
| `browser-probe3.mjs` | Playtest report replay, "Why this move?", rule links, deck transfer, 360 px, print views | `results/browser/results3.json` |
| `browser-probe4.mjs` | Every Plan review against an independent diff across two full games | `results/browser/results4.json` |

The strategy runs used prefixes `sg` and `sh` (12 seeds at two players, 6 at four, Journeyman and Master, eight policies), then `node audit/v0.3.11/scripts/strategy.mjs 24 sj 4 journeyman standard,builder <out>` for the confirmation.

Browser scripts need Playwright. Set `PLAYWRIGHT_MODULE` to its `index.mjs` if it is not resolvable as `playwright`, and `PLAYWRIGHT_BROWSERS_PATH` if Chromium is installed elsewhere.
