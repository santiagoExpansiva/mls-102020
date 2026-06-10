/// <mls fileReference="_102020_/l2/agentMaterializeSolution/ast/astIndex.ts" enhancement="_blank"/>

// ============================================================
// TYPES
// ============================================================
 
export interface NavEntry {
  label: string;
  href: string;
}
 
export interface PageEntry {
  path: string;
  title: string;
  tagName: string;
  loader: string; // o caminho do import: '/_102035_/l2/...'
}
 
// ============================================================
// PARSE
// ============================================================
 
export function parseCollab(source: string): {
  navigation: NavEntry[];
  pages: PageEntry[];
} {
  return {
    navigation: getNavigation(source),
    pages:      getPages(source),
  };
}
 
// ============================================================
// NAVIGATION — leitura
// ============================================================
 
function getNavSpans(source: string): Array<NavEntry & { start: number; end: number }> {
  const block = extractArraySpan(source, 'navigation');
  if (!block) return [];
 
  // captura cada { label: '...', href: '...' } dentro do array
  const re = /\{\s*label\s*:\s*['"]([^'"]*)['"]\s*,\s*href\s*:\s*['"]([^'"]*)['"]\s*\}/g;
  const results: Array<NavEntry & { start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block.content)) !== null) {
    results.push({
      label: m[1],
      href:  m[2],
      start: block.start + m.index,
      end:   block.start + m.index + m[0].length,
    });
  }
  return results;
}
 
export function getNavigation(source: string): NavEntry[] {
  return getNavSpans(source).map(({ start: _s, end: _e, ...e }) => e);
}
 
export function hasNav(source: string, href: string): boolean {
  return getNavigation(source).some(n => n.href === href);
}
 
// ============================================================
// NAVIGATION — escrita
// ============================================================
 
/**
 * Adiciona uma entrada de navigation.
 * - Se `href` já existe, retorna source intacto (ou lança se throwIfExists=true).
 */
export function addNav(
  source: string,
  entry: NavEntry,
  { throwIfExists = false }: { throwIfExists?: boolean } = {},
): string {
  if (hasNav(source, entry.href)) {
    if (throwIfExists) throw new Error(`Nav "${entry.href}" already exists.`);
    return source;
  }
 
  const block = extractArraySpan(source, 'navigation');
  if (!block) throw new Error('Could not find navigation array in source.');
 
  const newItem = `{ label: '${entry.label}', href: '${entry.href}' }`;
  return insertIntoArray(source, block, newItem, getNavSpans(source));
}
 
/**
 * Remove uma entrada de navigation pelo href.
 */
export function removeNav(source: string, href: string): string {
  const spans = getNavSpans(source);
  const target = spans.find(n => n.href === href);
  if (!target) throw new Error(`Nav "${href}" not found.`);
  return removeItemFromArray(source, target, spans);
}
 
// ============================================================
// PAGES — leitura
// ============================================================
 
function getPageSpans(source: string): Array<PageEntry & { start: number; end: number }> {
  const block = extractArraySpan(source, 'pages');
  if (!block) return [];
 
  // captura cada { path, title, tagName, loader } — multiline
  const re = /\{[^{}]*path\s*:\s*['"]([^'"]*)['"]\s*,[^{}]*title\s*:\s*['"]([^'"]*)['"]\s*,[^{}]*tagName\s*:\s*['"]([^'"]*)['"]\s*,[^{}]*loader\s*:\s*\(\s*\)\s*=>\s*import\s*\(\s*['"]([^'"]*)['"]\s*\)\s*,?\s*\}/gs;
  const results: Array<PageEntry & { start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block.content)) !== null) {
    results.push({
      path:    m[1],
      title:   m[2],
      tagName: m[3],
      loader:  m[4],
      start:   block.start + m.index,
      end:     block.start + m.index + m[0].length,
    });
  }
  return results;
}
 
export function getPages(source: string): PageEntry[] {
  return getPageSpans(source).map(({ start: _s, end: _e, ...e }) => e);
}
 
export function hasPage(source: string, path: string): boolean {
  return getPages(source).some(p => p.path === path);
}
 
// ============================================================
// PAGES — escrita
// ============================================================
 
/**
 * Adiciona uma entrada de pages.
 * - Se `path` já existe, retorna source intacto (ou lança se throwIfExists=true).
 */
export function addPage(
  source: string,
  entry: PageEntry,
  { throwIfExists = false }: { throwIfExists?: boolean } = {},
): string {
  if (hasPage(source, entry.path)) {
    if (throwIfExists) throw new Error(`Page "${entry.path}" already exists.`);
    return source;
  }
 
  const block = extractArraySpan(source, 'pages');
  if (!block) throw new Error('Could not find pages array in source.');
 
  const newItem = [
    '{',
    `      path: '${entry.path}',`,
    `      title: '${entry.title}',`,
    `      tagName: '${entry.tagName}',`,
    `      loader: () => import('${entry.loader}'),`,
    '    }',
  ].join('\n');
 
  return insertIntoArray(source, block, newItem, getPageSpans(source));
}
 
/**
 * Remove uma entrada de pages pelo path.
 */
export function removePage(source: string, path: string): string {
  const spans = getPageSpans(source);
  const target = spans.find(p => p.path === path);
  if (!target) throw new Error(`Page "${path}" not found.`);
  return removeItemFromArray(source, target, spans);
}
 
// ============================================================
// INTERNAL — array span
// ============================================================
 
interface Span { content: string; start: number; end: number }
 
/**
 * Localiza o array de uma propriedade pelo nome: `key: [...]`
 * Retorna o span do [ ... ] inteiro.
 */
function extractArraySpan(source: string, key: string): Span | null {
  const re = new RegExp(`\\b${key}\\s*:\\s*\\[`);
  const match = re.exec(source);
  if (!match) return null;
  const start = match.index + match[0].length - 1; // posição do [
  const content = balancedSlice(source, start, '[', ']');
  return { content, start, end: start + content.length };
}
 
// ============================================================
// INTERNAL — insert / remove genérico
// ============================================================
 
/**
 * Insere um item no array, depois do último elemento existente.
 * Se o array estiver vazio, formata com indentação.
 */
function insertIntoArray(
  source: string,
  block: Span,
  newItem: string,
  spans: Array<{ start: number; end: number }>,
): string {
  if (spans.length === 0) {
    // array vazio — detecta indentação do bloco pai para alinhar
    const indent = detectIndent(source, block.start);
    const inner  = indent + '  ';
    const replacement = `[\n${inner}${newItem},\n${indent}]`;
    return source.slice(0, block.start) + replacement + source.slice(block.end);
  }
 
  const last = spans[spans.length - 1];
  let insertAt = last.end;
  const hasTrailingComma = source[insertAt] === ',';
  if (hasTrailingComma) insertAt++;
 
  const prefix = hasTrailingComma ? '' : ',';
  return source.slice(0, insertAt) + `${prefix}\n    ${newItem},` + source.slice(insertAt);
}
 
/**
 * Remove um item do array, limpando vírgulas e linhas em branco.
 */
function removeItemFromArray(
  source: string,
  target: { start: number; end: number },
  all: Array<{ start: number; end: number }>,
): string {
  const idx    = all.indexOf(target);
  const isLast = idx === all.length - 1;
 
  let start = target.start;
  let end   = target.end;
 
  if (isLast && idx > 0) {
    // remove a vírgula e whitespace ANTES do item (deixa o anterior limpo)
    let p = start - 1;
    while (p >= 0 && /[ \t\n]/.test(source[p])) p--;
    if (source[p] === ',') start = p; // inclui a vírgula anterior
    while (start > 0 && /[ \t\n]/.test(source[start - 1])) start--;
  } else {
    // remove a vírgula e o \n que seguem
    if (source[end] === ',') end++;
    if (source[end] === '\n') end++;
  }
 
  return source.slice(0, start) + source.slice(end);
}
 
// ============================================================
// INTERNAL — utils
// ============================================================
 
function balancedSlice(source: string, start: number, open: string, close: string): string {
  let depth = 0;
  let inStr = false;
  let strCh = '';
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === strCh) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; continue; }
    if (ch === open)  depth++;
    if (ch === close) { if (--depth === 0) return source.slice(start, i + 1); }
  }
  throw new Error(`Unbalanced block starting at ${start}.`);
}
 
/** Detecta a indentação da linha onde `pos` está. */
function detectIndent(source: string, pos: number): string {
  let lineStart = pos;
  while (lineStart > 0 && source[lineStart - 1] !== '\n') lineStart--;
  let indent = '';
  for (let i = lineStart; i < pos; i++) {
    if (source[i] === ' ' || source[i] === '\t') indent += source[i];
    else break;
  }
  return indent;
}


// ============================================================
// USE CASE
// ============================================================

/*

test('add nav + page em cadeia', () => {
  let out = addNav(SRC, { label: 'Menu', href: '/pizzaria/menu' });
  out = addPage(out, {
    path:    '/pizzaria/menu',
    title:   'Menu',
    tagName: 'pizzaria--web--desktop--page12--menu-102035',
    loader:  '/_102035_/l2/pizzaria/web/desktop/page12/menu.js',
  });
  eq(getNavigation(out).length, 3);
  eq(getPages(out).length, 2);
});
 
test('remove nav + page em cadeia', () => {
  let out = removeNav(SRC, '/monitor');
  out = removePage(out, '/pizzaria/custumerEdit');
  eq(getNavigation(out).length, 1);
  eq(getPages(out).length, 0);
});

*/