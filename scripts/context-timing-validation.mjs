import {writeFile} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {MODEL_VERSION} from '../src/engine.mjs';
import {hardStar} from '../src/star-scale.mjs';
const before=JSON.parse(await readFile('data/table-v5.json','utf8')),after=JSON.parse(await readFile('data/table.json','utf8'));
if(after.model!==MODEL_VERSION)throw Error('Regenerate the table before comparing versions');
const comparisons=[];
for(const id of ['ageha-A','r3-A','moonrace-H']){
 const old=before.rows.find(r=>r.id===id),row=after.rows.find(r=>r.id===id),r=JSON.parse(await readFile(`data/results/${id}.json`,'utf8'));
 if(r.model!==MODEL_VERSION)throw Error('Mixed model: '+id);
 comparisons.push({id,title:row.title,officialLevel:row.level,previousModel:before.model,previousHardStar:old.analysis.hardStar,hardStar:row.analysis.hardStar,previousRequired:old.analysis.requiredCapacity,required:row.analysis.requiredCapacity,regularRequired:r.options.find(o=>o.name==='正規').required,fixedBestRequired:r.requiredCapacity,recommendation:r.free.recommendation,metrics:r.metrics,timing:r.selected.timing});
 const c=comparisons.at(-1);c.regularHardStar=hardStar(c.regularRequired,after.starScale).value;c.fixedBestHardStar=hardStar(c.fixedBestRequired,after.starScale).value;c.fixedBestOption=r.options[0].name;
}
await writeFile('data/context-timing-validation.json',JSON.stringify({model:MODEL_VERSION,note:'AGEHA/R3は運指・無理皿、MOON RACE HYPERは片手偏重配置の比較例。曲名による補正はない。係数・判定窓は未校正で、これらの一致を精度評価には使わない。変更前後で能力の尺度も異なる。',comparisons},null,2));
console.log(JSON.stringify(comparisons.map(({id,previousHardStar,hardStar,regularRequired,required,recommendation})=>({id,previousHardStar,hardStar,regularRequired,required,recommendation}))));
