/// <mls fileReference="_102020_/l2/agentMaterializeSolution/agentMaterializeContracts.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { createStorFile, IReqCreateStorFile } from '/_102027_/l2/libStor.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentMaterializeContracts',
    agentProject: 102020,
    agentFolder: 'agentMaterializeSolution',
    agentDescription: 'Generate web/contracts/{pageId}.ts TypeScript interfaces from a web/shared/{pageId}.defs.ts skill file',
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
    if (typeof path !== 'string' || !path) throw new Error('[agentMaterializeContracts] missing "path"');
    if (typeof moduleName !== 'string' || !moduleName) throw new Error('[agentMaterializeContracts] missing "moduleName"');
    return { path, moduleName };
  }
  const lines = trimmed.split(/[\n\r]+/).map(s => s.trim()).filter(Boolean);
  if (!lines[0]) throw new Error('[agentMaterializeContracts] path is required');
  if (!lines[1]) throw new Error('[agentMaterializeContracts] moduleName is required');
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

function toContractsPath(sharedDefsPath: string, moduleName: string): string {
  const project = extractProject(sharedDefsPath);
  const pageId = extractPageId(sharedDefsPath);
  return `mls-${project}/l2/${moduleName}/web/contracts/${pageId}.ts`;
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
  if (!info) throw new Error(`[agentMaterializeContracts] cannot resolve: ${mlsPath}`);
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
  if (!defsSrc) throw new Error(`[agentMaterializeContracts] defs file not found: ${path}`);

  const project = extractProject(path);
  const pageId = extractPageId(path);
  const outputPath = toContractsPath(path, moduleName);

  return `## path
${path}

## moduleName
${moduleName}

## pageId
${pageId}

## outputPath
${outputPath}

## fileReference
_${project}_/l2/${moduleName}/web/contracts/${pageId}.ts

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
      taskTitle: `contracts:${extractPageId(path)}`,
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
    const { path, moduleName, srcFile } = result;
    if (!path || !moduleName || !srcFile) throw new Error('AI response missing required fields');

    await writeStorFile(toContractsPath(path, moduleName), srcFile);

  } catch (err) {
    status = 'failed';
    console.error(`[agentMaterializeContracts](afterPromptStep)`, err);
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

You are agentMaterializeContracts.
You receive a shared BFF skill file (web/shared/{pageId}.defs.ts) and generate
the TypeScript contracts file web/contracts/{pageId}.ts.

The contracts file contains ONLY exported TypeScript interfaces — no logic, no classes, no functions.

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

/// <mls fileReference="<## fileReference>" enhancement="_blank" />

### 2. One blank line, then the interfaces — no other content

---

## Interface naming convention

Prefix ALL interface names with {ModuleNamePascalCase} (e.g. PetShopStripe, Locadora).

### Output / response interfaces

Name by entity: {ModuleNamePascalCase}{EntityNamePascalCase}Response
- Entity name comes from the top-level key in the output shape (e.g. output.cart → Cart → PetShopStripeCartResponse)
- If the output has nested array items with their own fields, extract a separate interface:
  {ModuleNamePascalCase}{EntityNamePascalCase}ItemResponse
- If two commands return the same entity shape, declare ONE interface and reuse it

### Input / request interfaces

Name by command: {ModuleNamePascalCase}{CommandNamePascalCase}Input
- One interface per BFF command that has a non-trivial input shape
- If the input has nested objects with multiple fields, inline them as anonymous object types
  (do NOT create separate interfaces for small nested shapes — only extract if reused)

---

## Type mapping from JSON schema strings

Map the string descriptions in the Origins bffCommands to TypeScript types:
  "string"           → string
  "number"           → number
  "boolean"          → boolean
  "string?"  / key?  → optional field (use ?)
  "value1|value2"    → 'value1' | 'value2'  (string literal union)
  [...] array        → Array<ElementType> or ElementType[]
  nested { }         → inline object type or extracted interface

Field optionality: if the original key ends with ? (e.g. "cartId?": "string"), the field is optional.

---

## Ordering

1. Response interfaces first (output shapes), deepest/smallest first
   — e.g. CartItemResponse before CartResponse (so CartResponse can reference it)
2. Input interfaces after (one per command, in the order they appear in bffCommands)

---

## Example — for a cartPage with getCart / updateCart / startCheckout

/// <mls fileReference="_102030_/l2/petShopStripe/web/contracts/cartPage.ts" enhancement="_blank" />

export interface PetShopStripeCartItemResponse {
  itemId: string;
  productId?: string;
  serviceId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PetShopStripeCartResponse {
  cartId: string;
  status: string;
  currency: string;
  itemsCount: number;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  items: PetShopStripeCartItemResponse[];
}

export interface PetShopStripeOrderSummaryResponse {
  orderId: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
}

export interface PetShopStripeGetCartInput {
  cartContext?: { cartId?: string };
  include: { items: boolean; totals: boolean };
}

export interface PetShopStripeUpdateCartInput {
  cartContext?: { cartId?: string };
  changes: {
    items: Array<{
      itemId?: string;
      productId?: string;
      serviceId?: string;
      quantity?: number;
      action: 'updateQuantity' | 'remove';
    }>;
  };
}

export interface PetShopStripeStartCheckoutInput {
  cartContext?: { cartId?: string };
  deliveryContact?: { phone?: string; email?: string };
  deliveryAddress?: {
    addressId?: string;
    street?: string;
    number?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
}

---

## Rules
- No logic, no classes, no functions — interfaces only
- No imports from other files
- Every field in every BFF command input and output shape must appear in some interface
- Do not duplicate interface definitions — if two commands share the same output entity shape, one interface
- Use the ## Origins bffCommands array as the authoritative source of shapes (it is the exact JSON from the plan)
- Use the ## BFF Commands section for naming hints (command names, usecase refs)
`;
