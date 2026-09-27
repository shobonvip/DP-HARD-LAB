import {readFile,writeFile} from 'node:fs/promises';
import {analyzeRandomStrategies} from '../src/engine.mjs';
const coverage=JSON.parse(await readFile('data/coverage.json','utf8'));let n=0,missing=0;
for(const c of coverage.report.filter(r=>r.status==='parsed')){
 let result;try{result=JSON.parse(await readFile(`data/results/${c.id}.json`,'utf8'));}catch{missing++;continue;}
 if(!result.free){const chart=JSON.parse(await readFile(`data/charts/${c.id}.json`,'utf8'));result.free=analyzeRandomStrategies(chart,result);await writeFile(`data/results/${c.id}.json`,JSON.stringify(result));}
 if(++n%100===0)console.log(`Random policies analyzed: ${n}`);
}
console.log(JSON.stringify({completed:n,missingBaseResults:missing}));
