// Temporary audit: undefined identifiers, unused bindings, broken or missing imports, import cycles.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, relative, join } from 'node:path';
import { parse } from '@babel/parser';
import traverseMod from '@babel/traverse';
const traverse = traverseMod.default || traverseMod;
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : /\.jsx?$/.test(f) ? [join(dir, f)] : []));
const GLOBALS = new Set(['window','document','console','fetch','URL','URLSearchParams','FormData','Promise','setTimeout','clearTimeout','setInterval','clearInterval','JSON','Math','Date','Number','String','Array','Object','Set','Map','Intl','Error','TypeError','Boolean','Image','navigator','localStorage','sessionStorage','requestAnimationFrame','cancelAnimationFrame','undefined','NaN','Infinity','isNaN','parseInt','parseFloat','encodeURIComponent','decodeURIComponent','Blob','File','matchMedia','getComputedStyle','IntersectionObserver','ResizeObserver','MutationObserver','performance','globalThis','Symbol','RegExp','location','history','alert','structuredClone','queueMicrotask','CustomEvent','Event','KeyboardEvent','HTMLElement','Node','AbortController','atob','btoa','crypto','screen','Reflect','WeakMap','WeakSet','BigInt','arguments','process']);
const files = walk('src').map((f) => resolve(f));
const exportsOf = {}; const importsOf = []; let problems = 0;
const report = (m) => { problems++; console.log(m); };
for (const file of files) {
  const rel = relative(process.cwd(), file);
  const ast = parse(readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  exportsOf[file] = new Set();
  traverse(ast, {
    Program(path) {
      for (const [name, b] of Object.entries(path.scope.bindings)) {
        const exported = b.path.parentPath?.isExportNamedDeclaration?.() || b.path.parentPath?.parentPath?.isExportNamedDeclaration?.() || b.path.isExportDefaultDeclaration?.() || b.path.parentPath?.isExportDefaultDeclaration?.();
        if (!b.referenced && !exported) report(`${rel}: unused ${b.kind} ${name}`);
      }
    },
    ImportDeclaration(path) {
      const src = path.node.source.value;
      if (!src.startsWith('.')) return;
      const target = resolve(dirname(file), src);
      if (!existsSync(target)) report(`${rel}: broken import ${src}`);
      importsOf.push({ from: file, target, names: path.node.specifiers.map((s) => (s.type === 'ImportDefaultSpecifier' ? 'default' : s.type === 'ImportNamespaceSpecifier' ? '*' : s.imported.name)) });
    },
    ExportNamedDeclaration(path) {
      if (path.node.source) {
        const target = resolve(dirname(file), path.node.source.value);
        if (!existsSync(target)) report(`${rel}: broken re-export ${path.node.source.value}`);
        importsOf.push({ from: file, target, names: path.node.specifiers.map((s) => s.local.name) });
      }
      const d = path.node.declaration;
      if (d?.id) exportsOf[file].add(d.id.name);
      if (d?.declarations) d.declarations.forEach((x) => exportsOf[file].add(x.id.name));
      path.node.specifiers.forEach((s) => exportsOf[file].add(s.exported.name));
    },
    ExportDefaultDeclaration() { exportsOf[file].add('default'); },
    ReferencedIdentifier(path) {
      const n = path.node.name;
      if (path.parentPath.isJSXMemberExpression() && path.parentPath.node.property === path.node) return;
      if (path.isJSXIdentifier() && /^[a-z]/.test(n)) return;
      if (path.scope.hasBinding(n) || GLOBALS.has(n)) return;
      report(`${rel}:${path.node.loc.start.line}: undefined ${n}`);
    },
  });
}
for (const i of importsOf) { const ex = exportsOf[i.target]; if (ex) for (const n of i.names) if (n !== '*' && !ex.has(n)) report(`${relative(process.cwd(), i.from)}: imports missing export ${n} from ${relative(process.cwd(), i.target)}`); }
const graph = {}; for (const i of importsOf) (graph[i.from] ??= new Set()).add(i.target);
const state = {}; const stack = [];
const dfs = (n) => { state[n] = 1; stack.push(n); for (const m of graph[n] || []) { if (state[m] === 1) report(`import cycle: ${[...stack.slice(stack.indexOf(m)), m].map((x) => relative(process.cwd(), x)).join(' -> ')}`); else if (!state[m]) dfs(m); } stack.pop(); state[n] = 2; };
for (const n of Object.keys(graph)) if (!state[n]) dfs(n);
console.log(problems ? `${problems} problem(s)` : 'audit clean');
