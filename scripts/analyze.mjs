import {writeFile,mkdir,rename} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {setTimeout} from 'node:timers/promises';
import {analyzeChart,MODEL_VERSION} from '../src/engine.mjs';
import {buildStarScale,hardStar} from '../src/star-scale.mjs';
await mkdir('data/results',{recursive:true});
const catalog=JSON.parse(await readFile('data/catalog.json','utf8')),coverage=JSON.parse(await readFile('data/coverage.json','utf8')),ereter=JSON.parse(await readFile('data/ereter-hard-stats.json','utf8').catch(e=>{if(e.code==='ENOENT')return '{"byChart":{}}';throw e;})),h5=JSON.parse(await readFile('data/h5-results.json','utf8').catch(e=>{if(e.code==='ENOENT')return '{"byChart":{}}';throw e;})),status=new Map(coverage.report.map(r=>[r.id,r]));
const limit=Number(process.argv.find(x=>x.startsWith('--limit='))?.split('=')[1]||Infinity),force=process.argv.includes('--force');
const html=await readFile('data/cache/normal-table.html','utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;}),normal=new Map();
const savedTable=JSON.parse(await readFile('data/table.json','utf8').catch(e=>{if(e.code==='ENOENT')return '{}';throw e;}));
const savedNormal=new Map((savedTable.rows||[]).map(r=>[r.id,r]));
const tempoData=JSON.parse(await readFile('data/chart-tempos.json','utf8').catch(e=>{if(e.code==='ENOENT')return '{"byChart":{}}';throw e;}));
const namedEntities={amp:'&',apos:"'",quot:'"',nbsp:' ',Oslash:'Ø',oslash:'ø',atilde:'ã',eacute:'é',hearts:'♥',auml:'ä',ouml:'ö',aelig:'æ',AElig:'Æ',ecirc:'ê',Uuml:'Ü',iexcl:'¡'};
const clean=t=>String(t??'').replace(/<[^>]*>/g,'').replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16))).replace(/&#(\d+);/g,(_,dec)=>String.fromCodePoint(Number(dec))).replace(/&([A-Za-z][A-Za-z0-9]+);/g,(_,name)=>namedEntities[name]??`&${name};`).normalize('NFKC').replace(/\s/g,'').toLowerCase();
for(const m of (html??'').matchAll(/<tr>([\s\S]*?)<\/tr>/g)){
 const title=m[1].match(/<td class="music">([\s\S]*?)<\/td>/)?.[1];if(!title)continue;
 for(const a of m[1].matchAll(/href="(music.php\?id=[^"]+)"[^>]*><span class="([HAL])">☆(\d+) \(([\d.]+)\)/g))normal.set(clean(title)+':'+({H:'HYPER',A:'ANOTHER',L:'LEGGENDARIA'}[a[2]]),{rating:Number(a[4]),level:Number(a[3]),url:'https://zasa.sakura.ne.jp/dp/'+a[1]});
}
const rows=[];let analyzed=0;
const priorTable=JSON.parse(await readFile('data/table-v6.0.json','utf8').catch(()=> '{}'));
const previousStars=new Map((priorTable.rows||[]).map(r=>[r.id,r.analysis?.hardStar]));
const prior=JSON.parse(await readFile('data/table-v1.json','utf8').catch(()=>'{}'));
const previous=new Map((prior.rows||[]).map(r=>[r.id,r.analysis?.hIndex]));
for(const c of catalog.charts){
 const row={...c,normal:normal.get(clean(c.title)+':'+c.difficulty)??null,ereter:ereter.byChart?.[c.id]??null,status:status.get(c.id)?.status??'pending'};
 // A Git checkout does not include the source cache. Preserve only references
 // whose chart identity still matches; an available cache remains authoritative.
 const saved=savedNormal.get(c.id);
 const tempo=tempoData.byChart[c.id];if(tempo){row.sourceBpm=c.bpm;row.bpm=tempo.bpm;row.tempo=tempo;}
 if(html===null&&saved&&clean(saved.title)===clean(c.title)&&saved.difficulty===c.difficulty&&saved.level===c.level)row.normal=saved.normal??null;
 if(row.normal&&row.normal.level!==c.level){row.normal=null;row.normalMismatch=true;}
 if(row.status==='parsed'&&analyzed<limit){
  let result;try{if(force)throw Error();result=JSON.parse(await readFile(`data/results/${c.id}.json`,'utf8'));if(result.model!==MODEL_VERSION)throw Error();}catch{
   const chart=JSON.parse(await readFile(`data/charts/${c.id}.json`,'utf8'));result=analyzeChart(chart);
   await writeFile(`data/results/${c.id}.json`,JSON.stringify(result));
  }
  row.analysis={requiredCapacity:result.free?.requiredCapacity??result.requiredCapacity,fixedRequiredCapacity:result.requiredCapacity,option:result.free?.recommendation??result.options[0].name,fixedOption:result.options[0].name,freeReady:!!result.free,metrics:result.metrics,random:result.random.meanClearRate,warnings:result.warnings};
  const single=h5.byChart?.[c.id];if(single)row.analysis.singleHard5={...single};
  row.analysis.previousHIndex=previous.get(c.id)??null;
  row.analysis.previousHardStar=previousStars.get(c.id)??null;
  analyzed++;if(analyzed%50===0)console.log(`Analyzed ${analyzed}`);
 }else row.reason=status.get(c.id)?.reason??'解析待ち';
 rows.push(row);
}
const sorted=rows.filter(r=>r.analysis).sort((a,b)=>a.analysis.requiredCapacity-b.analysis.requiredCapacity);
for(const row of sorted){const count=sorted.filter(r=>r.analysis.requiredCapacity<row.analysis.requiredCapacity).length,tied=sorted.filter(r=>r.analysis.requiredCapacity===row.analysis.requiredCapacity).length;row.analysis.hIndex=Math.round((count+(tied-1)/2)/Math.max(1,sorted.length-1)*1000)/10;}
const h5Sorted=rows.filter(r=>r.analysis?.singleHard5).sort((a,b)=>a.analysis.singleHard5.requiredCapacity-b.analysis.singleHard5.requiredCapacity);
for(const row of h5Sorted){const value=row.analysis.singleHard5.requiredCapacity,count=h5Sorted.filter(r=>r.analysis.singleHard5.requiredCapacity<value).length,tied=h5Sorted.filter(r=>r.analysis.singleHard5.requiredCapacity===value).length;row.analysis.singleHard5.hIndex=Math.round((count+(tied-1)/2)/Math.max(1,h5Sorted.length-1)*1000)/10;}
const result={game:catalog.game,generatedAt:new Date().toISOString(),snapshotAt:catalog.snapshotAt,model:MODEL_VERSION,total:rows.length,analyzed,normalMatched:rows.filter(r=>r.normal).length,ereterMatched:rows.filter(r=>r.ereter).length,ereterSource:{url:ereter.sourceUrl,retrievedAt:ereter.retrievedAt,matched:ereter.matchedCount,level12Total:ereter.officialLevel12Count},singleHard5:{version:h5.version,target:h5.target,trials:h5.trials,validation:h5.validation,definition:h5.definition},definition:'H指数 = 解析済み対象譜面の80%完走必要能力の百分位。固定8種＋両RANDOM/FLIP両RANDOMの有限標本。ノマゲの11.xとは別尺度。',rows};
result.starScale=buildStarScale(rows);
for(const row of sorted){const star=hardStar(row.analysis.requiredCapacity,result.starScale);row.analysis.hardStar=star.value;row.analysis.starExtrapolated=star.extrapolated;}
if(h5Sorted.length){result.singleHard5.starScale=buildStarScale(h5Sorted.map(r=>({...r,analysis:{requiredCapacity:r.analysis.singleHard5.requiredCapacity}})));for(const row of h5Sorted){const star=hardStar(row.analysis.singleHard5.requiredCapacity,result.singleHard5.starScale);row.analysis.singleHard5.hardStar=star.value;row.analysis.singleHard5.starExtrapolated=star.extrapolated;}}
result.definition='推定HARD ☆ = 公式難度ごとの必要能力中央値に合わせた参考換算。80%版と単発5%版を併記。公式難度・ノマゲ表の小数値とは別の評価。H指数・H5指数は対象内百分位。';
async function safeWrite(file,body){const temp=file+'.tmp';await writeFile(temp,body);for(let attempt=0;;attempt++){try{await rename(temp,file);return;}catch(error){if(!['EPERM','EBUSY','EACCES','UNKNOWN'].includes(error.code)||attempt===9)throw error;await setTimeout(200);}}}
await safeWrite('data/table.json',JSON.stringify(result));
const fields=['scratchOverlapLoad','scratchEnduranceLoad','scratchEndurance','bpm','tempoVariable','motorOverlapLoad','placementTransitionLoad','motorRelief','placementExtra','title','difficulty','level','normal','normalLevel','normalRating','normalUrl','hIndex','requiredCapacity','option','h5Index','h5RequiredCapacity','h5HardStar','h5Option','h5ValidationClearRate','density','peakHandNps','leftPeakHandNps','rightPeakHandNps','placement','scratch','repetition','hold','randomClearAtThreshold','status','sourceUrl','ereterRank','ereterEcDiff','ereterHcDiff','ereterExhDiff','ereterEcCount','ereterHcCount','ereterExhCount','ereterUrl','recognition','movement','reach','coordination','fatigue','movementDistance','patternReuse','previousHIndex','hardStar','starExtrapolated','previousHardStar','scratchRhythmComplexity','scratchRhythmWeight','scratchRhythmCost','scratchLanding','scratchReversal','scratchSplit','scratchTravel','physical','cognitive','extension','ergonomic','coupling','stairLoad','keimaLoad','scratchForce','scratchStroke','pressWork','scratchWork','fingerRate','unilateralBurst','rapidRunLoad','jackLoad','colorFlow','stairFlow','adjacentStairFlow','adjacentStairLoad','homeBreakStairLoad','phraseReuse','anmitsuGroupedNotes','shiftedScratches'];
const csv=[fields.join(','),...rows.map(r=>[...['scratchOverlapLoad','scratchEnduranceLoad','scratchEndurance'].map(k=>r.analysis?.metrics[k]),r.bpm,r.tempo?.variable,...['motorOverlapLoad','placementTransitionLoad','motorRelief','placementExtra'].map(k=>r.analysis?.metrics[k]),r.title,r.difficulty,r.level,r.normal?.rating,r.normal?.level,r.normal?.rating,r.normal?.url,r.analysis?.hIndex,r.analysis?.requiredCapacity,r.analysis?.option,r.analysis?.singleHard5?.hIndex,r.analysis?.singleHard5?.requiredCapacity,r.analysis?.singleHard5?.hardStar,r.analysis?.singleHard5?.recommendation,r.analysis?.singleHard5?.validationClearRate,r.analysis?.metrics.density,r.analysis?.metrics.peakHandNps,r.analysis?.metrics.leftPeakHandNps,r.analysis?.metrics.rightPeakHandNps,r.analysis?.metrics.placement,r.analysis?.metrics.scratch,r.analysis?.metrics.repetition,r.analysis?.metrics.hold,r.analysis?.random,r.status,r.sourceUrl,r.ereter?.rank,r.ereter?.ecDiff,r.ereter?.hcDiff,r.ereter?.exhDiff,r.ereter?.ecCount,r.ereter?.hcCount,r.ereter?.exhCount,r.ereter?.url,...['recognition','movement','reach','coordination','fatigue','movementDistance','patternReuse'].map(k=>r.analysis?.metrics[k]),r.analysis?.previousHIndex,r.analysis?.hardStar,r.analysis?.starExtrapolated,r.analysis?.previousHardStar,...['scratchRhythmComplexity','scratchRhythmWeight','scratchRhythmCost','scratchLanding','scratchReversal','scratchSplit','scratchTravel','physical','cognitive','extension','ergonomic','coupling','stairLoad','keimaLoad','scratchForce','scratchStroke','pressWork','scratchWork','fingerRate','unilateralBurst','rapidRunLoad','jackLoad','colorFlow','stairFlow','adjacentStairFlow','adjacentStairLoad','homeBreakStairLoad','phraseReuse','anmitsuGroupedNotes','shiftedScratches'].map(k=>r.analysis?.metrics[k])].map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(','))].join('\r\n');
await safeWrite('data/difficulty.csv','\ufeff'+csv);
console.log(JSON.stringify({total:rows.length,analyzed,normalMatched:result.normalMatched}));
