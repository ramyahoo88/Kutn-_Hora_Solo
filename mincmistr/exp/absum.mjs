// Absolute 2p summary from expsim files: the Mincmistr's win rate and margin. node exp/absum.mjs file... [--groups=a,b]
import {readFileSync} from 'node:fs';
const args=process.argv.slice(2), gArg=args.find(a=>a.startsWith('--groups=')), keep=gArg?gArg.slice(9).split(','):null;
for (const f of args.filter(a=>!a.startsWith('--'))) {
  const ds=readFileSync(f,'utf8').trim().split('\n').map(JSON.parse).filter(d=>!keep||keep.includes(d.group));
  const rows=ds.flatMap(d=>d.rows);
  const margin=rows.map(r=>Math.max(...r.tot.filter((_,k)=>k!==r.focus))-r.tot[r.focus]);
  const wins=rows.filter(r=>r.winner!==null&&r.winner!==r.focus).length;
  const m=margin.reduce((a,b)=>a+b,0)/margin.length, se=Math.sqrt(margin.reduce((t,x)=>t+(x-m)**2,0)/(margin.length-1)/margin.length);
  console.log(`${ds[0].spec.padEnd(22)} vs ${ds[0].bot.padEnd(8)} n=${rows.length} Mincmistr wins ${(100*wins/rows.length).toFixed(1)}% margin ${m.toFixed(2)} ±${se.toFixed(2)}`);
}
