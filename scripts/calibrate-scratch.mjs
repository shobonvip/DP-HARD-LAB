import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {writeFile} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {extract,fixedOptions,requiredCapacity,randomOption,hash,DEFAULT_PROFILE} from '../src/engine.mjs';

const CANDIDATES=[1,1.15,1.3,1.45,1.6,1.8];
const TARGET=.05,FIXED_TRIALS=48,RANDOM_TRIALS=96,SAMPLE_SIZE=360;

function ranks(values){
 const order=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value),out=Array(values.length);
 for(let i=0;i<order.length;){let j=i+1;while(j<order.length&&order[j].value===order[i].value)j++;const rank=(i+j-1)/2;for(let k=i;k<j;k++)out[order[k].index]=rank/Math.max(1,values.length-1)*100;i=j;}
 return out;
}
function mean(a){return a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);}
function pearson(a,b){const ma=mean(a),mb=mean(b);let xy=0,xx=0,yy=0;for(let i=0;i<a.length;i++){xy+=(a[i]-ma)*(b[i]-mb);xx+=(a[i]-ma)**2;yy+=(b[i]-mb)**2;}return xy/Math.sqrt(xx*yy);}
function summarize(rows,candidate,split){
 const group=rows.filter(r=>r.split===split),model=ranks(group.map(r=>r.values[candidate])),external=ranks(group.map(r=>r.hcDiff));
 const gaps=model.map((x,i)=>x-external[i]),scratch=ranks(group.map(r=>r.scratch));
 const heavy=gaps.filter((_,i)=>scratch[i]>=75),light=gaps.filter((_,i)=>scratch[i]<75);
 return {count:group.length,spearman:pearson(model,external),meanAbsoluteGap:mean(gaps.map(Math.abs)),scratchTopQuartileMeanGap:mean(heavy),otherMeanGap:mean(light)};
}

if(isMainThread){
 const workers=Number(process.argv.find(x=>x.startsWith('--workers='))?.slice(10)??8);
 const [table,ereter]=await Promise.all([readFile('data/table.json','utf8').then(JSON.parse),readFile('data/ereter-hard-stats.json','utf8').then(JSON.parse)]);
 const eligible=table.rows.filter(r=>r.level===12&&r.analysis&&ereter.byChart[r.id]&&!String(r.bpm).includes('～'))
  .sort((a,b)=>a.analysis.metrics.scratch-b.analysis.metrics.scratch);
 // Keep the whole scratch distribution represented instead of fitting only the
 // conspicuous scratch charts. Each of 12 ordered bins contributes equally.
 const ids=[];for(let bin=0;bin<12;bin++){const lo=Math.floor(eligible.length*bin/12),hi=Math.floor(eligible.length*(bin+1)/12),part=eligible.slice(lo,hi),take=Math.min(30,part.length);for(let i=0;i<take;i++)ids.push(part[Math.floor((i+.5)*part.length/take)].id);}
 if(ids.length!==SAMPLE_SIZE)throw Error(`Expected ${SAMPLE_SIZE} calibration charts, got ${ids.length}`);
 const metadata=new Map(eligible.map(r=>[r.id,{hcDiff:ereter.byChart[r.id].hcDiff,scratch:r.analysis.metrics.scratch,split:(hash(r.id)&1)?'validation':'train'}]));
 const rows=[];let done=0;
 await Promise.all(Array.from({length:workers},(_,i)=>new Promise((resolve,reject)=>{
  const worker=new Worker(new URL(import.meta.url),{workerData:{ids:ids.filter((_,j)=>j%workers===i)}});
  worker.on('message',row=>{rows.push({...row,...metadata.get(row.id)});if(++done%30===0)console.log(`${done}/${ids.length}`);});
  worker.on('error',reject);worker.on('exit',code=>code?reject(Error('Worker failed '+code)):resolve());
 })));
 const results=CANDIDATES.map(candidate=>({scratchEase:candidate,train:summarize(rows,String(candidate),'train'),validation:summarize(rows,String(candidate),'validation')}));
 const output={generatedAt:new Date().toISOString(),target:TARGET,excluded:'BPM表記に「～」を含むソフラン譜面',population:eligible.length,sample:rows.length,trials:{fixed:FIXED_TRIALS,random:RANDOM_TRIALS},results};
 await writeFile('data/scratch-calibration.json',JSON.stringify(output,null,2));
 console.log(JSON.stringify(output,null,2));
}else{
 for(const id of workerData.ids){
  const [chart,oldResult]=await Promise.all([readFile(`data/charts/${id}.json`,'utf8').then(JSON.parse),readFile(`data/results/${id}.json`,'utf8').then(JSON.parse)]);
  const seed=hash(id),saved=oldResult.random?.draws?.map(d=>d.option),randomOptions=saved?.length===16?saved:Array.from({length:16},(_,i)=>randomOption(seed+i*101,i%2===1));
  const values={};
  for(const scratch of CANDIDATES){
   const profile={...DEFAULT_PROFILE,...oldResult.profile,scratch};
   const fixed=fixedOptions().map(option=>requiredCapacity(extract(chart,option,profile),{target:TARGET,trials:FIXED_TRIALS,seed,profile}).value);
   const randomFeatures=randomOptions.map(option=>extract(chart,option,profile));
   const random=[];for(const flip of [false,true]){const pool=randomFeatures.filter((_,i)=>!!randomOptions[i].flip===flip);random.push(requiredCapacity({pool},{target:TARGET,trials:RANDOM_TRIALS,seed:seed+501,profile}).value);}
   values[String(scratch)]=Math.min(...fixed,...random);
  }
  parentPort.postMessage({id,values});
 }
}
