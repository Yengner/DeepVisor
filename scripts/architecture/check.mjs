import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function sourceFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '_archive') return [];
    const path = join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(path)
      : /\.[cm]?[jt]sx?$/.test(path) && !/\.(test|spec|d)\.[cm]?[jt]sx?$/.test(path) ? [path] : [];
  });
}

/** Literal imports only; no evaluation of application modules or environment. */
export function inspectArchitecture(root) {
  const paths = sourceFiles(join(root, 'src'));
  const files = new Set(paths);
  const modules = new Map();
  const name = path => relative(root, path).replaceAll('\\', '/');
  for (const path of paths) {
    const ast = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    const directives = new Set();
    for (const statement of ast.statements) {
      if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
      directives.add(statement.expression.text);
    }
    const imports = [];
    const add = (specifier, typeOnly = false) => {
      if (!specifier || !ts.isStringLiteralLike(specifier)) return;
      const value = specifier.text;
      const base = value.startsWith('@/') ? join(root, 'src', value.slice(2))
        : value.startsWith('.') ? resolve(dirname(path), value) : null;
      const target = base && [base, ...['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'].map(ext => base + ext)]
        .find(candidate => files.has(candidate));
      imports.push({ value, target, typeOnly });
    };
    const visit = node => {
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        const bindings = clause?.namedBindings;
        const onlyNamedTypes = bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0
          && bindings.elements.every(element => element.isTypeOnly) && !clause.name;
        add(node.moduleSpecifier, Boolean(clause?.isTypeOnly || onlyNamedTypes));
      } else if (ts.isExportDeclaration(node)) {
        const onlyNamedTypes = node.exportClause && ts.isNamedExports(node.exportClause)
          && node.exportClause.elements.length > 0 && node.exportClause.elements.every(element => element.isTypeOnly);
        add(node.moduleSpecifier, Boolean(node.isTypeOnly || onlyNamedTypes));
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        add(node.argument.literal, true);
      } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
        add(node.arguments[0]);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
    modules.set(path, { imports, directives });
  }
  const violations = new Set();
  const graph = new Map();
  for (const [path, module] of modules) {
    const source = name(path);
    graph.set(path, []);
    for (const edge of module.imports) {
      const target = edge.target && name(edge.target);
      if (source.startsWith('src/lib/server/features/') && target
        && !target.startsWith('src/lib/server/features/') && !target.startsWith('src/lib/shared/')) {
        violations.add(`feature-boundary: ${source} -> ${target}`);
      }
      if (edge.typeOnly) continue;
      if (edge.target) graph.get(path).push(edge.target);
      if (source.startsWith('src/lib/shared/') && target && /^src\/(app|components|lib\/(server|client))\//.test(target)) {
        violations.add(`shared-boundary: ${source} -> ${target}`);
      }
      if (source.startsWith('src/lib/server/') && target && /^src\/(app|components|lib\/client)\//.test(target)) {
        violations.add(`server-boundary: ${source} -> ${target}`);
      }
      if (module.directives.has('use client') && target?.startsWith('src/lib/server/')
        && !modules.get(edge.target).directives.has('use server')) {
        violations.add(`client-boundary: ${source} -> ${target}`);
      }
      if (source.startsWith('src/lib/shared/performance/') && !edge.target && edge.value !== '') {
        violations.add(`performance-external: ${source} -> ${edge.value}`);
      }
    }
  }
  // Tarjan components report each runtime cycle once, without exponential path enumeration.
  let nextIndex = 0;
  const indices = new Map(), low = new Map(), stack = [], active = new Set();
  const visit = path => {
    indices.set(path, nextIndex); low.set(path, nextIndex++); stack.push(path); active.add(path);
    for (const target of graph.get(path) ?? []) {
      if (!indices.has(target)) { visit(target); low.set(path, Math.min(low.get(path), low.get(target))); }
      else if (active.has(target)) low.set(path, Math.min(low.get(path), indices.get(target)));
    }
    if (low.get(path) !== indices.get(path)) return;
    const component = [];
    let member;
    do { member = stack.pop(); active.delete(member); component.push(member); } while (member !== path);
    if (component.length > 1 || graph.get(path)?.includes(path)) violations.add(`runtime-cycle: ${component.map(name).sort().join(' <-> ')}`);
  };
  for (const path of paths) if (!indices.has(path)) visit(path);
  return [...violations].sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const actual = inspectArchitecture(root);
  if (process.argv.includes('--inventory')) {
    console.log(JSON.stringify(actual, null, 2));
  } else {
    const baseline = JSON.parse(readFileSync(join(root, 'scripts/architecture/baseline.json'), 'utf8'));
    const added = actual.filter(item => !baseline.includes(item));
    const removed = baseline.filter(item => !actual.includes(item));
    if (added.length || removed.length) {
      for (const item of added) console.error(`NEW ${item}`);
      for (const item of removed) console.error(`REMOVE RESOLVED BASELINE ENTRY ${item}`);
      process.exitCode = 1;
    } else console.log(`Architecture check passed (${actual.length} documented existing exceptions).`);
  }
}
