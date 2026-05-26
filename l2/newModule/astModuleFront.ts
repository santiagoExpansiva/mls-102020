/// <mls fileReference="_102020_/l2/newModule/astModuleFront.ts" enhancement="_blank"/>

// ============================================================
// TYPES
// ============================================================
 
export interface ModuleNavEntry {
  id: string;
  label: string;
  href: string;
  description: string;
}
 
export interface ModuleRouteEntry {
  path: string;
  aliases: string[];
  entrypoint: string;
  tag: string;
  title: string;
}
 
// ============================================================
// PARSE
// ============================================================
 
export function parseModule(source: string): {
  navigation: ModuleNavEntry[];
  routes: ModuleRouteEntry[];
} {
  return {
    navigation: getModuleNavigation(source),
    routes:     getModuleRoutes(source),
  };
}
 
// ============================================================
// NAVIGATION — leitura
// ============================================================
 
function getModuleNavSpans(source: string): Array<ModuleNavEntry & { start: number; end: number }> {
  const block = extractArraySpanInsideConst(source, 'moduleFrontendDefinition', 'navigation');
  if (!block) return [];
 
  // captura cada objeto { id, label, href, description } — multiline, ordem garantida pelo formato
  const re = /\{[^{}]*id\s*:\s*['"]([^'"]*)['"]\s*,[^{}]*label\s*:\s*['"]([^'"]*)['"]\s*,[^{}]*href\s*:\s*['"]([^'"]*)['"]\s*,[^{}]*description\s*:\s*['"]([^'"]*)['"]\s*,?\s*\}/gs;
  const results: Array<ModuleNavEntry & { start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block.content)) !== null) {
    results.push({
      id:          m[1],
      label:       m[2],
      href:        m[3],
      description: m[4],
      start:       block.start + m.index,
      end:         block.start + m.index + m[0].length,
    });
  }
  return results;
}
 
export function getModuleNavigation(source: string): ModuleNavEntry[] {
  return getModuleNavSpans(source).map(({ start: _s, end: _e, ...e }) => e);
}
 
export function hasModuleNav(source: string, id: string): boolean {
  return getModuleNavigation(source).some(n => n.id === id);
}
 
// ============================================================
// NAVIGATION — escrita
// ============================================================
 
export function addModuleNav(
  source: string,
  entry: ModuleNavEntry,
  { throwIfExists = false }: { throwIfExists?: boolean } = {},
): string {
  if (hasModuleNav(source, entry.id)) {
    if (throwIfExists) throw new Error(`Nav id "${entry.id}" already exists.`);
    return source;
  }
 
  const block = extractArraySpanInsideConst(source, 'moduleFrontendDefinition', 'navigation');
  if (!block) throw new Error('Could not find navigation array in moduleFrontendDefinition.');
 
  const newItem = [
    '{',
    `      id: '${entry.id}',`,
    `      label: '${entry.label}',`,
    `      href: '${entry.href}',`,
    `      description: '${entry.description}',`,
    '    }',
  ].join('\n');
 
  return insertIntoArray(source, block, newItem, getModuleNavSpans(source));
}
 
export function removeModuleNav(source: string, id: string): string {
  const spans = getModuleNavSpans(source);
  const target = spans.find(n => n.id === id);
  if (!target) throw new Error(`Nav id "${id}" not found.`);
  return removeItemFromArray(source, target, spans);
}
 
// ============================================================
// ROUTES — leitura
// ============================================================
 
function getModuleRouteSpans(source: string): Array<ModuleRouteEntry & { start: number; end: number }> {
  const block = extractArraySpanInsideConst(source, 'moduleFrontendDefinition', 'routes');
  if (!block) return [];
 
  // captura cada objeto { path, aliases, entrypoint, tag, title }
  // aliases é um array — captura o bloco [ ... ] inteiro como string
  const re = /\{([^{}]*path\s*:[^{}]*aliases\s*:[^{}]*entrypoint\s*:[^{}]*tag\s*:[^{}]*title\s*:[^{}]*)\}/gs;
  const results: Array<ModuleRouteEntry & { start: number; end: number }> = [];
  let m: RegExpExecArray | null;
 
  while ((m = re.exec(block.content)) !== null) {
    const body = m[1];
 
    const pathM        = /path\s*:\s*['"]([^'"]*)['"]/s.exec(body);
    const entrypointM  = /entrypoint\s*:\s*['"]([^'"]*)['"]/s.exec(body);
    const tagM         = /tag\s*:\s*['"]([^'"]*)['"]/s.exec(body);
    const titleM       = /title\s*:\s*['"]([^'"]*)['"]/s.exec(body);
    const aliasesM     = /aliases\s*:\s*(\[[^\]]*\])/s.exec(body);
 
    if (!pathM || !entrypointM || !tagM || !titleM || !aliasesM) continue;
 
    const aliases = aliasesM[1]
      .slice(1, -1)
      .split(',')
      .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
 
    results.push({
      path:       pathM[1],
      aliases,
      entrypoint: entrypointM[1],
      tag:        tagM[1],
      title:      titleM[1],
      start:      block.start + m.index,
      end:        block.start + m.index + m[0].length,
    });
  }
  return results;
}
 
export function getModuleRoutes(source: string): ModuleRouteEntry[] {
  return getModuleRouteSpans(source).map(({ start: _s, end: _e, ...e }) => e);
}
 
export function hasModuleRoute(source: string, path: string): boolean {
  return getModuleRoutes(source).some(r => r.path === path);
}
 
// ============================================================
// ROUTES — escrita
// ============================================================
 
export function addModuleRoute(
  source: string,
  entry: ModuleRouteEntry,
  throwIfExists = false ,
): string {
  if (hasModuleRoute(source, entry.path)) {
    if (throwIfExists) throw new Error(`Route "${entry.path}" already exists.`);
    return source;
  }
 
  const block = extractArraySpanInsideConst(source, 'moduleFrontendDefinition', 'routes');
  if (!block) throw new Error('Could not find routes array in moduleFrontendDefinition.');
 
  const aliasesTs = `[${entry.aliases.map(a => `'${a}'`).join(', ')}]`;
  const newItem = [
    '{',
    `      path: '${entry.path}',`,
    `      aliases: ${aliasesTs},`,
    `      entrypoint: '${entry.entrypoint}',`,
    `      tag: '${entry.tag}',`,
    `      title: '${entry.title}',`,
    '    }',
  ].join('\n');
 
  return insertIntoArray(source, block, newItem, getModuleRouteSpans(source));
}
 
export function removeModuleRoute(source: string, path: string): string {
  const spans = getModuleRouteSpans(source);
  const target = spans.find(r => r.path === path);
  if (!target) throw new Error(`Route "${path}" not found.`);
  return removeItemFromArray(source, target, spans);
}
 
// ============================================================
// GENOME — types
// ============================================================

export interface GenomeEntry {
  key: string;
  designSystem: string;
  designSystemSkill: string;
  device: string;
  layout: string;
  layoutSkill: string;
}

// ============================================================
// GENOME — leitura
// ============================================================

function getModuleGenomeSpans(source: string): Array<GenomeEntry & { start: number; end: number }> {
  const block = extractObjectSpanOfConst(source, 'moduleGenome');
  if (!block) return [];

  const results: Array<GenomeEntry & { start: number; end: number }> = [];
  const keyRe = /'([^']+)'\s*:\s*\{/g;
  let m: RegExpExecArray | null;

  while ((m = keyRe.exec(block.content)) !== null) {
    const braceStart = block.start + m.index + m[0].length - 1;
    let valueContent: string;
    try { valueContent = balancedSlice(source, braceStart, '{', '}'); }
    catch { continue; }

    const dsM         = /designSystem\s*:\s*['"]([^'"]*)['"]/s.exec(valueContent);
    const dsSkillM    = /designSystemSkill\s*:\s*['"]([^'"]*)['"]/s.exec(valueContent);
    const deviceM     = /device\s*:\s*['"]([^'"]*)['"]/s.exec(valueContent);
    const layoutM     = /\blayout\s*:\s*['"]([^'"]*)['"]/s.exec(valueContent);
    const layoutSkillM = /layoutSkill\s*:\s*['"]([^'"]*)['"]/s.exec(valueContent);

    if (!dsM || !dsSkillM || !deviceM || !layoutM || !layoutSkillM) continue;

    results.push({
      key:               m[1],
      designSystem:      dsM[1],
      designSystemSkill: dsSkillM[1],
      device:            deviceM[1],
      layout:            layoutM[1],
      layoutSkill:       layoutSkillM[1],
      start:             block.start + m.index,
      end:               braceStart + valueContent.length,
    });
  }
  return results;
}

export function getModuleGenome(source: string): GenomeEntry[] {
  return getModuleGenomeSpans(source).map(({ start: _s, end: _e, ...e }) => e);
}

export function hasModuleGenomeEntry(source: string, key: string): boolean {
  return getModuleGenome(source).some(e => e.key === key);
}

// ============================================================
// GENOME — escrita
// ============================================================

export function addModuleGenome(
  source: string,
  entry: GenomeEntry,
  { throwIfExists = false }: { throwIfExists?: boolean } = {},
): string {
  if (hasModuleGenomeEntry(source, entry.key)) {
    if (throwIfExists) throw new Error(`Genome key "${entry.key}" already exists.`);
    return source;
  }

  const block = extractObjectSpanOfConst(source, 'moduleGenome');
  if (!block) throw new Error('Could not find moduleGenome const.');

  const newItem = [
    `'${entry.key}': {`,
    `    designSystem: '${entry.designSystem}',`,
    `    designSystemSkill: '${entry.designSystemSkill}',`,
    `    device: '${entry.device}',`,
    `    layout: '${entry.layout}',`,
    `    layoutSkill: '${entry.layoutSkill}',`,
    `  }`,
  ].join('\n  ');

  return insertIntoObject(source, block, newItem, getModuleGenomeSpans(source));
}

export function removeModuleGenome(source: string, key: string): string {
  const spans = getModuleGenomeSpans(source);
  const target = spans.find(e => e.key === key);
  if (!target) throw new Error(`Genome key "${key}" not found.`);
  return removeItemFromArray(source, target, spans);
}

// ============================================================
// INTERNAL — localiza array de uma prop dentro de uma const
// ============================================================
 
interface Span { content: string; start: number; end: number }
 
/**
 * Encontra o objeto { ... } de um `export const constName`.
 * Ex: extractObjectSpanOfConst(src, 'moduleGenome')
 */
function extractObjectSpanOfConst(source: string, constName: string): Span | null {
  const constRe = new RegExp(`export\\s+const\\s+${constName}[^=]*=\\s*\\{`);
  const constMatch = constRe.exec(source);
  if (!constMatch) return null;
  const objStart = constMatch.index + constMatch[0].length - 1;
  const content = balancedSlice(source, objStart, '{', '}');
  return { content, start: objStart, end: objStart + content.length };
}

/**
 * Encontra o array de `arrayKey` dentro do objeto `constName`.
 * Ex: extractArraySpanInsideConst(src, 'moduleFrontendDefinition', 'navigation')
 */
function extractArraySpanInsideConst(source: string, constName: string, arrayKey: string): Span | null {
  // localiza o bloco { ... } da const
  const constRe = new RegExp(`export\\s+const\\s+${constName}[^=]*=\\s*\\{`);
  const constMatch = constRe.exec(source);
  if (!constMatch) return null;
 
  const constObjStart = constMatch.index + constMatch[0].length - 1; // posição do {
  const constObj = balancedSlice(source, constObjStart, '{', '}');
 
  // dentro do objeto, localiza `arrayKey: [`
  const arrayRe = new RegExp(`\\b${arrayKey}\\s*:\\s*\\[`);
  const arrayMatch = arrayRe.exec(constObj);
  if (!arrayMatch) return null;
 
  const arrayStart = constObjStart + arrayMatch.index + arrayMatch[0].length - 1; // posição do [
  const content = balancedSlice(source, arrayStart, '[', ']');
  return { content, start: arrayStart, end: arrayStart + content.length };
}
 
// ============================================================
// INTERNAL — insert / remove genérico
// ============================================================
 
function insertIntoArray(
  source: string,
  block: Span,
  newItem: string,
  spans: Array<{ start: number; end: number }>,
): string {
  if (spans.length === 0) {
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
 
function insertIntoObject(
  source: string,
  block: Span,
  newItem: string,
  spans: Array<{ start: number; end: number }>,
): string {
  if (spans.length === 0) {
    const indent = detectIndent(source, block.start);
    const inner  = indent + '  ';
    const replacement = `{\n${inner}${newItem},\n${indent}}`;
    return source.slice(0, block.start) + replacement + source.slice(block.end);
  }

  const last = spans[spans.length - 1];
  let insertAt = last.end;
  const hasTrailingComma = source[insertAt] === ',';
  if (hasTrailingComma) insertAt++;

  const prefix = hasTrailingComma ? '' : ',';
  return source.slice(0, insertAt) + `${prefix}\n  ${newItem},` + source.slice(insertAt);
}

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
    let p = start - 1;
    while (p >= 0 && /[ \t\n]/.test(source[p])) p--;
    if (source[p] === ',') start = p;
    while (start > 0 && /[ \t\n]/.test(source[start - 1])) start--;
  } else {
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
test('add nav + route em cadeia', () => {
  let out = addModuleNav(SRC, { id: 'monitor', label: 'Monitor', href: '/monitor', description: 'Mon' });
  out = addModuleRoute(out, {
    path: '/monitor',
    aliases: [],
    entrypoint: '/_102035_/l2/pizzaria/web/desktop/page13/monitor.js',
    tag: 'pizzaria--web--desktop--page13--monitor-102035',
    title: 'Monitor',
  });
  eq(getModuleNavigation(out).length, 2);
  eq(getModuleRoutes(out).length, 2);
});
 
test('remove nav + route em cadeia', () => {
  let out = removeModuleNav(SRC, 'custumerEdit');
  out = removeModuleRoute(out, '/pizzaria');
  eq(getModuleNavigation(out).length, 0);
  eq(getModuleRoutes(out).length, 0);
});
*/