/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanUsecaseDefinition.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PlannerOutput,
  assertArray,
  assertRecord,
  assertString,
  createPlannerPromptReadyIntent,
  createPlannerVariableToolSchema,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  getPlannerOutputsWithFileFallback,
  reconcileParallelDynamicFanOut,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { readSavedPlanArtifactDataList, saveNewSolutionAgentTracePayload, saveNewSolutionPlanArtifacts } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { getPlanUsecaseEntitiesOutput } from '/_102020_/l2/agentNewSolution/agentPlanUsecaseEntities.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentPlanUsecaseDefinition',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Detail one usecase command signatures (input/output)',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const PLAN_USECASE_DEFINITION_TOOL_NAME = 'submitUsecaseDefinitionPlan';
export const PLAN_USECASE_DEFINITION_STEP_ID = 'plan-usecase-definition';
const PLAN_USECASE_DEFINITION_ALIASES = [PLAN_USECASE_DEFINITION_STEP_ID, 'plan-usecase-definition:parallel'];

export interface UsecaseCommandField {
  name: string;
  type: string;
  required?: boolean;
}

export interface UsecaseCommand {
  commandId: string;
  input: UsecaseCommandField[];
  output: UsecaseCommandField[];
}

export interface PlanUsecaseDefinitionResult {
  usecaseDefinition: {
    usecaseId: string;
    commands: UsecaseCommand[];
  };
}

export type PlanUsecaseDefinitionOutput = PlannerOutput<PlanUsecaseDefinitionResult>;

const planUsecaseDefinitionToolSchema = createPlannerVariableToolSchema(
  PLAN_USECASE_DEFINITION_TOOL_NAME,
  'Submit the command signatures (input/output) for one usecase.',
  {
    type: 'object',
    additionalProperties: false,
    required: ['usecaseDefinition'],
    properties: {
      usecaseDefinition: {
        type: 'object',
        additionalProperties: false,
        required: ['usecaseId', 'commands'],
        properties: {
          usecaseId: { type: 'string' },
          commands: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['commandId', 'input', 'output'],
              properties: {
                commandId: { type: 'string' },
                input: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['name', 'type', 'required'],
                    properties: {
                      name: { type: 'string' },
                      type: { type: 'string' },
                      required: { type: 'boolean' },
                    },
                  },
                },
                output: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['name', 'type'],
                    properties: {
                      name: { type: 'string' },
                      type: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }
);

async function beforePromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
  args?: string,
): Promise<mls.msg.AgentIntent[]> {
  if (!agent || !step) throw new Error('[agentPlanUsecaseDefinition](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) usecase selector args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const index = getPlanUsecaseEntitiesOutput(context);
  const usecaseItem = (index.result.usecases as Record<string, unknown>[]).find(u => u && u.usecaseId === args);
  if (!usecaseItem) throw new Error(`[${agent.agentName}](beforePromptStep) usecase selector not found: ${args}`);

  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(PLAN_USECASE_DEFINITION_TOOL_NAME),
      buildHumanPrompt(args, usecaseItem, index.result.backendArchitecture),
      planUsecaseDefinitionToolSchema,
      PLAN_USECASE_DEFINITION_TOOL_NAME
    ),
  ];
}

async function afterPromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
): Promise<mls.msg.AgentIntent[]> {
  let status: mls.msg.AIStepStatus = 'completed';
  let traceMsg: string | undefined;
  let output: PlanUsecaseDefinitionOutput | undefined;
  const selector = getUsecaseSelector(step);

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    output = extractPlanUsecaseDefinitionOutput(payload);
    // The selector (from the usecase index) is authoritative — coerce a slipped id to it.
    if (selector && output.result.usecaseDefinition.usecaseId !== selector) {
      console.warn(`[${agent.agentName}](afterPromptStep) coercing usecaseId '${output.result.usecaseDefinition.usecaseId}' to selector '${selector}'`);
      output.result.usecaseDefinition.usecaseId = selector;
    }
    validatePlanUsecaseDefinitionOutput(output, selector);
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentPlanUsecaseDefinition returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentPlanUsecaseDefinition returned status needs_input; keeping usecase definition draft.';
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);

  let cleaner: 'input' | 'input_output' | undefined;
  if (status === 'completed' && output) {
    const saved = await saveNewSolutionPlanArtifacts(context, agent.agentName, step, output);
    cleaner = saved.length > 0 ? 'input_output' : 'input';
  }

  const reconcileIntents = await buildUsecaseFanOutReconcileIntents(context, parentStep, step, hookSequential);
  return [...reconcileIntents, createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, cleaner)];
}

async function buildUsecaseFanOutReconcileIntents(
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
): Promise<mls.msg.AgentIntent[]> {
  try {
    const expectedSelectors = (getPlanUsecaseEntitiesOutput(context).result.usecases as Record<string, unknown>[])
      .map(u => (u && typeof u.usecaseId === 'string') ? u.usecaseId : '')
      .filter(Boolean);
    const savedSelectors = new Set<string>();
    for (const data of await readSavedPlanArtifactDataList(context, 'usecaseCommands')) {
      const def = data.usecaseDefinition;
      const id = def && typeof def === 'object' ? (def as Record<string, unknown>).usecaseId : undefined;
      if (typeof id === 'string' && id) savedSelectors.add(id);
    }
    return reconcileParallelDynamicFanOut(context, parentStep, step, hookSequential, { expectedSelectors, savedSelectors });
  } catch (error) {
    console.warn('[agentPlanUsecaseDefinition] fan-out reconcile skipped:', error);
    return [];
  }
}

export function getPlanUsecaseDefinitionOutputs(context: mls.msg.ExecutionContext): Promise<PlanUsecaseDefinitionOutput[]> {
  return getPlannerOutputsWithFileFallback(
    context,
    'agentPlanUsecaseDefinition',
    'usecaseCommands',
    planUsecaseDefinitionConfig,
    output => output.result.usecaseDefinition.usecaseId,
    validatePlanUsecaseDefinitionOutput,
  );
}

function extractPlanUsecaseDefinitionOutput(payload: unknown): PlanUsecaseDefinitionOutput {
  return extractPlannerOutput(payload, planUsecaseDefinitionConfig);
}

const planUsecaseDefinitionConfig = {
  toolName: PLAN_USECASE_DEFINITION_TOOL_NAME,
  stepId: PLAN_USECASE_DEFINITION_STEP_ID,
  stepIdAliases: PLAN_USECASE_DEFINITION_ALIASES,
  normalizeResult: normalizePlanUsecaseDefinitionResult,
};

function normalizePlanUsecaseDefinitionResult(value: unknown): PlanUsecaseDefinitionResult {
  const result = assertRecord(value, 'result');
  const def = assertRecord(result.usecaseDefinition, 'result.usecaseDefinition');
  const usecaseId = assertString(def.usecaseId, 'result.usecaseDefinition.usecaseId');
  const commands = assertArray(def.commands, 'result.usecaseDefinition.commands').map((cmd, index) => normalizeCommand(cmd, `result.usecaseDefinition.commands[${index}]`));
  return { usecaseDefinition: { usecaseId, commands } };
}

function normalizeCommand(value: unknown, path: string): UsecaseCommand {
  const command = assertRecord(value, path);
  const commandId = assertString(command.commandId, `${path}.commandId`);
  const input = assertArray(command.input, `${path}.input`).map((field, index) => {
    const record = assertRecord(field, `${path}.input[${index}]`);
    return {
      name: assertString(record.name, `${path}.input[${index}].name`),
      type: assertString(record.type, `${path}.input[${index}].type`),
      required: typeof record.required === 'boolean' ? record.required : false,
    };
  });
  const out = assertArray(command.output, `${path}.output`).map((field, index) => {
    const record = assertRecord(field, `${path}.output[${index}]`);
    return {
      name: assertString(record.name, `${path}.output[${index}].name`),
      type: assertString(record.type, `${path}.output[${index}].type`),
    };
  });
  return { commandId, input, output: out };
}

function validatePlanUsecaseDefinitionOutput(output: PlanUsecaseDefinitionOutput, selector?: string): void {
  const def = output.result.usecaseDefinition;
  if (!def.usecaseId) throw new Error('usecaseDefinition.usecaseId must be a non-empty string');
  if (selector && def.usecaseId !== selector) throw new Error(`usecaseDefinition.usecaseId must match selector ${selector}`);
  if (output.status === 'needs_input' && output.questions.length === 0) throw new Error('needs_input usecase definition must include questions');
}

function getUsecaseSelector(step: mls.msg.AIAgentStep): string {
  const prompt = (step as { prompt?: string }).prompt;
  if (typeof prompt === 'string' && prompt.trim() && !prompt.trim().startsWith('{')) return prompt.trim();
  return '';
}

function buildHumanPrompt(args: string, usecaseItem: Record<string, unknown>, backendArchitecture: unknown): string {
  const reduced = {
    usecase: usecaseItem,
    backendArchitecture,
  };
  return `## Current usecase selector
${args}

## Focused usecase context (from the usecase index)
${JSON.stringify(reduced, null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codeinstruct -->
<!-- x-tool-strict: true -->

You are agentPlanUsecaseDefinition for the collab.codes "newSolution" flow.
Detail the command signatures for EXACTLY ONE usecase — the one whose usecaseId equals the current selector.
Use the same language as the user for questions and trace. Do not generate TypeScript code.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## Rules
- usecaseDefinition.usecaseId MUST equal the current selector.
- commands[]: the operations this usecase exposes (usually one main command; add more only when the usecase clearly performs distinct operations).
- Each command declares a stable camelCase commandId and its signature as structured typed fields:
  - input: array of { name, type, required } — the parameters the command receives (empty array when none).
  - output: array of { name, type } — the fields the command returns (empty array when none).
- Use concise primitive/domain types in "type" (e.g. string, number, boolean, date, or an entity/enum id). Do not embed free-form JSON; only the declared fields.
- Derive inputs/outputs from the usecase's inputEntities/outputEntities, readsTables/writesTables and purpose. Do not invent unrelated fields.
`;
