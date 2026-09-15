// Lists every comment (JS line/block, JSX, and CSS-in-template) with its group and the code line after it.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '@babel/parser';
import traverseMod from '@babel/traverse';
const traverse = traverseMod.default || traverseMod;

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(jsx?)$/.test(f) ? [p] : [];
  });
}
const out = [];
let id = 0;
for (const file of walk('src')) {
  const code = readFileSync(file, 'utf8');
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
  const lineOf = (pos) => code.slice(0, pos).split('\n').length;
  const jsxRanges = [];
  traverse(ast, {
    JSXExpressionContainer(path) {
      if (path.node.expression.type === 'JSXEmptyExpression') jsxRanges.push([path.node.start, path.node.end]);
    },
    TemplateElement(path) {
      const raw = path.node.value.raw;
      const base = path.node.start;
      for (const m of raw.matchAll(/\/\*[\s\S]*?\*\//g)) {
        out.push({ id: id++, file, kind: 'css', start: base + m.index, end: base + m.index + m[0].length, line: lineOf(base + m.index), text: m[0] });
      }
    },
  });
  // group consecutive // lines
  const comments = ast.comments;
  for (let i = 0; i < comments.length; i++) {
    const c = comments[i];
    if (c.type === 'CommentLine') {
      let j = i;
      while (j + 1 < comments.length && comments[j + 1].type === 'CommentLine' && /^\s*$/.test(code.slice(comments[j].end, comments[j + 1].start)) && code.slice(comments[j].end, comments[j + 1].start).split('\n').length === 2) j++;
      const group = comments.slice(i, j + 1);
      out.push({ id: id++, file, kind: 'line', start: group[0].start, end: group[group.length - 1].end, line: lineOf(c.start), text: group.map((g) => '//' + g.value).join('\n') });
      i = j;
    } else {
      const jsx = jsxRanges.find(([s, e]) => s <= c.start && c.end <= e);
      out.push({ id: id++, file, kind: jsx ? 'jsx' : 'block', start: jsx ? jsx[0] : c.start, end: jsx ? jsx[1] : c.end, line: lineOf(c.start), text: '/*' + c.value + '*/' });
    }
  }
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
const byKind = out.reduce((a, c) => ((a[c.kind] = (a[c.kind] || 0) + 1), a), {});
const lines = out.reduce((a, c) => a + c.text.split('\n').length, 0);
console.log(out.length, 'comment groups', byKind, lines, 'comment lines');
const perFile = {};
for (const c of out) perFile[c.file] = (perFile[c.file] || 0) + 1;
console.log(Object.entries(perFile).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${n} ${f}`).join('\n'));
