// Dependency-free, deterministic ZIP packaging. Only explicit allowlists are shipped.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const runtimeFiles = [
  'manifest.json', 'background.js', 'content.js', 'core.js', 'rules.json',
  'popup.html', 'popup.js', 'README.md', 'PRIVACY.md', 'LICENSE',
  'CHANGELOG.md', 'CONTRIBUTING.md', 'RELEASE.md', 'RESEARCH.md',
];
export const sourceFiles = [...runtimeFiles, 'package.json', 'test.mjs', 'release.test.mjs',
  'research.mjs',
  '.gitignore', '.gitattributes', '.github/workflows/ci.yml',
  '.github/ISSUE_TEMPLATE/bug_report.md', 'scripts/build.mjs'];
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function zip(files) {
  const local = [], central = [];
  let offset = 0;
  for (const name of [...files].sort()) {
    if (!/^[a-zA-Z0-9_.\/-]+$/.test(name) || name.split('/').includes('..') || path.isAbsolute(name))
      throw Error('Unsafe archive entry: ' + name);
    const file = path.join(root, name);
    if (!fs.lstatSync(file).isFile()) throw Error('Not a regular file: ' + name);
    // All release source files are text: normalize line endings across Git checkouts.
    const data = Buffer.from(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
    const filename = Buffer.from(name);
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20,4);
    header.writeUInt16LE(0x0800,6); header.writeUInt16LE(33,12); // Jan 1, 1980
    header.writeUInt32LE(crc,14); header.writeUInt32LE(data.length,18);
    header.writeUInt32LE(data.length,22); header.writeUInt16LE(filename.length,26);
    local.push(header,filename,data);
    const index = Buffer.alloc(46);
    index.writeUInt32LE(0x02014b50); index.writeUInt16LE(20,4); index.writeUInt16LE(20,6);
    index.writeUInt16LE(0x0800,8); index.writeUInt16LE(33,14);
    index.writeUInt32LE(crc,16); index.writeUInt32LE(data.length,20);
    index.writeUInt32LE(data.length,24); index.writeUInt16LE(filename.length,28);
    index.writeUInt32LE(offset,42); central.push(index,filename);
    offset += header.length + filename.length + data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length,8);
  end.writeUInt16LE(files.length,10); end.writeUInt32LE(directory.length,12);
  end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
export function build() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
  const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json')));
  if (manifest.version !== pkg.version || !/^\d+\.\d+\.\d+$/.test(pkg.version)) throw Error('Version mismatch');
  const out = path.join(root,'dist');
  fs.mkdirSync(out,{recursive:true});
  const sums=[];
  for (const [suffix,files] of [['',runtimeFiles],['-source',sourceFiles]]) {
    const name = 'soundcloud-midroll-guard-v' + pkg.version + suffix + '.zip';
    const bytes = zip(files);
    fs.writeFileSync(path.join(out,name),bytes);
    sums.push(createHash('sha256').update(bytes).digest('hex') + '  ' + name);
  }
  fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),sums.join('\n')+'\n');
  console.log(sums.join('\n'));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build();
