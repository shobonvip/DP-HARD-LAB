import {writeFile} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';

const [catalog,table,ereter]=await Promise.all([
 readFile('data/catalog.json','utf8').then(JSON.parse),
 readFile('data/table.json','utf8').then(JSON.parse),
 readFile('data/ereter-hard-stats.json','utf8').then(JSON.parse)
]);
const charts=catalog.charts.filter(c=>c.level===12);
const tableById=new Map(table.rows.map(r=>[r.id,r]));
const source=process.argv.find(x=>x.startsWith('--source='))?.slice(9);
if(!source)throw Error('Specify --source=<H5 results directory for the current model>');
const h5=await Promise.all(charts.map(c=>readFile(`${source}/${c.id}.json`,'utf8').then(JSON.parse)));
if(h5.some(r=>r.model!==table.model||r.version!==table.singleHard5.version))throw Error('Comparison would mix different model/H5 versions');
const h5ById=new Map(h5.map(r=>[r.id,r]));
const matched=charts.filter(c=>ereter.byChart[c.id]).map(c=>{
 const row=tableById.get(c.id),five=h5ById.get(c.id),stat=ereter.byChart[c.id];
 const fixedBest=Math.min(...five.fixed.map(x=>x.required));
 return {...c,bpm:row.bpm,tempo:row.tempo,h5:five.requiredCapacity,h80:row.analysis.requiredCapacity,recommendation:five.recommendation,validationClearRate:five.validationClearRate,fixedBest,randomGain:fixedBest-five.requiredCapacity,ereterHc:stat.hcDiff,ereterGrade:stat.rank,hcCount:stat.hcCount,ereterUrl:stat.url,metrics:row.analysis.metrics};
});

function averageRanks(values){
 const sorted=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),out=Array(values.length);
 for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j].v===sorted[i].v)j++;const rank=(i+j-1)/2;for(let k=i;k<j;k++)out[sorted[k].i]=rank;i=j;}
 return out;
}
function percentileRanks(values){const ranks=averageRanks(values),den=Math.max(1,values.length-1);return ranks.map(r=>r/den*100);}
function pearson(x,y){const mx=x.reduce((a,b)=>a+b,0)/x.length,my=y.reduce((a,b)=>a+b,0)/y.length;let xy=0,xx=0,yy=0;for(let i=0;i<x.length;i++){xy+=(x[i]-mx)*(y[i]-my);xx+=(x[i]-mx)**2;yy+=(y[i]-my)**2;}return xy/Math.sqrt(xx*yy);}
function spearman(x,y){return pearson(averageRanks(x),averageRanks(y));}
function median(a){const s=[...a].sort((x,y)=>x-y),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;}
function mean(a){return a.reduce((s,v)=>s+v,0)/Math.max(1,a.length);}
function q(a,p){const s=[...a].sort((x,y)=>x-y),i=(s.length-1)*p;return s[Math.floor(i)]*(1-i%1)+s[Math.ceil(i)]*(i%1);}

const h5Rank=percentileRanks(matched.map(r=>r.h5)),h80Rank=percentileRanks(matched.map(r=>r.h80)),ereterRank=percentileRanks(matched.map(r=>r.ereterHc));
matched.forEach((r,i)=>Object.assign(r,{h5Rank:h5Rank[i],h80Rank:h80Rank[i],ereterHcRank:ereterRank[i],gap:h5Rank[i]-ereterRank[i],oldGap:h80Rank[i]-ereterRank[i]}));

const metricLabels={
 scratch:'皿総負荷',scratchRhythmComplexity:'皿リズム複雑度',scratchRhythmCost:'皿リズム認識',scratchLanding:'皿着地',scratchReversal:'皿切り返し',scratchSplit:'皿鍵盤分担',
 jackLoad:'縦連',hold:'CN拘束',peakHandNps:'片手ピーク',unilateralBurst:'片手集中',rapidRunLoad:'高速連続動作',
 adjacentStairLoad:'隣接階段',homeBreakStairLoad:'ホーム崩し階段',stairLoad:'階段認識',keimaLoad:'桂馬認識',
 ergonomic:'指干渉・押下',extension:'拡張運指',density:'全体密度',burst:'局所集中',duration:'曲尺',
 shiftedScratches:'ずらし皿',anmitsuGroupedNotes:'あんみつ候補'
};
const metricKeys=Object.keys(metricLabels);
const metricPercentiles=Object.fromEntries(metricKeys.map(key=>[key,percentileRanks(matched.map(r=>r.metrics[key]??0))]));
matched.forEach((r,i)=>{r.featurePercentiles=Object.fromEntries(metricKeys.map(k=>[k,metricPercentiles[k][i]]));});
const hcCountPercentiles=percentileRanks(matched.map(r=>r.hcCount));
matched.forEach((r,i)=>r.hcCountPercentile=hcCountPercentiles[i]);

function reasonCandidates(row){
 const p=row.featurePercentiles,positive=row.gap>0,out=[];
 const add=(condition,text,score)=>{if(condition)out.push({text,score});};
 if(positive){
  add(p.scratch>85&&p.scratchRhythmComplexity<25,'規則的な皿の量・速度をHARDの取りこぼし許容より重く見ている可能性',Math.max(p.scratch,100-p.scratchRhythmComplexity));
  add(Math.max(p.scratchLanding,p.scratchSplit)>85,'皿・着地の身体コストをモデルが強く見ている',Math.max(p.scratchLanding,p.scratchSplit));
  add(p.jackLoad>85,'縦連負荷・同レーンのタイミングずれの持越しを強く見ている可能性',p.jackLoad);
  add(Math.max(p.adjacentStairLoad,p.homeBreakStairLoad,p.ergonomic,p.extension)>85,'ホームを崩す階段・運指負荷を強く見ている',Math.max(p.adjacentStairLoad,p.homeBreakStairLoad,p.ergonomic,p.extension));
  add(Math.max(p.peakHandNps,p.unilateralBurst,p.rapidRunLoad)>88,'片手の瞬間密度を強く見ている',Math.max(p.peakHandNps,p.unilateralBurst,p.rapidRunLoad));
  add(p.anmitsuGroupedNotes>85,'実プレイのあんみつ・ごまかしがモデルより有効な可能性',p.anmitsuGroupedNotes);
  add(row.randomGain<.13,'8配置標本では実際のRANDOM当たり待ちを十分に拾えていない可能性',80);
 }else{
  add(String(row.bpm).includes('～'),'ソフラン認識・HS操作コストが未校正',110);
  add(p.hold>82,'CN/HCNの拘束・継続ダメージをモデルが簡略化している',p.hold);
  add(p.duration>88,'長さと実プレイ疲労を過小評価している可能性',p.duration);
  add(p.burst>88,'局所的な殺しを平均化しすぎている可能性',p.burst);
  add(p.scratchRhythmComplexity>85,'複雑な押し引きリズムの認識負荷をモデルが軽く見ている可能性',p.scratchRhythmComplexity);
  add(Math.max(p.scratch,p.scratchReversal,p.scratchSplit)>88,'実際の皿技術差をモデルが軽く見ている可能性',Math.max(p.scratch,p.scratchReversal,p.scratchSplit));
  add(p.shiftedScratches>85,'皿の早押し・遅押し最適化が実戦より有利な可能性',p.shiftedScratches);
  add(row.hcCountPercentile<15,'HARD件数が少なくereter推定自体の不確実性も大きい',100-row.hcCountPercentile);
  add(Number.isFinite(row.version)&&row.version<=15,'旧作DP特有の配置・認識難を現特徴量で捉え切れていない可能性',87);
 }
 if(!out.length)out.push({text:'認識難・ギミック・個人差など、現特徴量にない要因の可能性',score:0});
 return out.sort((a,b)=>b.score-a.score).slice(0,3).map(x=>x.text);
}
matched.forEach(r=>r.inference=reasonCandidates(r));

const threshold=20;
const modelHarder=matched.filter(r=>r.gap>=threshold).sort((a,b)=>b.gap-a.gap);
const ereterHarder=matched.filter(r=>r.gap<=-threshold).sort((a,b)=>a.gap-b.gap);
const focusRows=['_shakunt-A','makin_it-A','dicadica-A'].map(id=>matched.find(r=>r.id===id)).filter(Boolean);
let state=0x48f2153;const random=()=>{state=Math.imul(state,1664525)+1013904223|0;return(state>>>0)/4294967296;};
const bootstrapDifferences=[];
for(let b=0;b<1000;b++){
 const sample=Array.from({length:matched.length},()=>matched[Math.floor(random()*matched.length)]);
 bootstrapDifferences.push(spearman(sample.map(r=>r.h5),sample.map(r=>r.ereterHc))-spearman(sample.map(r=>r.h80),sample.map(r=>r.ereterHc)));
}
function featureShift(group){return metricKeys.map(key=>({key,label:metricLabels[key],meanPercentile:mean(group.map(r=>r.featurePercentiles[key]))})).sort((a,b)=>Math.abs(b.meanPercentile-50)-Math.abs(a.meanPercentile-50)).slice(0,8);}
const summary={
 generatedAt:new Date().toISOString(),definition:'公式☆12内で5%必要能力とereter HC diffをそれぞれ百分位化して比較。gapはH5百分位-ereter百分位。',
 target:.05,attemptInterpretation:{attempts:20,atLeastOne:1-(1-.05)**20},matched:matched.length,
 correlations:{h5VsEreterSpearman:pearson(h5Rank,ereterRank),h80VsEreterSpearman:pearson(h80Rank,ereterRank),h5VsH80Spearman:pearson(h5Rank,h80Rank),h5RawVsEreterRawPearson:pearson(matched.map(r=>r.h5),matched.map(r=>r.ereterHc))},
 correlationImprovementBootstrap:{difference:pearson(h5Rank,ereterRank)-pearson(h80Rank,ereterRank),p025:q(bootstrapDifferences,.025),p975:q(bootstrapDifferences,.975),sharePositive:bootstrapDifferences.filter(x=>x>0).length/bootstrapDifferences.length},
 rankError:{h5MeanAbsolute:mean(matched.map(r=>Math.abs(r.gap))),h80MeanAbsolute:mean(matched.map(r=>Math.abs(r.oldGap))),h5MedianAbsolute:median(matched.map(r=>Math.abs(r.gap))),h80MedianAbsolute:median(matched.map(r=>Math.abs(r.oldGap)))},
 validation:{median:median(matched.map(r=>r.validationClearRate)),p10:q(matched.map(r=>r.validationClearRate),.1),p90:q(matched.map(r=>r.validationClearRate),.9),within2to10Percent:matched.filter(r=>r.validationClearRate>=.02&&r.validationClearRate<=.10).length},
 largeGapThreshold:threshold,modelHarderCount:modelHarder.length,ereterHarderCount:ereterHarder.length,
 largeGapComparison:{h5:matched.filter(r=>Math.abs(r.gap)>=threshold).length,h80:matched.filter(r=>Math.abs(r.oldGap)>=threshold).length,improved:matched.filter(r=>Math.abs(r.gap)<Math.abs(r.oldGap)).length,worsened:matched.filter(r=>Math.abs(r.gap)>Math.abs(r.oldGap)).length},
 recommendationCounts:Object.fromEntries([...new Set(matched.map(r=>r.recommendation))].map(k=>[k,matched.filter(r=>r.recommendation===k).length])),
 modelHarderFeatureShift:featureShift(modelHarder),ereterHarderFeatureShift:featureShift(ereterHarder)
};
summary.groupSignals={modelHarder:{newerVersionMedian:median(modelHarder.map(r=>r.version).filter(Number.isFinite)),soflan:modelHarder.filter(r=>String(r.bpm).includes('～')).length,scratchTop10Percent:modelHarder.filter(r=>r.featurePercentiles.scratch>=90).length,simpleScratchTopQuartile:modelHarder.filter(r=>r.featurePercentiles.scratch>=75&&r.featurePercentiles.scratchRhythmComplexity<=25).length,burstTop10Percent:modelHarder.filter(r=>r.featurePercentiles.burst>=90).length},ereterHarder:{versionMedian:median(ereterHarder.map(r=>r.version).filter(Number.isFinite)),oldVersion15OrEarlier:ereterHarder.filter(r=>Number.isFinite(r.version)&&r.version<=15).length,soflan:ereterHarder.filter(r=>String(r.bpm).includes('～')).length,holdTop10Percent:ereterHarder.filter(r=>r.featurePercentiles.hold>=90).length,scratchRhythmTop10Percent:ereterHarder.filter(r=>r.featurePercentiles.scratchRhythmComplexity>=90).length,scratchLandingTop10Percent:ereterHarder.filter(r=>r.featurePercentiles.scratchLanding>=90).length}};
const compact=r=>({id:r.id,title:r.title,difficulty:r.difficulty,version:r.version,bpm:r.bpm,h5Required:r.h5,h5Rank:r.h5Rank,h80Rank:r.h80Rank,ereterHc:r.ereterHc,ereterRank:r.ereterHcRank,gap:r.gap,recommendation:r.recommendation,validationClearRate:r.validationClearRate,hcCount:r.hcCount,ereterUrl:r.ereterUrl,inference:r.inference,featurePercentiles:r.featurePercentiles});
const output={summary,modelHarder:modelHarder.map(compact),ereterHarder:ereterHarder.map(compact),rows:matched.map(compact)};
await writeFile('data/ereter-h5-comparison.json',JSON.stringify(output,null,2));
const fields=['title','difficulty','h5Required','h5Rank','h80Rank','ereterHc','ereterRank','gap','recommendation','validationClearRate','hcCount','ereterUrl','inference'];
const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
await writeFile('data/ereter-h5-comparison.csv','\ufeff'+[fields.join(','),...output.rows.map(r=>fields.map(k=>quote(k==='inference'?r.inference.join(' / '):r[k])).join(','))].join('\r\n'));
const fmt=n=>Number(n).toFixed(1),line=r=>`| ${r.title} (${r.difficulty}) | ${fmt(r.h5Rank)} | ${fmt(r.ereterHcRank)} | ${r.gap>0?'+':''}${fmt(r.gap)} | ${r.recommendation} | ${r.inference.join('／')} |`;
const focusLine=r=>`| ${r.title} (${r.difficulty}) | ${fmt(r.h5)} | ${fmt(r.h5Rank)} | ${fmt(r.ereterHcRank)} | ${r.gap>0?'+':''}${fmt(r.gap)} | ${fmt(r.featurePercentiles.scratchRhythmComplexity)} | ${r.inference.join('／')} |`;
const md=`# ereter.net HARD ★と5% H指標の比較\n\n生成: ${summary.generatedAt}\n\n公式☆12のうちereter HC diffを照合できた${matched.length}譜面を比較。H5とHC diffをそれぞれ☆12内百分位へ変換し、20ポイント以上の順位差を「大きなズレ」とした。正の差はDP-HARD-LAB側が難しく、負の差はereter側が難しい。\n\n- H5とereterの順位相関: ${summary.correlations.h5VsEreterSpearman.toFixed(3)}\n- 80%版とereterの順位相関: ${summary.correlations.h80VsEreterSpearman.toFixed(3)}\n- 相関差（H5−80%）: ${summary.correlationImprovementBootstrap.difference.toFixed(3)}（譜面単位bootstrap 95%区間 ${summary.correlationImprovementBootstrap.p025.toFixed(3)}〜${summary.correlationImprovementBootstrap.p975.toFixed(3)}）\n- H5の平均絶対順位差: ${fmt(summary.rankError.h5MeanAbsolute)}ポイント（80%版 ${fmt(summary.rankError.h80MeanAbsolute)}）\n- 20ポイント以上の大きなズレ: H5版${summary.largeGapComparison.h5}譜面（80%版${summary.largeGapComparison.h80}譜面）。H5ではモデル側が難しい${modelHarder.length}譜面、ereter側が難しい${ereterHarder.length}譜面\n- 別乱数での完走率中央値: ${(summary.validation.median*100).toFixed(1)}%（P10–P90 ${(summary.validation.p10*100).toFixed(1)}–${(summary.validation.p90*100).toFixed(1)}%）\n\n全体傾向として、モデル側が難しい群では皿総負荷が上位10%の譜面が${summary.groupSignals.modelHarder.scratchTop10Percent}/${modelHarder.length}、皿負荷上位25%かつ規則的な皿の譜面が${summary.groupSignals.modelHarder.simpleScratchTopQuartile}/${modelHarder.length}、局所集中が上位10%の譜面が${summary.groupSignals.modelHarder.burstTop10Percent}/${modelHarder.length}。ereter側が難しい群ではソフラン${summary.groupSignals.ereterHarder.soflan}/${ereterHarder.length}、初出15作目以前${summary.groupSignals.ereterHarder.oldVersion15OrEarlier}/${ereterHarder.length}、CN拘束が上位10%の譜面${summary.groupSignals.ereterHarder.holdTop10Percent}/${ereterHarder.length}、皿リズム複雑度が上位10%の譜面${summary.groupSignals.ereterHarder.scratchRhythmTop10Percent}/${ereterHarder.length}だった。\n\n## 指摘された譜面\n\nH5必要能力は旧モデルと尺度が異なるため、譜面間の位置は☆12内百分位で比較する。皿リズム複雑度も照合742譜面内の百分位。正の差はH5側が難しい。\n\n| 譜面 | H5必要能力 | H5百分位 | ereter百分位 | 差 | 皿リズム複雑度百分位 | 推論 |\n|---|---:|---:|---:|---:|---:|---|\n${focusRows.map(focusLine).join('\n')}\n\n## DP-HARD-LAB側が難しい上位\n\n| 譜面 | H5百分位 | ereter百分位 | 差 | 5%推奨 | 推論 |\n|---|---:|---:|---:|---|---|\n${modelHarder.slice(0,20).map(line).join('\n')}\n\n## ereter側が難しい上位\n\n| 譜面 | H5百分位 | ereter百分位 | 差 | 5%推奨 | 推論 |\n|---|---:|---:|---:|---|---|\n${ereterHarder.slice(0,20).map(line).join('\n')}\n\n推論は譜面特徴の相対順位から自動生成した原因候補で、因果を確定するものではない。ereterの値もプレイヤー母集団・登録数・選曲傾向の影響を受ける。\n`;
await writeFile('docs/ERETER_H5_COMPARISON.md',md);
console.log(JSON.stringify(summary,null,2));
