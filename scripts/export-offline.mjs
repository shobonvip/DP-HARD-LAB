import {readFile,writeFile} from 'node:fs/promises';
const table=JSON.parse(await readFile('data/table.json','utf8')),results={};
for(const row of table.rows.filter(r=>r.analysis)){
 const r=JSON.parse(await readFile(`data/results/${row.id}.json`,'utf8'));
 if(r.model!==table.model)throw Error('Mixed model versions: '+row.id+'; regenerate the table after the batch completes.');
 delete r.random.draws;delete r.standard;delete r.bestMetrics;
 r.selected.traces=r.selected.traces.slice(0,4).map(points=>points.map(p=>({time:Math.round(p.time*100)/100,gauge:Math.round(p.gauge*100)/100})));
 r.segments=r.segments.map(s=>({time:Math.round(s.time*100)/100}));
 r.options=r.options.map(o=>({name:o.name,required:o.required}));
 if(r.free)for(const s of r.free.strategies)delete s.simulation.traces;
 results[row.id]=r;
}
let html=await readFile('public/index.html','utf8'),css=await readFile('public/style.css','utf8'),app=await readFile('public/app.js','utf8');
app=app.replace(/async function json\(url\)\{[^\n]+\}/,"async function json(url){if(url==='/data/table.json')return SAVED_TABLE;if(url.startsWith('/data/results/'))return SAVED_RESULTS[url.split('/').pop().replace('.json','')];throw Error('保存版では再計算できません。start.ps1でローカル版を起動してください。');}");
app=app.replace("$('#simulate').onclick=async()=>", "$('#simulate').disabled=true;$('#simulate').textContent='保存版：計算済みの結果を表示しています';$('#simulate').onclick=async()=>");
html=html.replace('<link rel="stylesheet" href="/style.css">',`<style>${css}</style>`).replace('href="/docs/METHODOLOGY.md"','href="docs/METHODOLOGY.md"').replace('href="/data/difficulty.csv"','href="data/difficulty.csv"').replace('href="/"','href="#"');
const safe=x=>JSON.stringify(x).replace(/</g,'\\u003c');
html=html.replace('<script src="/app.js" type="module"></script>',`<script>const SAVED_TABLE=${safe(table)};const SAVED_RESULTS=${safe(results)};</script><script type="module">${app}</script>`);
await writeFile('DP-HARD-LAB.html',html);console.log(JSON.stringify({file:'DP-HARD-LAB.html',total:table.total,analyzed:table.analyzed,megabytes:(Buffer.byteLength(html)/1e6).toFixed(1)}));
