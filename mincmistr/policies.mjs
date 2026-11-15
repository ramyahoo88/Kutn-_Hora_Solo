// Rival names the engine's bot.mjs actually defines. botAction() silently falls back to Standard for an
// unknown name, so the runners check names here and stop instead.
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/bot.mjs',import.meta.url),'utf8');
const start=source.indexOf('const POLICIES = {');
const block=source.slice(start,source.indexOf('\n};',start));
export const POLICY_NAMES=[...block.matchAll(/^\s{2}(\w+)\s*[:,]/gm)].map(m=>m[1]);
export function checkPolicy(name) {
  if (!POLICY_NAMES.includes(name)) throw Error(`Unknown rival "${name}" for this engine. Known: ${POLICY_NAMES.join(', ')}`);
  return name;
}
