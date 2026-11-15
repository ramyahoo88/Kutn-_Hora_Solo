// The study runners validate names before botAction can use its Standard fallback.
import {BOT_POLICIES} from '../src/bot.mjs';
export const POLICY_NAMES=BOT_POLICIES;
export function checkPolicy(name) {
  if (!POLICY_NAMES.includes(name)) throw Error(`Unknown rival "${name}" for this engine. Known: ${POLICY_NAMES.join(', ')}`);
  return name;
}
