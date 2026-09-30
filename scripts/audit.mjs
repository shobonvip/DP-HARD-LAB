import {writeFile,rename} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {setTimeout} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {MODEL_VERSION,extract} from '../src/engine.mjs';
import {chartTempo} from '../src/tempo.mjs';
const catalog=JSON.parse(await readFile('data/catalog.json','utf8')),coverage=JSON.parse(await readFile('data/coverage.json','utf8')),table=JSON.parse(await readFile('data/table.json','utf8')),ereter=JSON.parse(await readFile('data/ereter-hard-stats.json','utf8')),h5=JSON.parse(await readFile('data/h5-results.json','utf8'));
const errors=[],warnings=[],byLevel={},idSet=new Set();let matched=0,randomComplete=0,notes=0,duplicates=0;
const verifyFeatures=process.argv.includes('--verify-features');let featuresChecked=0,sourceHashesChecked=0;
if(table.model!==MODEL_VERSION)errors.push('Table does not use the current model');
if(h5.model!==MODEL_VERSION||table.singleHard5?.version!==h5.version)errors.push('H5 model/version mismatch');
for(const row of table.rows){
 if(idSet.has(row.id))errors.push('Duplicate chart ID '+row.id);idSet.add(row.id);
 const bucket=byLevel[row.level]??={total:0,analyzed:0};bucket.total++;
 if(JSON.stringify(row.ereter??null)!==JSON.stringify(ereter.byChart?.[row.id]??null))errors.push('Stale ereter stats '+row.id);
 if(row.level!==12&&row.ereter)errors.push('Unexpected ereter stats outside level 12 '+row.id);
 if(!row.analysis){if(row.status==='parsed')errors.push('Parsed chart missing analysis '+row.id);continue;}bucket.analyzed++;
 const chartText=await readFile(`data/charts/${row.id}.json`,'utf8'),chart=JSON.parse(chartText),result=JSON.parse(await readFile(`data/results/${row.id}.json`,'utf8'));
 if(result.model!==table.model)errors.push('Mixed model version '+row.id);
 if(JSON.stringify(row.tempo??null)!==JSON.stringify(chartTempo(chart))||row.bpm!==chartTempo(chart)?.bpm)errors.push('Chart tempo metadata mismatch '+row.id);
 if(result.id!==row.id)errors.push('Result ID mismatch '+row.id);
 if(row.analysis.requiredCapacity!==(result.free?.requiredCapacity??result.requiredCapacity))errors.push('Stale table capacity '+row.id);
 if(JSON.stringify(row.analysis.metrics)!==JSON.stringify(result.metrics))errors.push('Stale table metrics '+row.id);
 if(verifyFeatures){const actual=extract(chart,undefined,result.profile).metrics;featuresChecked++;if(Object.keys(result.metrics).some(k=>!Number.isFinite(actual[k])||Math.abs(actual[k]-result.metrics[k])>1e-9))errors.push('Source/result features mismatch '+row.id);}
 if(!Number.isFinite(row.analysis.hardStar))errors.push('Missing star estimate '+row.id);
 const single=row.analysis.singleHard5,stored=h5.byChart?.[row.id];
 if(!single||!stored||single.requiredCapacity!==stored.requiredCapacity||single.recommendation!==stored.recommendation||single.validationClearRate!==stored.validationClearRate)errors.push('Missing or stale H5 result '+row.id);
 else if(!Number.isFinite(single.hIndex)||!Number.isFinite(single.hardStar))errors.push('Invalid H5 rank '+row.id);
 if(['scratchLanding','scratchReversal','scratchSplit','scratchTravel'].some(k=>!Number.isFinite(result.metrics[k])))errors.push('Missing scratch metrics '+row.id);
 if(['fingerRate','unilateralBurst','rapidRunLoad','leftPeakHandNps','rightPeakHandNps','jackLoad','colorFlow','stairFlow','adjacentStairFlow','adjacentStairLoad','homeBreakStairLoad','phraseReuse','anmitsuGroupedNotes','shiftedScratches'].some(k=>!Number.isFinite(result.metrics[k])))errors.push('Missing context metrics '+row.id);
 for(const simulation of [result.selected,...(result.free?.strategies??[]).map(s=>s.simulation)]){
  const t=simulation.timing;
  if(!t||!Object.values(t.judgements??{}).every(Number.isFinite)||!Number.isFinite(t.badChainsPerTrial))errors.push('Missing timing summary '+row.id);
  else if(Math.abs(t.judgements.BAD+t.judgements.POOR+t.judgements.EMPTY_POOR-simulation.meanMissUntilEndOrFail)>1e-7)errors.push('Timing/miss count mismatch '+row.id);
  for(const points of simulation.traces??[])if(points.some((p,i)=>i>0&&p.time<points[i-1].time))errors.push('Nonchronological gauge trace '+row.id);
 }
 if(chart.events.length!==row.notes||chart.events.length!==chart.sourceNotes)errors.push('Count mismatch '+row.id);else matched++;
 if(!Object.values(result.metrics).every(Number.isFinite))errors.push('Nonfinite metrics '+row.id);
 if(!Number.isFinite(row.analysis.hIndex)||row.analysis.hIndex<0||row.analysis.hIndex>100)errors.push('Invalid rank '+row.id);
 if(result.options.length!==8)errors.push('Fixed option count '+row.id);
 if(result.free){randomComplete++;if(result.free.strategies.some(s=>s.censored))warnings.push('Ability range insufficient '+row.id);}else errors.push('Missing RANDOM analysis '+row.id);
 if(result.options.some(o=>o.required>=32))warnings.push('Fixed capacity reached bound '+row.id);
 let prev=-1;const seen=new Set();
 for(const e of chart.events){if(!Number.isFinite(e.time)||e.time<prev||e.lane<0||e.lane>7||![0,1].includes(e.hand))errors.push('Invalid event '+row.id);prev=e.time;const key=e.time.toFixed(6)+':'+e.hand+':'+e.lane;if(seen.has(key))duplicates++;seen.add(key);}
 notes+=chart.events.length;
 if(result.sourceHash){sourceHashesChecked++;if(result.sourceHash!==createHash('sha256').update(chartText).digest('hex'))errors.push('Source hash mismatch '+row.id);}
 if(verifyFeatures&&featuresChecked%100===0)console.log(`Verified features ${featuresChecked}/${table.analyzed}`);
}
function ranks(a){const sorted=[...a].sort((x,y)=>x-y);return a.map(v=>{const start=sorted.indexOf(v),end=sorted.lastIndexOf(v);return(start+end)/2;});}
function correlation(x,y){if(x.length<2)return null;const mx=x.reduce((s,v)=>s+v,0)/x.length,my=y.reduce((s,v)=>s+v,0)/y.length;let xy=0,xx=0,yy=0;for(let i=0;i<x.length;i++){xy+=(x[i]-mx)*(y[i]-my);xx+=(x[i]-mx)**2;yy+=(y[i]-my)**2;}return xy/Math.sqrt(xx*yy);}
const overlap=table.rows.filter(r=>r.normal&&r.analysis),rho=correlation(ranks(overlap.map(r=>r.normal.rating)),ranks(overlap.map(r=>r.analysis.requiredCapacity)));
const ereterMatched=table.rows.filter(r=>r.ereter).length;
if(ereterMatched!==ereter.matchedCount||ereter.officialLevel12Count!==table.rows.filter(r=>r.level===12).length)errors.push('Ereter coverage count mismatch');
if(Object.keys(ereter.byChart??{}).some(id=>!catalog.charts.some(c=>c.id===id&&c.level===12)))errors.push('Ereter stats reference a non-level-12 or unknown chart');
if(catalog.charts.length!==coverage.total||catalog.charts.length!==table.total)errors.push('Catalog/coverage/table totals differ');
if(table.rows.length!==table.total||matched!==table.analyzed)errors.push('Table row/analysis count mismatch');
const report={checkedAt:new Date().toISOString(),model:table.model,catalogCharts:catalog.charts.length,analyzedCharts:matched,ereterMatched,ereterLevel12Total:ereter.officialLevel12Count,randomPoliciesComplete:randomComplete,validatedNotes:notes,featuresChecked,sourceHashesChecked,unavailable:coverage.report.filter(r=>r.status!=='parsed'),byLevel,duplicateLaneTimeEvents:duplicates,normalReferenceRankCorrelation:rho,normalOverlap:overlap.length,interpretation:'相関は参考値。ノマゲをハードの正解とした精度評価ではない。featuresCheckedは再取得譜面と保存結果の特徴量照合数。元結果にハッシュがない場合、当時の譜面とのバイト単位一致までは証明しない。',errors,warnings};
async function safeWrite(file,body){const temp=file+'.tmp';await writeFile(temp,body);for(let attempt=0;;attempt++){try{await rename(temp,file);return;}catch(error){if(!['EPERM','EBUSY','EACCES','UNKNOWN'].includes(error.code)||attempt===9)throw error;await setTimeout(200);}}}
await safeWrite('data/audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,unavailable:report.unavailable.length},null,2));if(errors.length)process.exitCode=1;
