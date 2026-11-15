import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {botAction} from '../src/bot.mjs';
import {CARDS} from '../src/data.mjs';
import {actionKey,legalActions,transition} from '../src/engine.mjs';
import {checkGame,readSave} from '../src/save.mjs';

// node test/skip-planner-study.mjs <skip-traces folder> <candidate[,candidate...]> [--case=4] [--rescore]
const [folder,policyList='reply',...flags]=process.argv.slice(2);
assert.ok(folder,'Pass the skip-traces folder from claude-audit-v0.3.0.');
const policies=policyList.split(',');
const only=flags.find(flag=>flag.startsWith('--case='))?.slice(7);
const rescore=flags.includes('--rescore');
const {cases}=JSON.parse(readFileSync(join(folder,'skip-traces.json'),'utf8'));
const records=cases.filter(record=>only===undefined||record.case===Number(only));
assert.ok(records.length,'No matching audit positions.');
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
const average=(rows,key)=>rows.length?Number(mean(rows.map(row=>row[key])).toFixed(2)):null;

function finish(state, seat) {
  let steps=0;
  while(state.phase!=='end') {
    assert.ok(++steps<=300,`Continuation stalled in ${state.seed}`);
    state=transition(state,botAction(state,'standard'));
    checkGame(state);
  }
  const scores=state.result.scores.map(score=>score.total);
  return {vp:scores[seat],margin:scores[seat]-Math.max(...scores.filter((_,i)=>i!==seat))};
}

const results=[];
for (const record of records) {
  const state=readSave(readFileSync(join(folder,record.save),'utf8'));
  assert.equal(state.actor,record.seat);
  const options=legalActions(state);
  const passes=options.filter(action=>action.kind==='skip'&&`skip [${CARDS[action.card].join('/')}]`===record.chosenLabel);
  assert.equal(passes.length,1,`Missing recorded card in case ${record.case}`);
  const old=passes[0];
  const scores=new Map();
  const score=action=>{
    const key=actionKey(action);
    if (!scores.has(key)) scores.set(key,finish(transition(state,action),record.seat));
    return scores.get(key);
  };
  const baseline=score(old);
  assert.deepEqual(baseline,{vp:record.chosen.vp,margin:record.chosen.margin},`Baseline case ${record.case}`);
  const alternatives=rescore?options.filter(a=>a.kind!=='skip').map(score):record.allOptions.filter(a=>a.kind!=='skip');
  const typical=alternatives.length
    ? {vp:mean(alternatives.map(row=>row.vp)),margin:mean(alternatives.map(row=>row.margin))}
    : null;
  for (const policy of policies) {
    const action=botAction(state,policy);
    const outcome=score(action);
    results.push({
      case:record.case,policy,action:actionKey(action),same:actionKey(action)===actionKey(old),skip:action.kind==='skip',
      vpGain:outcome.vp-baseline.vp,marginGain:outcome.margin-baseline.margin,
      versusTypical:typical?outcome.margin-typical.margin:null,
    });
  }
}
for(const policy of policies) {
  const rows=results.filter(row=>row.policy===policy);
  console.log(JSON.stringify({
    policy,cases:rows.length,changed:rows.filter(row=>!row.same).length,passes:rows.filter(row=>row.skip).length,
    meanVpGain:average(rows,'vpGain'),meanMarginGain:average(rows,'marginGain'),
    meanMarginVersusTypicalNonPass:average(rows.filter(row=>row.versusTypical!==null),'versusTypical'),
    perCase:rows,
  }));
}
