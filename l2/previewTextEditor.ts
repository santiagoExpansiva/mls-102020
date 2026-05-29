/// <mls fileReference="_102020_/l2/previewTextEditor.ts" enhancement="_blank"/>

import { resolveTagToFile } from '/_102020_/l2/utils.js';

/**
 * previewTextEditor.ts
 * 
 * Helper para identificar a origem de um texto visível no preview
 * e aplicar edições no source .ts correspondente.
 * 
 * Três cenários:
 *  1. static  — texto literal no template html`...`  → editável
 *  2. i18n    — texto em blocos message_xx do mesmo arquivo → editável  
 *  3. dynamic — texto vindo de fonte externa (API, state, props) → NÃO editável
 */

// --- Tipos ---

export type TextOrigin = IStaticOrigin | II18nOrigin | IDynamicOrigin;

export interface IStaticOrigin {
  type: 'static';
  /** Posição (offset) no source onde o texto começa */
  startOffset: number;
  /** Posição (offset) no source onde o texto termina */
  endOffset: number;
  /** Texto original encontrado no source */
  originalText: string;
}

export interface II18nOrigin {
  type: 'i18n';
  /** Chave no objeto de mensagens (ex: 'login') */
  key: string;
  /** Expressão no template (ex: 'this.msg.login') */
  templateExpression: string;
  /** Todas as ocorrências nos objetos de mensagem, por idioma */
  languages: II18nEntry[];
}

export interface II18nEntry {
  /** Nome do objeto (ex: 'message_en') */
  objectName: string;
  /** Idioma (ex: 'en') */
  lang: string;
  /** Valor atual */
  value: string;
  /** Offset no source onde o valor (string literal) começa (inclui aspas) */
  startOffset: number;
  /** Offset no source onde o valor (string literal) termina (inclui aspas) */
  endOffset: number;
}

export interface IDynamicOrigin {
  type: 'dynamic';
  /** Explicação de por que não é editável */
  reason: string;
}

export interface IEditResult {
  success: boolean;
  newSource?: string;
  error?: string;
}


// --- Funções principais ---

/**
 * Identifica a origem de um texto visível no preview.
 * 
 * @param text - Texto visível no preview (ex: "Login")
 * @param source - Conteúdo completo do arquivo .ts
 * @returns Origem do texto
 */
export function findTextOrigin(text: string, source: string): TextOrigin {
  const trimmed = text.trim();
  if (!trimmed) return { type: 'dynamic', reason: 'Empty text' };

  // 1. Tenta encontrar nos blocos i18n
  const i18nResult = findInI18n(trimmed, source);
  if (i18nResult) return i18nResult;

  // 2. Tenta encontrar como texto estático no template
  const staticResult = findInTemplate(trimmed, source);
  if (staticResult) return staticResult;

  // 3. Não encontrado — dinâmico
  return { type: 'dynamic', reason: `Text "${trimmed}" not found in source file` };
}


/**
 * Aplica uma edição de texto no source.
 * 
 * @param origin - Origem retornada por findTextOrigin
 * @param newText - Novo texto
 * @param source - Conteúdo completo do arquivo .ts
 * @param lang - Idioma atual (para i18n, edita só esse idioma). Se undefined, edita todos.
 * @returns Resultado com o novo source
 */
export function applyTextEdit(origin: TextOrigin, newText: string, source: string, lang?: string): IEditResult {
  if (origin.type === 'dynamic') {
    return { success: false, error: origin.reason };
  }

  if (origin.type === 'static') {
    return applyStaticEdit(origin, newText, source);
  }

  if (origin.type === 'i18n') {
    return applyI18nEdit(origin, newText, source, lang);
  }

  return { success: false, error: 'Unknown origin type' };
}


// --- Busca em i18n ---

/**
 * Procura o texto nos blocos collab_i18n delimitados por
 * /// **collab_i18n_start** e /// **collab_i18n_end**
 */
function findInI18n(text: string, source: string): II18nOrigin | null {

  // Extrai o bloco i18n
  const i18nBlock = extractI18nBlock(source);
  if (!i18nBlock) return null;

  // Encontra todos os objetos message_xx
  const messageObjects = parseMessageObjects(source, i18nBlock);
  if (messageObjects.length === 0) return null;

  // Procura o texto em qualquer valor dos objetos
  let foundKey: string | null = null;
  let templateExpression: string | null = null;

  // Normaliza: trim + colapsa whitespace interno
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  for (const obj of messageObjects) {
    for (const [key, entry] of Object.entries(obj.entries)) {
      const normalizedValue = entry.value.replace(/\s+/g, ' ').trim();
      if (normalizedValue === normalizedText) {
        foundKey = key;
        break;
      }
    }
    if (foundKey) break;
  }

  if (!foundKey) return null;

  // Descobre a expressão no template (ex: this.msg.login)
  // Procura padrões como ${this.msg.KEY} ou ${this.msg['KEY']}
  templateExpression = findTemplateExpression(foundKey, source);

  // Coleta todas as entradas para essa chave em todos os idiomas
  const languages: II18nEntry[] = [];
  for (const obj of messageObjects) {
    const entry = obj.entries[foundKey];
    if (entry) {
      languages.push({
        objectName: obj.name,
        lang: obj.lang,
        value: entry.value,
        startOffset: entry.startOffset,
        endOffset: entry.endOffset,
      });
    }
  }

  return {
    type: 'i18n',
    key: foundKey,
    templateExpression: templateExpression || `this.msg.${foundKey}`,
    languages,
  };
}

interface IMessageObject {
  name: string;       // ex: 'message_en'
  lang: string;       // ex: 'en'
  entries: Record<string, { value: string; startOffset: number; endOffset: number }>;
}

/**
 * Extrai as posições do bloco i18n no source
 */
function extractI18nBlock(source: string): { start: number; end: number } | null {
  const startMarker = '/// **collab_i18n_start**';
  const endMarker = '/// **collab_i18n_end**';

  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);

  if (start === -1 || end === -1 || end <= start) return null;

  return { start, end: end + endMarker.length };
}

/**
 * Faz parse dos objetos message_xx dentro do bloco i18n.
 * Suporta:
 *   const message_en = { key: 'value', ... }
 *   const message_en: Record<string, string> = { key: 'value', ... }
 *   const message_en: MessageType = { key: 'value', ... }
 */
function parseMessageObjects(source: string, block: { start: number; end: number }): IMessageObject[] {
  const blockSource = source.substring(block.start, block.end);
  const results: IMessageObject[] = [];

  // Regex para encontrar declarações de objetos message_xx
  // Captura: nome do objeto e o conteúdo entre { }
  const objRegex = /const\s+(message_(\w+))\s*(?::\s*[^=]+)?\s*=\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = objRegex.exec(blockSource)) !== null) {
    const name = match[1];     // message_en
    const lang = match[2];     // en
    const objStartInBlock = match.index + match[0].length - 1; // posição do {

    // Encontra o } correspondente
    const objEndInBlock = findClosingBrace(blockSource, objStartInBlock);
    if (objEndInBlock === -1) continue;

    const objContent = blockSource.substring(objStartInBlock, objEndInBlock + 1);

    // Parse dos key: value dentro do objeto
    const entries = parseObjectEntries(objContent, block.start + objStartInBlock);

    results.push({ name, lang, entries });
  }

  return results;
}

/**
 * Encontra a posição da chave de fechamento } correspondente
 */
function findClosingBrace(source: string, openPos: number): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = openPos; i < source.length; i++) {
    const ch = source[i];
    const prev = i > 0 ? source[i - 1] : '';

    if (inString) {
      if (ch === stringChar && prev !== '\\') {
        inString = false;
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      inString = true;
      stringChar = ch;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Parse dos pares key: 'value' dentro de um objeto.
 * Retorna as posições absolutas no source completo.
 * 
 * @param objContent - Conteúdo do objeto incluindo { }
 * @param absoluteOffset - Offset do { no source completo
 */
function parseObjectEntries(
  objContent: string,
  absoluteOffset: number
): Record<string, { value: string; startOffset: number; endOffset: number }> {
  const entries: Record<string, { value: string; startOffset: number; endOffset: number }> = {};

  // Regex para key: 'value' ou key: "value"
  // Suporta chaves com ou sem aspas
  const entryRegex = /(?:['"]?(\w+)['"]?)\s*:\s*(['"`])((?:(?!\2|(?<!\\)\2).)*?)\2/g;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(objContent)) !== null) {
    const key = match[1];
    const quote = match[2];
    const value = match[3];

    // Posição da string completa (com aspas) no source
    const valueWithQuotesStart = match.index + match[0].indexOf(quote);
    const valueWithQuotesEnd = valueWithQuotesStart + value.length + 2; // +2 para as aspas

    entries[key] = {
      value: unescapeString(value),
      startOffset: absoluteOffset + valueWithQuotesStart,
      endOffset: absoluteOffset + valueWithQuotesEnd,
    };
  }

  return entries;
}

/**
 * Remove escapes simples de strings
 */
function unescapeString(str: string): string {
  return str
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\');
}


// --- Busca no template ---

/**
 * Procura texto estático dentro do template html`...` do render().
 * 
 * Texto estático é qualquer texto entre tags HTML que NÃO está dentro de ${...}
 */
function findInTemplate(text: string, source: string): IStaticOrigin | null {
  // Encontra o template html`...` do render
  const renderMatch = source.match(/render\s*\(\s*\)\s*\{/);
  if (!renderMatch || renderMatch.index === undefined) return null;

  const renderStart = renderMatch.index;

  // Procura html` a partir do render
  const htmlTagIndex = source.indexOf('html`', renderStart);
  if (htmlTagIndex === -1) return null;

  const templateStart = htmlTagIndex + 5; // depois de html`

  // Encontra o backtick de fechamento (respeitando ${...})
  const templateEnd = findTemplateEnd(source, templateStart);
  if (templateEnd === -1) return null;

  const templateContent = source.substring(templateStart, templateEnd);

  // Procura o texto no template, ignorando partes dentro de ${...}
  const staticParts = extractStaticParts(templateContent, templateStart);

  for (const part of staticParts) {
    const idx = part.text.indexOf(text);
    if (idx !== -1) {
      return {
        type: 'static',
        startOffset: part.absoluteOffset + idx,
        endOffset: part.absoluteOffset + idx + text.length,
        originalText: text,
      };
    }
  }

  return null;
}

/**
 * Encontra o backtick de fechamento de um template literal,
 * respeitando ${...} aninhados
 */
function findTemplateEnd(source: string, start: number): number {
  let depth = 0; // profundidade de ${...}

  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    const next = i + 1 < source.length ? source[i + 1] : '';

    if (ch === '$' && next === '{') {
      depth++;
      i++; // pula o {
      continue;
    }

    if (ch === '}' && depth > 0) {
      depth--;
      continue;
    }

    if (ch === '`' && depth === 0) {
      return i;
    }
  }
  return -1;
}

/**
 * Extrai as partes estáticas de um template literal (fora de ${...})
 */
function extractStaticParts(template: string, absoluteOffset: number): { text: string; absoluteOffset: number }[] {
  const parts: { text: string; absoluteOffset: number }[] = [];
  let depth = 0;
  let partStart = 0;

  for (let i = 0; i < template.length; i++) {
    const ch = template[i];
    const next = i + 1 < template.length ? template[i + 1] : '';

    if (ch === '$' && next === '{' && depth === 0) {
      // Salva a parte estática antes do ${
      if (i > partStart) {
        parts.push({
          text: template.substring(partStart, i),
          absoluteOffset: absoluteOffset + partStart,
        });
      }
      depth++;
      i++; // pula o {
      continue;
    }

    if (ch === '{' && depth > 0) {
      depth++;
      continue;
    }

    if (ch === '}' && depth > 0) {
      depth--;
      if (depth === 0) {
        partStart = i + 1;
      }
      continue;
    }
  }

  // Última parte estática
  if (partStart < template.length) {
    parts.push({
      text: template.substring(partStart),
      absoluteOffset: absoluteOffset + partStart,
    });
  }

  return parts;
}


// --- Busca de expressão no template ---

/**
 * Procura como a chave i18n é referenciada no template.
 * Ex: para key='login', procura ${this.msg.login} ou ${this.msg['login']}
 */
function findTemplateExpression(key: string, source: string): string | null {
  // Padrões comuns
  const patterns = [
    new RegExp(`this\\.msg\\.${key}\\b`),
    new RegExp(`this\\.msg\\['${key}'\\]`),
    new RegExp(`this\\.msg\\["${key}"\\]`),
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) return match[0];
  }

  return null;
}


// --- Aplicar edições ---

/**
 * Aplica edição de texto estático no template
 */
function applyStaticEdit(origin: IStaticOrigin, newText: string, source: string): IEditResult {
  const before = source.substring(0, origin.startOffset);
  const after = source.substring(origin.endOffset);

  return {
    success: true,
    newSource: before + newText + after,
  };
}

/**
 * Aplica edição de texto i18n.
 * Se lang é informado, edita só aquele idioma.
 * Se não, edita todos.
 * 
 * IMPORTANTE: edita de trás pra frente para não invalidar offsets
 */
function applyI18nEdit(origin: II18nOrigin, newText: string, source: string, lang?: string): IEditResult {
  // Filtra por idioma se especificado
  let entries = origin.languages;
  if (lang) {
    entries = entries.filter(e => e.lang === lang);
  }

  if (entries.length === 0) {
    return { success: false, error: `No i18n entry found for lang: ${lang}` };
  }

  // Ordena por offset decrescente para editar de trás pra frente
  const sorted = [...entries].sort((a, b) => b.startOffset - a.startOffset);

  let result = source;
  for (const entry of sorted) {
    // Descobre o tipo de aspas usado
    const quoteChar = result[entry.startOffset];
    const escapedText = escapeForQuote(newText, quoteChar);
    const replacement = `${quoteChar}${escapedText}${quoteChar}`;

    result = result.substring(0, entry.startOffset) + replacement + result.substring(entry.endOffset);
  }

  return { success: true, newSource: result };
}

/**
 * Escapa texto para uso dentro de uma string com o tipo de aspas dado
 */
function escapeForQuote(text: string, quote: string): string {
  if (quote === "'") return text.replace(/'/g, "\\'");
  if (quote === '"') return text.replace(/"/g, '\\"');
  if (quote === '`') return text.replace(/`/g, '\\`');
  return text;
}


// --- Template Map ---

/**
 * Representa uma expressão ${...} no template, na ordem em que aparece.
 */
export interface ITemplateExpression {
  /** Índice sequencial da expressão no template (0, 1, 2, ...) */
  index: number;
  /** Expressão completa (ex: 'this.msg.login') */
  expression: string;
  /** Se é i18n, a chave extraída (ex: 'login'). null se não for padrão i18n */
  i18nKey: string | null;
  /** Tipo detectado: 'i18n' | 'static-text' | 'dynamic' */
  type: 'i18n' | 'dynamic';
  /** Offset no source onde a expressão começa (depois do ${) */
  startOffset: number;
  /** Offset no source onde a expressão termina (antes do }) */
  endOffset: number;
}

/**
 * Constrói um mapa ordenado de todas as expressões ${...} no template html`...` do render().
 * A ordem corresponde à ordem dos nós de texto no DOM renderizado.
 * 
 * @param source - Conteúdo completo do arquivo .ts
 * @returns Lista ordenada de expressões
 */
export function buildTemplateMap(source: string): ITemplateExpression[] {
  // Encontra o template html`...` do render
  const renderMatch = source.match(/render\s*\(\s*\)\s*\{/);
  if (!renderMatch || renderMatch.index === undefined) return [];

  const renderStart = renderMatch.index;

  // Procura html` a partir do render
  const htmlTagIndex = source.indexOf('html`', renderStart);
  if (htmlTagIndex === -1) return [];

  const templateStart = htmlTagIndex + 5; // depois de html`

  // Encontra o backtick de fechamento
  const templateEnd = findTemplateEnd(source, templateStart);
  if (templateEnd === -1) return [];

  // Extrai todas as expressões ${...} na ordem
  const expressions: ITemplateExpression[] = [];
  let depth = 0;
  let exprStart = -1;
  let exprIndex = 0;

  for (let i = templateStart; i < templateEnd; i++) {
    const ch = source[i];
    const next = i + 1 < source.length ? source[i + 1] : '';

    if (ch === '$' && next === '{' && depth === 0) {
      depth = 1;
      exprStart = i + 2; // depois do ${
      i++; // pula o {
      continue;
    }

    if (depth > 0) {
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          const expression = source.substring(exprStart, i).trim();
          const i18nKey = extractI18nKeyFromExpression(expression);

          expressions.push({
            index: exprIndex++,
            expression,
            i18nKey,
            type: i18nKey ? 'i18n' : 'dynamic',
            startOffset: exprStart,
            endOffset: i,
          });
        }
      }
    }
  }

  return expressions;
}

/**
 * Extrai a chave i18n de uma expressão como 'this.msg.login' ou 'this.msg["login"]'
 * Retorna null se não for um padrão i18n reconhecido.
 *
 * Reconhece também o helper t(): t('login') / this.t('login')
 */
function extractI18nKeyFromExpression(expression: string): string | null {
  // this.msg.key
  const dotMatch = expression.match(/^this\.msg\.(\w+)$/);
  if (dotMatch) return dotMatch[1];

  // this.msg['key'] ou this.msg["key"]
  const bracketMatch = expression.match(/^this\.msg\[['"](\w+)['"]\]$/);
  if (bracketMatch) return bracketMatch[1];

  // t('key') ou this.t('key')
  const tMatch = expression.match(/^(?:this\.)?t\(\s*['"](\w+)['"]\s*\)$/);
  if (tMatch) return tMatch[1];

  return null;
}


/**
 * Encontra a origem do texto usando o índice da expressão no DOM.
 * 
 * Fluxo:
 *  1. Constrói o mapa de expressões do template
 *  2. Usa o expressionIndex para encontrar a expressão exata
 *  3. Se é i18n, retorna a chave correta (sem ambiguidade)
 *  4. Se não, faz fallback para busca por texto
 * 
 * @param text - Texto visível no preview
 * @param source - Conteúdo do .ts
 * @param expressionIndex - Índice da expressão ${...} no template (posição no DOM)
 */
export function findTextOriginByIndex(text: string, source: string, expressionIndex: number): TextOrigin {
  const trimmed = text.trim();
  if (!trimmed) return { type: 'dynamic', reason: 'Empty text' };

  const templateMap = buildTemplateMap(source);

  // Se temos um índice válido, usa o mapa
  if (expressionIndex >= 0 && expressionIndex < templateMap.length) {
    const expr = templateMap[expressionIndex];

    if (expr.type === 'i18n' && expr.i18nKey) {
      // Encontra as entradas i18n para essa chave específica
      const i18nBlock = extractI18nBlock(source);
      if (i18nBlock) {
        const messageObjects = parseMessageObjects(source, i18nBlock);
        const languages: II18nEntry[] = [];

        for (const obj of messageObjects) {
          const entry = obj.entries[expr.i18nKey];
          if (entry) {
            languages.push({
              objectName: obj.name,
              lang: obj.lang,
              value: entry.value,
              startOffset: entry.startOffset,
              endOffset: entry.endOffset,
            });
          }
        }

        if (languages.length > 0) {
          return {
            type: 'i18n',
            key: expr.i18nKey,
            templateExpression: expr.expression,
            languages,
          };
        }
      }
    }

    if (expr.type === 'dynamic') {
      return { type: 'dynamic', reason: `Expression "${expr.expression}" is dynamic` };
    }
  }

  // Fallback: busca por texto (método original)
  return findTextOrigin(text, source);
}

// --- Resolução determinística por chave (data-i18n-key) ---

/**
 * Resolve a origem i18n DIRETAMENTE pela chave, sem qualquer ambiguidade.
 *
 * Este é o caminho 100% correto: usado quando o DOM carrega a chave via
 * data-i18n-key (emitido pelo helper t()). Não depende de contagem de
 * ocorrência, de ordem no DOM, nem de o texto bater com algum literal —
 * portanto resolve corretamente chaves distintas com o MESMO valor
 * (ex: formaPagamento vs colFormaPagamento).
 *
 * @param key - Chave i18n (ex: 'colFormaPagamento')
 * @param source - Conteúdo completo do arquivo .ts
 * @param _lang - Idioma atual (não usado na resolução; a edição por idioma
 *                acontece em applyTextEdit). Mantido por simetria de assinatura.
 */
export function findTextOriginByKey(key: string, source: string, _lang?: string): TextOrigin {
  if (!key) return { type: 'dynamic', reason: 'No i18n key' };

  const i18nBlock = extractI18nBlock(source);
  if (!i18nBlock) return { type: 'dynamic', reason: 'No i18n block in source' };

  const messageObjects = parseMessageObjects(source, i18nBlock);
  if (messageObjects.length === 0) return { type: 'dynamic', reason: 'No message objects in source' };

  const languages: II18nEntry[] = [];
  for (const obj of messageObjects) {
    const entry = obj.entries[key];
    if (entry) {
      languages.push({
        objectName: obj.name,
        lang: obj.lang,
        value: entry.value,
        startOffset: entry.startOffset,
        endOffset: entry.endOffset,
      });
    }
  }

  if (languages.length === 0) {
    return { type: 'dynamic', reason: `i18n key "${key}" not found in source` };
  }

  return {
    type: 'i18n',
    key,
    templateExpression: findTemplateExpression(key, source) || `this.msg.${key}`,
    languages,
  };
}

// --- Occurrence-based disambiguation ---

/**
 * Finds ALL i18n keys whose value matches the given text.
 * Returns them in declaration order.
 */
export function findAllI18nMatches(text: string, source: string, lang?: string): { key: string; origin: II18nOrigin }[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const i18nBlock = extractI18nBlock(source);
  if (!i18nBlock) return [];

  const messageObjects = parseMessageObjects(source, i18nBlock);
  if (messageObjects.length === 0) return [];

  const normalizedText = trimmed.replace(/\s+/g, ' ');
  const matchingKeys: string[] = [];

  const primaryObj = lang
    ? messageObjects.find(o => o.lang === lang) || messageObjects[0]
    : messageObjects[0];

  for (const [key, entry] of Object.entries(primaryObj.entries)) {
    const normalizedValue = entry.value.replace(/\s+/g, ' ').trim();
    if (normalizedValue === normalizedText) {
      matchingKeys.push(key);
    }
  }

  const results: { key: string; origin: II18nOrigin }[] = [];

  for (const foundKey of matchingKeys) {
    const templateExpression = findTemplateExpression(foundKey, source);
    const languages: II18nEntry[] = [];
    for (const obj of messageObjects) {
      const entry = obj.entries[foundKey];
      if (entry) {
        languages.push({
          objectName: obj.name,
          lang: obj.lang,
          value: entry.value,
          startOffset: entry.startOffset,
          endOffset: entry.endOffset,
        });
      }
    }
    results.push({
      key: foundKey,
      origin: {
        type: 'i18n',
        key: foundKey,
        templateExpression: templateExpression || `this.msg.${foundKey}`,
        languages,
      },
    });
  }

  return results;
}

/**
 * Resolves text origin using DOM occurrence index to disambiguate
 * when multiple i18n keys have the same value.
 *
 * NOTA: este é o caminho de FALLBACK, usado apenas para texto que não foi
 * tagueado com data-i18n-key. Para resolução determinística, prefira
 * findTextOriginByKey.
 * 
 * @param text - Visible text
 * @param source - Full .ts source  
 * @param occurrenceIndex - Which occurrence of this text in the DOM (0-based)
 * @param lang - Current language
 */
export function findTextOriginByOccurrence(
  text: string,
  source: string,
  occurrenceIndex: number,
  lang?: string
): TextOrigin {
  const trimmed = text.trim();
  if (!trimmed) return { type: 'dynamic', reason: 'Empty text' };

  const matches = findAllI18nMatches(trimmed, source, lang);

  if (matches.length > 1 && occurrenceIndex >= 0) {
    const templateMap = buildTemplateMap(source);

    // Ordena os matches pela posição no template. Chaves não encontradas no
    // template (templateIdx = -1) NÃO são descartadas: vão para o fim em ordem
    // de declaração — descartá-las fazia toda edição colapsar em matches[0].
    const ordered = matches
      .map((m, declIdx) => {
        const templateIdx = templateMap.findIndex(expr => expr.i18nKey === m.key);
        return { ...m, declIdx, templateIdx };
      })
      .sort((a, b) => {
        const ta = a.templateIdx < 0 ? Number.MAX_SAFE_INTEGER : a.templateIdx;
        const tb = b.templateIdx < 0 ? Number.MAX_SAFE_INTEGER : b.templateIdx;
        return ta !== tb ? ta - tb : a.declIdx - b.declIdx;
      });

    if (occurrenceIndex < ordered.length) {
      return ordered[occurrenceIndex].origin;
    }
  }

  if (matches.length > 0) {
    return matches[0].origin;
  }

  return findTextOrigin(text, source);
}



// --- Troca de tag de web component ---

export interface ITagReplaceResult {
  success: boolean;
  newSource?: string;
  /** Número de ocorrências substituídas (abertura + fechamento) */
  replacements?: number;
  error?: string;
}

/**
 * Substitui uma ocorrência específica ou todas as ocorrências de uma tag
 * de web component no template do render().
 * 
 * Também gerencia os imports:
 * - Se oldTag ainda existe no template após a troca → mantém import antigo E adiciona novo
 * - Se oldTag não existe mais → remove import antigo e adiciona novo
 * - Se import do newTag já existe → não duplica
 * 
 * @param oldTag - Tag atual (ex: 'ml-floating-text-input')
 * @param newTag - Nova tag (ex: 'ml-new-text-input')
 * @param source - Conteúdo completo do arquivo .ts
 * @param selectorPath - Path do elemento selecionado no DOM
 * @param mode - 'selected' troca só o selecionado, 'all' troca todas as ocorrências
 * @returns Resultado com o novo source
 */
export function replaceComponentTag(
  oldTag: string,
  newTag: string,
  source: string,
  selectorPath?: string,
  mode: 'selected' | 'all' = 'selected'
): ITagReplaceResult {
  if (!oldTag || !newTag) {
    return { success: false, error: 'oldTag and newTag are required' };
  }

  if (oldTag === newTag) {
    return { success: false, error: 'oldTag and newTag are the same' };
  }

  if (!oldTag.includes('-') || !newTag.includes('-')) {
    return { success: false, error: 'Tags must be custom elements (contain a hyphen)' };
  }

  const templateRange = getTemplateRange(source);
  if (!templateRange) {
    return { success: false, error: 'Template html`...` not found in render()' };
  }

  const { start, end } = templateRange;
  const template = source.substring(start, end);

  // Encontra todas as posições de abertura e fechamento da tag no template
  const escapedOld = escapeRegex(oldTag);
  const openRegex = new RegExp(`<${escapedOld}(\\s|>|\\/)`, 'g');
  const closeRegex = new RegExp(`</${escapedOld}>`, 'g');

  const openMatches: { index: number; length: number; suffix: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = openRegex.exec(template)) !== null) {
    openMatches.push({ index: m.index, length: m[0].length, suffix: m[1] });
  }

  const closeMatches: { index: number; length: number }[] = [];
  while ((m = closeRegex.exec(template)) !== null) {
    closeMatches.push({ index: m.index, length: m[0].length });
  }

  if (openMatches.length === 0) {
    return { success: false, error: `Tag "${oldTag}" not found in template` };
  }

  const totalOccurrences = openMatches.length;

  // Determina quais ocorrências trocar
  let targetOpen: typeof openMatches;
  let targetClose: typeof closeMatches;

  if (mode === 'all') {
    targetOpen = openMatches;
    targetClose = closeMatches;
  } else {
    // mode === 'selected' — usa o selectorPath para identificar qual
    const occurrenceIndex = getOccurrenceFromPath(oldTag, selectorPath);
    targetOpen = (occurrenceIndex >= 0 && occurrenceIndex < openMatches.length)
      ? [openMatches[occurrenceIndex]]
      : [openMatches[0]];
    targetClose = (occurrenceIndex >= 0 && occurrenceIndex < closeMatches.length)
      ? [closeMatches[occurrenceIndex]]
      : [closeMatches[0]];
  }

  // Coleta substituições com posições absolutas no source
  const replacements: { srcStart: number; srcEnd: number; replacement: string }[] = [];

  for (const open of targetOpen) {
    replacements.push({
      srcStart: start + open.index,
      srcEnd: start + open.index + open.length,
      replacement: `<${newTag}${open.suffix}`,
    });
  }

  for (const close of targetClose) {
    replacements.push({
      srcStart: start + close.index,
      srcEnd: start + close.index + close.length,
      replacement: `</${newTag}>`,
    });
  }

  if (replacements.length === 0) {
    return { success: false, error: `Tag "${oldTag}" not found in template` };
  }

  // Ordena de trás pra frente para não invalidar offsets
  replacements.sort((a, b) => b.srcStart - a.srcStart);

  let newSource = source;
  for (const r of replacements) {
    newSource = newSource.substring(0, r.srcStart) + r.replacement + newSource.substring(r.srcEnd);
  }

  // Verifica se ainda restam ocorrências da oldTag no template após a substituição
  const remainingOldTags = totalOccurrences - targetOpen.length;
  const oldTagStillExists = remainingOldTags > 0;

  // Gerencia imports
  newSource = updateImportsForTagReplace(oldTag, newTag, newSource, oldTagStillExists);

  return {
    success: true,
    newSource,
    replacements: replacements.length,
  };
}

/**
 * Gerencia os imports ao trocar uma tag de web component.
 * 
 * - Se oldTag ainda existe no template → mantém import antigo E adiciona o novo
 * - Se oldTag não existe mais → remove import antigo e adiciona o novo
 * - Se o import do newTag já existe → não duplica
 */
function updateImportsForTagReplace(oldTag: string, newTag: string, source: string, oldTagStillExists: boolean): string {
  const oldFile = resolveTagToFile(oldTag);
  const newFile = resolveTagToFile(newTag);

  if (!oldFile || !newFile) return source;

  const oldImportPath = buildImportPath(oldFile);
  const newImportPath = buildImportPath(newFile);

  if (!oldImportPath || !newImportPath) return source;

  // Verifica se o import do newTag já existe no source
  const newImportExists = source.includes(newImportPath);

  // Encontra a linha de import da oldTag
  const escapedOldPath = escapeRegex(oldImportPath);
  const importRegex = new RegExp(`^(import\\s+(?:[^;]*?from\\s+)?['"])${escapedOldPath}(['"]\\s*;?)\\s*$`, 'gm');
  const importMatch = importRegex.exec(source);

  if (!importMatch) {
    // Import antigo não encontrado — apenas adiciona o novo se não existe
    if (!newImportExists) {
      return addImport(source, newImportPath);
    }
    return source;
  }

  const oldImportLine = importMatch[0];
  const newImportLine = `${importMatch[1]}${newImportPath}${importMatch[2]}`;

  if (oldTagStillExists) {
    // Mantém import antigo E adiciona o novo (se não existe)
    if (!newImportExists) {
      const insertPos = importMatch.index + oldImportLine.length;
      return source.substring(0, insertPos) + '\n' + newImportLine + source.substring(insertPos);
    }
    return source;
  } else {
    // Remove import antigo e adiciona o novo (se não existe)
    if (newImportExists) {
      // Apenas remove o antigo
      return source.replace(oldImportLine, '').replace(/\n\n\n+/g, '\n\n');
    } else {
      // Substitui o antigo pelo novo
      return source.replace(oldImportLine, newImportLine);
    }
  }
}

/**
 * Adiciona uma linha de import no source, após o último import existente.
 */
function addImport(source: string, importPath: string): string {
  const newImportLine = `import '${importPath}';`;

  // Encontra a posição do último import no source
  const importRegex = /^import\s+.+;?\s*$/gm;
  let lastImportEnd = 0;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(source)) !== null) {
    lastImportEnd = match.index + match[0].length;
  }

  if (lastImportEnd > 0) {
    return source.substring(0, lastImportEnd) + '\n' + newImportLine + source.substring(lastImportEnd);
  }

  // Sem imports — insere no topo (após a primeira linha)
  const firstNewline = source.indexOf('\n');
  if (firstNewline >= 0) {
    return source.substring(0, firstNewline + 1) + newImportLine + '\n' + source.substring(firstNewline + 1);
  }

  return newImportLine + '\n' + source;
}

/**
 * Monta o path de import a partir de um fileInfo.
 * Padrão: /_${project}_/l2/${folder}/${shortName}.js
 */
function buildImportPath(fileInfo: { project: number; shortName: string; folder: string }): string {
  const { project, shortName, folder } = fileInfo;
  if (folder) {
    return `/_${project}_/l2/${folder}/${shortName}.js`;
  }
  return `/_${project}_/l2/${shortName}.js`;
}

/**
 * Determina qual ocorrência da tag no template corresponde ao selectorPath.
 * 
 * Analisa o path para extrair o nth-of-type se presente, ou conta a posição.
 * Ex: "page > main > ml-input:nth-of-type(2)" → ocorrência 1 (0-indexed)
 * Ex: "page > main > ml-input" → ocorrência 0 (primeira)
 * 
 * @returns Índice da ocorrência (0-based), ou -1 se não determinável (troca todas)
 */
function getOccurrenceFromPath(oldTag: string, selectorPath?: string): number {
  if (!selectorPath) return -1;

  // Pega o último segmento do path
  const segments = selectorPath.split('>').map(s => s.trim());
  const lastSegment = segments[segments.length - 1];

  if (!lastSegment) return -1;

  // Verifica se o último segmento é a tag que estamos procurando
  const tagLower = oldTag.toLowerCase();
  const segLower = lastSegment.toLowerCase();

  if (!segLower.startsWith(tagLower)) return -1;

  // Extrai nth-of-type se presente
  const nthMatch = lastSegment.match(/:nth-of-type\((\d+)\)/i);
  if (nthMatch) {
    return parseInt(nthMatch[1], 10) - 1; // CSS é 1-based, queremos 0-based
  }

  // Sem nth-of-type → primeira ocorrência
  return 0;
}

/**
 * Retorna o range (start, end) do conteúdo do template html`...` no render().
 */
function getTemplateRange(source: string): { start: number; end: number } | null {
  const renderMatch = source.match(/render\s*\(\s*\)\s*\{/);
  if (!renderMatch || renderMatch.index === undefined) return null;

  const renderStart = renderMatch.index;
  const htmlTagIndex = source.indexOf('html`', renderStart);
  if (htmlTagIndex === -1) return null;

  const templateStart = htmlTagIndex + 5;
  const templateEnd = findTemplateEnd(source, templateStart);
  if (templateEnd === -1) return null;

  return { start: templateStart, end: templateEnd };
}

/**
 * Escapa caracteres especiais de regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}