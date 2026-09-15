// Temporary: compares two snapshot folders from snap.tmp.mjs (DOM text and pixels).
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [A, B] = process.argv.slice(2);
const names = readdirSync(`${A}/shots`).map((f) => f.replace('.png', ''));
let clean = 0;
const rows = [];
for (const name of names) {
  const issues = [];
  if (!existsSync(`${B}/shots/${name}.png`)) {
    rows.push(`${name}: MISSING in second run`);
    continue;
  }
  const domA = readFileSync(`${A}/dom/${name}.html`, 'utf8');
  const domB = readFileSync(`${B}/dom/${name}.html`, 'utf8');
  if (domA !== domB) {
    let i = 0;
    while (i < domA.length && domA[i] === domB[i]) i++;
    issues.push(`DOM differs at ${i}: …${domA.slice(Math.max(0, i - 80), i + 80)}… vs …${domB.slice(Math.max(0, i - 80), i + 80)}…`);
  }
  const cssA = readFileSync(`${A}/dom/${name}.head.css`, 'utf8');
  const cssB = readFileSync(`${B}/dom/${name}.head.css`, 'utf8');
  if (cssA !== cssB) issues.push(`head CSS differs (${cssA.length} vs ${cssB.length} chars)`);
  const pa = PNG.sync.read(readFileSync(`${A}/shots/${name}.png`));
  const pb = PNG.sync.read(readFileSync(`${B}/shots/${name}.png`));
  if (pa.width !== pb.width || pa.height !== pb.height) {
    issues.push(`size ${pa.width}x${pa.height} vs ${pb.width}x${pb.height}`);
  } else {
    const diff = new PNG({ width: pa.width, height: pa.height });
    const n = pixelmatch(pa.data, pb.data, diff.data, pa.width, pa.height, { threshold: 0.1 });
    if (n > 0) {
      issues.push(`${n} pixels differ`);
      writeFileSync(`${B}/shots/${name}.diff.png`, PNG.sync.write(diff));
    }
  }
  if (issues.length) rows.push(`${name}:\n  ${issues.join('\n  ')}`);
  else clean++;
}
console.log(rows.join('\n'));
console.log(`\n${clean}/${names.length} identical (DOM + head CSS + pixels)`);
