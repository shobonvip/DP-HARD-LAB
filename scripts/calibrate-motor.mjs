import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {writeFile,mkdir} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {extract,fixedOptions,requiredCapacity,randomOption,hash,DEFAULT_PROFILE} from '../src/engine.mjs';
const candidates=[[0,0],[.35,0],[.65,0],[0,1],[.35,1],[.65,1],[.35,2],[.65,2]];
export function ranks(v){const s=v.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),out=[];for(let i=0;i<s.length;){let j=i+1;while(j<s.length&&s[j].v===s[i].v)j++;for(let k=i;k<j;k++)out[s[k].i]=(i+j-1)/2/Math.max(1,s.length-1)*100;i=j;}return out;}
const mean=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
export function evaluate(rows,index){const a=ranks(rows.map(r=>r.values[index])),b=ranks(rows.map(r=>r.hc)),ma=mean(a),mb=mean(b);return {n:rows.length,mae:mean(a.map((x,i)=>Math.abs(x-b[i]))),rho:a.reduce((s,x,i)=>s+(x-ma)*(b[i]-mb),0)/Math.sqrt(a.reduce((s,x)=>s+(x-ma)**2,0)*b.reduce((s,x)=>s+(x-mb)**2,0))};}
if(isMainThread){
 const table=JSON.parse(await readFile('data/table.json','utf8'));
 const eligible=table.rows.filter(r=>r.level===12&&r.ereter&&!/[～~]/.test(r.bpm)).sort((a,b)=>a.ereter.hcDiff-b.ereter.hcDiff);
 const count=Number(process.argv.find(a=>a.startsWith('--sample='))?.split('=')[1]??160);
 const ids=Array.from({length:Math.min(count,eligible.length)},(_,i)=>eligible[Math.floor((i+.5)*eligible.length/Math.min(count,eligible.length))].id);
 const metadata=new Map(eligible.map(r=>[r.id,{hc:r.ereter.hcDiff,title:r.title,split:hash(r.title)%5===0?'holdout':'train'}]));
 await mkdir('data/staging/motor-calibration-v2',{recursive:true});
 const rows=[];let done=0;
 await Promise.all(Array.from({length:8},(_,i)=>new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url),{workerData:{ids:ids.filter((_,j)=>j%8===i),candidates}});w.on('message',r=>{rows.push({...r,...metadata.get(r.id)});console.log(`${++done}/${ids.length} ${r.id}`);});w.on('error',reject);w.on('exit',c=>c?reject(Error('worker '+c)):resolve());})));
 const train=rows.filter(r=>r.split==='train'),holdout=rows.filter(r=>r.split==='holdout');
 const results=candidates.map((c,i)=>({index:i,relief:c[0],placement:c[1],train:evaluate(train,i)}));
 const chosen=[...results].sort((a,b)=>a.train.mae-b.train.mae)[0].index;
 const report={createdAt:new Date().toISOString(),definition:'Non-soflan, HC-stratified sample. Title-grouped 80/20 split; selection by TRAIN MAE only; holdout used once after selection. Fixed48/random96 trials. Previously used external population: not independent real-player validation.',candidates,chosen,results,holdout:{baseline:evaluate(holdout,0),chosen:evaluate(holdout,chosen)},rows};
 await writeFile('data/motor-calibration.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:undefined},null,2));
}else{
 for(const id of workerData.ids){
  const file=`data/staging/motor-calibration-v2/${id}.json`;let cached;try{cached=JSON.parse(await readFile(file,'utf8'));}catch{}if(cached){parentPort.postMessage(cached);continue;}
  const chart=JSON.parse(await readFile(`data/charts/${id}.json`,'utf8')),old=JSON.parse(await readFile(`data/results/${id}.json`,'utf8')),seed=hash(id),profile={...DEFAULT_PROFILE,...old.profile,motorOverlapRelief:0,placementWeight:0};
  const options=[...fixedOptions(),...(old.random?.draws?.map(d=>d.option)??Array.from({length:16},(_,i)=>randomOption(seed+i*101,i%2===1)))];
  const features=options.map(o=>extract(chart,o,profile));
  const values=[];
  for(const [relief,placement] of workerData.candidates){
   const adjusted=features.map(f=>{const actions=new Map(f.humanActions.map(a=>[a.time.toFixed(6)+':'+a.hand,a]));return {...f,events:f.events.map(e=>{const a=actions.get(e.plannedTime.toFixed(6)+':'+e.hand),side=e.hand?profile.right:profile.left;return {...e,demand:e.demand+(-relief*a.motorOverlapLoad+placement*a.placementTransitionLoad)/side};})};});
   const capacities=adjusted.slice(0,8).map(f=>requiredCapacity(f,{target:.05,trials:48,seed,profile}).value);
   for(const flip of [false,true])capacities.push(requiredCapacity({pool:adjusted.slice(8).filter(f=>!!f.option.flip===flip)},{target:.05,trials:96,seed:seed+501,profile}).value);
   values.push(Math.min(...capacities));
  }
  const row={id,values,metrics:features[0].metrics};await writeFile(file,JSON.stringify(row));parentPort.postMessage(row);
 }
}
