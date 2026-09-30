import {writeFile} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {MODEL_VERSION} from '../src/engine.mjs';

const source=process.argv.find(x=>x.startsWith('--source='))?.slice(9)||'data/staging/h5-results';
const coverage=JSON.parse(await readFile('data/coverage.json','utf8'));
const ids=coverage.report.filter(r=>r.status==='parsed').map(r=>r.id),byChart={};
const rates=[];
for(const id of ids){
 const result=JSON.parse(await readFile(`${source}/${id}.json`,'utf8'));
 if(result.id!==id||result.model!==MODEL_VERSION||result.version!=='single-hard-5-v3'||result.target!==.05||!Number.isFinite(result.requiredCapacity)||!Number.isFinite(result.validationClearRate))throw Error('Invalid H5 result: '+id);
 byChart[id]={requiredCapacity:result.requiredCapacity,recommendation:result.recommendation,validationClearRate:result.validationClearRate};
 rates.push(result.validationClearRate);
}
rates.sort((a,b)=>a-b);const q=p=>{const i=(rates.length-1)*p;return rates[Math.floor(i)]*(1-i%1)+rates[Math.ceil(i)]*(i%1);};
const output={version:'single-hard-5-v3',model:MODEL_VERSION,generatedAt:new Date().toISOString(),target:.05,definition:'固定8種＋両RANDOM/FLIP両RANDOM（各8配置の有限標本）における単発5%完走必要能力。',trials:{fixed:128,random:256,validation:256},validation:{median:q(.5),p10:q(.1),p90:q(.9),within2to10Percent:rates.filter(x=>x>=.02&&x<=.10).length,total:rates.length},byChart};
await writeFile('data/h5-results.json',JSON.stringify(output));
console.log(JSON.stringify({...output,byChart:undefined},null,2));
