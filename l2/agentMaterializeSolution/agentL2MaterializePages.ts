/// <mls fileReference="_102020_/l2/agentMaterializeSolution/agentL2MaterializePages.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { IFileInfoBase } from '/_102020_/l2/utils.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentL2MaterializePages',
    agentProject: 102020,
    agentFolder: 'agentMaterializeSolution',
    agentDescription: 'Find all .defs.ts files in a module and trigger agentL2MaterializeDefinition for each',
    visibility: 'public',
    beforePromptImplicit,
    beforePromptStep,
    afterPromptStep,
  };
}

// ─── input ────────────────────────────────────────────────────────────────────

interface AgentInput {
  moduleName: string;
}

function parseInput(raw: string): AgentInput {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const moduleName = parsed['moduleName'];
    if (typeof moduleName !== 'string' || !moduleName) throw new Error('[agentL2MaterializePages] missing "moduleName"');
    return { moduleName };
  }
  const line = trimmed.split(/[\n\r]+/).map(s => s.trim()).filter(Boolean)[0];
  if (!line) throw new Error('[agentL2MaterializePages] moduleName is required');
  return { moduleName: line };
}

// ─── file scanner ─────────────────────────────────────────────────────────────

function scanDefsFiles(moduleName: string): string[] {
  const files: Record<string, IFileInfoBase> = mls.stor.files;
  const paths: string[] = [];
  for (const key of Object.keys(files)) {
    const file = files[key];
    if (file.level === 2 && file.extension === '.defs.ts' && file.folder === moduleName && file.project === mls.actualProject && !['module', 'index'].includes(file.shortName)) {
      paths.push(`_${file.project}_/l2/${file.folder}/${file.shortName}${file.extension}`);
    }
  }
  return paths;
}

// ─── beforePromptImplicit ─────────────────────────────────────────────────────

async function beforePromptImplicit(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  userPrompt: string,
): Promise<mls.msg.AgentIntent[]> {
  const { moduleName } = parseInput(userPrompt);
  const defsPaths = scanDefsFiles(moduleName);

  if (defsPaths.length === 0) throw new Error(`[agentL2MaterializePages] no .defs.ts files found for module: ${moduleName}`);

  const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
    type: 'add-message-ai',
    request: {
      action: 'addMessageAI',
      agentName: agent.agentName,
      inputAI: [
        { type: 'system', content: systemPrompt },
        { type: 'human', content: JSON.stringify({ moduleName, defsPaths }) },
      ],
      taskTitle: `materialize-pages:${moduleName}`,
      threadId: context.message.threadId,
      userMessage: userPrompt,
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

  const { moduleName } = parseInput(args);
  const defsPaths = scanDefsFiles(moduleName);

  const promptReady: mls.msg.AgentIntentPromptReady = {
    type: 'prompt_ready',
    args,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    hookSequential,
    parentStepId: parentStep.stepId,
    humanPrompt: JSON.stringify({ moduleName, defsPaths }),
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
  const newSteps: mls.msg.AgentIntentAddStep[] = [];

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

  try {
    const moduleName = context.task?.iaCompressed?.longMemory['moduleName'] as string;
    if (!moduleName) throw new Error('[agentL2MaterializePages] missing moduleName in longMemory');

    const defsPaths = scanDefsFiles(moduleName);
    if (defsPaths.length === 0) throw new Error(`[agentL2MaterializePages] no .defs.ts files found for module: ${moduleName}`);

    for (const path of defsPaths) {
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
          agentName: 'agentL2MaterializeDefinition',
          prompt: JSON.stringify({ moduleName, path }),
          rags: [],
        },
      };
      newSteps.push(newStep);
    }
  } catch (err) {
    updateStatus.status = 'failed';
    console.error(`[agentL2MaterializePages](afterPromptStep)`, err);
    return [updateStatus];
  }

  return [...newSteps];
}

// ─── system prompt ────────────────────────────────────────────────────────────

const systemPrompt = `
<!-- modelType: nano -->

Return the same content passed.

## Output format
Return ONLY valid JSON, no markdown fences, no prose.

{
  "type": "flexible",
  "result": {
    "moduleName": "<echo moduleName>",
    "defsPaths": ["<echo each path from defsPaths array>"]
  }
}
`;

//#region OutputSection
export type AgentOutput = {
  type: 'flexible';
  result: {
    moduleName: string;
    defsPaths: string[];
  };
};
//#endregion
