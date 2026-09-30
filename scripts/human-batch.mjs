import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {writeFile,mkdir,rename} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {analyzeChart,analyzeRandomStrategies,MODEL_VERSION} from '../src/engine.mjs';
if(isMainThread){
 const workers=Number(process.argv.find(x=>x.startsWith('--workers='))?.slice(10)??4);
 if(!Number.isInteger(workers)||workers<1||workers>16)throw Error('Workers must be an integer from 1 to 16');
 const output=process.argv.find(x=>x.startsWith('--output='))?.slice(9)||'data/results';await mkdir(output,{recursive:true});
 const coverage=JSON.parse(await readFile('data/coverage.json','utf8')),ids=coverage.report.filter(r=>r.status==='parsed').map(r=>r.id);let done=0;
 await Promise.all(Array.from({length:workers},(_,i)=>new Promise((resolve,reject)=>{const worker=new Worker(new URL(import.meta.url),{workerData:{ids:ids.filter((_,j)=>j%workers===i),output}});worker.on('message',()=>{if(++done%100===0)console.log(`${done}/${ids.length}`);});worker.on('error',reject);worker.on('exit',code=>code?reject(Error('Worker failed '+code)):resolve());})));
 console.log('Human model complete: '+done);
}else{
 for(const id of workerData.ids){const file=`${workerData.output}/${id}.json`;let cached;try{cached=JSON.parse(await readFile(file,'utf8'));}catch{}
  if(cached?.model===MODEL_VERSION&&cached.free){parentPort.postMessage(id);continue;}
  const chart=JSON.parse(await readFile(`data/charts/${id}.json`,'utf8')),r=analyzeChart(chart);r.free=analyzeRandomStrategies(chart,r);await writeFile(file+'.tmp',JSON.stringify(r));await rename(file+'.tmp',file);parentPort.postMessage(id);
 }
}
