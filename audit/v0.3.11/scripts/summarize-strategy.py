#!/usr/bin/env python3
"""Summarize strategy.mjs output: wins and margins by policy, discovery (sd) vs fresh (sf) seeds."""
import json, sys, collections, statistics as st
rows = [json.loads(l) for l in open(sys.argv[1] if len(sys.argv) > 1 else 'results/strategy-all.jsonl')]
g = collections.defaultdict(list)
for r in rows: g[(r['count'], r['level'], r['policy'], r['seed'][:2])].append(r)
for count in (2, 4):
    for lvl in ('journeyman', 'master'):
        print(f'\n{count} players vs {lvl}: policy, human outright wins (discovery, fresh), mean margin vs best Mincmistr (discovery, fresh), Mincmistr no-effect cards per game')
        for p in ('standard', 'quick', 'builder', 'miner', 'council', 'denial', 'taxdodge', 'random'):
            d, f = g[(count, lvl, p, 'sg')], g[(count, lvl, p, 'sh')]
            disc = st.mean(x['mStats']['discards'] for x in d + f) / (count - 1)
            print(f"  {p:9s} {sum(x['win'] for x in d):2d}/{len(d)} {sum(x['win'] for x in f):2d}/{len(f)}  {st.mean(x['margin'] for x in d):+6.2f} {st.mean(x['margin'] for x in f):+6.2f}  {disc:.2f}")
