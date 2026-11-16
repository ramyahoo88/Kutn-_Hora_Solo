import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MINCMISTR_RULES_VERSION,VERSION} from './src/data.mjs';

const project=dirname(fileURLToPath(import.meta.url));
const read=(path)=>readFile(resolve(project,'src',path),'utf8');
const data=async (path,mime)=>`data:${mime};base64,${(await readFile(resolve(project,'src','assets',path))).toString('base64')}`;
const output=resolve(process.argv[2]??resolve(project,'dist','index.html'));
const tabletop=process.argv[3]!=='--digital';
const order=['data','prices','random','engine','bot','mincmistr','save','storage','paper','app'];
const modules=[];
for (const entry of order) {
  let source=await read(`${entry}.mjs`);
  if (entry==='app' && tabletop) source=source.replace('const TABLETOP_BUILD=false;','const TABLETOP_BUILD=true;');
  const exports=[];
  source=source.replace(/^import\s+\{([\s\S]*?)\}\s+from\s+'\.\/([a-z]+)\.mjs';$/gm,(_match,names,module)=>{
    if (!order.slice(0,order.indexOf(entry)).includes(module)) throw Error(`Unresolved module ${module} in ${entry}.`);
    return `const {${names}}=modules.${module};`;
  });
  source=source.replace(/^export (const|let|function) (\w+)/gm,(_match,kind,name)=>{
    exports.push(name);
    return `${kind} ${name}`;
  });
  if (/^(?:import|export) /m.test(source)) throw Error(`Unhandled module syntax in ${entry}.`);
  modules.push(`modules.${entry}=(()=>{\n${source}\nreturn {${exports.join(',')}};\n})();`);
}
const fonts=[
  ['DM Sans','400 750','dm-sans.woff2',''],
  ['DM Sans','400 750','dm-sans-ext.woff2','unicode-range:U+0100-02FF,U+1E00-1EFF;'],
  ['Instrument Serif','400','instrument-serif.woff2',''],
];
const cssFonts=[];
for (const [family,weight,path,range] of fonts) cssFonts.push(`@font-face{font-family:'${family}';font-weight:${weight};font-display:swap;${range}src:url(${await data(path,'font/woff2')}) format('woff2');}`);
const css=(await read('style.css'))
  .replace('/* LOCAL_FONTS */',()=>cssFonts.join('\n'))
  .replace('/* HERO_ASSET */',await data('cathedral.webp','image/webp'))
  .replace('/* PLAN_CARDS_ASSET */',await data('mincmistr-plans.webp','image/webp'));
const js=`'use strict';\nconst modules={};\n${modules.join('\n')}`.replace(/<\/script/gi,'<\\/script');
const licenses=await Promise.all(['DM-Sans-OFL.txt','Instrument-Serif-OFL.txt'].map(file=>read(`assets/${file}`)));
const reference=await readFile(resolve(project,'mincmistr','print','app-reference.html'),'utf8');
const html=(await read('page.html')).replace('APP_VERSION',VERSION).replace('/* BUNDLE_CSS */',()=>css)
  .replace('APP_EDITION',tabletop?'Unofficial tabletop companion':'Unofficial solo edition')
  .replace('APP_MODE',tabletop?'Tabletop game':'Digital game')
  .replace('APP_SAVE_NOTE',tabletop?'Use tabletop saves with this edition. Export an earlier digital save from New game.':'Version 0.1.0 saves keep their existing deck order.')
  .replace('MINCMISTR_RULES_VERSION',MINCMISTR_RULES_VERSION).replace('/* BUNDLE_JS */',()=>js)
  .replace('/* PAPER_REFERENCE */',()=>reference);
await mkdir(dirname(output),{recursive:true});
await writeFile(output,html.replace('</html>',()=>`<!-- Font licenses\n${licenses.join('\n\n')}\n-->\n</html>`));
console.log(output);
