/// <mls fileReference="_102020_/l2/agentMaterializeSolution/agentMaterializeDefinition.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { createStorFile, IReqCreateStorFile } from '/_102027_/l2/libStor.js';
import { updateVariableJson } from '/_102027_/l2/defsAST.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentMaterializeDefinition',
    agentProject: 102020,
    agentFolder: 'agentMaterializeSolution',
    agentDescription: 'Expand a page plan .defs.ts into three mat1 specs: shared BFF skill, desktop page spec, and controller contract',
    visibility: 'public',
    beforePromptImplicit,
    beforePromptStep,
    afterPromptStep,
  };
}

// ─── input ────────────────────────────────────────────────────────────────────
// Accepts JSON {"path":"...","moduleName":"..."} or two plain lines: path\nmoduleName

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
    if (typeof path !== 'string' || !path) throw new Error('[agentMaterializeDefinition] missing "path"');
    if (typeof moduleName !== 'string' || !moduleName) throw new Error('[agentMaterializeDefinition] missing "moduleName"');
    return { path, moduleName };
  }
  const lines = trimmed.split(/[\n\r]+/).map(s => s.trim()).filter(Boolean);
  if (!lines[0]) throw new Error('[agentMaterializeDefinition] path is required');
  if (!lines[1]) throw new Error('[agentMaterializeDefinition] moduleName is required');
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
  if (!info) throw new Error(`[agentMaterializeDefinition] cannot resolve: ${mlsPath}`);
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

function block(title: string, content: string | null): string {
  return `## ${title}\n${content ? `\`\`\`ts\n${content}\n\`\`\`` : '_not found_'}`;
}

async function buildHumanPrompt(path: string, moduleName: string): Promise<string> {
  const project = extractProject(path);
  const pageId = extractPageId(path);

  const planSrc = await readStorFile(path);
  if (!planSrc) throw new Error(`[agentMaterializeDefinition] plan file not found: ${path}`);

  const moduleDefs = await readStorFile(`mls-${project}/l5/${moduleName}/module.defs.ts`);
  const rulesDefs  = await readStorFile(`mls-${project}/l5/${moduleName}/rules.defs.ts`);
  const designSys  = await readStorFile(`mls-${project}/l2/designSystem.ts`);

  return [
    `## path\n${path}`,
    `## moduleName\n${moduleName}`,
    `## pageId\n${pageId}`,
    block('Page plan (.defs.ts)', planSrc),
    block('Module definition (l5/module.defs.ts)', moduleDefs),
    block('Module rules (l5/rules.defs.ts)', rulesDefs),
    block('Design system (l2/designSystem.ts)', designSys),
  ].join('\n\n');
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
      taskTitle: `materialize:${extractPageId(path)}`,
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
    const { path, moduleName, pageId } = result;
    if (!path || !moduleName || !pageId) throw new Error('AI response missing path, moduleName or pageId');

    const project = extractProject(path);

    await writeStorFile(
      `mls-${project}/l2/${moduleName}/web/shared/${pageId}.defs.ts`,
      result.sharedBffFile,
    );
    await writeStorFile(
      `mls-${project}/l2/${moduleName}/web/desktop/page11/${pageId}.defs.ts`,
      result.desktopPageFile,
    );
    await writeStorFile(
      `mls-${project}/l1/${moduleName}/layer_2_controllers/${pageId}.defs.ts`,
      result.controllerFile,
    );

    // Inject pipeline into the original plan defs
    const planSrc = await readStorFile(path);
    if (planSrc) {
      const pipeline = buildPipeline(project, moduleName, pageId);
      const updatedPlan = updateVariableJson(planSrc, 'materializeIndex', pipeline);
      await writeStorFile(path, updatedPlan);
    }
  } catch (err) {
    status = 'failed';
    console.error(`[agentMaterializeDefinition](afterPromptStep)`, err);
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

// ─── pipeline ────────────────────────────────────────────────────────────────

function buildPipeline(project: number, moduleName: string, pageId: string): object[] {
  const dt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const controllerDefsRef = `_${project}_/l1/${moduleName}/layer_2_controllers/${pageId}.defs.ts`;
  const sharedDefsRef  = `_${project}_/l2/${moduleName}/web/shared/${pageId}.defs.ts`;
  const desktopDefsRef = `_${project}_/l2/${moduleName}/web/desktop/page11/${pageId}.defs.ts`;

  return [
    {
      id: 'contracts',
      agent: 'agentMaterializeContracts',
      defsPath: controllerDefsRef,
      moduleName,
      outputPath: `_${project}_/l2/${moduleName}/web/contracts/${pageId}.ts`,
      dependsOn: [],
      specUpdatedAt: dt,
    },
    {
      id: 'shared',
      agent: 'agentMaterializePageShared',
      defsPath: sharedDefsRef,
      moduleName,
      outputPath: `_${project}_/l2/${moduleName}/web/shared/${pageId}.ts`,
      dependsOn: ['contracts'],
      specUpdatedAt: dt,
    },
    {
      id: 'page',
      agent: 'agentMaterializePage',
      defsPath: desktopDefsRef,
      moduleName,
      outputPath: `_${project}_/l2/${moduleName}/web/desktop/page11/${pageId}.ts`,
      dependsOn: ['contracts', 'shared'],
      specUpdatedAt: dt,
    },
  ];
}

// ─── output type ──────────────────────────────────────────────────────────────

//#region OutputSection
export type AgentOutput = {
  type: 'flexible';
  result: {
    path: string;
    moduleName: string;
    pageId: string;
    sharedBffFile: string;
    desktopPageFile: string;
    controllerFile: string;
  };
};
//#endregion

// ─── system prompt ────────────────────────────────────────────────────────────

const systemPrompt = `
<!-- modelType: codereasoning -->

You are agentMaterializeDefinition.
You receive a page plan (.defs.ts) and must produce three mat1 specification files.

## Output — return ONLY valid JSON, no markdown fences, no prose outside the JSON

{
  "type": "flexible",
  "result": {
    "path":            "<echo ## path exactly>",
    "moduleName":      "<echo ## moduleName exactly>",
    "pageId":          "<echo ## pageId exactly>",
    "sharedBffFile":   "<full TypeScript source, escaped as single-line JSON string>",
    "desktopPageFile": "<full TypeScript source, escaped as single-line JSON string>",
    "controllerFile":  "<full TypeScript source, escaped as single-line JSON string>"
  }
}

All source values are single-line JSON strings — escape every special character:
  newline → \\n  |  tab → \\t  |  double-quote → \\"  |  backslash → \\\\

---

## sharedBffFile  →  l2/{moduleName}/web/shared/{pageId}.defs.ts

Full TypeScript skill file:

/// <mls fileReference="_{project}_/l2/{moduleName}/web/shared/{pageId}.defs.ts" enhancement="_blank" />
export const skill = \`
# {pageId} — Shared BFF

## Purpose
<what the page does and who uses it>

## Target Genome
device: all
folder: web/shared/

## BFF Commands
<for each bffCommand from the plan:>
### {commandName}
- kind: query | command | mutation
- execBff call: execBff('{moduleName}.{commandName}', input)
- input: <exact shape from bffCommand.input>
- output: <exact shape from bffCommand.output>
- usecase: <usecaseRefs[0]>

## Shared Files
- web/shared/{pageId}.ts — BFF call functions (one function per command)
- web/shared/{pageId}Formatters.ts — display helpers and field formatters

## Page Behaviour
<BFF call sequence on load, on filter/param change, loading state, error state, empty state>

## Important Data
<key fields from BFF output that drive the UI>

## Origins
<paste here the bffCommands array exactly as it appears in the source plan — no changes>
\`;

---

## desktopPageFile  →  l2/{moduleName}/web/desktop/page11/{pageId}.defs.ts

Full TypeScript skill file:

/// <mls fileReference="_{project}_/l2/{moduleName}/web/desktop/page11/{pageId}.defs.ts" enhancement="_blank" />
export const skill = \`
# {pageId} — Desktop layout

## Purpose
<what the page does>

## Target Genome
device: desktop | layout: page11 | folder: web/desktop/page11/

## Layout
<overall page structure: which sections go where in the grid>

## Sections
<for each section from the plan:>
### {sectionName}
- mode: view | edit
- position in layout: <column / row / full-width / etc>

## Organisms
<for each organism inside each section:>
### {organismName} ({sectionName})
- purpose: <from plan>
- design system component: <closest match based on designSystem.ts>
- feeds from: {commandName}
- displays: <readsFields list>
- writes: <writesFields list>
- user actions → handlers: <userActions mapped to event handler names>

## State Model
<per section: loading skeleton, error banner, empty state>

## Navigation
<outbound links from navigationRefs: target pageId and trigger label>

## Origins
<paste here the pageDefinition object exactly as it appears in the source plan — no changes>
\`;

---

## controllerFile  →  l1/{moduleName}/layer_2_controllers/{pageId}.defs.ts

Full TypeScript file with a structured const — one entry per bffCommand:

/// <mls fileReference="_{project}_/l1/{moduleName}/layer_2_controllers/{pageId}.defs.ts" enhancement="_blank" />
export const {pageId}Controllers = {
  schemaVersion: "2026-06-06",
  artifactType: "controllerContract",
  moduleName: "{moduleName}",
  commands: [
    {
      commandName: "{bffCommand.commandName}",
      routeKey: "{moduleName}.{commandName}",
      kind: "query | command | mutation",
      actor: "{pageDefinition.actor}",
      authRequired: true,
      inputShape: <exact copy of bffCommand.input — no field changes>,
      outputShape: <exact copy of bffCommand.output — no field changes>,
      usecaseBinding: "{bffCommand.usecaseRefs[0]}",
      layerContract: {
        mustCallLayer: "layer_3_usecases",
        directTableAccessForbidden: true
      }
    }
  ]
} as const;

export default {pageId}Controllers;

Rules for controllerFile:
- One command entry per bffCommand in the plan — no more, no less
- inputShape and outputShape are exact copies — do not add, remove or rename fields
- layerContract is always the fixed value shown above
- authRequired is true unless actor is explicitly anonymous or public

---

## General rules
- Use the same natural language as the plan for user-facing labels and descriptions
- Use English camelCase for all TypeScript identifiers
- The project number in fileReference comes from the ## path header (e.g. mls-102030 → 102030)
`;
