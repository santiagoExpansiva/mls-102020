/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanMetricTableDefinition.ts" enhancement="_102027_/l2/enhancementAgent"/>

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
import { getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import type { FinalSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import { readSavedPlanArtifactDataList, saveNewSolutionAgentTracePayload, saveNewSolutionPlanArtifacts } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { getPlanMetricsIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricsIndex.js';
import type { PlanMetricsIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricsIndex.js';
import { getPlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import type { PlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import { getPlanTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';
import type { PlanTableDefinitionOutput } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';

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

export interface MetricTableHypertableIndex {
  indexName: string;
  columns: string[];
  purpose: string;
  unique?: boolean;
}

export interface MetricTableHypertable {
  timeColumn: string;
  chunkTimeInterval: string;
  retentionPolicy: string;
  compressionPolicy?: string;
  indexes: MetricTableHypertableIndex[];
}

export interface PlanMetricTableDefinitionResult {
  metricTableDefinition: Record<string, unknown> & {
    metricTableId: string;
    tableName: string;
    moduleId: string;
    tableKind: string;
    storageEngine: string;
    layer: string;
    timeColumn: string;
    hypertable: MetricTableHypertable;
    accessPolicy: Record<string, unknown>;
  };
  defsPlan: {
    fileName: string;
    exportName: string;
    saveAsDefs: boolean;
  };
}

export type PlanMetricTableDefinitionOutput = PlannerOutput<PlanMetricTableDefinitionResult>;

const planMetricTableDefinitionToolSchema = createPlannerVariableToolSchema(
  PLAN_METRIC_TABLE_DEFINITION_TOOL_NAME,
  'Submit one TimescaleDB metric table definition plan.',
  {
    type: 'object',
    additionalProperties: false,
    required: ['metricTableDefinition', 'defsPlan'],
    properties: {
      metricTableDefinition: {
        type: 'object',
        additionalProperties: false,
        required: [
          'metricTableId',
          'tableName',
          'moduleId',
          'tableKind',
          'storageEngine',
          'layer',
          'timeColumn',
          'columns',
          'dimensions',
          'measures',
          'sourceWriteEvents',
          'updatePolicy',
          'accessPolicy',
          'hypertable',
        ],
        properties: {
          metricTableId: { type: 'string' },
          tableName: { type: 'string' },
          moduleId: { type: 'string' },
          title: { type: 'string' },
          purpose: { type: 'string' },
          tableKind: { enum: ['metricTimeseries', 'metric'] },
          storageEngine: { const: 'postgresTimescaleDB' },
          layer: { const: 'layer_1_external' },
          timeColumn: { type: 'string' },
          columns: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'type', 'nullable'],
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                nullable: { type: 'boolean' },
                default: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
                description: { type: 'string' },
              },
            },
          },
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
              required: ['measureId', 'column', 'aggregation'],
              properties: {
                measureId: { type: 'string' },
                column: { type: 'string' },
                aggregation: { type: 'string' },
                unit: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
          sourceWriteEvents: { type: 'array', items: { type: 'string' } },
          hypertable: {
            type: 'object',
            additionalProperties: false,
            required: ['timeColumn', 'chunkTimeInterval', 'retentionPolicy', 'indexes'],
            properties: {
              timeColumn: { type: 'string' },
              chunkTimeInterval: { type: 'string' },
              retentionPolicy: { type: 'string' },
              compressionPolicy: { type: 'string' },
              indexes: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['indexName', 'columns', 'purpose'],
                  properties: {
                    indexName: { type: 'string' },
                    columns: { type: 'array', items: { type: 'string' } },
                    purpose: { type: 'string' },
                    unique: { type: 'boolean' },
                  },
                },
              },
            },
          },
          updatePolicy: {
            type: 'object',
            additionalProperties: false,
            required: ['updatedByLayer', 'pagesMayUpdate', 'controllersMayUpdate'],
            properties: {
              updatedByLayer: { const: 'layer_3_usecases' },
              pagesMayUpdate: { const: false },
              controllersMayUpdate: { const: false },
              usecaseRefs: { type: 'array', items: { type: 'string' } },
            },
          },
          accessPolicy: {
            type: 'object',
            additionalProperties: false,
            required: ['directAccessAllowedFor'],
            properties: {
              directAccessAllowedFor: { type: 'array', items: { enum: ['layer_3_usecases'] } },
              forbiddenFor: { type: 'array', items: { enum: ['pages', 'layer_2_controllers', 'agents'] } },
            },
          },
          rulesApplied: { type: 'array', items: { type: 'string' } },
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
  if (!agent || !step) throw new Error('[agentPlanMetricTableDefinition](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) metric table selector args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const finalPlan = getFinalizeSolutionPlanOutput(context);
  const persistenceIndex = getPlanPersistenceIndexOutput(context);
  const tableDefinitions = await getPlanTableDefinitionOutputs(context);
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

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);

  // /023: clear the full payload only when the .defs.ts was saved; getters and
  // the covered-set computation now read metric table definitions back from the saved files.
  let cleaner: 'input' | 'input_output' | undefined;
  if (status === 'completed' && output) {
    const saved = await saveNewSolutionPlanArtifacts(context, agent.agentName, step, output);
    cleaner = saved.length > 0 ? 'input_output' : 'input';
  }

  // T-006: when this child is the last live one, reconcile the approved index selectors vs the
  // saved artifacts; re-spawn missing children (limited rounds) before the fan-out is finalized.
  const reconcileIntents = await buildMetricTableFanOutReconcileIntents(context, parentStep, step, hookSequential);

  // Parallel fan-out: the metrics index opened all metric-table children at once, so this step
  // only validates/saves its own table and reports status — it does NOT chain the next one.
  return [...reconcileIntents, createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, cleaner)];
}

// T-006: expected selectors come from the approved metrics index; saved selectors from the
// plan artifacts manifest ('metricTable' artifacts). Best-effort: never throws.
async function buildMetricTableFanOutReconcileIntents(
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
): Promise<mls.msg.AgentIntent[]> {
  try {
    const expectedSelectors = getPlanMetricsIndexOutput(context).result.metricTables.map(table => table.metricTableId);
    const savedSelectors = new Set<string>();
    for (const data of await readSavedPlanArtifactDataList(context, 'metricTable')) {
      const table = data.metricTableDefinition;
      const id = table && typeof table === 'object' ? (table as Record<string, unknown>).metricTableId : undefined;
      if (typeof id === 'string' && id) savedSelectors.add(id);
    }
    return reconcileParallelDynamicFanOut(context, parentStep, step, hookSequential, { expectedSelectors, savedSelectors });
  } catch (error) {
    console.warn('[agentPlanMetricTableDefinition] fan-out reconcile skipped:', error);
    return [];
  }
}

// /023: also reads metric table definitions back from saved .defs.ts when the
// task payload was cleared with cleaner="input_output".
export function getPlanMetricTableDefinitionOutputs(context: mls.msg.ExecutionContext): Promise<PlanMetricTableDefinitionOutput[]> {
  return getPlannerOutputsWithFileFallback(
    context,
    'agentPlanMetricTableDefinition',
    'metricTable',
    planMetricTableDefinitionConfig,
    output => output.result.metricTableDefinition.metricTableId,
    validatePlanMetricTableDefinitionOutput,
  );
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
  const rawTableKind = assertString(metricTableDefinition.tableKind, 'result.metricTableDefinition.tableKind');
  const hypertable = assertRecord(metricTableDefinition.hypertable, 'result.metricTableDefinition.hypertable');
  return {
    metricTableDefinition: {
      ...metricTableDefinition,
      metricTableId: assertString(metricTableDefinition.metricTableId, 'result.metricTableDefinition.metricTableId'),
      tableName: assertString(metricTableDefinition.tableName, 'result.metricTableDefinition.tableName'),
      moduleId: assertString(metricTableDefinition.moduleId, 'result.metricTableDefinition.moduleId'),
      tableKind: rawTableKind === 'metric' ? 'metricTimeseries' : rawTableKind,
      storageEngine: assertString(metricTableDefinition.storageEngine, 'result.metricTableDefinition.storageEngine'),
      layer: assertString(metricTableDefinition.layer, 'result.metricTableDefinition.layer'),
      timeColumn: assertString(metricTableDefinition.timeColumn, 'result.metricTableDefinition.timeColumn'),
      hypertable: normalizeMetricTableHypertable(hypertable, 'result.metricTableDefinition.hypertable'),
      accessPolicy: assertRecord(metricTableDefinition.accessPolicy, 'result.metricTableDefinition.accessPolicy'),
    },
    defsPlan: {
      fileName: assertString(defsPlan.fileName, 'result.defsPlan.fileName'),
      exportName: assertString(defsPlan.exportName, 'result.defsPlan.exportName'),
      saveAsDefs: assertBoolean(defsPlan.saveAsDefs, 'result.defsPlan.saveAsDefs'),
    },
  };
}

function normalizeMetricTableHypertable(value: Record<string, unknown>, path: string): MetricTableHypertable {
  return {
    timeColumn: assertString(value.timeColumn, `${path}.timeColumn`),
    chunkTimeInterval: assertString(value.chunkTimeInterval, `${path}.chunkTimeInterval`),
    retentionPolicy: assertString(value.retentionPolicy, `${path}.retentionPolicy`),
    compressionPolicy: optionalStringValue(value.compressionPolicy),
    indexes: assertArray(value.indexes, `${path}.indexes`).map((index, i) => normalizeMetricTableHypertableIndex(index, `${path}.indexes[${i}]`)),
  };
}

function normalizeMetricTableHypertableIndex(value: unknown, path: string): MetricTableHypertableIndex {
  const index = assertRecord(value, path);
  return {
    indexName: assertString(index.indexName, `${path}.indexName`),
    columns: assertArray(index.columns, `${path}.columns`).map((column, i) => assertString(column, `${path}.columns[${i}]`)),
    purpose: assertString(index.purpose, `${path}.purpose`),
    unique: typeof index.unique === 'boolean' ? index.unique : undefined,
  };
}

function optionalStringValue(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error('optional string value must be a string');
  return value.trim() || undefined;
}

function assertBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean`);
  return value;
}

function validatePlanMetricTableDefinitionOutput(output: PlanMetricTableDefinitionOutput): void {
  const table = output.result.metricTableDefinition;
  if (table.layer !== 'layer_1_external') throw new Error(`metric table ${table.metricTableId} must be in layer_1_external`);
  if (table.tableKind !== 'metricTimeseries') throw new Error(`metric table ${table.metricTableId} must be metricTimeseries`);
  if (table.storageEngine !== 'postgresTimescaleDB') throw new Error(`metric table ${table.metricTableId} must use postgresTimescaleDB`);
  validateMetricTableHypertable(table);
  const directAccess = assertArray(table.accessPolicy.directAccessAllowedFor, 'metricTableDefinition.accessPolicy.directAccessAllowedFor');
  if (!directAccess.includes('layer_3_usecases')) throw new Error(`metric table ${table.metricTableId} must allow direct access for layer_3_usecases`);
  if (output.status === 'needs_input' && output.questions.length === 0) throw new Error('needs_input metric table definition must include questions');
}

function validateMetricTableHypertable(table: PlanMetricTableDefinitionResult['metricTableDefinition']): void {
  if (!table.timeColumn.trim()) throw new Error(`metric table ${table.metricTableId} timeColumn must be a non-empty string`);
  if (!table.hypertable.timeColumn.trim()) throw new Error(`metric table ${table.metricTableId} hypertable.timeColumn must be a non-empty string`);
  if (table.hypertable.timeColumn !== table.timeColumn) {
    throw new Error(`metric table ${table.metricTableId} hypertable.timeColumn must match timeColumn`);
  }
  if (!table.hypertable.chunkTimeInterval.trim()) throw new Error(`metric table ${table.metricTableId} hypertable.chunkTimeInterval must be a non-empty string`);
  if (!table.hypertable.retentionPolicy.trim()) throw new Error(`metric table ${table.metricTableId} hypertable.retentionPolicy must be a non-empty string`);
  if (table.hypertable.indexes.length === 0) throw new Error(`metric table ${table.metricTableId} hypertable.indexes must include at least one index`);

  let hasTimeIndex = false;
  for (const index of table.hypertable.indexes) {
    if (!index.indexName.trim()) throw new Error(`metric table ${table.metricTableId} hypertable indexName must be a non-empty string`);
    if (index.columns.length === 0) throw new Error(`metric table ${table.metricTableId} hypertable index ${index.indexName} must include columns`);
    if (index.columns.some(column => column === table.timeColumn)) hasTimeIndex = true;
  }
  if (!hasTimeIndex) throw new Error(`metric table ${table.metricTableId} hypertable.indexes must include the timeColumn`);
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
<!-- modelType: codeinstruct -->
<!-- x-tool-strict: true -->

You are agentPlanMetricTableDefinition for the collab.codes "newSolution" flow.
Plan exactly one TimescaleDB metric table definition for the current metric table selector.
Use the same language as the user for titles, descriptions, questions, and trace.
Use snake_case for table names and camelCase for ids.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## Rules
- Generate one metric table only: the metric table whose metricTableId equals the current selector.
- metricTableDefinition.tableKind must be exactly "metricTimeseries"; do not use "metric".
- Metric tables are additional tables; do not replace normal transactional tables.
- The table must be in layer_1_external, but direct access must be allowed only for layer_3_usecases.
- Declare the base table updates that feed the metric table.
- metricTableDefinition must include timeColumn and a hypertable object.
- hypertable.timeColumn must equal metricTableDefinition.timeColumn.
- hypertable.chunkTimeInterval must define the TimescaleDB chunk policy, such as "7 days" or another explicit interval.
- hypertable.retentionPolicy must define the retention window.
- hypertable.indexes must include at least one index whose columns include the timeColumn, plus dimension indexes when dimensions exist.
- dimensions must include the FK columns of the source entities' direct ontology relationships (e.g. Deal related to Lead means this metric table needs a lead_id dimension), and never drop the dimensions declared in the metrics index item.
- Declare that pages and BFF controllers cannot update this metric table directly.
- updatePolicy.updatedByLayer must be layer_3_usecases.
- defsPlan.fileName should be stable and metric-table-specific, such as tables/{metricTableId}.defs.ts.
- Do not generate TypeScript code.
`;
