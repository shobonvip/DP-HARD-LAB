import {readFile,writeFile} from 'node:fs/promises';
import {analyzeChart,analyzeRandomStrategies,extract} from '../src/engine.mjs';
const coverage=JSON.parse(await readFile('data/coverage.json','utf8'));let changed=0;const fixes=[];
for(const row of coverage.report.filter(x=>x.status==='parsed')){
 const c=JSON.parse(await readFile(`data/charts/${row.id}.json`,'utf8')),groups=new Map();
 for(const e of c.events){const k=e.time.toFixed(6)+':'+e.hand;if(!groups.has(k))groups.set(k,new Set());if(e.lane)groups.get(k).add(e.lane);}
 if(![...groups.values()].some(s=>s.size>=5))continue;
 const previous=JSON.parse(await readFile(`data/results/${row.id}.json`,'utf8'));
 const r=analyzeChart(c);r.free=analyzeRandomStrategies(c,r);r.correction='palm-v1';
 await writeFile(`data/results/${row.id}.json`,JSON.stringify(r));
 fixes.push({id:row.id,title:c.title,before:previous.free?.requiredCapacity??previous.requiredCapacity,after:r.free.requiredCapacity});changed++;
}
await writeFile('data/palm-correction.json',JSON.stringify({description:'全押しを一つの手のひら動作として扱う一般則。実測校正ではありません。',changed,fixes},null,2));console.log(JSON.stringify({changed,dirty:fixes.filter(x=>x.id.includes('thedirty'))}));
