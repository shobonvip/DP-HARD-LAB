import {readFile} from '../src/storage.mjs';
import {parse} from 'acorn';
import {gunzipSync} from 'node:zlib';

const [html,live]=await Promise.all([readFile('DP-HARD-LAB.html','utf8'),readFile('data/table.json','utf8').then(JSON.parse)]);
const unpack=id=>{const payload=html.match(new RegExp('<script id="'+id+'" type="application/octet-stream">([^<]+)</script>'))?.[1];if(!payload)throw Error('Missing packed payload');return JSON.parse(gunzipSync(Buffer.from(payload,'base64')).toString());};
const table=unpack('packed-table'),results=unpack('packed-results');
const scriptStart=html.indexOf('<script type="module">')+'<script type="module">'.length,scriptEnd=html.lastIndexOf('</script>');
parse(html.slice(scriptStart,scriptEnd),{ecmaVersion:'latest',sourceType:'module',allowAwaitOutsideFunction:true});
const h5Count=table.rows.filter(r=>r.analysis?.singleHard5).length;
if(table.model!==live.model||table.total!==live.total||table.analyzed!==live.analyzed)throw Error('Offline table does not match live table');
if(Object.keys(results).length!==table.analyzed||h5Count!==table.analyzed)throw Error('Offline result/H5 count mismatch');
for(const row of table.rows.filter(r=>r.analysis)){const r=results[row.id];if(r.model!==table.model||r.requiredCapacity!==(row.analysis.fixedRequiredCapacity??row.analysis.requiredCapacity))throw Error('Saved result mismatch '+row.id);}
console.log(JSON.stringify({file:'DP-HARD-LAB.html',model:table.model,total:table.total,analyzed:table.analyzed,embeddedResults:Object.keys(results).length,h5Count,scriptSyntax:'ok',megabytes:(Buffer.byteLength(html)/1e6).toFixed(1)},null,2));
