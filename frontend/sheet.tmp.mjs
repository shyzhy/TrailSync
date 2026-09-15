// Prints comments for review: id, kind, line, text, and the next code line.
import { readFileSync } from 'node:fs';
const [manifest, pattern] = process.argv.slice(2);
const all = JSON.parse(readFileSync(manifest, 'utf8'));
const cache = {};
for (const c of all) {
  if (!new RegExp(pattern).test(c.file.split('\\').join('/'))) continue;
  const code = (cache[c.file] ??= readFileSync(c.file, 'utf8'));
  const rest = code.slice(c.end).split('\n');
  const sameLineAfter = rest[0].trim();
  const before = code.slice(code.lastIndexOf('\n', c.start - 1) + 1, c.start).trim();
  const next = sameLineAfter || rest.slice(1).find((l) => l.trim())?.trim() || '';
  console.log(`#${c.id} ${c.kind} L${c.line}${before ? ` [after: ${before.slice(0, 60)}]` : ''}\n${c.text}\n  -> ${next.slice(0, 110)}\n`);
}
