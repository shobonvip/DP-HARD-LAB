import {mkdir,writeFile,rename} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {createHash} from 'node:crypto';
import {setTimeout} from 'node:timers/promises';
import {catalog,parseChart} from '../src/textage.mjs';
await mkdir('data/cache',{recursive:true});await mkdir('data/charts',{recursive:true});
const refresh=process.argv.includes('--refresh');
let lastRequest=0;
async function fetchCached(path){
 const file='data/cache/'+path.replaceAll('/','__');
 if(!refresh)try{return await readFile(file,'utf8');}catch{}
 await setTimeout(Math.max(0,400-(Date.now()-lastRequest)));lastRequest=Date.now();
 const url='https://textage.cc/score/'+path,r=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'DPHardLab/0.1 (local research; cached sequential requests)'}});
 if(!r.ok)throw Error(`HTTP ${r.status}: ${url}`);
 const text=new TextDecoder('shift_jis').decode(await r.arrayBuffer());await writeFile(file,text);
 await writeFile(file+'.meta.json',JSON.stringify({url,retrievedAt:new Date().toISOString(),sha256:createHash('sha256').update(text).digest('hex')},null,2));return text;
}
const titles=await fetchCached('titletbl.js'),levels=await fetchCached('actbl.js'),counts=await fetchCached('datatbl.js');
const charts=catalog(titles,levels,counts);
await writeFile('data/catalog.json',JSON.stringify({game:'IIDX 34 ZINRAI',snapshotAt:new Date().toISOString(),scope:'AC current: ANOTHER 5–9, all DP 10–12',charts},null,2));
console.log(`Catalog: ${charts.length} charts / ${new Set(charts.map(c=>c.tag)).size} songs`);
const limit=Number(process.argv.find(a=>a.startsWith('--limit='))?.split('=')[1]||Infinity),report=[];
async function saveCoverage(value){
 const file='data/coverage.json',temporary=file+'.tmp';
 await writeFile(temporary,JSON.stringify(value,null,2));
 for(let attempt=0;;attempt++){
  try{await rename(temporary,file);return;}
  catch(e){if(!['EPERM','EBUSY','EACCES','UNKNOWN'].includes(e.code)||attempt>=8)throw e;await setTimeout(200);}
 }
}
let n=0;
for(const meta of charts.slice(0,limit)){
 try{
   if(!meta.available)throw Error('Source chart not available');
   const html=await fetchCached(`${meta.version}/${meta.tag}.html`),chart=parseChart(html,meta);
   await writeFile(`data/charts/${meta.id}.json`,JSON.stringify(chart));report.push({id:meta.id,status:'parsed',notes:chart.events.length});
 }catch(e){report.push({id:meta.id,status:'unparsed',reason:e.message});}
 if(++n%50===0)console.log(`${n}/${Math.min(limit,charts.length)} processed, ${report.filter(r=>r.status==='parsed').length} validated`);
 if(n%25===0)await saveCoverage({updatedAt:new Date().toISOString(),total:charts.length,processed:report.length,report});
}
await saveCoverage({updatedAt:new Date().toISOString(),total:charts.length,processed:report.length,report});
console.log(JSON.stringify({parsed:report.filter(r=>r.status==='parsed').length,unparsed:report.filter(r=>r.status!=='parsed').length,examples:report.filter(r=>r.status!=='parsed').slice(0,12)},null,2));
