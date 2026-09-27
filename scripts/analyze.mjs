import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {analyzeChart,MODEL_VERSION} from '../src/engine.mjs';
import {buildStarScale,hardStar} from '../src/star-scale.mjs';
await mkdir('data/results',{recursive:true});
const catalog=JSON.parse(await readFile('data/catalog.json','utf8')),coverage=JSON.parse(await readFile('data/coverage.json','utf8')),status=new Map(coverage.report.map(r=>[r.id,r]));
const limit=Number(process.argv.find(x=>x.startsWith('--limit='))?.split('=')[1]||Infinity),force=process.argv.includes('--force');
const html=await readFile('data/cache/normal-table.html','utf8').catch(()=>''),normal=new Map();
const clean=t=>t.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&apos;|&#039;/g,"'").replace(/&quot;/g,'"').normalize('NFKC').replace(/\s/g,'').toLowerCase();
for(const m of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)){
 const title=m[1].match(/<td class="music">([\s\S]*?)<\/td>/)?.[1];if(!title)continue;
 for(const a of m[1].matchAll(/href="(music.php\?id=[^"]+)"[^>]*><span class="([HAL])">☆(\d+) \(([\d.]+)\)/g))normal.set(clean(title)+':'+({H:'HYPER',A:'ANOTHER',L:'LEGGENDARIA'}[a[2]]),{rating:Number(a[4]),level:Number(a[3]),url:'https://zasa.sakura.ne.jp/dp/'+a[1]});
}
const rows=[];let analyzed=0;
const v2=JSON.parse(await readFile('data/table-v2.json','utf8').catch(()=>'{}'));
const previousStars=new Map((v2.rows||[]).map(r=>[r.id,r.analysis?.hardStar]));
const prior=JSON.parse(await readFile('data/table-v1.json','utf8').catch(()=>'{}'));
const previous=new Map((prior.rows||[]).map(r=>[r.id,r.analysis?.hIndex]));
for(const c of catalog.charts){
 const row={...c,normal:normal.get(clean(c.title)+':'+c.difficulty)??null,status:status.get(c.id)?.status??'pending'};
 if(row.normal&&row.normal.level!==c.level){row.normal=null;row.normalMismatch=true;}
 if(row.status==='parsed'&&analyzed<limit){
  let result;try{if(force)throw Error();result=JSON.parse(await readFile(`data/results/${c.id}.json`,'utf8'));if(result.model!==MODEL_VERSION)throw Error();}catch{
   const chart=JSON.parse(await readFile(`data/charts/${c.id}.json`,'utf8'));result=analyzeChart(chart);
   await writeFile(`data/results/${c.id}.json`,JSON.stringify(result));
  }
  row.analysis={requiredCapacity:result.free?.requiredCapacity??result.requiredCapacity,fixedRequiredCapacity:result.requiredCapacity,option:result.free?.recommendation??result.options[0].name,fixedOption:result.options[0].name,freeReady:!!result.free,metrics:result.metrics,random:result.random.meanClearRate,warnings:result.warnings};
  row.analysis.previousHIndex=previous.get(c.id)??null;
  row.analysis.previousHardStar=previousStars.get(c.id)??null;
  analyzed++;if(analyzed%50===0)console.log(`Analyzed ${analyzed}`);
 }else row.reason=status.get(c.id)?.reason??'解析待ち';
 rows.push(row);
}
const sorted=rows.filter(r=>r.analysis).sort((a,b)=>a.analysis.requiredCapacity-b.analysis.requiredCapacity);
for(const row of sorted){const count=sorted.filter(r=>r.analysis.requiredCapacity<row.analysis.requiredCapacity).length,tied=sorted.filter(r=>r.analysis.requiredCapacity===row.analysis.requiredCapacity).length;row.analysis.hIndex=Math.round((count+(tied-1)/2)/Math.max(1,sorted.length-1)*1000)/10;}
const result={game:catalog.game,generatedAt:new Date().toISOString(),snapshotAt:catalog.snapshotAt,model:MODEL_VERSION,total:rows.length,analyzed,normalMatched:rows.filter(r=>r.normal).length,definition:'H指数 = 解析済み対象譜面の80%完走必要能力の百分位。固定8種＋両RANDOM/FLIP両RANDOMの有限標本。ノマゲの11.xとは別尺度。',rows};
result.starScale=buildStarScale(rows);
for(const row of sorted){const star=hardStar(row.analysis.requiredCapacity,result.starScale);row.analysis.hardStar=star.value;row.analysis.starExtrapolated=star.extrapolated;}
result.definition='推定HARD ☆ = 公式難度ごとの必要能力中央値に合わせた参考換算。公式難度・ノマゲ表の小数値とは別の評価。H指数は対象内百分位として保持。';
await writeFile('data/table.json',JSON.stringify(result));
const fields=['title','difficulty','level','normal','hIndex','requiredCapacity','option','density','peakHandNps','placement','scratch','repetition','hold','randomClearAtThreshold','status','sourceUrl','recognition','movement','reach','coordination','fatigue','movementDistance','patternReuse','previousHIndex','hardStar','starExtrapolated','previousHardStar','scratchLanding','scratchReversal','scratchSplit','scratchTravel'];
const csv=[fields.join(','),...rows.map(r=>[r.title,r.difficulty,r.level,r.normal?.rating,r.analysis?.hIndex,r.analysis?.requiredCapacity,r.analysis?.option,r.analysis?.metrics.density,r.analysis?.metrics.peakHandNps,r.analysis?.metrics.placement,r.analysis?.metrics.scratch,r.analysis?.metrics.repetition,r.analysis?.metrics.hold,r.analysis?.random,r.status,r.sourceUrl,...['recognition','movement','reach','coordination','fatigue','movementDistance','patternReuse'].map(k=>r.analysis?.metrics[k]),r.analysis?.previousHIndex,r.analysis?.hardStar,r.analysis?.starExtrapolated,r.analysis?.previousHardStar,...['scratchLanding','scratchReversal','scratchSplit','scratchTravel'].map(k=>r.analysis?.metrics[k])].map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(','))].join('\r\n');
await writeFile('data/difficulty.csv','\ufeff'+csv);
console.log(JSON.stringify({total:rows.length,analyzed,normalMatched:result.normalMatched}));
