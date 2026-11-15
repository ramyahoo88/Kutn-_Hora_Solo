import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {isMainThread,parentPort,Worker,workerData} from 'node:worker_threads';
import {botAction} from '../src/bot.mjs';
import {createGame,plotCount,seedNumber,transition} from '../src/engine.mjs';
import {randomIndex} from '../src/random.mjs';
import {checkGame} from '../src/save.mjs';

const mean=values=>values.reduce((sum,n)=>sum+n,0)/values.length;
const round=value=>Number(value.toFixed(2));

function runGame(start, policy, seat) {
  let game=createGame(start);
  const records=game.players.map(()=>({cpuMs:0,decisions:0,builds:0,passes:0}));
  let steps=0;
  while(game.phase!=='end') {
    assert.ok(++steps<=300,`Stalled at ${start.seed}`);
    const actor=game.actor;
    const stats=records[actor];
    const time=performance.now();
    const cpu=process.threadCpuUsage?.();
    const action=botAction(game,actor===seat?policy:'standard');
    if (cpu) {
      const used=process.threadCpuUsage(cpu);
      stats.cpuMs+=(used.user+used.system)/1000;
    } else stats.cpuMs+=performance.now()-time;
    stats.decisions++;
    stats.builds+=Number(action.kind==='build');
    stats.passes+=Number(game.phase==='action'&&!game.pending.length&&action.kind==='skip');
    game=transition(game,action);
    checkGame(game);
  }
  const scores=game.result.scores.map(score=>score.total);
  return records.map((stats,i)=>({
    ...stats,vp:scores[i],margin:scores[i]-Math.max(...scores.filter((_,j)=>i!==j)),
    win:game.result.winner===i,shared:game.result.winner===null&&game.result.winners.includes(i),
    rights:game.players[i].held.length,plots:plotCount(game,i),steps,
  }));
}

function compareStart(start, policies) {
  const baseline=runGame(start,'standard',-1);
  return {
    start,baseline,
    variants:Object.fromEntries(policies.map(policy=>[policy,baseline.map((_,seat)=>runGame(start,policy,seat)[seat])])),
  };
}

function confidenceInterval(clusterDeltas) {
  const rng={rng:seedNumber('paired-bootstrap')};
  const samples=Array.from({length:4000},()=>mean(clusterDeltas.map(()=>clusterDeltas[randomIndex(rng,clusterDeltas.length)])));
  samples.sort((a,b)=>a-b);
  return [round(samples[100]),round(samples[3899])];
}

function summarize(matches, policy) {
  const rows=matches.flatMap(match=>match.variants[policy].map((variant,i)=>({variant,baseline:match.baseline[i]})));
  const clusterDeltas=matches.map(match=>mean(match.variants[policy].map((variant,i)=>variant.margin-match.baseline[i].margin)));
  const metrics=rows.map(row=>row.variant);
  const control=rows.map(row=>row.baseline);
  const time=group=>round(group.reduce((sum,r)=>sum+r.cpuMs,0)/group.reduce((sum,r)=>sum+r.decisions,0));
  return {
    playerCount:matches[0].start.playerCount,policy,seeds:matches.length,games:rows.length,
    wins:metrics.filter(r=>r.win).length,shared:metrics.filter(r=>r.shared).length,
    meanMargin:round(mean(metrics.map(r=>r.margin))),pairedMargin:round(mean(clusterDeltas)),
    pairedMargin95:confidenceInterval(clusterDeltas),
    cpuMsPerDecision:time(metrics),baselineCpuMs:time(control),
    builds:round(mean(metrics.map(r=>r.builds))),passes:round(mean(metrics.map(r=>r.passes))),
    unusedPlots:round(mean(metrics.map(r=>r.plots))),unusedRights:round(mean(metrics.map(r=>r.rights))),
  };
}

if (!isMainThread) {
  for (const start of workerData.starts) parentPort.postMessage(compareStart(start,workerData.policies));
} else {
  // node test/planner-study.mjs reply 8 reply-pilot [output.json]
  const policies=(process.argv[2]??'reply').split(',');
  const seedCount=Number(process.argv[3]??8);
  const group=process.argv[4]??'planner-pilot';
  const output=process.argv[5];
  const counts=(process.env.KUTNA_COUNTS??'2,3,4').split(',').map(Number);
  const jobs=Number(process.env.KUTNA_JOBS??4);
  assert.ok(Number.isInteger(seedCount)&&seedCount>0&&Number.isInteger(jobs)&&jobs>0);
  assert.ok(counts.length>0 && counts.every(n=>[2,3,4].includes(n)));
  const starts=Array.from({length:seedCount},(_,i)=>counts.map(playerCount=>({
    playerCount,seed:`${group}-${playerCount}-${i}`,setup:i%9+1,
    side:Math.floor(i/2)%playerCount,starter:i%playerCount,events:i%2===1,
  }))).flat();
  const results=[];
  const started=performance.now();
  const workers=Math.min(jobs,starts.length);
  await Promise.all(Array.from({length:workers},(_,i)=>new Promise((resolve,reject)=>{
    const subset=starts.filter((_,j)=>j%workers===i);
    const worker=new Worker(new URL(import.meta.url),{workerData:{starts:subset,policies}});
    worker.on('message',result=>{
      results.push(result);
      console.error(`${results.length}/${starts.length} starts complete (${result.start.seed})`);
    });
    worker.once('error',reject);
    worker.once('exit',code=>code===0?resolve():reject(Error(`Worker ${i} exited with ${code}`)));
  })));
  results.sort((a,b)=>a.start.seed.localeCompare(b.start.seed));
  const summary=counts.flatMap(count=>policies.map(policy=>summarize(results.filter(r=>r.start.playerCount===count),policy)));
  const study={group,summary,results,seconds:round((performance.now()-started)/1000)};
  for (const row of summary) console.log(JSON.stringify(row));
  if (output) writeFileSync(output,JSON.stringify(study,null,2)+'\n');
}
