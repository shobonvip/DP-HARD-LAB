import {writeFile} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {chartTempo} from '../src/tempo.mjs';
const catalog=JSON.parse(await readFile('data/catalog.json','utf8')),byChart={};
for(const c of catalog.charts){try{byChart[c.id]=chartTempo(JSON.parse(await readFile(`data/charts/${c.id}.json`,'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;}}
await writeFile('data/chart-tempos.json',JSON.stringify({generatedAt:new Date().toISOString(),definition:'Parsed per-chart tempo events, not song-wide catalog BPM',byChart}));
console.log(JSON.stringify({charts:Object.keys(byChart).length,variable:Object.values(byChart).filter(t=>t?.variable).length,level12Variable:catalog.charts.filter(c=>c.level===12&&byChart[c.id]?.variable).length}));
