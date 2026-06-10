/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanMetricsIndex.ts" enhancement="_102027_/l2/enhancementAgent"/>

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
  createParallelDynamicAgentStepIntent,
  createHoldIndexForReviewIntents,
  createPlannerPromptReadyIntent,
  createPlannerVariableToolSchema,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  findStepByPlanId,
  getPlannerOutputWithRepair,
  getPlanningContextSnapshot,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import type { FinalSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import { saveNewSolutionAgentTracePayload } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { getPlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import type { PlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import { getPlanTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';
import type { PlanTableDefinitionOutput } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';

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

export const PLAN_METRICS_INDEX_RESULT_SCHEMA: Record<string, unknown> = {
    type: 'object',
    additionalProperties: false,
    required: ['metricsPlan', 'metricTables', 'dashboardPages'],
    properties: {
      metricsPlan: {
        type: 'object',
        additionalProperties: false,
        required: ['enabled', 'storageEngine'],
        properties: {
          enabled: { type: 'boolean' },
          storageEngine: { const: 'postgresTimescaleDB' },
          moduleId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          updateResponsibility: { const: 'layer_3_usecases' },
          derivationSources: { type: 'array', items: { enum: ['baseTableUpdates', 'lifecycleTransitions', 'operationalRisks'] } },
        },
      },
      metricTables: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'metricTableId',
            'tableName',
            'title',
            'purpose',
            'storageEngine',
            'sourceBaseTables',
            'sourceEntities',
            'sourceWriteEvents',
            'timeColumn',
            'dimensions',
            'measures',
            'aggregationWindows',
            'retentionPolicy',
            'priority',
            'rulesApplied',
            'reason',
          ],
          properties: {
            metricTableId: { type: 'string' },
            tableName: { type: 'string' },
            title: { type: 'string' },
            purpose: { type: 'string' },
            storageEngine: { const: 'postgresTimescaleDB' },
            sourceBaseTables: { type: 'array', items: { type: 'string' } },
            sourceEntities: { type: 'array', items: { type: 'string' } },
            sourceWriteEvents: { type: 'array', items: { type: 'string' } },
            timeColumn: { type: 'string' },
            dimensions: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['dimensionId', 'column', 'type'],
                properties: {
                  dimensionId: { type: 'string' },
                  column: { type: 'string' },
                  type: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
            measures: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['measureId', 'column', 'type', 'aggregation'],
                properties: {
                  measureId: { type: 'string' },
                  column: { type: 'string' },
                  type: { type: 'string' },
                  aggregation: { type: 'string' },
                  unit: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
            aggregationWindows: { type: 'array', items: { type: 'string' } },
            retentionPolicy: { type: 'string' },
            priority: { enum: ['now', 'soon', 'later', 'never'] },
            rulesApplied: { type: 'array', items: { type: 'string' } },
            reason: { type: 'string' },
          },
        },
      },
      dashboardPages: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['metricDashboardId', 'title', 'actor', 'accessPolicy', 'priority', 'sources', 'widgets'],
          properties: {
            metricDashboardId: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            actor: { type: 'string' },
            accessPolicy: { type: 'string' },
            priority: { enum: ['now', 'soon', 'later', 'never'] },
            sources: { type: 'array', items: { type: 'string' } },
            widgets: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['widgetId', 'title', 'metricId', 'type', 'sourceMetricTable'],
                properties: {
                  widgetId: { type: 'string' },
                  title: { type: 'string' },
                  metricId: { type: 'string' },
                  type: { type: 'string' },
                  sourceMetricTable: { type: 'string' },
                },
              },
            },
            rulesApplied: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
};

const planMetricsIndexToolSchema = createPlannerVariableToolSchema(
  PLAN_METRICS_INDEX_TOOL_NAME,
  'Submit the module operational metrics index.',
  PLAN_METRICS_INDEX_RESULT_SCHEMA
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
  const tableDefinitions = await getPlanTableDefinitionOutputs(context);
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

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);

  // TODO-FINAL-023/024: hold the step open and run critic/repair before metric table definitions.
  if (status === 'completed' && output && output.status === 'ok') {
    return createHoldIndexForReviewIntents(context, parentStep, step, hookSequential, 'metricsIndex');
  }

  const intents: mls.msg.AgentIntent[] = [
    createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined),
  ];

  if (status === 'completed' && output) intents.push(...createMetricTableDefinitionParallelIntent(context, output));
  return intents;
}

export function getPlanMetricsIndexOutput(context: mls.msg.ExecutionContext): PlanMetricsIndexOutput {
  // TODO-FINAL-024: prefer the latest repaired index when a repair step exists.
  return getPlannerOutputWithRepair(context, 'agentPlanMetricsIndex', 'metricsIndex', planMetricsIndexConfig, output => validatePlanMetricsIndexOutput(output, getPlanningContextSnapshot(context).initialMetricsRequested));
}

function extractPlanMetricsIndexOutput(payload: unknown): PlanMetricsIndexOutput {
  return extractPlannerOutput(payload, planMetricsIndexConfig);
}

export const planMetricsIndexConfig = {
  toolName: PLAN_METRICS_INDEX_TOOL_NAME,
  stepId: PLAN_METRICS_INDEX_STEP_ID,
  stepIdAliases: PLAN_METRICS_INDEX_ALIASES,
  normalizeResult: normalizePlanMetricsIndexResult,
};

export function normalizePlanMetricsIndexResult(value: unknown): PlanMetricsIndexResult {
  const result = assertRecord(value, 'result');
  const metricsPlan = assertRecord(result.metricsPlan, 'result.metricsPlan');
  const metricTables = assertArray(result.metricTables, 'result.metricTables').map((item, index) => normalizeMetricTableIndexItem(item, `result.metricTables[${index}]`));
  return {
    metricsPlan: {
      ...metricsPlan,
      enabled: assertBoolean(metricsPlan.enabled, 'result.metricsPlan.enabled'),
      storageEngine: assertString(metricsPlan.storageEngine, 'result.metricsPlan.storageEngine'),
    },
    metricTables,
    dashboardPages: assertArray(result.dashboardPages, 'result.dashboardPages').map((item, index) => normalizeDashboardPage(item, `result.dashboardPages[${index}]`)),
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
    dimensions: assertArray(table.dimensions, `${path}.dimensions`).map((item, index) => normalizeMetricDimension(item, `${path}.dimensions[${index}]`)),
    measures: assertArray(table.measures, `${path}.measures`).map((item, index) => normalizeMetricMeasure(item, `${path}.measures[${index}]`)),
    aggregationWindows: normalizeStringArray(table.aggregationWindows, `${path}.aggregationWindows`),
    retentionPolicy: assertString(table.retentionPolicy, `${path}.retentionPolicy`),
    priority: assertPriority(table.priority, `${path}.priority`),
    rulesApplied: normalizeStringArray(table.rulesApplied, `${path}.rulesApplied`),
    reason: assertString(table.reason, `${path}.reason`),
  };
}

function normalizeMetricDimension(value: unknown, path: string): unknown {
  const dimension = assertRecord(value, path);
  assertString(dimension.dimensionId, `${path}.dimensionId`);
  assertString(dimension.column, `${path}.column`);
  assertString(dimension.type, `${path}.type`);
  if (dimension.description !== undefined) assertString(dimension.description, `${path}.description`);
  return dimension;
}

function normalizeMetricMeasure(value: unknown, path: string): unknown {
  const measure = assertRecord(value, path);
  assertString(measure.measureId, `${path}.measureId`);
  assertString(measure.column, `${path}.column`);
  assertString(measure.type, `${path}.type`);
  assertString(measure.aggregation, `${path}.aggregation`);
  if (measure.unit !== undefined) assertString(measure.unit, `${path}.unit`);
  if (measure.description !== undefined) assertString(measure.description, `${path}.description`);
  return measure;
}

function normalizeDashboardPage(value: unknown, path: string): unknown {
  const page = assertRecord(value, path);
  assertString(page.metricDashboardId, `${path}.metricDashboardId`);
  assertString(page.title, `${path}.title`);
  assertString(page.actor, `${path}.actor`);
  assertString(page.accessPolicy, `${path}.accessPolicy`);
  assertPriority(page.priority, `${path}.priority`);
  normalizeStringArray(page.sources, `${path}.sources`);
  assertArray(page.widgets, `${path}.widgets`).forEach((item, index) => normalizeDashboardWidget(item, `${path}.widgets[${index}]`));
  if (page.rulesApplied !== undefined) normalizeStringArray(page.rulesApplied, `${path}.rulesApplied`);
  return page;
}

function normalizeDashboardWidget(value: unknown, path: string): unknown {
  const widget = assertRecord(value, path);
  assertString(widget.widgetId, `${path}.widgetId`);
  assertString(widget.title, `${path}.title`);
  assertString(widget.metricId, `${path}.metricId`);
  assertString(widget.type, `${path}.type`);
  assertString(widget.sourceMetricTable, `${path}.sourceMetricTable`);
  return widget;
}

export function validatePlanMetricsIndexOutput(output: PlanMetricsIndexOutput, initialMetricsRequested: boolean): void {
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

// Metric table definitions are independent per metricTableId, so they run in controlled
// parallel (like page/workflow definitions), not as a serial chain.
export function createMetricTableDefinitionParallelIntent(context: mls.msg.ExecutionContext, output: PlanMetricsIndexOutput): mls.msg.AgentIntent[] {
  const placeholder = findStepByPlanId(context, 'plan-metric-table-definition') as mls.msg.AIAgentStep | null;
  if (!placeholder || placeholder.type !== 'agent' || placeholder.status === 'completed') return [];

  const metricTableIds = output.result.metricTables.map(table => table.metricTableId);
  if (metricTableIds.length === 0) {
    return [createPlannerUpdateStatusIntent(context, placeholder, placeholder, 0, 'completed', 'No metric tables to define.')];
  }

  return [
    createParallelDynamicAgentStepIntent(
      context,
      placeholder,
      'agentPlanMetricTableDefinition',
      'plan-metric-table-definition:parallel',
      'Plan metric tables {{completed}}/{{total}}, errors: {{failed}}',
      metricTableIds,
      5
    ),
  ];
}

function normalizeStringArray(value: unknown, path: string): string[] {
  return assertArray(value, path).map((item, index) => assertString(item, `${path}[${index}]`));
}

function assertBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean`);
  return value;
}

function buildHumanPrompt(
  args: string,
  finalPlan: FinalSolutionPlanOutput,
  persistenceIndex: PlanPersistenceIndexOutput,
  tableDefinitions: PlanTableDefinitionOutput[],
  initialMetricsRequested: boolean,
): string {
  // TODO-FINAL-030 (R1): compact context. The metrics index needs approved metrics/dashboards,
  // capabilities and the base tables to derive metrics from — not the full final plan or full
  // table definitions (columns). Table summaries (id/name/rootEntity) are enough.
  const reduced = {
    initialMetricsRequested,
    finalPlan: compactFinalPlan(finalPlan.result),
    persistenceTables: summarizeRecords(persistenceIndex.result.tables, ['tableId', 'tableName', 'rootEntity', 'sourceEntities']),
    tableDefinitions: summarizeRecords(tableDefinitions.map(t => t.result.tableDefinition), ['tableId', 'tableName', 'rootEntity']),
  };

  return `## Planned step args
${args}

## Reduced metrics-planning context
${JSON.stringify(reduced, null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codepro -->
<!-- x-tool-strict: true -->

You are agentPlanMetricsIndex for the collab.codes "newSolution" flow.
Plan only the metrics index for the module.
Use the same language as the user for titles, purposes, reasons, questions, and trace.
Use English camelCase identifiers for metricTableId and snake_case tableName values.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## Rules
- Generate metrics only when the clarification or implementation decisions approve initial metrics/dashboard.
- Dashboards generated by this step must be admin-only unless approved decisions say otherwise.
- Metric tables must be separate from normal transactional tables.
- Metric tables must use storageEngine "postgresTimescaleDB" for time-series operational metrics.
- metricsPlan.storageEngine is required and must be "postgresTimescaleDB".
- Metric table index items must use string timeColumn, string[] sourceWriteEvents, string[] sourceBaseTables, dimensions[], measures[], aggregationWindows[], and retentionPolicy.
- dimensions must include the FK of every direct ontology relationship of the source entities (e.g. Deal related to Lead means the deal metric table needs a lead_id dimension).
- Derive metrics from base table updates, lifecycle transitions, and operational risks.
- Do not update metrics from pages.
- Metrics must be updated by backend use cases in layer_3_usecases.
- Use sourceWriteEvents to list the base table updates that feed each metric table.
- Do not generate TypeScript code.
`;
