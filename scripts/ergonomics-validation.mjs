import {writeFile} from 'node:fs/promises';
import {humanFeatures} from '../src/human.mjs';
import {MODEL_VERSION} from '../src/engine.mjs';
const patterns={home:[[1,2,4,6,7],[1,3,4,5,7]],stairs:[[1],[2],[3],[4],[5],[6],[7]],keima:[[2,5],[3,6]],scratch:[[0]]};
const variants={standard:{},homeUnfamiliar:{homeSkill:0},extensionPracticed:{extensionSkill:1},stairPracticed:{stairSkill:1},keimaPracticed:{keimaSkill:1},heavyScratch:{scratchTorque:.1},weakPull:{scratchPullForce:1}};
const cases=[];
for(const [name,pattern] of Object.entries(patterns)){
 const chart={events:Array.from({length:28},(_,i)=>pattern[i%pattern.length].map(lane=>({time:i*.125,lane,hand:1,kind:'tap'}))).flat(),holds:[]};
 for(const [variant,human] of Object.entries(variants)){
  const result=humanFeatures(chart,{human});
  cases.push({pattern:name,variant,notes:chart.events.length,actions:result.actions.length,physical:result.metrics.physical,cognitive:result.metrics.cognitive,meanDemand:result.metrics.physical+result.metrics.cognitive,travelMm:result.metrics.movementDistance,scratchStrokeMm:result.metrics.scratchStroke,pressWorkMilliJ:result.metrics.pressWork});
 }
}
await writeFile('data/ergonomics-validation.json',JSON.stringify({model:MODEL_VERSION,note:'合成譜面の感度確認。配置ごとにノーツ数が異なるため、パターン間の難度比較用ではない。同じパターンで設定を変えた差を見る。実プレイ精度の評価ではない。',cases},null,2));
console.log('Saved 28 synthetic sensitivity cases.');
