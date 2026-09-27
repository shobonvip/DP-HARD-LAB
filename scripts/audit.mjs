import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const catalog=JSON.parse(await readFile('data/catalog.json','utf8')),coverage=JSON.parse(await readFile('data/coverage.json','utf8')),table=JSON.parse(await readFile('data/table.json','utf8'));
const errors=[],warnings=[],byLevel={},idSet=new Set();let matched=0,randomComplete=0,notes=0,duplicates=0;
for(const row of table.rows){
 if(idSet.has(row.id))errors.push('Duplicate chart ID '+row.id);idSet.add(row.id);
 const bucket=byLevel[row.level]??={total:0,analyzed:0};bucket.total++;
 if(!row.analysis)continue;bucket.analyzed++;
 const chartText=await readFile(`data/charts/${row.id}.json`,'utf8'),chart=JSON.parse(chartText),result=JSON.parse(await readFile(`data/results/${row.id}.json`,'utf8'));
 if(result.model!==table.model)errors.push('Mixed model version '+row.id);
 if(!Number.isFinite(row.analysis.hardStar))errors.push('Missing star estimate '+row.id);
 if(['scratchLanding','scratchReversal','scratchSplit','scratchTravel'].some(k=>!Number.isFinite(result.metrics[k])))errors.push('Missing scratch metrics '+row.id);
 if(chart.events.length!==row.notes||chart.events.length!==chart.sourceNotes)errors.push('Count mismatch '+row.id);else matched++;
 if(!Object.values(result.metrics).every(Number.isFinite))errors.push('Nonfinite metrics '+row.id);
 if(!Number.isFinite(row.analysis.hIndex)||row.analysis.hIndex<0||row.analysis.hIndex>100)errors.push('Invalid rank '+row.id);
 if(result.options.length!==8)errors.push('Fixed option count '+row.id);
 if(result.free){randomComplete++;if(result.free.strategies.some(s=>s.censored))warnings.push('Ability range insufficient '+row.id);}
 if(result.options.some(o=>o.required>=32))warnings.push('Fixed capacity reached bound '+row.id);
 let prev=-1;const seen=new Set();
 for(const e of chart.events){if(!Number.isFinite(e.time)||e.time<prev||e.lane<0||e.lane>7||![0,1].includes(e.hand))errors.push('Invalid event '+row.id);prev=e.time;const key=e.time.toFixed(6)+':'+e.hand+':'+e.lane;if(seen.has(key))duplicates++;seen.add(key);}
 notes+=chart.events.length;
 if(!result.sourceHash){result.sourceHash=createHash('sha256').update(chartText).digest('hex');await writeFile(`data/results/${row.id}.json`,JSON.stringify(result));}
}
function ranks(a){const sorted=[...a].sort((x,y)=>x-y);return a.map(v=>{const start=sorted.indexOf(v),end=sorted.lastIndexOf(v);return(start+end)/2;});}
function correlation(x,y){if(x.length<2)return null;const mx=x.reduce((s,v)=>s+v,0)/x.length,my=y.reduce((s,v)=>s+v,0)/y.length;let xy=0,xx=0,yy=0;for(let i=0;i<x.length;i++){xy+=(x[i]-mx)*(y[i]-my);xx+=(x[i]-mx)**2;yy+=(y[i]-my)**2;}return xy/Math.sqrt(xx*yy);}
const overlap=table.rows.filter(r=>r.normal&&r.analysis),rho=correlation(ranks(overlap.map(r=>r.normal.rating)),ranks(overlap.map(r=>r.analysis.requiredCapacity)));
if(catalog.charts.length!==coverage.total||catalog.charts.length!==table.total)errors.push('Catalog/coverage/table totals differ');
const report={checkedAt:new Date().toISOString(),catalogCharts:catalog.charts.length,analyzedCharts:matched,randomPoliciesComplete:randomComplete,validatedNotes:notes,unavailable:coverage.report.filter(r=>r.status!=='parsed'),byLevel,duplicateLaneTimeEvents:duplicates,normalReferenceRankCorrelation:rho,normalOverlap:overlap.length,interpretation:'相関は参考値。ノマゲをハードの正解とした精度評価ではない。',errors,warnings};
await writeFile('data/audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,unavailable:report.unavailable.length},null,2));if(errors.length)process.exitCode=1;
