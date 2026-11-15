// Summarise multisim.mjs output. node mincmistr/multisum.mjs file...
import {readFileSync} from 'node:fs';
const cells=new Map();
for (const f of process.argv.slice(2)) for (const l of readFileSync(f,'utf8').trim().split('\n').filter(Boolean)) {
  const d=JSON.parse(l), key=`${d.mode}|${d.players}|${d.level}|${d.bot}`;
  if (!cells.has(key)) cells.set(key,{...d,rows:[]}); cells.get(key).rows.push(...d.rows);
}
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length, se=xs=>{const m=mean(xs);return Math.sqrt(xs.reduce((t,x)=>t+(x-m)**2,0)/(xs.length-1)/xs.length);};
for (const c of cells.values()) {
  const r=c.rows, n=r.length, fair=100/c.players;
  const wins=r.filter(x=>x.winner===x.focus).length;
  const vsBest=r.map(x=>x.tot[x.focus]-Math.max(...x.tot.filter((_,k)=>k!==x.focus)));
  const vsAvg=r.map(x=>x.tot[x.focus]-mean(x.tot.filter((_,k)=>k!==x.focus)));
  const rank=r.map(x=>1+x.tot.filter((v,k)=>k!==x.focus&&v>x.tot[x.focus]).length);
  const who=c.mode==='solo'?`${c.bot} (as you) vs ${c.players-1} Mincmistr ${c.level}`:`1 Mincmistr ${c.level} vs ${c.players-1} ${c.bot}`;
  console.log(`${c.players}p ${who}: n=${n} | focus wins ${(100*wins/n).toFixed(1)}% (fair ${fair.toFixed(0)}%) | vs best other ${mean(vsBest).toFixed(1)} ±${se(vsBest).toFixed(1)} | vs avg other ${mean(vsAvg).toFixed(1)} ±${se(vsAvg).toFixed(1)} | avg rank ${mean(rank).toFixed(2)} | avg score ${mean(r.map(x=>x.tot[x.focus])).toFixed(1)}`);
}
