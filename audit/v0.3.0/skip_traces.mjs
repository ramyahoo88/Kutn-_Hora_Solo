// Four-player positions where Standard plays a card for no effect, with every legal alternative
// played to the end by Standard at all seats. Writes skip-traces/skip-4p-NN.json (importable saves)
// and skip-traces/<shard>.partial.json.
// Usage, from this folder: node skip_traces.mjs [games=24] [shard=0] [shards=1]
//   then: node skip_traces.mjs merge
// Each option's score is one deterministic continuation: the real hidden decks are used, so it is
// a hindsight comparison, not an expected value.
import {mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {botAction} from '../../src/bot.mjs';
import {actionKey,createGame,legalActions,transition} from '../../src/engine.mjs';
import {writeSave} from '../../src/save.mjs';
import {CARDS,BUILDINGS} from '../../src/data.mjs';

const OUT=process.env.SKIP_OUT??'skip-traces';
mkdirSync(OUT,{recursive:true});

function finish(state) {
  let s=state;
  while (s.phase!=='end') s=transition(s,botAction(s,'standard'));
  return s;
}
function outcome(end, seat) {
  const totals=end.result.scores.map(score=>score.total);
  return {vp:totals[seat],margin:totals[seat]-Math.max(...totals.filter((_,i)=>i!==seat)),win:end.result.winner===seat};
}
function describe(action) {
  const card=action.card===undefined?'':` [${CARDS[action.card].join('/')}]`;
  const as=action.as?` as ${action.as} (Joker)`:'';
  const what=action.id?` ${(BUILDINGS[action.id]?.name)??action.id}`:'';
  const where=action.space!==undefined?` @${action.space}`:'';
  const cost=action.cost!==undefined?` ${action.cost} g`:'';
  return `${action.kind}${what}${where}${cost}${as}${card}`;
}

if (process.argv[2]==='merge') {
  const cases=readdirSync(OUT).filter(f=>f.endsWith('.partial.json')).flatMap(f=>JSON.parse(readFileSync(`${OUT}/${f}`,'utf8')));
  cases.sort((a,b)=>a.game-b.game||a.step-b.step);
  cases.forEach((c,i)=>{c.case=i+1;});
  const better=cases.filter(c=>c.bestAlternative.vp>c.chosen.vp);
  const summary={
    cases:cases.length,
    skipAtLeastAsGoodAsEveryAlternative:cases.length-better.length,
    alternativeScoredHigher:better.length,
    meanSkipVP:Number((cases.reduce((t,c)=>t+c.chosen.vp,0)/cases.length).toFixed(2)),
    meanBestAlternativeVP:Number((cases.reduce((t,c)=>t+c.bestAlternative.vp,0)/cases.length).toFixed(2)),
    meanBestNonSkipVP:Number((cases.reduce((t,c)=>t+(c.bestNonSkip?.vp??c.chosen.vp),0)/cases.length).toFixed(2)),
    note:'Scores are one deterministic continuation per option with Standard at every seat (hindsight on hidden decks).',
  };
  writeFileSync(`${OUT}/skip-traces.json`,JSON.stringify({summary,cases},null,1)+'\n');
  const lines=['| Case | Save | Round · turn | Seat | Skipped card | Skip VP (margin) | Best alternative | Its VP (margin) | Best non-skip | Its VP |','| ---: | --- | --- | ---: | --- | ---: | --- | ---: | --- | ---: |'];
  for (const c of cases) lines.push(`| ${c.case} | \`${c.save}\` | R${c.round} · T${c.turn} | ${c.seat} | ${c.chosenLabel} | ${c.chosen.vp} (${c.chosen.margin>=0?'+':''}${c.chosen.margin}) | ${c.bestAlternative.label} | ${c.bestAlternative.vp} (${c.bestAlternative.margin>=0?'+':''}${c.bestAlternative.margin}) | ${c.bestNonSkip?.label??'—'} | ${c.bestNonSkip?.vp??'—'} |`);
  writeFileSync(`${OUT}/skip-traces.md`,`# Four-player skip traces\n\n${summary.note}\n\nSummary: ${summary.cases} cases; skip scored at least as well as every legal alternative in ${summary.skipAtLeastAsGoodAsEveryAlternative}; an alternative scored higher in ${summary.alternativeScoredHigher}.\n\n${lines.join('\n')}\n`);
  console.log(JSON.stringify(summary,null,1));
  process.exit(0);
}

const games=Number(process.argv[2]??24), shard=Number(process.argv[3]??0), shards=Number(process.argv[4]??1);
const cases=[];
for (let i=0;i<games;i++) {
  let s=createGame({playerCount:4,seed:`skips-4-${i}`,setup:1+i%9,side:i%4,starter:(i>>1)%4});
  let step=0;
  while (s.phase!=='end') {
    const a=botAction(s,'standard');
    if (s.phase==='action' && !s.pending.length && a.kind==='skip') {
      const id=`${i}-${step}`;
      if ((i*1000+step)%shards===shard) {
        const seat=s.actor;
        const save=`skip-4p-g${String(i).padStart(2,'0')}-s${String(step).padStart(3,'0')}.json`;
        writeFileSync(`${OUT}/${save}`,writeSave(s));
        const options=[...new Map(legalActions(s).map(x=>[actionKey(x),x])).values()];
        const scored=options.map(x=>({key:actionKey(x),label:describe(x),kind:x.kind,...outcome(finish(transition(s,x)),seat)}));
        const chosen=scored.find(x=>x.key===actionKey(a));
        const rank=(x,y)=>y.vp-x.vp||y.margin-x.margin;
        const alternatives=scored.filter(x=>x.key!==chosen.key).sort(rank);
        const nonSkip=alternatives.filter(x=>x.kind!=='skip');
        cases.push({game:i,step,id,seed:s.seed,save,round:s.round,turn:s.turn,seat,coins:s.players[seat].coins,
          rep:s.players[seat].rep,held:s.players[seat].held,
          hand:CARDS.flatMap((c,k)=>s.players[seat].hand&(1<<k)?[c.join('/')]:[]),
          chosenLabel:chosen.label,chosen:{vp:chosen.vp,margin:chosen.margin,win:chosen.win},
          optionsEvaluated:scored.length,
          bestAlternative:alternatives[0]&&{label:alternatives[0].label,vp:alternatives[0].vp,margin:alternatives[0].margin,win:alternatives[0].win},
          bestNonSkip:nonSkip[0]&&{label:nonSkip[0].label,vp:nonSkip[0].vp,margin:nonSkip[0].margin,win:nonSkip[0].win},
          allOptions:scored.sort(rank).map(({key,...rest})=>rest)});
        process.stderr.write(`case ${id}: ${scored.length} options\n`);
      }
    }
    s=transition(s,a); step++;
  }
}
writeFileSync(`${OUT}/shard-${shard}.partial.json`,JSON.stringify(cases));
console.log(`shard ${shard}: ${cases.length} cases`);
