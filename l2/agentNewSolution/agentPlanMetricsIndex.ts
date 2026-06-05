/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanMetricsIndex.ts" enhancement="_102027_/l2/enhancementAgent"/>

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
  getPlanningContextSnapshot,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { FinalSolutionPlanOutput, getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import { PlanPersistenceIndexOutput, getPlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import { PlanTableDefinitionOutput, getPlanTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentPlanMetricsIndex',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Plan the operational metrics index for the module',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const PLAN_METRICS_INDEX_TOOL_NAME = 'submitMetricsIndex';
export const PLAN_METRICS_INDEX_STEP_ID = '14-plan-metrics-index';
const PLAN_METRICS_INDEX_ALIASES = [PLAN_METRICS_INDEX_STEP_ID, 'plan-metrics-index'];

export interface MetricTableIndexItem {
  metricTableId: string;
  tableName: string;
  title: string;
  purpose: string;
  storageEngine: string;
  sourceBaseTables: string[];
  sourceEntities: string[];
  sourceWriteEvents: string[];
  timeColumn: string;
  dimensions: unknown[];
  measures: unknown[];
  aggregationWindows: string[];
  retentionPolicy: string;
  priority: Priority;
  rulesApplied: string[];
  reason: string;
}

export interface PlanMetricsIndexResult {
  metricsPlan: Record<string, unknown> & {
    enabled: boolean;
    storageEngine: string;
  };
  metricTables: MetricTableIndexItem[];
  dashboardPages: unknown[];
}

export type PlanMetricsIndexOutput = PlannerOutput<PlanMetricsIndexResult>;

const planMetricsIndexToolSchema = createPlannerToolSchema(
  PLAN_METRICS_INDEX_TOOL_NAME,
  'Submit the module operational metrics index.',
  PLAN_METRICS_INDEX_STEP_ID,
  {
    type: 'object',
    additionalProperties: false,
    required: ['metricsPlan', 'metricTables', 'dashboardPages'],
    properties: {
      metricsPlan: { type: 'object', additionalProperties: true },
      metricTables: { type: 'array', items: { type: 'object', additionalProperties: true } },
      dashboardPages: { type: 'array', items: { type: 'object', additionalProperties: true } },
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
  if (!agent || !step) throw new Error('[agentPlanMetricsIndex](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const finalPlan = getFinalizeSolutionPlanOutput(context);
  const persistenceIndex = getPlanPersistenceIndexOutput(context);
  const tableDefinitions = getPlanTableDefinitionOutputs(context);
  const snapshot = getPlanningContextSnapshot(context);

  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(PLAN_METRICS_INDEX_TOOL_NAME),
      buildHumanPrompt(args, finalPlan, persistenceIndex, tableDefinitions, snapshot.initialMetricsRequested),
      planMetricsIndexToolSchema,
      PLAN_METRICS_INDEX_TOOL_NAME
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
  let output: PlanMetricsIndexOutput | undefined;

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    output = extractPlanMetricsIndexOutput(payload);
    validatePlanMetricsIndexOutput(output, getPlanningContextSnapshot(context).initialMetricsRequested);
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentPlanMetricsIndex returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentPlanMetricsIndex returned status needs_input; keeping metrics index draft.';
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  const intents: mls.msg.AgentIntent[] = [
    createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined),
  ];

  if (status === 'completed' && output) intents.push(...createFirstMetricTableDefinitionIntent(context, output));
  return intents;
}

export function getPlanMetricsIndexOutput(context: mls.msg.ExecutionContext): PlanMetricsIndexOutput {
  return getPlannerOutput(context, 'agentPlanMetricsIndex', planMetricsIndexConfig, output => validatePlanMetricsIndexOutput(output, getPlanningContextSnapshot(context).initialMetricsRequested));
}

function extractPlanMetricsIndexOutput(payload: unknown): PlanMetricsIndexOutput {
  return extractPlannerOutput(payload, planMetricsIndexConfig);
}

const planMetricsIndexConfig = {
  toolName: PLAN_METRICS_INDEX_TOOL_NAME,
  stepId: PLAN_METRICS_INDEX_STEP_ID,
  stepIdAliases: PLAN_METRICS_INDEX_ALIASES,
  normalizeResult: normalizePlanMetricsIndexResult,
};

function normalizePlanMetricsIndexResult(value: unknown): PlanMetricsIndexResult {
  const result = assertRecord(value, 'result');
  const metricsPlan = assertRecord(result.metricsPlan, 'result.metricsPlan');
  return {
    metricsPlan: {
      ...metricsPlan,
      enabled: Boolean(metricsPlan.enabled),
      storageEngine: assertString(metricsPlan.storageEngine, 'result.metricsPlan.storageEngine'),
    },
    metricTables: assertArray(result.metricTables, 'result.metricTables').map((item, index) => normalizeMetricTableIndexItem(item, `result.metricTables[${index}]`)),
    dashboardPages: assertArray(result.dashboardPages, 'result.dashboardPages'),
  };
}

function normalizeMetricTableIndexItem(value: unknown, path: string): MetricTableIndexItem {
  const table = assertRecord(value, path);
  return {
    metricTableId: assertString(table.metricTableId, `${path}.metricTableId`),
    tableName: assertString(table.tableName, `${path}.tableName`),
    title: assertString(table.title, `${path}.title`),
    purpose: assertString(table.purpose, `${path}.purpose`),
    storageEngine: assertString(table.storageEngine, `${path}.storageEngine`),
    sourceBaseTables: normalizeStringArray(table.sourceBaseTables, `${path}.sourceBaseTables`),
    sourceEntities: normalizeStringArray(table.sourceEntities, `${path}.sourceEntities`),
    sourceWriteEvents: normalizeStringArray(table.sourceWriteEvents, `${path}.sourceWriteEvents`),
    timeColumn: assertString(table.timeColumn, `${path}.timeColumn`),
    dimensions: assertArray(table.dimensions, `${path}.dimensions`),
    measures: assertArray(table.measures, `${path}.measures`),
    aggregationWindows: normalizeStringArray(table.aggregationWindows, `${path}.aggregationWindows`),
    retentionPolicy: assertString(table.retentionPolicy, `${path}.retentionPolicy`),
    priority: assertPriority(table.priority, `${path}.priority`),
    rulesApplied: normalizeStringArray(table.rulesApplied, `${path}.rulesApplied`),
    reason: assertString(table.reason, `${path}.reason`),
  };
}

function validatePlanMetricsIndexOutput(output: PlanMetricsIndexOutput, initialMetricsRequested: boolean): void {
  if (output.status === 'ok' && initialMetricsRequested) {
    if (!output.result.metricsPlan.enabled) throw new Error('initial metrics requested, but metricsPlan.enabled is false');
    if (output.result.metricTables.length === 0) throw new Error('initial metrics requested, but metricTables is empty');
    if (output.result.dashboardPages.length === 0) throw new Error('initial metrics requested, but dashboardPages is empty');
  }
  for (const table of output.result.metricTables) {
    if (table.storageEngine !== 'postgresTimescaleDB') throw new Error(`metric table ${table.metricTableId} must use postgresTimescaleDB`);
  }
  if (output.status === 'needs_input' && output.questions.length === 0) throw new Error('needs_input metrics index must include questions');
}

function createFirstMetricTableDefinitionIntent(context: mls.msg.ExecutionContext, output: PlanMetricsIndexOutput): mls.msg.AgentIntent[] {
  const placeholder = findStepByPlanId(context, 'plan-metric-table-definition') as mls.msg.AIAgentStep | null;
  if (!placeholder || placeholder.type !== 'agent' || placeholder.status === 'completed') return [];

  const firstTable = output.result.metricTables[0];
  if (!firstTable) {
    return [createPlannerUpdateStatusIntent(context, placeholder, placeholder, 0, 'completed', 'No metric tables to define.')];
  }

  return [
    createDynamicAgentStepIntent(
      context,
      placeholder,
      'agentPlanMetricTableDefinition',
      `plan-metric-table-definition:${firstTable.metricTableId}`,
      `Plan metric table ${firstTable.metricTableId}`,
      firstTable.metricTableId
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
  initialMetricsRequested: boolean,
): string {
  return `## Planned step args
${args}

## Initial metrics/dashboard requested
${initialMetricsRequested}

## Final solution plan
${JSON.stringify(finalPlan, null, 2)}

## Persistence index
${JSON.stringify(persistenceIndex, null, 2)}

## Table definitions
${JSON.stringify(tableDefinitions, null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codepro -->

You are agentPlanMetricsIndex for the collab.codes "newSolution" flow.
Plan only the metrics index for the module.
Use the same language as the user for titles, purposes, reasons, questions, and trace.
Use English camelCase identifiers for metricTableId and snake_case tableName values.

## Tool mode
Call the "{{toolName}}" tool with the complete structured result.
Do not return prose.

## Rules
- Generate metrics only when the clarification or implementation decisions approve initial metrics/dashboard.
- Dashboards generated by this step must be admin-only unless approved decisions say otherwise.
- Metric tables must be separate from normal transactional tables.
- Metric tables must use storageEngine "postgresTimescaleDB" for time-series operational metrics.
- Derive metrics from base table updates, lifecycle transitions, and operational risks.
- Do not update metrics from pages.
- Metrics must be updated by backend use cases in layer_3_usecases.
- Use sourceWriteEvents to list the base table updates that feed each metric table.
- Do not generate TypeScript code.

## Content Memory
actualDate: 2026-06-05
userName: Wagner
taskName: newModule
flowName: newSolution
`;
