import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {writeFile,mkdir,rename} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {extract,fixedOptions,requiredCapacity,simulate,randomOption,hash,DEFAULT_PROFILE,MODEL_VERSION} from '../src/engine.mjs';

const VERSION='single-hard-5-v3';
const TARGET=.05;
const FIXED_TRIALS=128;
const RANDOM_TRIALS=256;
const VALIDATION_TRIALS=256;

if(isMainThread){
 const workers=Number(process.argv.find(x=>x.startsWith('--workers='))?.slice(10)??8);
 if(!Number.isInteger(workers)||workers<1||workers>16)throw Error('Workers must be an integer from 1 to 16');
 const output=process.argv.find(x=>x.startsWith('--output='))?.slice(9)||'data/staging/h5-results';
 await mkdir(output,{recursive:true});
 const catalog=JSON.parse(await readFile('data/catalog.json','utf8'));
 const coverage=JSON.parse(await readFile('data/coverage.json','utf8'));
 const parsed=new Set(coverage.report.filter(r=>r.status==='parsed').map(r=>r.id));
 const ids=catalog.charts.filter(c=>parsed.has(c.id)&&(process.argv.includes('--all')||c.level===12)).map(c=>c.id);
 let done=0;
 await Promise.all(Array.from({length:workers},(_,i)=>new Promise((resolve,reject)=>{
  const worker=new Worker(new URL(import.meta.url),{workerData:{ids:ids.filter((_,j)=>j%workers===i),output}});
  worker.on('message',()=>{if(++done%25===0)console.log(`${done}/${ids.length}`);});
  worker.on('error',reject);
  worker.on('exit',code=>code?reject(Error('Worker failed '+code)):resolve());
 })));
 console.log(`H5 calculation complete: ${done}/${ids.length}`);
}else{
 for(const id of workerData.ids){
  const file=`${workerData.output}/${id}.json`;
  let cached;try{cached=JSON.parse(await readFile(file,'utf8'));}catch{}
  if(cached?.version===VERSION&&cached?.model===MODEL_VERSION){parentPort.postMessage(id);continue;}
  const [chart,oldResult]=await Promise.all([
   readFile(`data/charts/${id}.json`,'utf8').then(JSON.parse),
   readFile(`data/results/${id}.json`,'utf8').then(JSON.parse)
  ]);
  const profile={...DEFAULT_PROFILE,...oldResult.profile};
  const seed=hash(id);
  const fixedFeatures=fixedOptions().map(option=>extract(chart,option,profile));
  const fixed=fixedFeatures.map(features=>({
   name:features.option.name,
   required:requiredCapacity(features,{target:TARGET,trials:FIXED_TRIALS,seed,profile}).value
  })).sort((a,b)=>a.required-b.required);
  const savedOptions=oldResult.random?.draws?.map(d=>d.option);
  const randomOptions=savedOptions?.length===16?savedOptions:Array.from({length:16},(_,i)=>randomOption(seed+i*101,i%2===1));
  const randomFeatures=randomOptions.map(option=>extract(chart,option,profile));
  const random=[];
  for(const flip of [false,true]){
   const pool=randomFeatures.filter((_,i)=>!!randomOptions[i].flip===flip);
   const required=requiredCapacity({pool},{target:TARGET,trials:RANDOM_TRIALS,seed:seed+501,profile}).value;
   random.push({name:flip?'FLIP + 両RANDOM':'両RANDOM',required,pool});
  }
  const candidates=[...fixed.map((x,i)=>({...x,features:fixedFeatures.find(f=>f.option.name===x.name)})),...random.map(x=>({...x,features:{pool:x.pool}}))].sort((a,b)=>a.required-b.required);
  const best=candidates[0];
  const validation=simulate(best.features,{capacity:best.required,trials:VALIDATION_TRIALS,seed:seed+40001,profile,summary:false});
  const result={
   id,version:VERSION,model:MODEL_VERSION,target:TARGET,
   trials:{fixed:FIXED_TRIALS,random:RANDOM_TRIALS,validation:VALIDATION_TRIALS},
   requiredCapacity:best.required,recommendation:best.name,validationClearRate:validation.clearRate,
   fixed:fixed.map(({name,required})=>({name,required})),
   random:random.map(({name,required})=>({name,required}))
  };
  await writeFile(file+'.tmp',JSON.stringify(result));
  await rename(file+'.tmp',file);
  parentPort.postMessage(id);
 }
}
