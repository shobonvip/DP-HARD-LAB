import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {writeFile,mkdir} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {humanFeatures} from '../src/human.mjs';
import {DEFAULT_PROFILE,MODEL_VERSION} from '../src/engine.mjs';
import {categories,practiceFeatures,PRACTICE_VERSION} from '../src/practice.mjs';
import {keyboardLoad} from '../src/practice-load.mjs';
if(isMainThread){
 const catalog=JSON.parse(await readFile('data/practice/catalog.json','utf8'));
 const available=new Set(catalog.report.filter(r=>r.status!=='unavailable').map(r=>r.id));
 const charts=catalog.charts.filter(c=>available.has(c.id));await mkdir('data/practice/features',{recursive:true});let done=0;
 await Promise.all(Array.from({length:8},(_,i)=>new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url),{workerData:charts.filter((_,j)=>j%8===i)});w.on('message',()=>{if(++done%200===0)console.log(`${done}/${charts.length}`);});w.on('error',reject);w.on('exit',code=>code?reject(Error('Worker '+code)):resolve());})));
 const rows=await Promise.all(charts.map(c=>readFile(`data/practice/features/${c.id}.json`,'utf8').then(JSON.parse)));
 const data={version:PRACTICE_VERSION,model:MODEL_VERSION,generatedAt:new Date().toISOString(),total:catalog.charts.length,analyzed:rows.length,unavailable:catalog.report.filter(r=>r.status==='unavailable'),categories,rows};
 await writeFile('public/practice-data.json',JSON.stringify(data));
 console.log(JSON.stringify({total:data.total,analyzed:data.analyzed,added:catalog.report.filter(r=>r.status==='parsed').length}));
}else for(const meta of workerData){
 const file=`data/practice/features/${meta.id}.json`;let cached;try{cached=JSON.parse(await readFile(file,'utf8'));}catch{}
 if(cached?.version!==PRACTICE_VERSION||cached?.model!==MODEL_VERSION){
  const chart=JSON.parse(await readFile(`data/charts/${meta.id}.json`,'utf8')),f=humanFeatures(chart,DEFAULT_PROFILE);
  const keysOnly={...chart,events:chart.events.filter(e=>e.lane>0),holds:chart.holds.filter(h=>h.lane>0)};
  const load=keyboardLoad(chart,humanFeatures(keysOnly,DEFAULT_PROFILE).actions),features=practiceFeatures(chart,f.actions);
  features.stamina.score=load.staminaScore;features.technique.score=load.techniqueScore;
  await writeFile(file,JSON.stringify({...meta,version:PRACTICE_VERSION,model:MODEL_VERSION,duration:chart.duration,features,keyboardLoad:load,soflan:new Set(chart.tempos.map(t=>t.bpm)).size>1,holds:chart.holds.length}));
 }
 parentPort.postMessage(meta.id);
}
