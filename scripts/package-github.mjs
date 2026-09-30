import {readdir,stat,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
// Build a fresh source/data snapshot without Git history or generated caches.
const files=[];
async function scan(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory()){if(['cache','charts','staging'].includes(e.name))continue;await scan(p);}else files.push(p);}}
for(const dir of ['src','scripts','public','test','docs','data','backups'])await scan(dir);
files.push('.gitignore','.gitattributes','package.json','package-lock.json','README.md','start.ps1','DP-HARD-LAB.html','DP-PRACTICE.html');
let bytes=0,max=0;for(const file of files){const n=(await stat(file)).size;if(n>100*1024*1024)throw Error('Exceeds GitHub file limit: '+file);bytes+=n;max=Math.max(max,n);}
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/github-files.txt',files.join('\n')+'\n');
execFileSync('tar',['-a','-c','-f','artifacts/DP-HARD-LAB-GitHub.zip','-T','artifacts/github-files.txt'],{stdio:'inherit'});
const report={files:files.length,totalBytes:bytes,largestFileBytes:max,archiveBytes:(await stat('artifacts/DP-HARD-LAB-GitHub.zip')).size,excludes:['.git','node_modules','data/cache','data/charts','data/staging'],historyIncluded:false};
await writeFile('artifacts/github-package-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
