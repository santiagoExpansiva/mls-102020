/// <mls fileReference="_102020_/l2/agentMaterializeSolution/agentMaterializePage.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { createStorFile, IReqCreateStorFile } from '/_102027_/l2/libStor.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentMaterializePage',
    agentProject: 102020,
    agentFolder: 'agentMaterializeSolution',
    agentDescription: 'Generate web/desktop/page11/{pageId}.ts (visual-only Lit component) from a desktop defs skill file',
    visibility: 'public',
    beforePromptImplicit,
    beforePromptStep,
    afterPromptStep,
  };
}

// ─── input ────────────────────────────────────────────────────────────────────

interface AgentInput {
  path: string;
  moduleName: string;
}

function parseInput(raw: string): AgentInput {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const path = parsed['path'];
    const moduleName = parsed['moduleName'];
    if (typeof path !== 'string' || !path) throw new Error('[agentMaterializePage] missing "path"');
    if (typeof moduleName !== 'string' || !moduleName) throw new Error('[agentMaterializePage] missing "moduleName"');
    return { path, moduleName };
  }
  const lines = trimmed.split(/[\n\r]+/).map(s => s.trim()).filter(Boolean);
  if (!lines[0]) throw new Error('[agentMaterializePage] path is required');
  if (!lines[1]) throw new Error('[agentMaterializePage] moduleName is required');
  return { path: lines[0], moduleName: lines[1] };
}

function extractPageId(path: string): string {
  const last = path.replace(/^\/+/, '').split('/').pop() || '';
  return last.replace(/\.defs\.ts$|\.ts$/, '');
}

function extractProject(path: string): number {
  const m = path.match(/mls-(\d+)/);
  return m ? parseInt(m[1], 10) : (mls.actualProject || 0);
}

function extractOutputPath(inputPath: string): string {
  return inputPath.replace(/\.defs\.ts$/, '.ts');
}

function toKebab(camel: string): string {
  return camel.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

// ─── stor helpers ─────────────────────────────────────────────────────────────

function toRef(mlsPath: string): string {
  const norm = mlsPath.trim().replace(/^\/+/, '');
  const m = norm.match(/^mls-(\d+)\/(.+)/);
  if (m) return `_${m[1]}_/${m[2]}`;
  return norm;
}

async function readStorFile(mlsPath: string): Promise<string | null> {
  try {
    const info = mls.stor.convertFileReferenceToFile(toRef(mlsPath));
    if (!info) return null;
    const sf = mls.stor.files[mls.stor.getKeyToFile(info)];
    if (!sf) return null;
    const content = await sf.getContent();
    return typeof content === 'string' ? content : null;
  } catch {
    return null;
  }
}

async function writeStorFile(mlsPath: string, src: string): Promise<void> {
  const info = mls.stor.convertFileReferenceToFile(toRef(mlsPath));
  if (!info) throw new Error(`[agentMaterializePage] cannot resolve: ${mlsPath}`);
  const key = mls.stor.getKeyToFile(info);
  let sf = mls.stor.files[key];
  if (!sf) {
    const param: IReqCreateStorFile = { ...info, source: src };
    sf = await createStorFile(param, false, false, false);
  } else {
    const m = await sf.getOrCreateModel();
    if (m && m.model) m.model.setValue(src);
  }
}

// ─── prompt builder ───────────────────────────────────────────────────────────

async function buildHumanPrompt(path: string, moduleName: string): Promise<string> {
  const defsSrc = await readStorFile(path);
  if (!defsSrc) throw new Error(`[agentMaterializePage] defs file not found: ${path}`);

  const project = extractProject(path);
  const pageId = extractPageId(path);
  const outputPath = extractOutputPath(path);
  const baseClassImport = `/_${project}_/l2/${moduleName}/web/shared/${pageId}.js`;
  const customElementTag = `${toKebab(moduleName)}--web--desktop--page11--${toKebab(pageId)}-${project}`;

  return `## path
${path}

## moduleName
${moduleName}

## pageId
${pageId}

## outputPath
${outputPath}

## baseClassImport
${baseClassImport}

## customElementTag
${customElementTag}

## Defs file (skill content)
\`\`\`ts
${defsSrc}
\`\`\`
`;
}

// ─── beforePromptImplicit ─────────────────────────────────────────────────────

async function beforePromptImplicit(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  userPrompt: string,
): Promise<mls.msg.AgentIntent[]> {
  const { path, moduleName } = parseInput(userPrompt);
  const humanPrompt = await buildHumanPrompt(path, moduleName);

  const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
    type: 'add-message-ai',
    request: {
      action: 'addMessageAI',
      agentName: agent.agentName,
      inputAI: [
        { type: 'system', content: systemPrompt },
        { type: 'human', content: humanPrompt },
      ],
      taskTitle: `page:${extractPageId(path)}`,
      threadId: context.message.threadId,
      userMessage: path,
      longTermMemory: {},
    },
  };

  return [addMessageAI];
}

// ─── beforePromptStep ─────────────────────────────────────────────────────────

async function beforePromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
  args?: string,
): Promise<mls.msg.AgentIntent[]> {
  if (!args) throw new Error(`(${agent.agentName})[beforePromptStep] args is required`);

  const { path, moduleName } = parseInput(args);
  const humanPrompt = await buildHumanPrompt(path, moduleName);

  const promptReady: mls.msg.AgentIntentPromptReady = {
    type: 'prompt_ready',
    args,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    hookSequential,
    parentStepId: parentStep.stepId,
    humanPrompt,
    systemPrompt,
  };

  return [promptReady];
}

// ─── afterPromptStep ──────────────────────────────────────────────────────────

async function afterPromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
): Promise<mls.msg.AgentIntent[]> {
  if (!agent || !context || !step) throw new Error(`(${agent.agentName})[afterPromptStep] invalid params`);

  let status: mls.msg.AIStepStatus = 'completed';

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload || payload.type !== 'flexible' || !payload.result) {
      throw new Error('missing or invalid flexible payload');
    }

    const result = payload.result as AgentOutput['result'];
    const { path, srcFile } = result;
    if (!path || !srcFile) throw new Error('AI response missing path or srcFile');

    await writeStorFile(extractOutputPath(path), srcFile);

  } catch (err) {
    status = 'failed';
    console.error(`[agentMaterializePage](afterPromptStep)`, err);
  }

  const updateStatus: mls.msg.AgentIntentUpdateStatus = {
    type: 'update-status',
    hookSequential,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    parentStepId: parentStep.stepId,
    stepId: step.stepId,
    cleaner: 'input_output',
    status,
  };

  return [updateStatus];
}

// ─── output type ──────────────────────────────────────────────────────────────

//#region OutputSection
export type AgentOutput = {
  type: 'flexible';
  result: {
    path: string;
    moduleName: string;
    pageId: string;
    srcFile: string;
  };
};
//#endregion

// ─── system prompt ────────────────────────────────────────────────────────────

const systemPrompt = `
<!-- modelType: codereasoning -->

You are agentMaterializePage.
You receive a desktop page skill file (web/desktop/page11/{pageId}.defs.ts) and generate
the visual-only Lit web component web/desktop/page11/{pageId}.ts.

This component contains ZERO business logic and ZERO BFF calls.
It only renders HTML using properties and calls handler methods inherited from the base class.

## Output — return ONLY valid JSON, no markdown fences, no prose outside the JSON

{
  "type": "flexible",
  "result": {
    "path":       "<echo ## path exactly>",
    "moduleName": "<echo ## moduleName exactly>",
    "pageId":     "<echo ## pageId exactly>",
    "srcFile":    "<full TypeScript source — escaped as single-line JSON string>"
  }
}

srcFile must be a single-line JSON string — escape every special character:
  newline → \\n  |  tab → \\t  |  double-quote → \\"  |  backslash → \\\\

---

## File structure

### 1. Header

/// <mls fileReference="_{project}_/l2/{moduleName}/web/desktop/page11/{pageId}.ts" enhancement="_102027_/l2/enhancementLit.ts" />

### 2. Imports

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { {ModuleNamePascalCase}{PageIdPascalCase}Base } from '<## baseClassImport>';

Only these three imports. No state management, no execBff, no contracts.

### 3. Custom element registration + class

@customElement('<## customElementTag>')
export class {ModuleNamePascalCase}WebDesktop{PageIdPascalCase}Page extends {ModuleNamePascalCase}{PageIdPascalCase}Base {
  render() {
    ...
  }
}

---

## render() rules

### What render() must do
- Return a single lit html\`...\` template
- Read ONLY from this.* properties (inherited from the base class)
- Wire events to ONLY handler methods from the base class (e.g. this.handleXxxClick, this.handleXxxSubmit)
- Show loading skeletons when an action state is 'loading'
- Show error banners when an action state is 'error'
- Show empty state when relevant (e.g. items array is empty, count is 0)
- Implement the layout described in ## Layout and ## Sections

### What render() must NOT do
- No async, no fetch, no execBff, no setState, no getState
- No logic beyond conditional rendering and event wiring
- No imports of molecules or external components

### Naming conventions
Base class name: {ModuleNamePascalCase}{PageIdPascalCase}Base
Page class name: {ModuleNamePascalCase}WebDesktop{PageIdPascalCase}Page

### Styling
Use Tailwind CSS utility classes exclusively. No inline styles, no CSS files.
Color palette: slate (neutral), indigo (primary actions), emerald (success), red (error/danger), amber (warning).
Layout grid: grid-cols-12. Main content section col-span-8, sidebar col-span-4 (or adjust per ## Layout).

### Page wrapper
<div class="min-h-screen bg-slate-50 text-slate-900">
  <div class="mx-auto max-w-6xl px-6 py-8">
    ...
  </div>
</div>

### Page header (always present)
<header class="flex flex-col gap-4 border-b border-slate-200 pb-6">
  <div class="flex items-start justify-between gap-6">
    <div>
      <h1 class="text-2xl font-semibold text-slate-900">{pageName from Origins}</h1>
      <p class="mt-1 text-sm text-slate-600">{purpose from Origins}</p>
    </div>
    <!-- CTA buttons derived from outbound navigationRefs go here, if applicable -->
  </div>
  <!-- Status line: this.status -->
  <div class="flex items-center gap-2">
    <div class="h-2.5 w-2.5 rounded-full \${this.status ? 'bg-emerald-500' : 'bg-slate-300'}"></div>
    <div class="text-sm text-slate-700">\${this.status}</div>
  </div>
</header>

### Main grid
<main class="mt-8 grid grid-cols-12 gap-6">
  <!-- render each section in its column position (from ## Sections) -->
</main>

### Per section
Wrap each section in <section class="col-span-{n}"> or <aside class="col-span-{n}">.
Inside each section, one card per organism:
<div class="rounded-xl border border-slate-200 bg-white shadow-sm">
  <div class="border-b border-slate-200 px-6 py-4">
    <h2 class="text-base font-semibold text-slate-900">{sectionName}</h2>
  </div>
  <div class="px-6 py-6">
    <!-- organism content -->
  </div>
</div>

### Loading skeleton
When action state is 'loading' (e.g. this.getCart === 'loading'), show animated placeholder:
<div class="animate-pulse space-y-3">
  <div class="h-4 rounded bg-slate-200 w-3/4"></div>
  <div class="h-4 rounded bg-slate-200 w-1/2"></div>
</div>

### Error banner
When action state is 'error', show:
<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
  {error message} <button @click=\${() => this.loadInitialData()} class="ml-2 underline">Tentar novamente</button>
</div>

### Empty state (list/table sections)
When items array is empty or count === 0:
<div class="py-10 text-center text-sm text-slate-500">
  {emptyMessage}
</div>

### Organisms guidance (from ## Organisms in the defs)

#### Data tables / item lists
Use a simple <table> with Tailwind:
<table class="w-full text-sm text-left">
  <thead class="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">...</thead>
  <tbody class="divide-y divide-slate-100">
    \${this.{items}.map(item => html\`<tr>...</tr>\`)}
  </tbody>
</table>
For quantity controls use <input type="number"> or +/- buttons wired to handler methods.
For remove actions use a small icon button wired to handler method.

#### Summary / totals card
Use a <dl> description list:
<dl class="space-y-3 text-sm">
  <div class="flex justify-between"><dt class="text-slate-500">Subtotal</dt><dd>\${this.subtotalAmount}</dd></div>
  ...
</dl>

#### CTA / primary action
<button type="button"
  class="mt-4 w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
  ?disabled=\${this.{commandActionState} === 'loading' || this.{items}.length === 0}
  @click=\${this.handle{CommandName}Click}
>
  \${this.{commandActionState} === 'loading' ? 'Aguarde...' : '{actionLabel}'}
</button>

### Handler wiring rules
- Use only handler methods that exist on the base class (handle{CommandName}Click or handle{CommandName}Submit)
- For forms with @submit: <form @submit=\${this.handleXxxSubmit}> ... <button type="submit">
- For simple actions: <button @click=\${this.handleXxxClick}>
- For inline field changes (table row quantity inputs): use arrow function @input=\${(e: Event) => { ... this.handleXxxClick(); }}

### Action state property names
The base class exposes action state properties named after each BFF command:
  @property() {commandName}: 'idle' | 'loading' | 'success' | 'error' = 'idle'
Use these to disable buttons and show busy labels.

---

## Rules
- ONLY three imports: html, customElement, and the base class
- render() is the only method in the class
- All data comes from this.* — never re-fetch or compute derived data inside render()
- Use ${this.msg.xxx} for ALL user-visible text (labels, titles, button text, messages)
  — the msg object is inherited from the base class; assume the base class has all needed keys
- customElementTag comes from ## customElementTag — use it exactly, do not invent one
`;
