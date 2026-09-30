import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {readFile} from '../src/storage.mjs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {MODEL_VERSION} from '../src/engine.mjs';

test('rebuilding after a Git checkout preserves matching normal references without a source cache',async()=>{
 const root=await mkdtemp(join(tmpdir(),'dp-hard-rebuild-'));
 try{
  await mkdir(join(root,'data/results'),{recursive:true});
  const snapshot=JSON.parse(await readFile(new URL('../data/table-v2.json',import.meta.url),'utf8'));
  const rows=[10,11].flatMap(level=>snapshot.rows.filter(r=>r.level===level&&r.normal&&r.analysis).slice(0,10));
  const original=rows[0],normal=original.normal;
  const charts=rows.map(({analysis,normal,status,...meta})=>meta);
  await writeFile(join(root,'data/catalog.json'),JSON.stringify({charts}));
  await writeFile(join(root,'data/coverage.json'),JSON.stringify({report:charts.map(c=>({id:c.id,status:'parsed'}))}));
  const old={rows:[...rows]};
  await writeFile(join(root,'data/table.json'),JSON.stringify(old));
  for(const meta of charts){const fixture=JSON.parse(await readFile(new URL(`../data/results/${meta.id}.json`,import.meta.url),'utf8'));fixture.model=MODEL_VERSION;await writeFile(join(root,`data/results/${meta.id}.json`),JSON.stringify(fixture));}
  const rebuild=()=>execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/analyze.mjs',import.meta.url))],{cwd:root});
  rebuild();
  let updated=JSON.parse(await readFile(join(root,'data/table.json'),'utf8'));
  assert.deepEqual(updated.rows[0].normal,normal);
  assert.equal(updated.normalMatched,20);
  old.rows[0]={...original,title:'A different chart'};
  await writeFile(join(root,'data/table.json'),JSON.stringify(old));
  rebuild();
  updated=JSON.parse(await readFile(join(root,'data/table.json'),'utf8'));
  assert.equal(updated.rows[0].normal,null);
  await writeFile(join(root,'data/table.json'),JSON.stringify({rows}));
  await mkdir(join(root,'data/cache'));
  await writeFile(join(root,'data/cache/normal-table.html'),'<table></table>');
  rebuild();
  updated=JSON.parse(await readFile(join(root,'data/table.json'),'utf8'));
  assert.equal(updated.rows[0].normal,null,'available cache supersedes old references');
 }finally{await rm(root,{recursive:true,force:true});}
});
