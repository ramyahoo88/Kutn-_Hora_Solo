// Bots must decide from public information. Perturb concealed state consistent
// with the public position and require the same decision.
const R = new URL('../../../src/', import.meta.url).href;
const E = await import(R + 'engine.mjs');
const D = await import(R + 'data.mjs');
const {botAction} = await import(R + 'bot.mjs');
const {shuffle} = await import(R + 'random.mjs');
const {playMincmistr} = await import(R + 'mincmistr.mjs');
const key = a => E.actionKey(a);
const res = {};
function perturb(s, k) {
  const c = structuredClone(s);
  const g = {rng: E.seedNumber('perturb/' + k)};
  // Mine stack: reshuffle unseen faces within each tier, keeping the count of backs per tier and stack order of tiers.
  const visible = new Set([...c.mine.flatMap(x => x?.id ? [x.id] : []), ...c.pending.flatMap(i => i.drawn ?? [])]);
  if (!c.mineMixed) {
    const pool = D.MINE_GROUPS.map(gr => shuffle(g, gr.filter(t => !visible.has(t.id)).map(t => t.id)));
    const deck = c.mineDeck.map(id => pool[D.MINES[id].tier - 1].pop());
    c.mineDiscard = c.mineDiscard.map(id => pool[D.MINES[id].tier - 1].pop());
    c.mineDeck = deck;
  } else {
    const all = shuffle(g, [...c.mineDeck, ...c.mineDiscard]);
    c.mineDeck = all.slice(0, c.mineDeck.length); c.mineDiscard = all.slice(c.mineDeck.length);
  }
  // Market: shuffle each stack below its top tile (keep marked bottoms at the bottom).
  for (const row of c.market) for (const st of row) { const [top, ...rest] = st.tiles; if (rest.length > 1) { const last = rest.pop(); st.tiles = [top, ...shuffle(g, rest), last]; } }
  // Future events of the same set and the red order before it is revealed.
  if (c.events.length) {
    const red = E.rulesFor(c).redRound;
    const future = c.events.slice(c.round);
    const usedA = new Set(c.events.slice(0, red)), usedB = new Set(c.events.slice(red));
    const poolA = shuffle(g, Object.keys(D.EVENTS).filter(id => D.EVENTS[id].set === 'A' && !c.events.slice(0, c.round).includes(id)));
    const poolB = shuffle(g, Object.keys(D.EVENTS).filter(id => D.EVENTS[id].set === 'B' && !c.events.slice(0, c.round).includes(id)));
    for (let r = c.round; r < c.events.length; r++) c.events[r] = (r < red ? poolA : poolB).shift();
  }
  if (c.round <= E.rulesFor(c).redRound) c.red = shuffle(g, c.red);
  c.rng = E.seedNumber('rng/' + k);
  if (c.mincmistr) for (const d of c.mincmistr.decks) { d.draw = shuffle(g, d.draw); d.rng = {rng: E.seedNumber('deck/' + k)}; }
  return c;
}
for (const count of [2, 3, 4]) for (const policy of ['standard', 'quick', 'planner']) {
  let same = 0, diff = 0, positions = 0; const examples = [];
  for (let i = 0; i < (policy === 'planner' ? 6 : 12); i++) {
    let s = E.createGame({seed: `hid-${count}-${i}`, playerCount: count, setup: 1 + i, starter: i % count, difficulty: policy, events: i % 2 === 0});
    let step = 0;
    while (s.phase !== 'end') {
      const a = botAction(s, policy);
      if (s.actor !== 0 && step % 9 === 4 && s.phase === 'action' && !s.pending.length) {
        positions++;
        let ok = true;
        for (let k = 0; k < 2; k++) if (key(botAction(perturb(s, `${i}/${step}/${k}`), policy)) !== key(a)) ok = false;
        ok ? same++ : (diff++, examples.length < 2 && examples.push({seed: `hid-${count}-${i}`, step}));
      }
      s = E.transition(s, a); step++;
    }
  }
  res[`${count}p ${policy}`] = {positions, same, diff, examples};
}
// Mincmistr: perturb concealed state except its own deck's draw order (the next flip is not hidden from the procedure; it is random).
{
  let same = 0, diff = 0, positions = 0;
  for (const count of [2, 3, 4]) for (let i = 0; i < 10; i++) {
    let s = E.createGame({seed: `hidm-${count}-${i}`, playerCount: count, setup: 1 + i, starter: i % count, difficulty: 'mincmistr', events: true, mincmistr: {level: 'master'}});
    let step = 0;
    while (s.phase !== 'end') {
      if (s.actor === 0) { s = E.transition(s, botAction(s, 'quick')); continue; }
      const next = playMincmistr(s);
      if (step % 5 === 2) {
        positions++;
        const p = perturb(s, 'm' + step); p.mincmistr = s.mincmistr; // keep its deck
        const alt = playMincmistr(p);
        const strip = x => JSON.stringify(x.log.slice(s.log.length).map(e => e.text));
        strip(alt) === strip(next) ? same++ : diff++;
      }
      s = next; step++;
    }
  }
  res['Mincmistr master (all table sizes)'] = {positions, same, diff};
}
console.log(JSON.stringify(res, null, 1));
