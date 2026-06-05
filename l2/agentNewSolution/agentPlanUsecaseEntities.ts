/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanUsecaseEntities.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PlannerOutput,
  assertArray,
  assertRecord,
  createPlannerPromptReadyIntent,
  createPlannerToolSchema,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  getPlannerOutput,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { FinalSolutionPlanOutput, getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import { PlanMetricTableDefinitionOutput, getPlanMetricTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanMetricTableDefinition.js';
import { PlanMetricsIndexOutput, getPlanMetricsIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricsIndex.js';
import { PlanPersistenceIndexOutput, getPlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import { PlanTableDefinitionOutput, getPlanTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentPlanUsecaseEntities',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Plan layer_3 usecase entities and usecases',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const PLAN_USECASE_ENTITIES_TOOL_NAME = 'submitUsecaseEntitiesPlan';
export const PLAN_USECASE_ENTITIES_STEP_ID = '16-plan-usecase-entities';
const PLAN_USECASE_ENTITIES_ALIASES = [PLAN_USECASE_ENTITIES_STEP_ID, 'plan-usecase-entities'];

export interface PlanUsecaseEntitiesResult {
  backendArchitecture: Record<string, unknown>;
  usecaseEntities: unknown[];
  usecases: unknown[];
  controllerRules: {
    bffMustCallUsecases: boolean;
    bffDirectTableAccessForbidden: boolean;
  };
}

export type PlanUsecaseEntitiesOutput = PlannerOutput<PlanUsecaseEntitiesResult>;

const planUsecaseEntitiesToolSchema = createPlannerToolSchema(
  PLAN_USECASE_ENTITIES_TOOL_NAME,
  'Submit layer_3 usecase entities and usecases planning.',
  PLAN_USECASE_ENTITIES_STEP_ID,
  {
    type: 'object',
    additionalProperties: false,
    required: ['backendArchitecture', 'usecaseEntities', 'usecases', 'controllerRules'],
    properties: {
      backendArchitecture: { type: 'object', additionalProperties: true },
      usecaseEntities: { type: 'array', items: { type: 'object', additionalProperties: true } },
      usecases: { type: 'array', items: { type: 'object', additionalProperties: true } },
      controllerRules: {
        type: 'object',
        additionalProperties: false,
        required: ['bffMustCallUsecases', 'bffDirectTableAccessForbidden'],
        properties: {
          bffMustCallUsecases: { type: 'boolean' },
          bffDirectTableAccessForbidden: { type: 'boolean' },
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
  if (!agent || !step) throw new Error('[agentPlanUsecaseEntities](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const finalPlan = getFinalizeSolutionPlanOutput(context);
  const persistenceIndex = getPlanPersistenceIndexOutput(context);
  const tableDefinitions = getPlanTableDefinitionOutputs(context);
  const metricsIndex = getPlanMetricsIndexOutput(context);
  const metricTableDefinitions = getPlanMetricTableDefinitionOutputs(context);

  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(PLAN_USECASE_ENTITIES_TOOL_NAME),
      buildHumanPrompt(args, finalPlan, persistenceIndex, tableDefinitions, metricsIndex, metricTableDefinitions),
      planUsecaseEntitiesToolSchema,
      PLAN_USECASE_ENTITIES_TOOL_NAME
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

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    const output = extractPlanUsecaseEntitiesOutput(payload);
    validatePlanUsecaseEntitiesOutput(output, getPlanPersistenceIndexOutput(context).result.tables.length > 0);
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentPlanUsecaseEntities returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentPlanUsecaseEntities returned status needs_input; keeping usecase plan draft.';
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  return [createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined)];
}

export function getPlanUsecaseEntitiesOutput(context: mls.msg.ExecutionContext): PlanUsecaseEntitiesOutput {
  return getPlannerOutput(context, 'agentPlanUsecaseEntities', planUsecaseEntitiesConfig, output => validatePlanUsecaseEntitiesOutput(output, getPlanPersistenceIndexOutput(context).result.tables.length > 0));
}

function extractPlanUsecaseEntitiesOutput(payload: unknown): PlanUsecaseEntitiesOutput {
  return extractPlannerOutput(payload, planUsecaseEntitiesConfig);
}

const planUsecaseEntitiesConfig = {
  toolName: PLAN_USECASE_ENTITIES_TOOL_NAME,
  stepId: PLAN_USECASE_ENTITIES_STEP_ID,
  stepIdAliases: PLAN_USECASE_ENTITIES_ALIASES,
  normalizeResult: normalizePlanUsecaseEntitiesResult,
};

function normalizePlanUsecaseEntitiesResult(value: unknown): PlanUsecaseEntitiesResult {
  const result = assertRecord(value, 'result');
  const controllerRules = assertRecord(result.controllerRules, 'result.controllerRules');
  return {
    backendArchitecture: assertRecord(result.backendArchitecture, 'result.backendArchitecture'),
    usecaseEntities: assertArray(result.usecaseEntities, 'result.usecaseEntities'),
    usecases: assertArray(result.usecases, 'result.usecases'),
    controllerRules: {
      bffMustCallUsecases: Boolean(controllerRules.bffMustCallUsecases),
      bffDirectTableAccessForbidden: Boolean(controllerRules.bffDirectTableAccessForbidden),
    },
  };
}

function validatePlanUsecaseEntitiesOutput(output: PlanUsecaseEntitiesOutput, hasModuleTables: boolean): void {
  if (!output.result.controllerRules.bffMustCallUsecases) throw new Error('bffMustCallUsecases must be true');
  if (!output.result.controllerRules.bffDirectTableAccessForbidden) throw new Error('bffDirectTableAccessForbidden must be true');
  if (output.status === 'ok' && hasModuleTables && output.result.usecaseEntities.length === 0) {
    throw new Error('module tables exist, but usecaseEntities is empty');
  }
  if (output.status === 'ok' && hasModuleTables && output.result.usecases.length === 0) {
    throw new Error('module tables exist, but usecases is empty');
  }
  if (output.status === 'needs_input' && output.questions.length === 0) throw new Error('needs_input usecase plan must include questions');
}

function buildHumanPrompt(
  args: string,
  finalPlan: FinalSolutionPlanOutput,
  persistenceIndex: PlanPersistenceIndexOutput,
  tableDefinitions: PlanTableDefinitionOutput[],
  metricsIndex: PlanMetricsIndexOutput,
  metricTableDefinitions: PlanMetricTableDefinitionOutput[],
): string {
  return `## Planned step args
${args}

## Final solution plan
${JSON.stringify(finalPlan, null, 2)}

## Persistence index
${JSON.stringify(persistenceIndex, null, 2)}

## Table definitions
${JSON.stringify(tableDefinitions, null, 2)}

## Metrics index
${JSON.stringify(metricsIndex, null, 2)}

## Metric table definitions
${JSON.stringify(metricTableDefinitions, null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codepro -->

You are agentPlanUsecaseEntities for the collab.codes "newSolution" flow.
Plan entities and use cases for layer_3_usecases.
The goal is to create .defs data that will later materialize backend use case files. Do not generate TypeScript code.
Use the same language as the user for titles, purposes, questions, and trace.

## Tool mode
Call the "{{toolName}}" tool with the complete structured result.
Do not return prose.

## Rules
- Create usecase entities for module-owned aggregate entities that are read or written by BFF commands, workflows, agents, or metrics.
- Include metric table update responsibilities in the use cases that write base transactional tables.
- If an aggregate has child data stored in details, maintain the parent and child data in the same use case.
- layer_2_controllers must always call layer_3_usecases.
- Only layer_3_usecases may access tables from layer_1_external.
- BFF commands generated later must be able to reference these use cases by usecaseId.
- Do not generate TypeScript code.

## Content Memory
actualDate: 2026-06-05
userName: Wagner
taskName: newModule
flowName: newSolution
`;
