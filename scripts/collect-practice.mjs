import {writeFile,mkdir} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {catalog,parseChart} from '../src/textage.mjs';
const read=p=>readFile(p,'utf8');
const charts=catalog(...await Promise.all(['titletbl.js','actbl.js','datatbl.js'].map(p=>read('data/cache/'+p))),{practice:true});
await mkdir('data/practice',{recursive:true});
const report=[];let last=0,requests=0;
for(const meta of charts){
 try{
  if(!meta.available)throw Error('Source chart not available');
  const file=`data/charts/${meta.id}.json`;
  try{const c=JSON.parse(await read(file));if(c.events.length===meta.notes){report.push({id:meta.id,status:'reused'});continue;}}catch(e){if(e.code!=='ENOENT')throw e;}
  const path=`${meta.version}/${meta.tag}.html`,cache='data/cache/'+path.replaceAll('/','__');let html;
  try{html=await read(cache);}catch(e){if(e.code!=='ENOENT')throw e;
   await new Promise(r=>setTimeout(r,Math.max(0,500-(Date.now()-last))));last=Date.now();
   const response=await fetch('https://textage.cc/score/'+path,{signal:AbortSignal.timeout(20000)});requests++;
   if(!response.ok)throw Error('HTTP '+response.status);
   html=new TextDecoder('shift_jis').decode(await response.arrayBuffer());await writeFile(cache,html);
  }
  const chart=parseChart(html,meta);await writeFile(file,JSON.stringify(chart));report.push({id:meta.id,status:'parsed'});
 }catch(e){report.push({id:meta.id,status:'unavailable',reason:e.message});}
 if(report.length%50===0)console.log(`${report.length}/${charts.length}, requests=${requests}`);
}
await writeFile('data/practice/catalog.json',JSON.stringify({generatedAt:new Date().toISOString(),scope:'Existing scope plus DP NORMAL/HYPER levels 7–9; source table snapshot reused',charts,report,requests},null,2));
console.log(JSON.stringify({total:charts.length,parsed:report.filter(r=>r.status==='parsed').length,reused:report.filter(r=>r.status==='reused').length,unavailable:report.filter(r=>r.status==='unavailable').length,requests}));
