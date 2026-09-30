import {writeFile,rename} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {setTimeout} from 'node:timers/promises';
import {MODEL_VERSION} from '../src/engine.mjs';

const source=process.argv.find(x=>x.startsWith('--source='))?.slice(9);
if(!source)throw Error('Use --source=<staged results directory>');
const coverage=JSON.parse(await readFile('data/coverage.json','utf8'));
const ids=coverage.report.filter(r=>r.status==='parsed').map(r=>r.id),validated=[];
for(const id of ids){
 const body=await readFile(`${source}/${id}.json`,'utf8'),result=JSON.parse(body);
 if(result.id!==id||result.model!==MODEL_VERSION||!result.free||!Object.values(result.metrics).every(Number.isFinite))throw Error('Invalid staged result: '+id);
 validated.push({id,body});
}
console.log(`Validated ${validated.length} results at ${MODEL_VERSION}`);
let done=0;
for(const {id,body} of validated){
 const destination=`data/results/${id}.json`;
 await writeFile(destination+'.tmp',body);
 for(let attempt=0;;attempt++){
  try{await rename(destination+'.tmp',destination);break;}
  catch(error){if(!['EPERM','EBUSY','EACCES'].includes(error.code)||attempt===4)throw error;await setTimeout(200);}
 }
 if(++done%300===0)console.log(`Published ${done}/${ids.length}`);
}
console.log(`Published all ${done} results.`);
