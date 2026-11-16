// "Why this move?" keeps at most PLAN_EXPLANATION_LIMIT (32) lines per Plan. How long do they get?
const R = new URL('../../../src/', import.meta.url).href;
const E = await import(R + 'engine.mjs');
const {PLAN_EXPLANATION_LIMIT} = await import(R + 'data.mjs');
const {botAction} = await import(R + 'bot.mjs');
const {playMincmistr} = await import(R + 'mincmistr.mjs');
let entries = 0, max = 0, atLimit = 0, missingRule = 0; const hist = {};
for (const count of [2, 3, 4]) for (let i = 0; i < 40; i++) {
  let s = E.createGame({seed: `xl-${count}-${i}`, playerCount: count, setup: 1 + i % 9, starter: i % count, difficulty: 'mincmistr', events: true, mincmistr: {level: 'grandmaster'}});
  while (s.phase !== 'end') s = s.actor === 0 ? E.transition(s, botAction(s, 'quick')) : playMincmistr(s);
  for (const e of s.log) if (e.explanation) {
    entries++; const n = e.explanation.length; max = Math.max(max, n); if (n >= PLAN_EXPLANATION_LIMIT) atLimit++;
    if (!e.rule) missingRule++;
    hist[n] = (hist[n] ?? 0) + 1;
  }
}
console.log(JSON.stringify({limit: PLAN_EXPLANATION_LIMIT, entries, max, atLimit, missingRule, hist}));
