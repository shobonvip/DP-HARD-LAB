import {mkdir,writeFile,rename} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {createHash} from 'node:crypto';
import {parseChart} from '../src/textage.mjs';

// Restore the saved snapshot without changing its catalog or coverage.
const catalog=JSON.parse(await readFile('data/catalog.json','utf8'));
const coverage=JSON.parse(await readFile('data/coverage.json','utf8'));
const parsed=new Set(coverage.report.filter(r=>r.status==='parsed').map(r=>r.id));
await mkdir('data/cache',{recursive:true});
await mkdir('data/charts',{recursive:true});
const report={startedAt:new Date().toISOString(),snapshotAt:catalog.snapshotAt,restored:0,reused:0,errors:[]};
let lastRequest=0,requests=0;
async function page(meta){
 const path=`${meta.version}/${meta.tag}.html`,file='data/cache/'+path.replaceAll('/','__');
 try{return await readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,400-(Date.now()-lastRequest))));
 lastRequest=Date.now();requests++;
 const url='https://textage.cc/score/'+path;
 const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'DPHardLab/0.1 (local research; cached sequential requests)'}});
 if(!response.ok)throw Error(`HTTP ${response.status}: ${url}`);
 const text=new TextDecoder('shift_jis').decode(await response.arrayBuffer());
 await writeFile(file,text);
 await writeFile(file+'.meta.json',JSON.stringify({url,retrievedAt:new Date().toISOString(),sha256:createHash('sha256').update(text).digest('hex')},null,2));
 return text;
}
for(const meta of catalog.charts.filter(c=>parsed.has(c.id))){
 try{
  const file=`data/charts/${meta.id}.json`;
  let existing;
  try{existing=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(existing?.id===meta.id&&existing.events?.length===meta.notes&&existing.sourceNotes===meta.notes){report.reused++;continue;}
  const chart=parseChart(await page(meta),meta);
  await writeFile(file+'.tmp',JSON.stringify(chart));
  await rename(file+'.tmp',file);
  report.restored++;
 }catch(e){report.errors.push({id:meta.id,reason:e.message});}
 const done=report.restored+report.reused+report.errors.length;
 if(done%50===0){console.log(`${done}/${parsed.size} restored=${report.restored} reused=${report.reused} errors=${report.errors.length}`);await writeFile('data/restore-report.json',JSON.stringify({...report,requests},null,2));}
 // Stop repeated network failures instead of hammering an unavailable source.
 if(report.errors.length>=5&&report.restored===0)break;
}
report.finishedAt=new Date().toISOString();report.requests=requests;
await writeFile('data/restore-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.errors.length)process.exitCode=1;
