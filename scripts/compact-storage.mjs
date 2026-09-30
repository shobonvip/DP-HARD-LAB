import {readFile,readdir,stat,writeFile,rename,unlink} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve,sep} from 'node:path';
const root=resolve('.'),candidates=[];
async function scan(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory()){if(['cache','charts','staging'].includes(e.name))continue;await scan(p);}else if(e.name.endsWith('.json')&&(dir.endsWith('/features')||(await stat(p)).size>=131072))candidates.push(p);}}
await scan('data');
// Historical HTML is preserved byte-for-byte, with gzip instead of raw copies.
for(const e of await readdir('.'))if(/^DP-HARD-LAB-v\d+\.html$/.test(e))candidates.push(e);
candidates.push('public/practice-data.json');
let before=0,after=0,done=0;
for(const file of candidates){
 const target=resolve(file);if(!target.startsWith(root+sep))throw Error('Outside workspace');
 let original;try{original=await readFile(target);}catch(e){if(e.code==='ENOENT')continue;throw e;}
 const packed=gzipSync(original,{level:9});if(packed.length>=original.length)continue;
 const temp=target+'.gz.tmp';await writeFile(temp,packed);
 if(!gunzipSync(await readFile(temp)).equals(original))throw Error('Round trip failed: '+file);
 await rename(temp,target+'.gz');await unlink(target);
 before+=original.length;after+=packed.length;if(++done%500===0)console.log('Compressed '+done);
}
let prior;try{prior=JSON.parse(await readFile('data/storage-report.json','utf8'));}catch{}
const report={generatedAt:new Date().toISOString(),files:done+(prior?.files??0),before:before+(prior?.before??0),after:after+(prior?.after??0),saved:before-after+(prior?.saved??0),lossless:true};
await writeFile('data/storage-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
