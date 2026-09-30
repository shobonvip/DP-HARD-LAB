import {writeFile} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {gzipSync} from 'node:zlib';
const read=p=>readFile(p,'utf8'),[html,css,js,json]=await Promise.all(['public/practice.html','public/practice.css','public/practice.js','public/practice-data.json'].map(read));
const decoder=await readFile('public/packed.js','utf8'),payload=gzipSync(Buffer.from(json),{level:9}).toString('base64');
const saved=html.replace('<link rel="stylesheet" href="/practice.css">',`<style>${css}</style>`).replace('href="/"','href="DP-HARD-LAB.html"').replace('href="/docs/PRACTICE.md"','href="docs/PRACTICE.md"').replace('<script type="module" src="/practice.js"></script>',`<script id="packed-practice" type="application/octet-stream">${payload}</script><script type="module">${decoder}\nglobalThis.PRACTICE_DATA=await unpackJson(document.querySelector('#packed-practice').textContent);\n${js}</script>`);
await writeFile('DP-PRACTICE.html',saved);console.log('Saved DP-PRACTICE.html '+(Buffer.byteLength(saved)/1e6).toFixed(1)+' MB');
const data=JSON.parse(json),lines=['# ☆7～9 NORMAL/HYPERの練習候補','', '正規譜面の機械集計による候補。各テーマ・各難度から上位2件を例示。実プレイで厳選したリストではない。回数や条件の詳細は練習ページとPRACTICE.mdを参照。',''];
for(const c of data.categories){
 const loadBased=['stamina','technique'].includes(c.id);
 lines.push('## '+c.label,'',c.description,'',loadBased?'| 難度 | 譜面 | 平均負荷 | 上位負荷 |':'| 難度 | 譜面 | 検出回数 | 左 / 右 |','|---|---|---:|---:|');
 for(const level of [7,8,9]){
  const rows=data.rows.filter(r=>r.level===level&&['NORMAL','HYPER'].includes(r.difficulty)&&!r.soflan&&(loadBased?r.features[c.id].score>0:r.features[c.id].count>=3&&r.features[c.id].sections>=2)).sort((a,b)=>b.features[c.id].score-a.features[c.id].score).slice(0,2);
  for(const r of rows){const f=r.features[c.id],l=r.keyboardLoad,kind=c.id==='stamina'?'physical':'technical';lines.push(`| ☆${level} | [${r.title.replaceAll('|','／')} ${r.difficulty}](${r.sourceUrl}) | ${loadBased?l[kind+'Mean']:f.count} | ${loadBased?l[kind+'Peak']:f.hands.join(' / ')} |`);}
 }lines.push('');
}
await writeFile('docs/PRACTICE_PICKS.md',lines.join('\n'));
