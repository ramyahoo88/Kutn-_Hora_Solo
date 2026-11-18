// Paired summary: node exp/expsum.mjs base.jsonl variant.jsonl  (same seeds, same order)
import {readFileSync} from 'node:fs';
const load=f=>readFileSync(f,'utf8').trim().split('\n').map(JSON.parse);
const [A,B]=[load(process.argv[2]),load(process.argv[3])];
const ra=A.flatMap(d=>d.rows), rb=B.flatMap(d=>d.rows);
if (ra.length!==rb.length) throw Error('unpaired');
const vsBest=r=>r.tot[r.focus]-Math.max(...r.tot.filter((_,k)=>k!==r.focus));
const d=ra.map((r,i)=>vsBest(rb[i])-vsBest(r));   // change in the bot's (your) margin; negative = Mincmistrs tougher
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length, se=xs=>{const m=mean(xs);return Math.sqrt(xs.reduce((t,x)=>t+(x-m)**2,0)/(xs.length-1)/xs.length);};
const wins=rs=>rs.filter(r=>r.winner===r.focus).length;
const tall=rs=>{const t={}; for (const r of rs) for (const [k,v] of Object.entries(r.tallies)) t[k]=(t[k]??0)+v; return Object.fromEntries(Object.entries(t).map(([k,v])=>[k,+(v/rs.length).toFixed(3)]));};
const changed=d.filter(x=>x!==0).length;
console.log(`${A[0].players}p ${A[0].spec} -> ${B[0].spec} vs ${A[0].bot}: n=${ra.length} | your wins ${wins(ra)} -> ${wins(rb)} | your margin vs best Mincmistr ${mean(ra.map(vsBest)).toFixed(2)} -> ${mean(rb.map(vsBest)).toFixed(2)} | change ${mean(d).toFixed(2)} ±${se(d).toFixed(2)} | games changed ${changed} | per game ${JSON.stringify(tall(rb))}`);
