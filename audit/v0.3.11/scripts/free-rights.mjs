// v1.2.5 rule 6.5 free rights: classify every free-right step the shipped Mincmistr resolves
// and check the result and its "Why this move?" line against the printed rule.
import {writeFileSync} from 'node:fs';
const R = new URL('../../../src/', import.meta.url).href;
const E = await import(R + 'engine.mjs');
const {BUILDINGS} = await import(R + 'data.mjs');
const {botAction} = await import(R + 'bot.mjs');
const {playMincmistr} = await import(R + 'mincmistr.mjs');
const {writeSave} = await import(R + 'save.mjs');
const n = Number(process.argv[2] ?? 60);
const t = {games: 0, house: {public: 0, nothing: 0, full: 0}, tile2: {public: 0, ownGuild: 0, nothing: 0, full: 0}, publicTies: 0, guildTies: 0, bad: []};
const saved = {};
for (const count of [2, 3, 4]) for (let i = 0; i < n; i++) {
  const seed = `fr-${count}-${i}`;
  let s = E.createGame({seed, playerCount: count, setup: 1 + i % 9, starter: i % count, difficulty: 'mincmistr', events: i % 2 === 0,
    mincmistr: {level: ['journeyman', 'master', 'grandmaster'][i % 3]}});
  t.games++;
  while (s.phase !== 'end') {
    if (s.actor === 0) { s = E.transition(s, botAction(s, 'quick')); continue; }
    const item = s.pending[0];
    if (item?.kind !== 'right') { s = playMincmistr(s); continue; }
    const p = s.players[s.actor], offers = E.marketOffer(s);
    const pv = id => { const b = BUILDINGS[id]; return b.vp + 2 * b.pelicans + 2 * b.rep; };
    const iv = id => BUILDINGS[id].production * E.price(s, BUILDINGS[id].group);
    const pubs = offers.filter(o => BUILDINGS[o.id].public);
    const own = offers.filter(o => !BUILDINGS[o.id].public && p.guilds.includes(BUILDINGS[o.id].group));
    const first = (xs, v) => xs.reduce((best, o) => best === null || v(o.id) > v(best.id) ? o : best, null); // reading order wins ties
    let want = null, kind;
    const bucket = item.publicOnly ? t.house : t.tile2;
    if (p.held.length >= 3) kind = 'full';
    else if (pubs.length) { want = first(pubs, pv); kind = 'public'; if (pubs.filter(o => pv(o.id) === pv(want.id)).length > 1) t.publicTies++; }
    else if (!item.publicOnly && own.length) { want = first(own, iv); kind = 'ownGuild'; if (own.filter(o => iv(o.id) === iv(want.id)).length > 1) t.guildTies++; }
    else kind = 'nothing';
    bucket[kind]++;
    const next = playMincmistr(s);
    const gained = next.players[s.actor].held.filter(id => !p.held.includes(id));
    const got = gained[0] ?? null;
    const title = next.log.findLast(e => e.actor === s.actor && e.explanation);
    const line = title?.explanation?.findLast(x => x.rule === '6.5')?.text ?? '';
    const lineOk = want ? line.includes(BUILDINGS[want.id].name) : line.startsWith('Skip the free right.');
    if (got !== (want?.id ?? null) || !lineOk) t.bad.push({seed, round: s.round, kind, want: want?.id, got, line});
    const key = `${item.publicOnly ? 'house' : 'tile2'}-${kind}`;
    if (!saved[key]) { saved[key] = {seed, round: s.round, seat: s.actor, line}; writeFileSync(new URL(`../positions/Free_Right_${key}.json`, import.meta.url), writeSave(s)); }
    s = next;
  }
}
console.log(JSON.stringify({...t, bad: t.bad.length, examples: saved}, null, 1));
if (t.bad.length) console.log(JSON.stringify(t.bad.slice(0, 5), null, 1));
