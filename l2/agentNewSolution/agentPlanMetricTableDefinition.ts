/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanMetricTableDefinition.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PlannerOutput,
  assertArray,
  assertRecord,
  assertString,
  createDynamicAgentStepIntent,
  createPlannerPromptReadyIntent,
  createPlannerToolSchema,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  findStepByPlanId,
  getPlannerOutputs,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { FinalSolutionPlanOutput, getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import { PlanMetricsIndexOutput, getPlanMetricsIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricsIndex.js';
import { PlanPersistenceIndexOutput, getPlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import { PlanTableDefinitionOutput, getPlanTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentPlanMetricTableDefinition',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Plan one TimescaleDB metric table definition',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const PLAN_METRIC_TABLE_DEFINITION_TOOL_NAME = 'submitMetricTableDefinitionPlan';
export const PLAN_METRIC_TABLE_DEFINITION_STEP_ID = '15-plan-metric-table-definition';
const PLAN_METRIC_TABLE_DEFINITION_ALIASES = [PLAN_METRIC_TABLE_DEFINITION_STEP_ID, '15-plan-single-metric-table', 'plan-metric-table-definition'];

export interface PlanMetricTableDefinitionResult {
  metricTableDefinition: Record<string, unknown> & {
    metricTableId: string;
    tableName: string;
    moduleId: string;
    tableKind: string;
    storageEngine: string;
    layer: string;
    accessPolicy: Record<string, unknown>;
  };
  defsPlan: {
    fileName: string;
    exportName: string;
    saveAsDefs: boolean;
  };
}

export type PlanMetricTableDefinitionOutput = PlannerOutput<PlanMetricTableDefinitionResult>;

const planMetricTableDefinitionToolSchema = createPlannerToolSchema(
  PLAN_METRIC_TABLE_DEFINITION_TOOL_NAME,
  'Submit one TimescaleDB metric table definition plan.',
  PLAN_METRIC_TABLE_DEFINITION_STEP_ID,
  {
    type: 'object',
    additionalProperties: false,
    required: ['metricTableDefinition', 'defsPlan'],
    properties: {
      metricTableDefinition: { type: 'object', additionalProperties: true },
      defsPlan: { type: 'object', additionalProperties: true },
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
  if (!agent || !step) throw new Error('[agentPlanMetricTableDefinition](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) metric table selector args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const finalPlan = getFinalizeSolutionPlanOutput(context);
  const persistenceIndex = getPlanPersistenceIndexOutput(context);
  const tableDefinitions = getPlanTableDefinitionOutputs(context);
  const metricsIndex = getPlanMetricsIndexOutput(context);
  const metricIndexItem = metricsIndex.result.metricTables.find(table => table.metricTableId === args);
  if (!metricIndexItem) throw new Error(`[${agent.agentName}](beforePromptStep) metric table selector not found: ${args}`);

  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(PLAN_METRIC_TABLE_DEFINITION_TOOL_NAME),
      buildHumanPrompt(args, finalPlan, persistenceIndex, tableDefinitions, metricsIndex, metricIndexItem),
      planMetricTableDefinitionToolSchema,
      PLAN_METRIC_TABLE_DEFINITION_TOOL_NAME
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
  let output: PlanMetricTableDefinitionOutput | undefined;

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    output = extractPlanMetricTableDefinitionOutput(payload);
    validatePlanMetricTableDefinitionOutput(output);
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentPlanMetricTableDefinition returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentPlanMetricTableDefinition returned status needs_input; keeping metric table definition draft.';
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  const intents: mls.msg.AgentIntent[] = [
    createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined),
  ];

  if (status === 'completed' && output) intents.push(...createNextMetricTableDefinitionIntent(context, output));
  return intents;
}

export function getPlanMetricTableDefinitionOutputs(context: mls.msg.ExecutionContext): PlanMetricTableDefinitionOutput[] {
  return getPlannerOutputs(context, 'agentPlanMetricTableDefinition', planMetricTableDefinitionConfig, validatePlanMetricTableDefinitionOutput);
}

function extractPlanMetricTableDefinitionOutput(payload: unknown): PlanMetricTableDefinitionOutput {
  return extractPlannerOutput(payload, planMetricTableDefinitionConfig);
}

const planMetricTableDefinitionConfig = {
  toolName: PLAN_METRIC_TABLE_DEFINITION_TOOL_NAME,
  stepId: PLAN_METRIC_TABLE_DEFINITION_STEP_ID,
  stepIdAliases: PLAN_METRIC_TABLE_DEFINITION_ALIASES,
  normalizeResult: normalizePlanMetricTableDefinitionResult,
};

function normalizePlanMetricTableDefinitionResult(value: unknown): PlanMetricTableDefinitionResult {
  const result = assertRecord(value, 'result');
  const metricTableDefinition = assertRecord(result.metricTableDefinition, 'result.metricTableDefinition');
  const defsPlan = assertRecord(result.defsPlan, 'result.defsPlan');
  return {
    metricTableDefinition: {
      ...metricTableDefinition,
      metricTableId: assertString(metricTableDefinition.metricTableId, 'result.metricTableDefinition.metricTableId'),
      tableName: assertString(metricTableDefinition.tableName, 'result.metricTableDefinition.tableName'),
      moduleId: assertString(metricTableDefinition.moduleId, 'result.metricTableDefinition.moduleId'),
      tableKind: assertString(metricTableDefinition.tableKind, 'result.metricTableDefinition.tableKind'),
      storageEngine: assertString(metricTableDefinition.storageEngine, 'result.metricTableDefinition.storageEngine'),
      layer: assertString(metricTableDefinition.layer, 'result.metricTableDefinition.layer'),
      accessPolicy: assertRecord(metricTableDefinition.accessPolicy, 'result.metricTableDefinition.accessPolicy'),
    },
    defsPlan: {
      fileName: assertString(defsPlan.fileName, 'result.defsPlan.fileName'),
      exportName: assertString(defsPlan.exportName, 'result.defsPlan.exportName'),
      saveAsDefs: Boolean(defsPlan.saveAsDefs),
    },
  };
}

function validatePlanMetricTableDefinitionOutput(output: PlanMetricTableDefinitionOutput): void {
  const table = output.result.metricTableDefinition;
  if (table.layer !== 'layer_1_external') throw new Error(`metric table ${table.metricTableId} must be in layer_1_external`);
  if (table.tableKind !== 'metricTimeseries') throw new Error(`metric table ${table.metricTableId} must be metricTimeseries`);
  if (table.storageEngine !== 'postgresTimescaleDB') throw new Error(`metric table ${table.metricTableId} must use postgresTimescaleDB`);
  const directAccess = assertArray(table.accessPolicy.directAccessAllowedFor, 'metricTableDefinition.accessPolicy.directAccessAllowedFor');
  if (!directAccess.includes('layer_3_usecases')) throw new Error(`metric table ${table.metricTableId} must allow direct access for layer_3_usecases`);
  if (output.status === 'needs_input' && output.questions.length === 0) throw new Error('needs_input metric table definition must include questions');
}

function createNextMetricTableDefinitionIntent(context: mls.msg.ExecutionContext, currentOutput: PlanMetricTableDefinitionOutput): mls.msg.AgentIntent[] {
  const metricsIndex = getPlanMetricsIndexOutput(context);
  const covered = new Set(getPlanMetricTableDefinitionOutputs(context).map(output => output.result.metricTableDefinition.metricTableId));
  covered.add(currentOutput.result.metricTableDefinition.metricTableId);

  const nextTable = metricsIndex.result.metricTables.find(table => !covered.has(table.metricTableId));
  const placeholder = findStepByPlanId(context, 'plan-metric-table-definition') as mls.msg.AIAgentStep | null;
  if (!placeholder || placeholder.type !== 'agent') return [];

  if (nextTable) {
    return [
      createDynamicAgentStepIntent(
        context,
        placeholder,
        'agentPlanMetricTableDefinition',
        `plan-metric-table-definition:${nextTable.metricTableId}`,
        `Plan metric table ${nextTable.metricTableId}`,
        nextTable.metricTableId
      ),
    ];
  }

  return [createPlannerUpdateStatusIntent(context, placeholder, placeholder, 0, 'completed', 'All dynamic metric table definitions completed.')];
}

function buildHumanPrompt(
  args: string,
  finalPlan: FinalSolutionPlanOutput,
  persistenceIndex: PlanPersistenceIndexOutput,
  tableDefinitions: PlanTableDefinitionOutput[],
  metricsIndex: PlanMetricsIndexOutput,
  metricIndexItem: unknown,
): string {
  return `## Current metric table selector
${args}

## Selected metric table index item
${JSON.stringify(metricIndexItem, null, 2)}

## Final solution plan
${JSON.stringify(finalPlan, null, 2)}

## Persistence index
${JSON.stringify(persistenceIndex, null, 2)}

## Table definitions
${JSON.stringify(tableDefinitions, null, 2)}

## Metrics index
${JSON.stringify(metricsIndex, null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codepro -->

You are agentPlanMetricTableDefinition for the collab.codes "newSolution" flow.
Plan exactly one TimescaleDB metric table definition for the current metric table selector.
Use the same language as the user for titles, descriptions, questions, and trace.
Use snake_case for table names and camelCase for ids.

## Tool mode
Call the "{{toolName}}" tool with the complete structured result.
Do not return prose.

## Rules
- Generate one metric table only: the metric table whose metricTableId equals the current selector.
- Metric tables are additional tables; do not replace normal transactional tables.
- The table must be in layer_1_external, but direct access must be allowed only for layer_3_usecases.
- Declare the base table updates that feed the metric table.
- Declare that pages and BFF controllers cannot update this metric table directly.
- updatePolicy.updatedByLayer must be layer_3_usecases.
- defsPlan.fileName should be stable and metric-table-specific, such as tables/{metricTableId}.defs.ts.
- Do not generate TypeScript code.

## Content Memory
actualDate: 2026-06-05
userName: Wagner
taskName: newModule
flowName: newSolution
`;
