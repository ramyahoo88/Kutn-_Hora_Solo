// Export the Plan deck, row and levels from the rules module for the PDF builder.
import {writeFileSync} from 'node:fs';
import {PLAN_DECK,ROW,LEVELS} from '../mincmistr.mjs';
writeFileSync(new URL('./cards.json',import.meta.url),JSON.stringify({deck:PLAN_DECK,row:ROW,levels:LEVELS},null,1));
