/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanWorkflowIndex.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PlannerOutput,
  Priority,
  assertArray,
  assertPriority,
  assertRecord,
  assertString,
  compactFinalPlan,
  summarizeRecords,
  createHoldIndexForReviewIntents,
  createParallelDynamicAgentStepIntent,
  createPlannerPromptReadyIntent,
  createPlannerVariableToolSchema,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  findStepByPlanId,
  getPlannerOutputWithRepair,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import type { FinalSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import { saveNewSolutionAgentTracePayload } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { getPlanMetricTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanMetricTableDefinition.js';
import type { PlanMetricTableDefinitionOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricTableDefinition.js';
import { getPlanMetricsIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricsIndex.js';
import type { PlanMetricsIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricsIndex.js';
import { getPlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import type { PlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import { getPlanTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';
import type { PlanTableDefinitionOutput } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';
import { getPlanUsecaseEntitiesOutput } from '/_102020_/l2/agentNewSolution/agentPlanUsecaseEntities.js';
import type { PlanUsecaseEntitiesOutput } from '/_102020_/l2/agentNewSolution/agentPlanUsecaseEntities.js';

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

export const PLAN_WORKFLOW_INDEX_RESULT_SCHEMA: Record<string, unknown> = {
    type: 'object',
    additionalProperties: false,
    required: ['workflows'],
    properties: {
      workflows: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'workflowId',
            'title',
            'purpose',
            'executionMode',
            'createsTask',
            'priority',
            'actors',
            'relatedEntities',
            'persistenceRefs',
            'usecaseRefs',
            'metricRefs',
            'relatedCapabilities',
            'rulesApplied',
            'implementationSuggestions',
          ],
          properties: {
            workflowId: { type: 'string' },
            title: { type: 'string' },
            purpose: { type: 'string' },
            executionMode: { enum: ['documentationOnly', 'uiState', 'entityLifecycle', 'taskWorkflow', 'automation'] },
            createsTask: { type: 'boolean' },
            priority: { enum: ['now', 'soon', 'later', 'never'] },
            actors: { type: 'array', items: { type: 'string' } },
            relatedEntities: { type: 'array', items: { type: 'string' } },
            persistenceRefs: { type: 'array', items: { type: 'string' } },
            usecaseRefs: { type: 'array', items: { type: 'string' } },
            metricRefs: { type: 'array', items: { type: 'string' } },
            relatedCapabilities: { type: 'array', items: { type: 'string' } },
            rulesApplied: { type: 'array', items: { type: 'string' } },
            implementationSuggestions: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['suggestionId', 'title', 'reason'],
                properties: {
                  suggestionId: { type: 'string' },
                  title: { type: 'string' },
                  reason: { type: 'string' },
                  priority: { enum: ['now', 'soon', 'later', 'never'] },
                },
              },
            },
          },
        },
      },
    },
};

const planWorkflowIndexToolSchema = createPlannerVariableToolSchema(
  PLAN_WORKFLOW_INDEX_TOOL_NAME,
  'Submit the workflow index for the newSolution plan.',
  PLAN_WORKFLOW_INDEX_RESULT_SCHEMA
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
  const tableDefinitions = await getPlanTableDefinitionOutputs(context);
  const metricsIndex = getPlanMetricsIndexOutput(context);
  const metricTableDefinitions = await getPlanMetricTableDefinitionOutputs(context);
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

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);

  // /024: hold the step open and run critic/repair before workflow definitions.
  if (status === 'completed' && output && output.status === 'ok') {
    return createHoldIndexForReviewIntents(context, parentStep, step, hookSequential, 'workflowIndex');
  }

  const intents: mls.msg.AgentIntent[] = [
    createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined),
  ];

  if (status === 'completed' && output) intents.push(...createWorkflowDefinitionParallelIntent(context, output));
  return intents;
}

export function getPlanWorkflowIndexOutput(context: mls.msg.ExecutionContext): PlanWorkflowIndexOutput {
  // prefer the latest repaired index when a repair step exists.
  return getPlannerOutputWithRepair(context, 'agentPlanWorkflowIndex', 'workflowIndex', planWorkflowIndexConfig, validatePlanWorkflowIndexOutput);
}

function extractPlanWorkflowIndexOutput(payload: unknown): PlanWorkflowIndexOutput {
  return extractPlannerOutput(payload, planWorkflowIndexConfig);
}

export const planWorkflowIndexConfig = {
  toolName: PLAN_WORKFLOW_INDEX_TOOL_NAME,
  stepId: PLAN_WORKFLOW_INDEX_STEP_ID,
  stepIdAliases: PLAN_WORKFLOW_INDEX_ALIASES,
  normalizeResult: normalizePlanWorkflowIndexResult,
};

export function normalizePlanWorkflowIndexResult(value: unknown): PlanWorkflowIndexResult {
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
    createsTask: assertBoolean(workflow.createsTask, `${path}.createsTask`),
    priority: assertPriority(workflow.priority, `${path}.priority`),
    actors: normalizeStringArray(workflow.actors, `${path}.actors`),
    relatedEntities: normalizeStringArray(workflow.relatedEntities, `${path}.relatedEntities`),
    persistenceRefs: normalizeStringArray(workflow.persistenceRefs, `${path}.persistenceRefs`),
    usecaseRefs: normalizeStringArray(workflow.usecaseRefs, `${path}.usecaseRefs`),
    metricRefs: normalizeStringArray(workflow.metricRefs, `${path}.metricRefs`),
    relatedCapabilities: normalizeStringArray(workflow.relatedCapabilities, `${path}.relatedCapabilities`),
    rulesApplied: normalizeStringArray(workflow.rulesApplied, `${path}.rulesApplied`),
    implementationSuggestions: assertArray(workflow.implementationSuggestions, `${path}.implementationSuggestions`)
      .map((item, index) => normalizeImplementationSuggestion(item, `${path}.implementationSuggestions[${index}]`)),
  };
}

function assertBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean`);
  return value;
}

function normalizeImplementationSuggestion(value: unknown, path: string): unknown {
  const suggestion = assertRecord(value, path);
  assertString(suggestion.suggestionId, `${path}.suggestionId`);
  assertString(suggestion.title, `${path}.title`);
  assertString(suggestion.reason, `${path}.reason`);
  if (suggestion.priority !== undefined) assertPriority(suggestion.priority, `${path}.priority`);
  return suggestion;
}

export function validatePlanWorkflowIndexOutput(output: PlanWorkflowIndexOutput): void {
  const validModes = new Set(['documentationOnly', 'uiState', 'entityLifecycle', 'taskWorkflow', 'automation']);
  for (const workflow of output.result.workflows) {
    if (!validModes.has(workflow.executionMode)) throw new Error(`invalid workflow executionMode: ${workflow.executionMode}`);
  }
  if (output.status === 'needs_input' && output.questions.length === 0) throw new Error('needs_input workflow index must include questions');
}

export function createWorkflowDefinitionParallelIntent(context: mls.msg.ExecutionContext, output: PlanWorkflowIndexOutput): mls.msg.AgentIntent[] {
  const placeholder = findStepByPlanId(context, 'plan-workflow-definition') as mls.msg.AIAgentStep | null;
  if (!placeholder || placeholder.type !== 'agent' || placeholder.status === 'completed') return [];

  const workflowIds = output.result.workflows.map(workflow => workflow.workflowId);
  if (workflowIds.length === 0) {
    return [createPlannerUpdateStatusIntent(context, placeholder, placeholder, 0, 'completed', 'No workflows to define.')];
  }

  return [
    createParallelDynamicAgentStepIntent(
      context,
      placeholder,
      'agentPlanWorkflowDefinition',
      'plan-workflow-definition:parallel',
      'Plan workflows {{completed}}/{{total}}, errors: {{failed}}',
      workflowIds,
      5
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
  // compact context. The workflow index needs capabilities, actors, approved
  // workflows and the ids of module tables / usecases / metrics it can reference — not the full
  // final plan, full table/metric definitions or the full usecase plan.
  const reduced = {
    finalPlan: compactFinalPlan(finalPlan.result),
    persistenceTables: summarizeRecords(persistenceIndex.result.tables, ['tableId', 'tableName', 'rootEntity']),
    metricTables: summarizeRecords(metricsIndex.result.metricTables, ['metricTableId', 'title']),
    metricTableDefinitions: summarizeRecords(metricTableDefinitions.map(m => m.result.metricTableDefinition), ['metricTableId']),
    usecases: summarizeRecords(usecasePlan.result.usecases, ['usecaseId', 'title', 'actor']),
  };
  void tableDefinitions; // table columns not needed to plan the workflow index

  return `## Planned step args
${args}

## Reduced workflow-planning context
${JSON.stringify(reduced, null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codepro -->
<!-- x-tool-strict: true -->

You are agentPlanWorkflowIndex for the collab.codes "newSolution" flow.
Plan only the workflow index. Do not define full states or transitions in this step.
Use the same language as the user for titles, purposes, suggestions, questions, and trace.
Use English camelCase identifiers for workflowId.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## Rules
- executionMode must be one of documentationOnly, uiState, entityLifecycle, taskWorkflow, automation.
- createsTask must be true only when the workflow should create or coordinate tasks for staff, managers, or agents.
- Do not hard-code workflow ids from a sample domain.
- Create workflow ids from capabilities and lifecycle concepts in the final solution plan.
- Include a workflow when the domain has multi-step state, cross-page user progress, staff coordination, approval, fulfillment, reminders, external integration, or scheduled automation.
- persistenceRefs is the persistence SUPERSET (T-009): the module-owned table ids the workflow depends on PLUS the metric table ids it writes. When a workflow feeds a metric table, that metric table id MUST appear in BOTH persistenceRefs and metricRefs.
- Include usecaseRefs when workflow transitions must be executed by layer_3_usecases.
- Include metricRefs with the metric table ids whose measures the workflow's transitions feed.
- Do not include MDM, horizontal, or plugin-owned tables in persistenceRefs.
- Include implementation suggestions such as whether confirmation by an operations or back-office role should create a task.
- Use rule ids; do not write loose rule text.
- Do not generate TypeScript code.
`;
