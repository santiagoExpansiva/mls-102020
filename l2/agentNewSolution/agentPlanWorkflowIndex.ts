/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanWorkflowIndex.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PlannerOutput,
  Priority,
  assertArray,
  assertPriority,
  assertRecord,
  assertString,
  createDynamicAgentStepIntent,
  createPlannerPromptReadyIntent,
  createPlannerToolSchema,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  findStepByPlanId,
  getPlannerOutput,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { FinalSolutionPlanOutput, getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import { PlanMetricTableDefinitionOutput, getPlanMetricTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanMetricTableDefinition.js';
import { PlanMetricsIndexOutput, getPlanMetricsIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricsIndex.js';
import { PlanPersistenceIndexOutput, getPlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import { PlanTableDefinitionOutput, getPlanTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';
import { PlanUsecaseEntitiesOutput, getPlanUsecaseEntitiesOutput } from '/_102020_/l2/agentNewSolution/agentPlanUsecaseEntities.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentPlanWorkflowIndex',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Plan the workflow index for the solution',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const PLAN_WORKFLOW_INDEX_TOOL_NAME = 'submitWorkflowIndex';
export const PLAN_WORKFLOW_INDEX_STEP_ID = '17-plan-workflow-index';
const PLAN_WORKFLOW_INDEX_ALIASES = [PLAN_WORKFLOW_INDEX_STEP_ID, 'plan-workflow-index'];

export interface WorkflowIndexItem {
  workflowId: string;
  title: string;
  purpose: string;
  executionMode: string;
  createsTask: boolean;
  priority: Priority;
  actors: string[];
  relatedEntities: string[];
  persistenceRefs: string[];
  usecaseRefs: string[];
  metricRefs: string[];
  relatedCapabilities: string[];
  rulesApplied: string[];
  implementationSuggestions: unknown[];
}

export interface PlanWorkflowIndexResult {
  workflows: WorkflowIndexItem[];
}

export type PlanWorkflowIndexOutput = PlannerOutput<PlanWorkflowIndexResult>;

const planWorkflowIndexToolSchema = createPlannerToolSchema(
  PLAN_WORKFLOW_INDEX_TOOL_NAME,
  'Submit the workflow index for the newSolution plan.',
  PLAN_WORKFLOW_INDEX_STEP_ID,
  {
    type: 'object',
    additionalProperties: false,
    required: ['workflows'],
    properties: {
      workflows: { type: 'array', items: { type: 'object', additionalProperties: true } },
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
  if (!agent || !step) throw new Error('[agentPlanWorkflowIndex](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const finalPlan = getFinalizeSolutionPlanOutput(context);
  const persistenceIndex = getPlanPersistenceIndexOutput(context);
  const tableDefinitions = getPlanTableDefinitionOutputs(context);
  const metricsIndex = getPlanMetricsIndexOutput(context);
  const metricTableDefinitions = getPlanMetricTableDefinitionOutputs(context);
  const usecasePlan = getPlanUsecaseEntitiesOutput(context);

  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(PLAN_WORKFLOW_INDEX_TOOL_NAME),
      buildHumanPrompt(args, finalPlan, persistenceIndex, tableDefinitions, metricsIndex, metricTableDefinitions, usecasePlan),
      planWorkflowIndexToolSchema,
      PLAN_WORKFLOW_INDEX_TOOL_NAME
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
  let output: PlanWorkflowIndexOutput | undefined;

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    output = extractPlanWorkflowIndexOutput(payload);
    validatePlanWorkflowIndexOutput(output);
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentPlanWorkflowIndex returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentPlanWorkflowIndex returned status needs_input; keeping workflow index draft.';
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  const intents: mls.msg.AgentIntent[] = [
    createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined),
  ];

  if (status === 'completed' && output) intents.push(...createFirstWorkflowDefinitionIntent(context, output));
  return intents;
}

export function getPlanWorkflowIndexOutput(context: mls.msg.ExecutionContext): PlanWorkflowIndexOutput {
  return getPlannerOutput(context, 'agentPlanWorkflowIndex', planWorkflowIndexConfig, validatePlanWorkflowIndexOutput);
}

function extractPlanWorkflowIndexOutput(payload: unknown): PlanWorkflowIndexOutput {
  return extractPlannerOutput(payload, planWorkflowIndexConfig);
}

const planWorkflowIndexConfig = {
  toolName: PLAN_WORKFLOW_INDEX_TOOL_NAME,
  stepId: PLAN_WORKFLOW_INDEX_STEP_ID,
  stepIdAliases: PLAN_WORKFLOW_INDEX_ALIASES,
  normalizeResult: normalizePlanWorkflowIndexResult,
};

function normalizePlanWorkflowIndexResult(value: unknown): PlanWorkflowIndexResult {
  const result = assertRecord(value, 'result');
  return {
    workflows: assertArray(result.workflows, 'result.workflows').map((item, index) => normalizeWorkflowIndexItem(item, `result.workflows[${index}]`)),
  };
}

function normalizeWorkflowIndexItem(value: unknown, path: string): WorkflowIndexItem {
  const workflow = assertRecord(value, path);
  return {
    workflowId: assertString(workflow.workflowId, `${path}.workflowId`),
    title: assertString(workflow.title, `${path}.title`),
    purpose: assertString(workflow.purpose, `${path}.purpose`),
    executionMode: assertString(workflow.executionMode, `${path}.executionMode`),
    createsTask: Boolean(workflow.createsTask),
    priority: assertPriority(workflow.priority, `${path}.priority`),
    actors: normalizeStringArray(workflow.actors, `${path}.actors`),
    relatedEntities: normalizeStringArray(workflow.relatedEntities, `${path}.relatedEntities`),
    persistenceRefs: normalizeStringArray(workflow.persistenceRefs, `${path}.persistenceRefs`),
    usecaseRefs: normalizeStringArray(workflow.usecaseRefs, `${path}.usecaseRefs`),
    metricRefs: normalizeStringArray(workflow.metricRefs, `${path}.metricRefs`),
    relatedCapabilities: normalizeStringArray(workflow.relatedCapabilities, `${path}.relatedCapabilities`),
    rulesApplied: normalizeStringArray(workflow.rulesApplied, `${path}.rulesApplied`),
    implementationSuggestions: assertArray(workflow.implementationSuggestions, `${path}.implementationSuggestions`),
  };
}

function validatePlanWorkflowIndexOutput(output: PlanWorkflowIndexOutput): void {
  const validModes = new Set(['documentationOnly', 'uiState', 'entityLifecycle', 'taskWorkflow', 'automation']);
  for (const workflow of output.result.workflows) {
    if (!validModes.has(workflow.executionMode)) throw new Error(`invalid workflow executionMode: ${workflow.executionMode}`);
  }
  if (output.status === 'needs_input' && output.questions.length === 0) throw new Error('needs_input workflow index must include questions');
}

function createFirstWorkflowDefinitionIntent(context: mls.msg.ExecutionContext, output: PlanWorkflowIndexOutput): mls.msg.AgentIntent[] {
  const placeholder = findStepByPlanId(context, 'plan-workflow-definition') as mls.msg.AIAgentStep | null;
  if (!placeholder || placeholder.type !== 'agent' || placeholder.status === 'completed') return [];

  const firstWorkflow = output.result.workflows[0];
  if (!firstWorkflow) {
    return [createPlannerUpdateStatusIntent(context, placeholder, placeholder, 0, 'completed', 'No workflows to define.')];
  }

  return [
    createDynamicAgentStepIntent(
      context,
      placeholder,
      'agentPlanWorkflowDefinition',
      `plan-workflow-definition:${firstWorkflow.workflowId}`,
      `Plan workflow ${firstWorkflow.workflowId}`,
      firstWorkflow.workflowId
    ),
  ];
}

function normalizeStringArray(value: unknown, path: string): string[] {
  return assertArray(value, path).map((item, index) => assertString(item, `${path}[${index}]`));
}

function buildHumanPrompt(
  args: string,
  finalPlan: FinalSolutionPlanOutput,
  persistenceIndex: PlanPersistenceIndexOutput,
  tableDefinitions: PlanTableDefinitionOutput[],
  metricsIndex: PlanMetricsIndexOutput,
  metricTableDefinitions: PlanMetricTableDefinitionOutput[],
  usecasePlan: PlanUsecaseEntitiesOutput,
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

## Usecase plan
${JSON.stringify(usecasePlan, null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codepro -->

You are agentPlanWorkflowIndex for the collab.codes "newSolution" flow.
Plan only the workflow index. Do not define full states or transitions in this step.
Use the same language as the user for titles, purposes, suggestions, questions, and trace.
Use English camelCase identifiers for workflowId.

## Tool mode
Call the "{{toolName}}" tool with the complete structured result.
Do not return prose.

## Rules
- executionMode must be one of documentationOnly, uiState, entityLifecycle, taskWorkflow, automation.
- createsTask must be true only when the workflow should create or coordinate tasks for staff, managers, or agents.
- Do not hard-code workflow ids from a sample domain.
- Create workflow ids from capabilities and lifecycle concepts in the final solution plan.
- Include a workflow when the domain has multi-step state, cross-page user progress, staff coordination, approval, fulfillment, reminders, external integration, or scheduled automation.
- Include persistenceRefs with table ids from module-owned table definitions when the workflow depends on local persisted state.
- Include usecaseRefs when workflow transitions must be executed by layer_3_usecases.
- Include metricRefs when workflow transitions feed operational metrics.
- Do not include MDM, horizontal, or plugin-owned tables in persistenceRefs.
- Include implementation suggestions such as whether staff confirmation should create a task.
- Use rule ids; do not write loose rule text.
- Do not generate TypeScript code.

## Content Memory
actualDate: 2026-06-05
userName: Wagner
taskName: newModule
flowName: newSolution
`;
