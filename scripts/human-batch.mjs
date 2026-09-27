import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {readFile,writeFile} from 'node:fs/promises';
import {analyzeChart,analyzeRandomStrategies,MODEL_VERSION} from '../src/engine.mjs';
if(isMainThread){
 const coverage=JSON.parse(await readFile('data/coverage.json','utf8')),ids=coverage.report.filter(r=>r.status==='parsed').map(r=>r.id);let done=0;
 await Promise.all(Array.from({length:4},(_,i)=>new Promise((resolve,reject)=>{const worker=new Worker(new URL(import.meta.url),{workerData:ids.filter((_,j)=>j%4===i)});worker.on('message',()=>{if(++done%100===0)console.log(`${done}/${ids.length}`);});worker.on('error',reject);worker.on('exit',code=>code?reject(Error('Worker failed '+code)):resolve());})));
 console.log('Human model complete: '+done);
}else{
 for(const id of workerData){let cached;try{cached=JSON.parse(await readFile(`data/results/${id}.json`,'utf8'));}catch{}
  if(cached?.model===MODEL_VERSION&&cached.free){parentPort.postMessage(id);continue;}
  const chart=JSON.parse(await readFile(`data/charts/${id}.json`,'utf8')),r=analyzeChart(chart);r.free=analyzeRandomStrategies(chart,r);await writeFile(`data/results/${id}.json`,JSON.stringify(r));parentPort.postMessage(id);
 }
}
