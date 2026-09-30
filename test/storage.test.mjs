import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';import {gzipSync} from 'node:zlib';
import {readFile} from '../src/storage.mjs';
test('gzip fallback preserves bytes, text and URL paths; fresh files win',async()=>{
 const root=await mkdtemp(join(tmpdir(),'dp-storage-'));
 try{const file=join(root,'sample.json'),raw=Buffer.from('{"title":"混フレ"}');await writeFile(file+'.gz',gzipSync(raw));assert.deepEqual(await readFile(file),raw);assert.equal(await readFile(pathToFileURL(file),'utf8'),raw.toString());await writeFile(file,'fresh');assert.equal(await readFile(file,'utf8'),'fresh');}finally{await rm(root,{recursive:true,force:true});}
});
