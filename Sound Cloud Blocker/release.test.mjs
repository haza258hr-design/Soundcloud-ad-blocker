import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { root, zip, crc32, runtimeFiles, sourceFiles } from './scripts/build.mjs';
const read = name => fs.readFileSync(path.join(root,name),'utf8');
test('manifest, package and shipped runtime references are consistent',()=>{
  const manifest=JSON.parse(read('manifest.json')),pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,manifest.version);
  assert.equal(pkg.license,'MIT');
  const references=[manifest.background.service_worker,manifest.action.default_popup,
    ...manifest.content_scripts.flatMap(c=>c.js),...manifest.declarative_net_request.rule_resources.map(r=>r.path)];
  for(const file of references) assert(runtimeFiles.includes(file),file);
  for(const file of runtimeFiles.filter(f=>f.endsWith('.js'))) new vm.Script(read(file));
  assert.equal(new Set(sourceFiles).size,sourceFiles.length);
  for(const file of sourceFiles) assert(fs.statSync(path.join(root,file)).isFile(),file);
});
test('release permissions stay narrow and no remote executable code is included',()=>{
  const manifest=JSON.parse(read('manifest.json'));
  assert.deepEqual(manifest.permissions,['storage','declarativeNetRequest','webRequest','alarms']);
  assert.deepEqual(manifest.host_permissions,['https://soundcloud.com/*','https://*.soundcloud.com/*','https://*.sndcdn.com/*']);
  for(const file of ['background.js','core.js','content.js','popup.js','popup.html']) {
    assert(!/eval\s*\(|new Function\s*\(|<script[^>]+src=["']https?:/i.test(read(file)),file);
  }
});
test('ZIP has valid entries, CRCs, central directory and deterministic bytes',()=>{
  assert.equal(crc32(Buffer.from('123456789')),0xcbf43926);
  const bytes=zip(sourceFiles);
  assert.deepEqual(bytes,zip(sourceFiles));
  let offset=0;const names=[];
  while(bytes.readUInt32LE(offset)===0x04034b50) {
    const size=bytes.readUInt32LE(offset+18),length=bytes.readUInt16LE(offset+26);
    const name=bytes.subarray(offset+30,offset+30+length).toString();
    const data=bytes.subarray(offset+30+length,offset+30+length+size);
    assert.equal(crc32(data),bytes.readUInt32LE(offset+14),name);
    assert.equal(data.toString(),read(name).replace(/\r\n/g,'\n'),name);
    names.push(name);offset+=30+length+size;
  }
  assert.equal(bytes.readUInt32LE(offset),0x02014b50);
  assert.equal(bytes.readUInt32LE(bytes.length-22),0x06054b50);
  assert.equal(bytes.readUInt32LE(bytes.length-6),offset);
  assert.equal(bytes.readUInt16LE(bytes.length-12),sourceFiles.length);
  assert.deepEqual(names,[...sourceFiles].sort());
});
test('allowlists omit browser caches, reports, secrets and workspace dependencies',()=>{
  for(const name of sourceFiles) {
    assert(!/(^|\/)(_metadata|dist|node_modules|admin|sessions|\.git)(\/|$)|report.*\.json|\.env/.test(name),name);
    assert(!read(name).includes(root) && !read(name).includes(root.replaceAll('\\','/')),name);
  }
});
test('source snapshot runs behavioral tests and builds without the parent workspace',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sc-guard-release-'));
  try {
    for(const file of sourceFiles) {
      const dest=path.join(dir,file);fs.mkdirSync(path.dirname(dest),{recursive:true});
      fs.copyFileSync(path.join(root,file),dest);
    }
    const result=spawnSync(process.execPath,['--test','test.mjs'],{cwd:dir,encoding:'utf8'});
    assert.equal(result.status,0,result.stdout+result.stderr);
    const build=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:dir,encoding:'utf8'});
    assert.equal(build.status,0,build.stdout+build.stderr);
    assert.equal(fs.readdirSync(path.join(dir,'dist')).length,3);
  } finally {
    // Only the exact directory returned by mkdtemp above is removed.
    assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));
    assert(path.basename(dir).startsWith('sc-guard-release-'));
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
