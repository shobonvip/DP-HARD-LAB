import {writeFile} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {gzipSync} from 'node:zlib';
import {displayResult} from '../src/payload.mjs';
const table=JSON.parse(await readFile('data/table.json','utf8')),results={};
for(const row of table.rows.filter(r=>r.analysis)){
 const r=JSON.parse(await readFile(`data/results/${row.id}.json`,'utf8'));
 if(r.model!==table.model)throw Error('Mixed model versions: '+row.id+'; regenerate the table after the batch completes.');
 const display=displayResult(r);display.options=display.options.map(o=>({name:o.name,required:o.required}));
 results[row.id]=display;
}
let html=await readFile('public/index.html','utf8'),css=await readFile('public/style.css','utf8'),app=await readFile('public/app.js','utf8');
app=app.replace(/async function json\(url\)\{[^\n]+\}/,"async function json(url){if(url==='/data/table.json')return SAVED_TABLE;if(url.startsWith('/data/results/'))return SAVED_RESULTS[url.split('/').pop().replace('.json','')];throw Error('保存版では再計算できません。start.ps1でローカル版を起動してください。');}");
app=app.replace("$('#simulate').onclick=async()=>", "$('#simulate').disabled=true;$('#simulate').textContent='保存版：計算済みの結果を表示しています';for(const input of document.querySelectorAll('#detail input,#detail select'))input.disabled=true;$('#simulate').onclick=async()=>");
html=html.replace('<link rel="stylesheet" href="/style.css">',`<style>${css}</style>`).replace('href="/docs/METHODOLOGY.md"','href="docs/METHODOLOGY.md"').replace('href="/data/difficulty.csv"','href="data/difficulty.csv"').replace('href="/"','href="#"');
html=html.replace('href="/practice.html"','href="DP-PRACTICE.html"');
const pack=x=>gzipSync(Buffer.from(JSON.stringify(x)),{level:9}).toString('base64');
const decoder=await readFile('public/packed.js','utf8');
html=html.replace('<script src="/app.js" type="module"></script>',`<script id="packed-table" type="application/octet-stream">${pack(table)}</script><script id="packed-results" type="application/octet-stream">${pack(results)}</script><script type="module">${decoder}\nconst SAVED_TABLE=await unpackJson(document.querySelector('#packed-table').textContent);const SAVED_RESULTS=await unpackJson(document.querySelector('#packed-results').textContent);\n${app}</script>`);
await writeFile('DP-HARD-LAB.html',html);console.log(JSON.stringify({file:'DP-HARD-LAB.html',total:table.total,analyzed:table.analyzed,megabytes:(Buffer.byteLength(html)/1e6).toFixed(1)}));
