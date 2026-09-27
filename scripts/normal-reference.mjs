import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('data/cache',{recursive:true});
const url='https://zasa.sakura.ne.jp/dp/run.php',r=await fetch(url,{signal:AbortSignal.timeout(20000)});
if(!r.ok)throw Error(`HTTP ${r.status}`);
const text=await r.text();await writeFile('data/cache/normal-table.html',text);
await writeFile('data/cache/normal-table.html.meta.json',JSON.stringify({url,retrievedAt:new Date().toISOString(),sha256:createHash('sha256').update(text).digest('hex'),condition:'正規 / FLIP+両MIRROR、ノマゲ。表見出しのバージョンにも注意。'},null,2));
console.log('Normal reference saved');
