export const VERSION = '0.3.8';
export const MINCMISTR_RULES_VERSION = '1.2.3';
export const PLAN_EXPLANATION_LIMIT = 32;
export const SAVE_SCHEMA = 3;
export const SETUP_VERSION = 2;
export const RIVAL_SETTINGS = ['standard','quick','planner','mincmistr'];
export const MINCMISTR_LEVELS = {
  apprentice:  {townPoints:false, rowPoints:false, extraCard:[]},
  journeyman:  {townPoints:true,  rowPoints:true,  extraCard:[]},
  master:      {townPoints:true,  rowPoints:true,  extraCard:[4,5,6]},
  grandmaster: {townPoints:true,  rowPoints:true,  extraCard:[1,2,3,4,5,6]},
};
// Mincmistr v1.2.2 Plan cards, in print order. C = Construct, M = Mine, S = St. Barbara.
export const MINCMISTR_PLANS = [
  ['CM','low'], ['CM','high'], ['CM','low'], ['MC','high'], ['CS','low'],
  ['MC','high'], ['CS','low'], ['MC','high'], ['CM','low'], ['CS','high'],
  ['SC','low'], ['CM','high'], ['MC','low'], ['CM','high'], ['CM','low'],
].map(([goals,arrow],i)=>({number:i+1,goals:goals.split(''),arrow}));
export const GUILDS = {
  wood: 'Builders', food: 'Grocers', beer: 'Innkeepers',
  ore: 'Miners', silver: 'Metallurgists', permit: 'Scribes',
};
export const GOODS = Object.keys(GUILDS);
export const COMMODITY = {wood:'Wood', food:'Food', beer:'Beer', ore:'Ore', silver:'Silver', permit:'Permits'};
export const PATRICIANS = ['green', 'silver', 'yellow', 'red'];
export const LABEL = {
  mine:'Mine', joker:'Joker', plot:'Plot', build:'Building',
  income:'Income', rights:'Rights', barbara:'St. Barbara', skip:'No effect',
};
export const CARDS = [
  ['mine','joker'], ['mine','plot'], ['build','income'],
  ['build','plot'], ['rights','income'], ['rights','barbara'],
];
export const CARDS_PER_TURN = [2,2,1];
// Match the 2-, 3- and 4-player rows of the nine printed setup cards.
// Codes follow the CGE companion's guild setup table.
const guildCode={b:'wood',e:'silver',m:'ore',g:'food',s:'permit',i:'beer'};
const setupCodes=[
  ['emi bsg','geb ime sbm','gem ims bie sgb'],
  ['egm bis','gme ebi bsm','bme ism eig gbs'],
  ['mbe gis','sbg egi meb','emg ibm bes gsi'],
  ['smb ieg','egm imb bes','bem img egs sib'],
  ['sgm bei','seg eib bms','emi gbm bse igs'],
  ['ism ebg','bgs ise emb','iem gms egb sbi'],
  ['gmb sie','gie seb bmi','smb igm esi beg'],
  ['bim sge','gbe bsi eim','gsm mib sbe egi'],
  ['gmi esb','esg ibe bgm','sim bmg esb ige'],
];
export const GUILD_SETUPS_BY_COUNT=Object.fromEntries([2,3,4].map(count=>[count,Object.fromEntries(
  setupCodes.map((card,i)=>[i+1,card[count-2].split(' ').map(set=>[...set].map(code=>guildCode[code]))]),
)]));
export const GUILD_SETUPS=GUILD_SETUPS_BY_COUNT[2];
export const CITY_WIDTH=6;
export const MINE_ROWS=4;
export const CITY = [
  '..xx..', '.xxxx.', 'xxxxxx', '.xxxx.', '..xx..',
].join('').split('').map(c => c === 'x');
export const CITY_EDGE = {7:'b',10:'y',19:'s',22:'r'};
export const MINE_ENTRANCES = [1,3];
export const ROCK_STARS = [0,1,1,2];
export const ROCK_LAYOUTS = [
  [0,8,11,19], [7,13,15,17], [6,8,12,17], [5,6,13,14], [6,8,16,18],
  [2,5,14,17], [2,8,11,15], [5,8,16,19], [7,12,15,19], [2,7,16,18],
  [6,9,12,18], [5,7,12,14], [5,9,16,18], [2,8,11,17], [2,5,9,12],
];
const largeTown=Array(30).fill(true);
const largeEdge={5:'y',11:'s',12:'r',17:'r',18:'y',24:'s'};
const largeRocks=[
  [2,12,15,25], [9,11,15,19], [9,11,17,24], [8,9,18,19], [8,10,12,24],
  [8,12,16,18], [4,9,12,15], [8,11,23,26], [10,17,22,26], [9,11,22,26],
  [8,16,19,24], [8,10,17,19], [8,12,23,25], [11,15,19,23], [3,15,19,24],
];
const makeBoard=(town,edge,mineWidth,entrances,rockLayouts)=>({
  town,edge,mineWidth,entrances,rockLayouts,
  neighbours:town.map((open,space)=>{
    if (!open) return [];
    const col=space%CITY_WIDTH;
    return [space-CITY_WIDTH,space+CITY_WIDTH,col>0?space-1:-1,
      col<CITY_WIDTH-1?space+1:-1].filter(i=>town[i]);
  }),
});
const smallBoard=makeBoard(CITY,CITY_EDGE,5,MINE_ENTRANCES,ROCK_LAYOUTS);
const largeBoard=makeBoard(largeTown,largeEdge,7,[1,5],largeRocks);
export const HOUSE_EFFECTS = [
  [{public:true},{public:true,vp:1},{public:true,vp:3},{vp:8}],
  [{pelicans:1},{pelicans:1,vp:1},{pelicans:1,vp:3},{vp:8}],
  [{rep:1},{rep:3},{rep:4},{vp:8}],
];
export const REP_SCORE = {'-5':-4,'-4':-2,'-3':-1,3:1,4:2,5:4,6:6,7:8,8:10,9:13};
export const REP_LOSS = [0,1,1,1,2,2,3];
// Red buildings enter just before the final three council rounds.
export const GAME_RULES={
  2:{rounds:6,redRound:3,repLoss:REP_LOSS,board:smallBoard},
  3:{rounds:6,redRound:3,repLoss:REP_LOSS,board:largeBoard},
  4:{rounds:5,redRound:2,repLoss:[0,1,1,2,2,3],board:largeBoard},
};
export const BARBARA_TAX = [0,0,1,1,1,2,3,2,1,1,1,0];
export const BARBARA = [null,
  ['Gain standing','Gain 2 reputation.'],
  ['Free rights','Gain 1 reputation. Take any eligible building tile for free.'],
  ['Fund a guild','Lose 1 reputation. You may remove a house to gain 2 production in its guild.'],
  ['Free plot','Gain 1 reputation. You may claim any empty town space for free.'],
  ['Collect twice','Lose 2 reputation. You may take two Income actions.'],
  ['Seat a patrician','Score 2 points. You may seat one patrician directly from the bank.'],
  ['Public neighbours','Gain 1 reputation for each public building next to each of your buildings.'],
  ['Free building','Score 1 point. You may build with no wood cost using a held right and plot.'],
  ['Dig twice','You may take two free Mine actions using miners from your reserve first.'],
  ['Score a building','You may score one of your buildings for matching adjacent dots.'],
  ['Complete the cathedral','Score 5 points. Future St. Barbara actions grant 2 reputation.'],
  ['Completed cathedral','Gain 2 reputation.'],
];
const building = (id,name,group,dots,wood,plot,effects) => ({id,name,group,dots,wood,plot,...effects});
const guild = (id,name,group,dots,wood,plot,production,pop=0) => building(id,name,group,dots,wood,plot,{
  production, pop, technology:group==='ore', bypass:group==='food'||group==='beer',
});
const publicTile = (id,name,group,dots,wood,pop,tax,vp,pelicans,rep) => building(id,name,group,dots,wood,wood,{
  public:true,pop,tax,vp,pelicans,rep,removeHouse:group==='red',
});
// The last guild tile in each row is the marked bottom tile.
export const BUILDING_GROUPS = {
  silver:[
    guild('smelter','Smelter','silver','s',7,4,4),
    guild('hammer','Hammer Works','silver','s',4,4,3),
    guild('furnace','Furnace','silver','sr',7,6,3),
    guild('washworks','Ore Washworks','silver','ys',8,4,7),
  ],
  ore:[
    guild('pump','Pump','ore','y',3,4,3),
    guild('airshaft','Airshaft','ore','y',2,3,2),
    guild('horse-mill','Horse Mill','ore','ys',3,4,1,1),
    guild('smithy','Smithy','ore','yr',4,5,3),
  ],
  wood:[
    guild('mason','Mason’s','wood','b',5,6,5),
    guild('limekiln','Limekiln','wood','r',3,4,4),
    guild('sawmill','Sawmill','wood','yr',4,4,3,1),
    guild('workshop','Cathedral’s Workshop','wood','rb',5,4,7,1),
  ],
  permit:[
    guild('assay','Assay Office','permit','o',5,5,3),
    guild('ore-market','Ore Market','permit','sb',8,7,3,1),
    guild('mining-office','Mining Office','permit','yb',7,8,3,1),
    guild('courthouse','Courthouse','permit','bo',10,10,6,1),
  ],
  food:[
    guild('bakery','Bakery','food','b',6,6,4,2),
    guild('bread','Bread Market','food','r',6,5,4,2),
    guild('butcher','Butcher’s','food','o',8,8,5,1),
    guild('fish','Fish Market','food','rb',9,7,6,1),
  ],
  beer:[
    guild('tavern','Tavern','beer','yo',5,4,2,1),
    guild('bathhouse','Bathhouse','beer','bo',7,8,2,1),
    guild('brewery','Brewery','beer','so',9,8,3,1),
    guild('warehouse','Wine Warehouse','beer','ro',10,9,5,2),
  ],
  green:[
    publicTile('st-john','St. John’s Chapel','green','ryy',9,1,1,3,1,0),
    publicTile('st-mary','St. Mary Magdalene’s Chapel','green','srr',9,1,1,3,1,0),
    publicTile('st-george','St. George’s Chapel','green','rbb',9,1,1,3,1,0),
  ],
  civicSilver:[
    publicTile('our-lady','Church of Our Lady','silver','bss',12,2,3,2,0,3),
    publicTile('high-church','High Church of the Virgin Mary','silver','obb',12,2,3,2,0,3),
    publicTile('bartholomew','Church of St. Bartholomew','silver','boo',12,2,3,2,0,3),
  ],
  yellow:[
    publicTile('hospital','Hospital','yellow','yrr',8,2,1,0,1,2),
    publicTile('coal-market','Coal Market','yellow','yss',8,2,1,0,1,2),
    publicTile('mint','Mint','yellow','sbb',8,2,1,0,1,2),
  ],
  red:[
    publicTile('town-hall','Town Hall','red','ooo',10,2,2,0,2,0),
    publicTile('smallcastle','Smallcastle','red','orr',10,2,2,0,2,0),
    publicTile('school','School','red','bbb',10,2,2,0,2,0),
  ],
};
export const BUILDINGS = Object.fromEntries(Object.values(BUILDING_GROUPS).flat().map(tile => [tile.id,tile]));
const mineData = [
  [[1,1,0,0,1],[0,2,1,0,4],[0,2,0,0,3],[0,2,0,0,1],[1,1,1,0,2],[1,1,1,0,4]],
  [[3,0,1,0,1],[2,1,0,0,2],[2,0,1,1,4],[0,2,0,1,2],[1,2,0,0,4],[1,0,1,1,5],[3,0,1,0,5],[0,3,0,0,1],[0,1,0,2,3]],
  [[1,0,2,0,6],[2,0,0,0,2],[2,2,0,0,2],[3,0,0,0,3],[0,0,1,2,1],[0,1,0,1,4],[0,0,1,3,3],[0,2,0,2,5],[1,1,0,1,1],[1,0,1,2,4],[0,3,0,0,5],[2,0,1,0,5]],
];
export const MINE_GROUPS = mineData.map((group,tier) => group.map(([stars,ore,pop,vp,extend],i) => ({
  id: `m${tier+1}-${i+1}`, name: `${['I','II','III'][tier]}–${i+1}`, tier:tier+1, stars,ore,pop,vp,extend,
})));
export const TECHNOLOGY = [1,2,3,3].map((extend,i) => ({id:`t${i+1}`,name:`Technology ${i+1}`,stars:1,ore:0,pop:0,vp:0,extend}));
export const MINES = Object.fromEntries([...MINE_GROUPS.flat(),...TECHNOLOGY].map(tile => [tile.id,tile]));
export const EVENTS = {
  abbey:{name:'Sedlec Abbey',set:'A',tax:2, detail:'At round end, cycle the top tile of each guild stack to its bottom.'},
  fever:{name:'Silver Fever',set:'A',pop:2, detail:'At round end, population rises 2 and every miner pool refills for free.'},
  rush:{name:'Land Rush',set:'A',tax:4,pop:2, detail:'At round end, population rises 2. Skip all taxes this round.'},
  siege:{name:'Siege of Kutná Hora',set:'A',tax:2, detail:'At round end, discard the top tile of the three original public stacks.'},
  code:{name:'Ius Regale Montanorum',set:'A',ore:2, detail:'At round end, ore rises 2. Discard the next five mine tiles, or the rest of the stack if fewer remain.'},
  cathedral:{name:'Cathedral Construction',set:'A',ore:2, detail:'At round end, ore rises 2 and each player gains one pelican.'},
  michal:{name:'Michal of Vrchoviště',set:'B',tax:3, detail:'At round end, discard the top tile of the leftmost stack in each row.'},
  groschen:{name:'180,000 Groschen',set:'B',ore:3, detail:'At round end, ore rises 3. Skip the current cathedral tile and add its tax before paying taxes.'},
  king:{name:'A Visit from the King',set:'B',pop:3, detail:'At round end, population rises 3. Double taxes for this round.'},
  abbot:{name:'Abbot Heidenreich',set:'B',tax:3, detail:'At round end, move each leftmost stack to the end of its row.'},
};
