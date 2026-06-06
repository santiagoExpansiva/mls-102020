/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanWorkflowDefinition.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PlannerOutput,
  Priority,
  assertArray,
  assertPriority,
  assertRecord,
  assertString,
  createPlannerPromptReadyIntent,
  createPlannerVariableToolSchema,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  getPlannerOutputs,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import type { FinalSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import { saveNewSolutionAgentTracePayload, saveNewSolutionPlanArtifacts } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { getPlanMetricTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanMetricTableDefinition.js';
import type { PlanMetricTableDefinitionOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricTableDefinition.js';
import { getPlanTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';
import type { PlanTableDefinitionOutput } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';
import { getPlanUsecaseEntitiesOutput } from '/_102020_/l2/agentNewSolution/agentPlanUsecaseEntities.js';
import type { PlanUsecaseEntitiesOutput } from '/_102020_/l2/agentNewSolution/agentPlanUsecaseEntities.js';
import { getPlanWorkflowIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanWorkflowIndex.js';
import type { PlanWorkflowIndexOutput, WorkflowIndexItem } from '/_102020_/l2/agentNewSolution/agentPlanWorkflowIndex.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentPlanWorkflowDefinition',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Plan one workflow definition from the workflow index',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const PLAN_WORKFLOW_DEFINITION_TOOL_NAME = 'submitWorkflowDefinitionPlan';
export const PLAN_WORKFLOW_DEFINITION_STEP_ID = '18-plan-workflow-definition';
const PLAN_WORKFLOW_DEFINITION_ALIASES = [PLAN_WORKFLOW_DEFINITION_STEP_ID, 'plan-workflow-definition'];

export interface PlanWorkflowDefinitionResult {
  workflowDefinition: Record<string, unknown> & {
    workflowId: string;
    title: string;
    purpose: string;
    executionMode: string;
    createsTask: boolean;
  };
  defsPlan: {
    fileName: string;
    exportName: string;
    saveAsDefs: boolean;
  };
}

export type PlanWorkflowDefinitionOutput = PlannerOutput<PlanWorkflowDefinitionResult>;

const transitionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['from', 'to', 'trigger', 'actor', 'conditions', 'actions', 'rulesApplied'],
  properties: {
    from: { type: 'string' },
    to: { type: 'string' },
    trigger: { type: 'string' },
    actor: { type: 'string' },
    conditions: { type: 'array', items: { type: 'string' } },
    actions: { type: 'array', items: { type: 'string' } },
    rulesApplied: { type: 'array', items: { type: 'string' } },
  },
};

const planWorkflowDefinitionToolSchema = createPlannerVariableToolSchema(
  PLAN_WORKFLOW_DEFINITION_TOOL_NAME,
  'Submit one workflow definition plan for the current workflow selector.',
  {
    type: 'object',
    additionalProperties: false,
    required: ['workflowDefinition', 'defsPlan'],
    properties: {
      workflowDefinition: {
        type: 'object',
        additionalProperties: false,
        required: [
          'workflowId',
          'title',
          'purpose',
          'executionMode',
          'createsTask',
          'taskConfig',
          'actors',
          'states',
          'transitions',
          'requiredEntities',
          'persistenceRefs',
          'usecaseRefs',
          'metricRefs',
          'userActions',
          'relatedPages',
          'relatedAgents',
          'relatedPlugins',
          'rulesApplied',
          'implementationSuggestions',
        ],
        properties: {
          workflowId: { type: 'string' },
          title: { type: 'string' },
          purpose: { type: 'string' },
          executionMode: { enum: ['documentationOnly', 'uiState', 'entityLifecycle', 'taskWorkflow', 'automation'] },
          createsTask: { type: 'boolean' },
          createsTaskReason: { type: ['string', 'null'] },
          taskConfig: {
            type: 'object',
            additionalProperties: false,
            required: ['taskTitleTemplate', 'assigneeRules', 'slaRules', 'taskRoomRequired'],
            properties: {
              taskTitleTemplate: { type: 'string' },
              assigneeRules: { type: 'array', items: { type: 'string' } },
              slaRules: { type: 'array', items: { type: 'string' } },
              taskRoomRequired: { type: 'boolean' },
            },
          },
          actors: { type: 'array', items: { type: 'string' } },
          states: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['stateId', 'description'],
              properties: {
                stateId: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
          transitions: { type: 'array', items: transitionSchema },
          requiredEntities: { type: 'array', items: { type: 'string' } },
          persistenceRefs: { type: 'array', items: { type: 'string' } },
          usecaseRefs: { type: 'array', items: { type: 'string' } },
          metricRefs: { type: 'array', items: { type: 'string' } },
          userActions: { type: 'array', items: { type: 'string' } },
          relatedPages: { type: 'array', items: { type: 'string' } },
          relatedAgents: { type: 'array', items: { type: 'string' } },
          relatedPlugins: { type: 'array', items: { type: 'string' } },
          rulesApplied: { type: 'array', items: { type: 'string' } },
          implementationSuggestions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['suggestionId', 'title', 'priority', 'description', 'tradeoff'],
              properties: {
                suggestionId: { type: 'string' },
                title: { type: 'string' },
                priority: { enum: ['now', 'soon', 'later', 'never'] },
                description: { type: 'string' },
                tradeoff: { type: 'string' },
              },
            },
          },
        },
      },
      defsPlan: {
        type: 'object',
        additionalProperties: false,
        required: ['fileName', 'exportName', 'saveAsDefs'],
        properties: {
          fileName: { type: 'string' },
          exportName: { type: 'string' },
          saveAsDefs: { type: 'boolean' },
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
  if (!agent || !step) throw new Error('[agentPlanWorkflowDefinition](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) workflow selector args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const finalPlan = getFinalizeSolutionPlanOutput(context);
  const workflowIndex = getPlanWorkflowIndexOutput(context);
  const workflowIndexItem = workflowIndex.result.workflows.find(workflow => workflow.workflowId === args);
  if (!workflowIndexItem) throw new Error(`[${agent.agentName}](beforePromptStep) workflow selector not found: ${args}`);

  const usecasePlan = getPlanUsecaseEntitiesOutput(context);
  const tableDefinitions = getPlanTableDefinitionOutputs(context);
  const metricTableDefinitions = getPlanMetricTableDefinitionOutputs(context);

  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(PLAN_WORKFLOW_DEFINITION_TOOL_NAME),
      buildHumanPrompt(args, finalPlan, workflowIndex, workflowIndexItem, usecasePlan, tableDefinitions, metricTableDefinitions),
      planWorkflowDefinitionToolSchema,
      PLAN_WORKFLOW_DEFINITION_TOOL_NAME
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
  let output: PlanWorkflowDefinitionOutput | undefined;
  const workflowSelector = getWorkflowSelector(step);

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    output = extractPlanWorkflowDefinitionOutput(payload);
    validatePlanWorkflowDefinitionOutput(output, workflowSelector);
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentPlanWorkflowDefinition returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentPlanWorkflowDefinition returned status needs_input; keeping workflow definition draft.';
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);
  if (status === 'completed' && output) await saveNewSolutionPlanArtifacts(context, agent.agentName, step, output);

  const updateIntent = createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined);
  return [updateIntent];
}

export function getPlanWorkflowDefinitionOutputs(context: mls.msg.ExecutionContext): PlanWorkflowDefinitionOutput[] {
  return getPlannerOutputs(context, 'agentPlanWorkflowDefinition', planWorkflowDefinitionConfig, output => {
    validatePlanWorkflowDefinitionOutput(output, output.result.workflowDefinition.workflowId);
  });
}

function extractPlanWorkflowDefinitionOutput(payload: unknown): PlanWorkflowDefinitionOutput {
  return extractPlannerOutput(payload, planWorkflowDefinitionConfig);
}

const planWorkflowDefinitionConfig = {
  toolName: PLAN_WORKFLOW_DEFINITION_TOOL_NAME,
  stepId: PLAN_WORKFLOW_DEFINITION_STEP_ID,
  stepIdAliases: PLAN_WORKFLOW_DEFINITION_ALIASES,
  normalizeResult: normalizePlanWorkflowDefinitionResult,
};

function normalizePlanWorkflowDefinitionResult(value: unknown): PlanWorkflowDefinitionResult {
  const result = assertRecord(value, 'result');
  const workflowDefinition = assertRecord(result.workflowDefinition, 'result.workflowDefinition');
  const defsPlan = assertRecord(result.defsPlan, 'result.defsPlan');
  const { createsTaskReason: _createsTaskReason, ...normalizedWorkflowDefinition } = workflowDefinition;

  return {
    workflowDefinition: {
      ...normalizedWorkflowDefinition,
      workflowId: assertString(workflowDefinition.workflowId, 'result.workflowDefinition.workflowId'),
      title: assertString(workflowDefinition.title, 'result.workflowDefinition.title'),
      purpose: assertString(workflowDefinition.purpose, 'result.workflowDefinition.purpose'),
      executionMode: assertString(workflowDefinition.executionMode, 'result.workflowDefinition.executionMode'),
      createsTask: assertBoolean(workflowDefinition.createsTask, 'result.workflowDefinition.createsTask'),
    },
    defsPlan: {
      fileName: assertString(defsPlan.fileName, 'result.defsPlan.fileName'),
      exportName: assertString(defsPlan.exportName, 'result.defsPlan.exportName'),
      saveAsDefs: assertBoolean(defsPlan.saveAsDefs, 'result.defsPlan.saveAsDefs'),
    },
  };
}

function assertBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean`);
  return value;
}

function validatePlanWorkflowDefinitionOutput(output: PlanWorkflowDefinitionOutput, workflowSelector: string): void {
  const workflow = output.result.workflowDefinition;
  const defsPlan = output.result.defsPlan;
  const validModes = new Set(['documentationOnly', 'uiState', 'entityLifecycle', 'taskWorkflow', 'automation']);
  if (!validModes.has(workflow.executionMode)) throw new Error(`invalid workflow executionMode: ${workflow.executionMode}`);
  if (!workflowSelector) throw new Error('workflow selector not found in step prompt or prepared input');
  if (workflow.workflowId !== workflowSelector) {
    throw new Error(`workflowDefinition.workflowId must match selector ${workflowSelector}`);
  }
  if (!defsPlan.saveAsDefs) throw new Error('defsPlan.saveAsDefs must be true');
  if (output.status === 'needs_input' && output.questions.length === 0) {
    throw new Error('needs_input workflow definition must include questions');
  }

  const lifecycleModes = new Set(['entityLifecycle', 'taskWorkflow', 'automation']);
  if (output.status === 'ok' && lifecycleModes.has(workflow.executionMode)) {
    const states = assertArray(workflow.states, 'workflowDefinition.states');
    const transitions = assertArray(workflow.transitions, 'workflowDefinition.transitions');
    if (states.length === 0) throw new Error(`workflow ${workflow.workflowId} must include states`);
    if (transitions.length === 0) throw new Error(`workflow ${workflow.workflowId} must include transitions`);
  }
}

function getWorkflowSelector(step: mls.msg.AIAgentStep): string {
  return normalizeSelector(step.prompt)
    || extractSelectorFromPreparedInput(step, 'Current workflow selector')
    || '';
}

function extractSelectorFromPreparedInput(step: mls.msg.AIAgentStep, title: string): string {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`## ${escapedTitle}\\s*\\n([^\\n]+)`);
  for (const input of step.interaction?.input || []) {
    if (input.type !== 'human') continue;
    const match = pattern.exec(input.content);
    const selector = normalizeSelector(match?.[1]);
    if (selector) return selector;
  }
  return '';
}

function normalizeSelector(value: unknown): string {
  if (typeof value !== 'string') return '';
  const selector = value.trim();
  if (!selector || selector.startsWith('{') || selector.startsWith('[')) return '';
  return selector;
}

function buildHumanPrompt(
  args: string,
  finalPlan: FinalSolutionPlanOutput,
  workflowIndex: PlanWorkflowIndexOutput,
  workflowIndexItem: WorkflowIndexItem,
  usecasePlan: PlanUsecaseEntitiesOutput,
  tableDefinitions: PlanTableDefinitionOutput[],
  metricTableDefinitions: PlanMetricTableDefinitionOutput[],
): string {
  return `## Current workflow selector
${args}

## Workflow index item
${JSON.stringify(workflowIndexItem, null, 2)}

## Workflow index
${JSON.stringify(workflowIndex, null, 2)}

## Final solution plan
${JSON.stringify(finalPlan, null, 2)}

## Usecase plan
${JSON.stringify(usecasePlan, null, 2)}

## Table definitions
${JSON.stringify(tableDefinitions, null, 2)}

## Metric table definitions
${JSON.stringify(metricTableDefinitions, null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codeinstruct -->

You are agentPlanWorkflowDefinition for the collab.codes "newSolution" flow.
Plan exactly one workflow definition for the current workflow selector.
Use the same language as the user for titles, purposes, descriptions, questions, and trace.
Use English camelCase identifiers for workflowId, stateId, trigger, and suggestionId.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## Rules
- Generate one workflow only: the workflow whose workflowId equals the current selector.
- Read the workflow index item for executionMode, createsTask, actors, refs, and suggestions.
- Keep executionMode and createsTask identical to the index unless the index is internally inconsistent; if corrected, explain it in trace.
- If createsTask is true, taskConfig must be filled.
- If createsTask is false, explain task-related choices in implementationSuggestions.
- Do not return createsTaskReason; explain task reasoning in implementationSuggestions or trace.
- Transitions must have from, to, trigger, and actor.
- Transition actions must only write entity fields and enum values declared in the final solution plan.
- Include persistenceRefs with module-owned table ids when transitions read or write local persisted state.
- Include usecaseRefs when transitions mutate module-owned data through layer_3_usecases.
- Include metricRefs when transitions feed operational metrics; metric updates happen in backend use cases, not pages.
- Do not reference MDM, horizontal, or plugin-owned entities as new module tables.
- defsPlan.fileName should be stable and workflow-specific, such as workflows/{workflowId}.defs.ts.
- defsPlan.exportName should be a stable camelCase export name, such as {workflowId}Def.
- defsPlan.saveAsDefs must be true.
- Use rule ids; do not write loose rule text.
- Do not generate TypeScript code.
`;
