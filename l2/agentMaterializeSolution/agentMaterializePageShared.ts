/// <mls fileReference="_102020_/l2/agentMaterializeSolution/agentMaterializePageShared.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { createStorFile, IReqCreateStorFile } from '/_102027_/l2/libStor.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentMaterializePageShared',
    agentProject: 102020,
    agentFolder: 'agentMaterializeSolution',
    agentDescription: 'Generate web/shared/{pageId}.ts (state + BFF class) from a web/shared/{pageId}.defs.ts skill file',
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
    if (typeof path !== 'string' || !path) throw new Error('[agentMaterializePageShared] missing "path"');
    if (typeof moduleName !== 'string' || !moduleName) throw new Error('[agentMaterializePageShared] missing "moduleName"');
    return { path, moduleName };
  }
  const lines = trimmed.split(/[\n\r]+/).map(s => s.trim()).filter(Boolean);
  if (!lines[0]) throw new Error('[agentMaterializePageShared] path is required');
  if (!lines[1]) throw new Error('[agentMaterializePageShared] moduleName is required');
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
  if (!info) throw new Error(`[agentMaterializePageShared] cannot resolve: ${mlsPath}`);
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
  if (!defsSrc) throw new Error(`[agentMaterializePageShared] defs file not found: ${path}`);

  const project = extractProject(path);
  const pageId = extractPageId(path);

  return `## path
${path}

## moduleName
${moduleName}

## pageId
${pageId}

## outputPath
mls-${project}/l2/${moduleName}/web/shared/${pageId}.ts

## contractsImportPath
/_${project}_/l2/${moduleName}/web/contracts/${pageId}.js

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
      taskTitle: `shared:${extractPageId(path)}`,
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
    const { path, moduleName, pageId, srcFile } = result;
    if (!path || !moduleName || !pageId || !srcFile) throw new Error('AI response missing required fields');

    const project = extractProject(path);
    await writeStorFile(`mls-${project}/l2/${moduleName}/web/shared/${pageId}.ts`, srcFile);

  } catch (err) {
    status = 'failed';
    console.error(`[agentMaterializePageShared](afterPromptStep)`, err);
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

You are agentMaterializePageShared.
You receive a page skill file (web/shared/{pageId}.defs.ts) and generate the TypeScript base class
web/shared/{pageId}.ts that manages state and calls the BFF.

## Output — return ONLY valid JSON, no markdown fences, no prose outside the JSON

{
  "type": "flexible",
  "result": {
    "path":      "<echo ## path exactly>",
    "moduleName":"<echo ## moduleName exactly>",
    "pageId":    "<echo ## pageId exactly>",
    "srcFile":   "<full TypeScript source — escaped as single-line JSON string>"
  }
}

srcFile must be a single-line JSON string — escape every special character:
  newline → \\n  |  tab → \\t  |  double-quote → \\"  |  backslash → \\\\

---

## File to generate — web/shared/{pageId}.ts

### 1. File header

/// <mls fileReference="_{project}_/l2/{moduleName}/web/shared/{pageId}.ts" enhancement="_102027_/l2/enhancementLit.ts" />

Project number comes from ## path (e.g. mls-102030 → 102030).

### 2. Imports (in this order)

import { CollabLitElement } from '/_102029_/l2/collabLitElement.js';
import { property } from 'lit/decorators.js';
import type { AuraNormalizedError } from '/_102029_/l2/contracts/bootstrap.js';
import type { BffClientOptions } from '/_102029_/l2/bffClient.js';
import { execBff } from '/_102029_/l2/bffClient.js';
import {
  bindExpectedNavigationLoad,
  consumeExpectedNavigationLoad,
  runBlockingUiAction,
} from '/_102029_/l2/interactionRuntime.js';
import {
  subscribe,
  unsubscribe,
  getState,
  setState,
  initState,
} from '/_102029_/l2/collabState.js';
import type {
  <TypeNames>
} from '<## contractsImportPath>';

Contract type names follow the convention:
  {ModuleNamePascalCase}{CommandNamePascalCase}Input   — for each bffCommand.input shape
  {ModuleNamePascalCase}{CommandNamePascalCase}Output  — for each bffCommand.output shape (query)
  {ModuleNamePascalCase}{CommandNamePascalCase}Result  — for each bffCommand.output shape (command)

### 3. i18n block

/// **collab_i18n_start**
const message_pt = { ... };
const message_en = { ... };
type MessageType = typeof message_en;
const messages: { [key: string]: MessageType } = { en: message_en, pt: message_pt };
/// **collab_i18n_end**

Generate messages for:
- brand, pageTitle, pageSubtitle (from Purpose in the skill file)
- loading{EntityName}: 'Carregando...' — for each query command (loading state message)
- couldNotLoad: ... — generic load error
- reload: 'Recarregar'
- For each command: {commandName}: 'Executar', {commandName}ing: 'Executando...', couldNot{CommandName}: '...', {commandName}Successfully: '...'
- Label fields: label{FieldName}: '...' — one per relevant field from output shapes
- statusReady: 'Pronto.'
Always generate both pt and en. Use the page's natural language (from Purpose/Origins) for pt.

### 4. Class — {ModuleNamePascalCase}{PageIdPascalCase}Base extends CollabLitElement

#### 4a. _stateKeys

private readonly _stateKeys = [
  // One 'db.{entity}.{field}' per output field of each query command
  // e.g. query returns { cart: { cartId, status, items[] } } → 'db.cart.cartId', 'db.cart.status', 'db.cart.items'
  //
  // One 'ui.{pageId}.{field}' for transient UI state (formDirty, activeTab, etc.)
  //
  // One '*ui.{pageId}.{commandName}' per BFF command (the * prefix marks it as an action state)
] as const;

Key rules:
- db keys come from BFF query output shapes — one key per leaf field (arrays count as one key holding the array)
- '*ui.{pageId}.{commandName}' for EVERY command (queries included — covers loading state)
- Derive entity name from the top-level key in the output shape (e.g. output.cart → entity 'cart')

#### 4b. @property() declarations

One @property() per state key:
- db keys → typed property matching the output shape field type (string, number, boolean, any[], etc.), initialized to '' / 0 / false / []
- *ui action keys → 'idle' | 'loading' | 'success' | 'error', initialized to 'idle'
- ui keys → appropriate type with sensible default
- @property() status: string = ''  — always present

#### 4c. createRenderRoot()

createRenderRoot() { return this; }

#### 4d. connectedCallback()

connectedCallback() {
  super.connectedCallback();

  const pendingLoad = consumeExpectedNavigationLoad();
  const task = this.loadInitialData(undefined, { mode: 'silent', signal: pendingLoad?.signal });
  bindExpectedNavigationLoad(pendingLoad, task);
  void task.catch(() => undefined);

  const lang: string = this.getMessageKey(messages);
  this.msg = messages[lang] || messages['en'];

  // initState for every ui.* key (not db.* and not *ui.* action keys)
  // e.g. initState('ui.{pageId}.formDirty', false);

  subscribe(this._stateKeys as unknown as string[], this);

  (this._stateKeys as unknown as string[]).forEach((key) => {
    const k = key.startsWith('*') ? key.slice(1) : key;
    const v = getState(k);
    if (v !== undefined) this.handleIcaStateChange(k, v);
  });

  if (!this.status) this.status = this.msg.statusReady;
}

#### 4e. disconnectedCallback()

disconnectedCallback() {
  super.disconnectedCallback();
  unsubscribe(this._stateKeys as unknown as string[], this);
}

#### 4f. handleIcaStateChange(key, value)

Switch/case for every state key (strip leading * for action keys).
Map each key to its @property() field.

#### 4g. loadInitialData

async loadInitialData(_params?: undefined, options?: BffClientOptions): Promise<void>

Calls every query command in sequence:
- Sets this.status = this.msg.loading{Entity}
- Sets setState('*ui.{pageId}.{commandName}', 'loading')  — note: no * in setState, key without prefix
- Calls execBff then distributes response fields into setState('db.{entity}.{field}', value) for each field
- Also updates the matching @property() directly so UI reacts immediately
- On success: setState('*ui.{pageId}.{commandName}', 'success')
- On error: setState('*ui.{pageId}.{commandName}', 'error'), this.status = this.msg.couldNotLoad, throws

Always has the mock guard:
  if ((window as any).mls) {
    console.log('[mls mock] {moduleName}.{pageId}.loadInitialData');
    this.status = this.msg.statusReady;
    return;
  }

#### 4h. One async method per non-query BFF command

async {commandName}(params: {ModuleNamePascalCase}{CommandNamePascalCase}Input, signal?: AbortSignal): Promise<void> {
  setState('ui.{pageId}.{commandName}', 'loading');
  try {
    const options: BffClientOptions | undefined = signal ? { mode: 'blocking', signal } : { mode: 'blocking' };

    if ((window as any).mls) {
      console.log('[mls mock] {moduleName}.{commandName}', params);
      this.status = this.msg.{commandName}Successfully;
      setState('ui.{pageId}.{commandName}', 'success');
      return;
    }

    const response = await execBff<{ModuleNamePascalCase}{CommandNamePascalCase}Result>(
      '{moduleName}.{commandName}',
      params,
      options,
    );
    if (!response.ok || !response.data) {
      const err = (response.error ?? {
        code: 'UNEXPECTED_ERROR',
        message: this.msg.couldNot{CommandName},
      }) satisfies AuraNormalizedError;
      setState('ui.{pageId}.{commandName}', 'error');
      throw err;
    }

    // distribute response fields into setState + this.property for each field in outputShape
    const data = response.data;
    // e.g. this.cartId = data.cart.cartId; setState('db.cart.cartId', data.cart.cartId);

    this.status = this.msg.{commandName}Successfully;
    setState('ui.{pageId}.{commandName}', 'success');
  } catch (e) {
    setState('ui.{pageId}.{commandName}', 'error');
    throw e;
  }
}

Note: setState key for action states does NOT have the * prefix (initState/setState use the plain key; the * in _stateKeys is only used for subscribe/unsubscribe).

#### 4i. Handler method per non-query command

Use handleXxxSubmit(event: SubmitEvent) for form-based commands (ones with many input fields):
  event.preventDefault();
  const params: ... = { ... from this.properties ... };
  void runBlockingUiAction(
    async (signal) => { await this.{commandName}(params, signal); },
    { busyLabel: this.msg.{commandName}ing, errorTitle: this.msg.couldNot{CommandName}, retry: () => this.{commandName}(params) },
  );

Use handleXxxClick() for simple action commands (few or no inputs):
  const params: ... = { ... };
  void runBlockingUiAction(
    async (signal) => { await this.{commandName}(params, signal); },
    { busyLabel: this.msg.{commandName}ing, errorTitle: this.msg.couldNot{commandName}, retry: () => this.{commandName}(params) },
  );

#### 4j. protected msg

protected msg: MessageType = messages['en'];

---

## Rules
- setState for action states uses the key WITHOUT the * prefix (e.g. 'ui.cartPage.updateCart', not '*ui.cartPage.updateCart')
- _stateKeys uses * prefix only to signal to subscribe() that this key should trigger immediate re-read on connect
- Every field in every BFF output shape gets a corresponding db.* state key and @property()
- Array fields (e.g. cart.items) become @property() cartItems: any[] = [] and one state key db.cart.items
- Import type names follow {ModuleNamePascalCase}{CommandNamePascalCase}Input / Output / Result
- Class name: {ModuleNamePascalCase}{PageIdPascalCase}Base
- Use the same natural language as the skill file for all user-facing message strings
`;
