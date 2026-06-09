/// <mls fileReference="_102020_/l2/agentMaterializeSolution/agentL2MaterializeDefinition.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { createStorFile, IReqCreateStorFile } from '/_102027_/l2/libStor.js';
import { updateVariableJson } from '/_102027_/l2/defsAST.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentL2MaterializeDefinition',
    agentProject: 102020,
    agentFolder: 'agentMaterializeSolution',
    agentDescription: 'Split a page plan into three defs files and start L2 materialization',
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
  await mls.stor.localStor.setContent(sf, { contentType: 'string', content: src });
}

// ─── template builders ────────────────────────────────────────────────────────

function buildPageDefsFile(fileRef: string, pageSpecJson: string, sharedRef: string): string {
  const bt = '`';
  const bt3 = '\\\`\\\`\\\`';
  return (
    `/// <mls fileReference="${fileRef}"  enhancement="_blank"/>\n` +
    `export const skill = ${bt}\n` +
    `## Pages spec\n` +
    `${bt3}JSON\n` +
    `${pageSpecJson}\n` +
    `${bt3}\n` +
    `\n` +
    `## Base Class\n` +
    `${bt3}JSON\n` +
    `    [[(${sharedRef})]]\n` +
    `${bt3}\n` +
    `${bt};\n`
  );
}

function buildSharedDefsFile(fileRef: string, commandsJson: string, contractsRef: string): string {
  const bt = '`';
  const bt3 = '\\\`\\\`\\\`';
  return (
    `/// <mls fileReference="${fileRef}"  enhancement="_blank"/>\n` +
    `export const skill = ${bt}\n` +
    `## Pages spec\n` +
    `${bt3}JSON\n` +
    `${commandsJson}\n` +
    `${bt3}\n` +
    `\n` +
    `## Contracts\n` +
    `${bt3}JSON\n` +
    `    [[(${contractsRef})]]\n` +
    `${bt3}\n` +
    `${bt};\n`
  );
}

function buildContractDefsFile(fileRef: string, commandsJson: string): string {
  const bt = '`';
  const bt3 = '\\\`\\\`\\\`';
  return (
    `/// <mls fileReference="${fileRef}"  enhancement="_blank"/>\n` +
    `export const skill = ${bt}\n` +
    `## Pages spec\n` +
    `${bt3}JSON\n` +
    `${commandsJson}\n` +
    `${bt3}\n` +
    `${bt};\n`
  );
}

// ─── prompt builder ───────────────────────────────────────────────────────────

async function buildHumanPrompt(path: string, moduleName: string): Promise<string> {
  const pageId = extractPageId(path);
  const planSrc = await readStorFile(path);
  if (!planSrc) throw new Error(`[agentMaterializeDefinition] plan file not found: ${path}`);

  return [
    `## path\n${path}`,
    `## moduleName\n${moduleName}`,
    `## pageId\n${pageId}`,
    `## Plan source\n\`\`\`ts\n${planSrc}\n\`\`\``,
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
      longTermMemory: { moduleName },
    },
  };

  return [addMessageAI];
}

// ─── beforePromptStep ─────────────────────────────────────────────────────────

async function beforePromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  _step: mls.msg.AIAgentStep,
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
    const { path, moduleName, pageId, commandsJson, pageSpecJson } = result;
    if (!path || !moduleName || !pageId) throw new Error('AI response missing path, moduleName or pageId');

    const project = extractProject(path);

    const contractDefsRef = `_${project}_/l1/${moduleName}/layer_2_controllers/${pageId}.defs.ts`;
    const sharedDefsRef = `_${project}_/l2/${moduleName}/web/shared/${pageId}.defs.ts`;
    const pageDefsRef = `_${project}_/l2/${moduleName}/web/desktop/page11/${pageId}.defs.ts`;
    const sharedRef = `_${project}_/l2/${moduleName}/web/shared/${pageId}.ts`;
    const contractsRef = `_${project}_/l2/${moduleName}/web/contracts/${pageId}.ts`;

    await writeStorFile(
      `_${project}_/l2/${moduleName}/web/desktop/page11/${pageId}.defs.ts`,
      buildPageDefsFile(pageDefsRef, pageSpecJson, sharedRef),
    );
    await writeStorFile(
      `_${project}_/l2/${moduleName}/web/shared/${pageId}.defs.ts`,
      buildSharedDefsFile(sharedDefsRef, commandsJson, contractsRef),
    );
    await writeStorFile(
      `_${project}_/l1/${moduleName}/layer_2_controllers/${pageId}.defs.ts`,
      buildContractDefsFile(contractDefsRef, commandsJson),
    );

    const key = mls.stor.getKeyToFile({ project: mls.actualProject || 0, level: 2, folder: moduleName, shortName: 'module', extension: '.ts' });
    if (!mls.stor.files[key]) await generateInfoModule(moduleName);

    let planSrc = await readStorFile(path);
    if (planSrc) {
      const idx = planSrc.indexOf('export default ');
      if (idx > 0) planSrc = planSrc.slice(0, idx);
      planSrc = planSrc.replace(/as const/g, '');
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

  if (status === 'failed') return [updateStatus];

  const payload = step.interaction?.payload?.[0];
  const path = (payload?.type === 'flexible' && payload.result?.path) ? payload.result.path as string : '';

  const newStep: mls.msg.AgentIntentAddStep = {
    type: 'add-step',
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    parentStepId: parentStep.stepId,
    step: {
      type: 'agent',
      stepId: 0,
      interaction: null,
      status: 'waiting_human_input',
      nextSteps: [],
      agentName: 'agentL2Materialize',
      prompt: path,
      rags: [],
    },
  };

  return [newStep];
}

// ─── pipeline ─────────────────────────────────────────────────────────────────

function buildPipeline(project: number, moduleName: string, pageId: string): object[] {
  const dt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const contractDefsRef = `_${project}_/l1/${moduleName}/layer_2_controllers/${pageId}.defs.ts`;
  const sharedDefsRef = `_${project}_/l2/${moduleName}/web/shared/${pageId}.defs.ts`;
  const pageDefsRef = `_${project}_/l2/${moduleName}/web/desktop/page11/${pageId}.defs.ts`;

  return [
    {
      id: 'contract',
      agent: 'agentL2MaterializeContract',
      defsPath: contractDefsRef,
      skillPath: '_102020_/l2/agentMaterializeSolution/skills/genContract.ts',
      moduleName,
      outputPath: `_${project}_/l2/${moduleName}/web/contracts/${pageId}.ts`,
      dependsOn: [],
      specUpdatedAt: dt,
    },
    {
      id: 'shared',
      agent: 'agentL2MaterializeSharedPage',
      defsPath: sharedDefsRef,
      moduleName,
      outputPath: `${pageId}.ts`,
      dependsOn: ['contract'],
      specUpdatedAt: dt,
    },
    {
      id: 'page',
      agent: 'agentL2MaterializePageLit',
      defsPath: pageDefsRef,
      moduleName,
      outputPath: `${pageId}.ts`,
      dependsOn: ['contract', 'shared'],
      specUpdatedAt: dt,
    },
  ];
}

// ─── module generator ─────────────────────────────────────────────────────────

async function generateInfoModule(moduleName: string) {
  const src = `/// <mls fileReference="_${mls.actualProject}_/l2/${moduleName}/module.ts" enhancement="_blank" />
import type { AuraModuleFrontendDefinition, IPaths, IGenomeConfig } from '/_102029_/l2/contracts/bootstrap.js';

export const moduleGenome: Record<string, IGenomeConfig> = {
  'web/desktop/page11': {
    designSystem: 'default',
    device: 'desktop',
    layout: 'standard',
  }
} as const;

export const skills: IPaths = {
  web: {
    sharedPath: '/_${mls.actualProject}_/l2/${moduleName}/web/shared',
    sharedSkill: '/_102020_/l2/agentMaterializeSolution/skills/genPageShared.ts'
  }
}

export const moduleStates = {
} as const;

export const moduleShellPreferences = {
  layout: {
    asideMode: {
      desktop: 'inline',
      mobile: 'fullscreen',
    },
  },
} as const;

export const moduleFrontendDefinition: AuraModuleFrontendDefinition = {
  pageTitle: '${moduleName}',
  device: 'desktop',
  navigation: [],
  routes: [],
};
`;
  await saveFile(`_${mls.actualProject}_/l2/${moduleName}/module.ts`, src);
}

async function saveFile(ref: string, src: string) {
  const info = mls.stor.convertFileReferenceToFile(ref);
  const k = mls.stor.getKeyToFile(info);
  let sf = mls.stor.files[k];
  if (!sf) {
    const param: IReqCreateStorFile = { ...info, source: src };
    sf = await createStorFile(param, true, true, true);
  } else {
    const m = await sf.getOrCreateModel();
    if (m && m.model) m.model.setValue(src);
  }
  await mls.stor.localStor.setContent(sf, { contentType: 'string', content: src });
}

// ─── output type ──────────────────────────────────────────────────────────────

//#region OutputSection
export type AgentOutput = {
  type: 'flexible';
  result: {
    path: string;
    moduleName: string;
    pageId: string;
    commandsJson: string;  // JSON string of the BFF commands array (Origins[])
    pageSpecJson: string;  // JSON string of the page spec object (sections/organisms)
  };
};
//#endregion

// ─── system prompt ────────────────────────────────────────────────────────────

const systemPrompt = `
<!-- modelType: mini -->
<!-- modelTypeList: geminiChat (2.5 pro), code (grok), deepseekchat, codeflash (gemini), deepseekreasoner, mini (4.1) ou nano (openai), codeinstruct (4.1), codereasoning(gpt5), code2 (kimi 2.5) -->

You are agentL2MaterializeDefinition.
You receive a page plan source file and must extract two JSON payloads from it.

## Your only job

Read the plan source in ## Plan source and extract:

1. **commandsJson** — the array that describes BFF commands (the Origins commands list).
   It is an array of objects, each with fields like: commandName, kind, input, output, purpose, readsEntities, writesEntities, usecaseRefs, layerContract, rulesApplied.
   Find the exported const that holds this array and return its value as a compact JSON string.

2. **pageSpecJson** — the object that describes the page structure (sections and organisms).
   It is an object with fields like: pageId, pageName, actor, purpose, sections, navigationRefs, capabilities, flowRefs.
   Find the exported const that holds this object and return its value as a compact JSON string.

If either is not found in the source, return an empty array \`[]\` or empty object \`{}\` for that field.

## Output — return ONLY valid JSON, no markdown fences, no prose

{
  "type": "flexible",
  "result": {
    "path":         "<echo ## path exactly>",
    "moduleName":   "<echo ## moduleName exactly>",
    "pageId":       "<echo ## pageId exactly>",
    "commandsJson": "<compact JSON string of the BFF commands array>",
    "pageSpecJson": "<compact JSON string of the page spec object>"
  }
}

Both commandsJson and pageSpecJson must be valid compact JSON strings (no pretty-printing, no trailing commas).
Escape any double-quotes inside them with \\" and any backslashes with \\\\.
`;
