import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, it } from 'vitest';

/**
 * A server component can't hand a component (a function) to a client component: e.g.
 * `<Button component={Link}>` from a page without 'use client' crashes the page with "Functions
 * cannot be passed directly to Client Components". Server files use `component="a"` instead.
 * (This broke Campaigns once, through the Saved plans list.)
 */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? tsxFiles(path) : path.endsWith('.tsx') ? [path] : [];
  });
}

it('server components never pass component={Link} to a component', () => {
  const root = join(process.cwd(), 'src');
  const offenders = tsxFiles(root).filter(path => {
    const source = readFileSync(path, 'utf8');
    const client = /^\s*(['"])use client\1/m.test(source.slice(0, 200));
    return !client && /component=\{Link\}/.test(source);
  }).map(path => relative(process.cwd(), path));
  expect(offenders).toEqual([]);
});
