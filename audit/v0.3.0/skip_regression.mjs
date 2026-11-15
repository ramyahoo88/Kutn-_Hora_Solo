// Regression harness for the next planner: load every traced four-player skip position, ask the
// current Standard rival for its move, and score that move with the same kind of continuation used
// in skip-traces.json (Standard at every seat to the end, real hidden decks).
// Usage, from this folder: node skip_regression.mjs [--rescore]
//   --rescore also replays the v0.3.0 skip and best alternative with the current build's bots,
//   so all three numbers come from the same policy.
import {readFileSync} from 'node:fs';
import {botAction} from '../../src/bot.mjs';
import {actionKey,legalActions,transition} from '../../src/engine.mjs';
import {readSave} from '../../src/save.mjs';

const rescore=process.argv.includes('--rescore');
const {cases}=JSON.parse(readFileSync('skip-traces/skip-traces.json','utf8'));
const finish=s=>{while (s.phase!=='end') s=transition(s,botAction(s,'standard')); return s;};
const score=(end,seat)=>{
  const t=end.result.scores.map(x=>x.total);
  return {vp:t[seat],margin:t[seat]-Math.max(...t.filter((_,i)=>i!==seat))};
};
let same=0, changed=0, sum={now:0,skip:0,best:0};
for (const c of cases) {
  const state=readSave(readFileSync(`skip-traces/${c.save}`,'utf8'));
  const choice=botAction(state,'standard');
  const now=score(finish(transition(state,choice)),c.seat);
  const stillSkips=choice.kind==='skip';
  stillSkips?same++:changed++;
  let skip=c.chosen, best=c.bestAlternative;
  if (rescore) {
    const options=legalActions(state);
    const firstSkip=options.find(x=>x.kind==='skip');
    skip=score(finish(transition(state,firstSkip)),c.seat);
    const scored=options.filter(x=>x.kind!=='skip').map(x=>({x,...score(finish(transition(state,x)),c.seat)}));
    scored.sort((a,b)=>b.vp-a.vp||b.margin-a.margin);
    best=scored[0]??skip;
  }
  sum.now+=now.vp; sum.skip+=skip.vp; sum.best+=best.vp;
  console.log(`case ${String(c.case).padStart(2)} ${c.save}: now ${choice.kind}${choice.id?` ${choice.id}`:''} → ${now.vp} VP (${now.margin>=0?'+':''}${now.margin}) | v0.3.0 skip ${skip.vp} | best alternative ${best.vp}`);
}
const n=cases.length;
console.log(JSON.stringify({cases:n,stillSkips:same,nowPlaysSomething:changed,
  meanVP:{currentChoice:+(sum.now/n).toFixed(2),v030Skip:+(sum.skip/n).toFixed(2),bestAlternative:+(sum.best/n).toFixed(2)},
  scoredWith:rescore?'current build for all three':'current build for the new choice; v0.3.0 continuations for the stored numbers'}));
