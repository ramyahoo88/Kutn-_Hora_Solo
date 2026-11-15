// Importable saves for finding P1: the Mincmistr's house-row free right with no public tile on offer.
const R = new URL('../../../src/', import.meta.url).href;
const E=await import(R+'engine.mjs'); const {BUILDINGS}=await import(R+'data.mjs');
const {botAction}=await import(R+'bot.mjs'); const {playMincmistr}=await import(R+'mincmistr.mjs');
const {writeSave,readSave}=await import(R+'save.mjs'); const {writeFileSync}=await import('node:fs');
let s=E.createGame({seed:'hr-4-22',playerCount:4,setup:5,starter:2,difficulty:'mincmistr',events:true,mincmistr:{level:'master'}});
let cardStart=null;
while (s.phase!=='end') {
  if (s.actor===0) { s=E.transition(s,botAction(s,'quick')); continue; }
  if (s.phase==='action'&&!s.pending.length) cardStart=s;
  const item=s.pending[0];
  if (item?.kind==='right'&&item.publicOnly&&!E.marketOffer(s).some(o=>BUILDINGS[o.id].public)) {
    writeFileSync(new URL('../positions/', import.meta.url).pathname+'House_Right_No_Public_Card_Play.json',writeSave(cardStart));
    writeFileSync(new URL('../positions/', import.meta.url).pathname+'House_Right_No_Public_Pending.json',writeSave(s));
    const p=s.players[s.actor];
    const offer=E.marketOffer(s).map(o=>({name:BUILDINGS[o.id].name,guild:BUILDINGS[o.id].group,own:p.guilds.includes(BUILDINGS[o.id].group),production:BUILDINGS[o.id].production,value:BUILDINGS[o.id].production*E.price(s,BUILDINGS[o.id].group)}));
    console.log(JSON.stringify({round:s.round,seat:s.actor,lastLog:s.log.slice(-3).map(e=>e.text),offer,legal:E.legalActions(s),appNext:playMincmistr(s).log.slice(s.log.length).map(e=>e.text)},null,1));
    // round-trip check
    readSave(writeSave(s)); readSave(writeSave(cardStart));
    break;
  }
  s=playMincmistr(s);
}
