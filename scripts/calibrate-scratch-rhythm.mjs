import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {writeFile} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {extract,fixedOptions,requiredCapacity,randomOption,hash,DEFAULT_PROFILE} from '../src/engine.mjs';

const CANDIDATES=[0,.35,.5,.65,.8];
const TARGET=.05,FIXED_TRIALS=48,RANDOM_TRIALS=96,SAMPLE_SIZE=360;

function ranks(values){
 const order=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value),out=Array(values.length);
 for(let i=0;i<order.length;){let j=i+1;while(j<order.length&&order[j].value===order[i].value)j++;const rank=(i+j-1)/2;for(let k=i;k<j;k++)out[order[k].index]=rank/Math.max(1,values.length-1)*100;i=j;}
 return out;
}
function mean(values){return values.reduce((sum,value)=>sum+value,0)/Math.max(1,values.length);}
function pearson(a,b){const ma=mean(a),mb=mean(b);let xy=0,xx=0,yy=0;for(let i=0;i<a.length;i++){xy+=(a[i]-ma)*(b[i]-mb);xx+=(a[i]-ma)**2;yy+=(b[i]-mb)**2;}return xy/Math.sqrt(xx*yy);}
function summarize(rows,candidate,split){
 const group=rows.filter(row=>row.split===split),model=ranks(group.map(row=>row.values[candidate])),external=ranks(group.map(row=>row.hcDiff));
 const gaps=model.map((value,index)=>value-external[index]),complexity=ranks(group.map(row=>row.scratchRhythmComplexity));
 const complex=gaps.filter((_,index)=>complexity[index]>=75),other=gaps.filter((_,index)=>complexity[index]<75);
 return {count:group.length,spearman:pearson(model,external),meanAbsoluteGap:mean(gaps.map(Math.abs)),scratchRhythmTopQuartileMeanGap:mean(complex),otherMeanGap:mean(other)};
}

if(isMainThread){
 const workers=Number(process.argv.find(value=>value.startsWith('--workers='))?.slice(10)??8);
 const [table,ereter]=await Promise.all([readFile('data/table.json','utf8').then(JSON.parse),readFile('data/ereter-hard-stats.json','utf8').then(JSON.parse)]);
 const eligible=table.rows.filter(row=>row.level===12&&row.analysis&&ereter.byChart[row.id]&&!String(row.bpm).includes('～')).sort((a,b)=>a.analysis.metrics.scratch-b.analysis.metrics.scratch);
 const ids=[];for(let bin=0;bin<12;bin++){const lo=Math.floor(eligible.length*bin/12),hi=Math.floor(eligible.length*(bin+1)/12),part=eligible.slice(lo,hi),take=Math.min(30,part.length);for(let i=0;i<take;i++)ids.push(part[Math.floor((i+.5)*part.length/take)].id);}
 if(ids.length!==SAMPLE_SIZE)throw Error(`Expected ${SAMPLE_SIZE} calibration charts, got ${ids.length}`);
 const metadata=new Map(eligible.map(row=>[row.id,{hcDiff:ereter.byChart[row.id].hcDiff,scratch:row.analysis.metrics.scratch,split:(hash(row.id)&1)?'validation':'train'}]));
 const rows=[];let done=0;
 await Promise.all(Array.from({length:workers},(_,worker)=>new Promise((resolve,reject)=>{
  const workerIds=ids.filter((_,index)=>index%workers===worker);
  const thread=new Worker(new URL(import.meta.url),{workerData:{ids:workerIds,candidates:CANDIDATES,fixedTrials:FIXED_TRIALS,randomTrials:RANDOM_TRIALS}});
  thread.on('message',row=>{rows.push({...row,...metadata.get(row.id)});if(++done%30===0)console.log(`${done}/${ids.length}`);});
  thread.on('error',reject);thread.on('exit',code=>code?reject(Error('Worker failed '+code)):resolve());
 })));
 const results=CANDIDATES.map(candidate=>({scratchRhythmEase:candidate,train:summarize(rows,String(candidate),'train'),validation:summarize(rows,String(candidate),'validation')}));
 const output={generatedAt:new Date().toISOString(),target:TARGET,excluded:'BPM表記に「～」を含むソフラン譜面',population:eligible.length,sample:rows.length,trials:{fixed:FIXED_TRIALS,random:RANDOM_TRIALS},selection:'皿負荷の12区間から各30譜面、譜面ID hashで学習・確認を分割',results};
 await writeFile('data/scratch-rhythm-calibration.json',JSON.stringify(output,null,2));
 console.log(JSON.stringify(output,null,2));
}else{
 for(const id of workerData.ids){
  const [chart,oldResult]=await Promise.all([readFile(`data/charts/${id}.json`,'utf8').then(JSON.parse),readFile(`data/results/${id}.json`,'utf8').then(JSON.parse)]);
  const seed=hash(id),saved=oldResult.random?.draws?.map(draw=>draw.option),randomOptions=saved?.length===16?saved:Array.from({length:16},(_,index)=>randomOption(seed+index*101,index%2===1));
  const values={};let scratchRhythmComplexity=0;
  for(const candidate of workerData.candidates){
   const profile={...DEFAULT_PROFILE,...oldResult.profile,scratchRhythmEase:candidate};
   const fixedFeatures=fixedOptions().map(option=>extract(chart,option,profile));
   if(candidate===workerData.candidates[0])scratchRhythmComplexity=fixedFeatures[0].metrics.scratchRhythmComplexity;
   const fixed=fixedFeatures.map(features=>requiredCapacity(features,{target:TARGET,trials:workerData.fixedTrials,seed,profile}).value);
   const randomFeatures=randomOptions.map(option=>extract(chart,option,profile));
   const random=[];for(const flip of [false,true]){const pool=randomFeatures.filter((_,index)=>!!randomOptions[index].flip===flip);random.push(requiredCapacity({pool},{target:TARGET,trials:workerData.randomTrials,seed:seed+501,profile}).value);}
   values[String(candidate)]=Math.min(...fixed,...random);
  }
  parentPort.postMessage({id,values,scratchRhythmComplexity});
 }
}
