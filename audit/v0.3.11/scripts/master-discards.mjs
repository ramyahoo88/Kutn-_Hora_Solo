const R = new URL('../../../src/', import.meta.url).href;
const E=await import(R+'engine.mjs'); const {botAction}=await import(R+'bot.mjs'); const {playMincmistr}=await import(R+'mincmistr.mjs');
let doubled=0, other=0;
for (let i=0;i<40;i++) {
  let s=E.createGame({seed:`dc-${i}`,setup:1+i%9,starter:i%2,difficulty:'mincmistr',mincmistr:{level:'master'}});
  while (s.phase!=='end') {
    if (s.actor===0) { s=E.transition(s,botAction(s,'standard')); continue; }
    const b=s; s=playMincmistr(s);
    if (b.phase==='action'&&!b.pending.length&&s.log.slice(b.log.length).some(e=>e.actor===b.actor&&/with no effect\.$/.test(e.text))) {
      const last=b.turn>=2*b.players.length; const dbl=E.cardsThisTurn(b)===2&&last;
      dbl?doubled++:other++;
    }
  }
}
console.log({doubledLastTurn:doubled,otherTurns:other});
