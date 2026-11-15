from pathlib import Path
import json,collections,statistics,random
p=Path(__file__).parent; batches=[]
for file in ['bench.jsonl','strategies.jsonl']:
 batches.extend(json.loads(s) for s in (p/'results'/file).read_text().splitlines())
def interval(vals):
 rng=random.Random(34015);samples=sorted(statistics.mean(rng.choices(vals,k=len(vals))) for _ in range(4000));return [round(samples[100],2),round(samples[3899],2)]
def summary(bs):
 rows=[(b,r) for b in bs for r in b['rows']]
 wins=lambda r:float(r['winners']==[r['focus']])
 margin=lambda r:r['tot'][r['focus']]-max(v for i,v in enumerate(r['tot'])if i!=r['focus'])
 return dict(boards=len(bs),games=len(rows),wins=sum(int(wins(r))for b,r in rows),shared=sum(len(r['winners'])>1 and r['focus'] in r['winners']for b,r in rows),margin=round(statistics.mean(margin(r)for b,r in rows),2),win95=interval([100*statistics.mean(wins(r)for r in b['rows'])for b in bs]),margin95=interval([statistics.mean(margin(r)for r in b['rows'])for b in bs]))
levels=[]
for n in [2,3,4]:
 for level in ['apprentice','journeyman','master','grandmaster']:
  rows=[b for b in batches if b['players']==n and b['level']==level and b['policy']=='standard' and 'levels' in b['seed']]
  levels.append(dict(players=n,level=level,**summary(rows)))
independent=[]
for target in ['paper','standard','planner']:
 for policy in ['industry','mining','council-focus','blockade']:
  for n in [2,3,4]:
   rows=[b for b in batches if b.get('digitalOpponent','paper')==target and b['players']==n and b['policy']==policy and 'independent' in b['seed']]
   independent.append(dict(target=target,policy=policy,players=n,**summary(rows),batches={name:summary([b for b in rows if name in b['seed']])for name in ['discovery','confirm']}))
paper=[]
for policy in ['standard','quick','builder','miner','council','denial','rights-denial','planner']:
 for n in [2,3,4]:
  rows=[b for b in batches if b['players']==n and b['policy']==policy and 'strategy-' in b['seed']]
  paper.append(dict(policy=policy,players=n,**summary(rows)))
paired=[]
for n in [2,3,4]:
 bases={b['seed']:b for b in batches if b['players']==n and b['policy']=='standard' and 'strategy-' in b['seed']}
 changes=[]
 for b in batches:
  if b['players']!=n or b['policy']!='rights-denial':continue
  baseline=bases[b['seed']]
  def margin(r):return r['tot'][r['focus']]-max(v for i,v in enumerate(r['tot'])if i!=r['focus'])
  changes.append(statistics.mean(margin(r)-margin(q)for r,q in zip(b['rows'],baseline['rows'])))
 paired.append(dict(players=n,pairedMargin=round(statistics.mean(changes),2),paired95=interval(changes)))
raw=json.loads((p/'results/rules.jsonl').read_text().splitlines()[-1])['checks'];work=[]
for n in [2,3,4]:
 x=raw[f'{n}/master'];d=x['games']*(n-1)
 work.append(dict(players=n,games=x['games'],perMincmistr={k:round(x[k]/d,2)for k in ['planFlips','bonus','plotQuotes','townFits','councilQuotes','placingMines']}))
result=dict(competitiveGames=sum(len(b['rows'])for b in batches),levels=levels,independent=independent,paperStrategies=paper,rightsDenialPaired=paired,workload=work)
(p/'results/summary.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items()if k not in ['independent','paperStrategies']},indent=2))
