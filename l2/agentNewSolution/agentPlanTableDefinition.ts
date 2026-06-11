/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanTableDefinition.ts" enhancement="_102027_/l2/enhancementAgent"/>

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
  optionalString,
  reconcileParallelDynamicFanOut,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import type { FinalSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import { readSavedPlanArtifactDataList, saveNewSolutionAgentTracePayload, saveNewSolutionPlanArtifacts } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { getPlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import type { PlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentPlanTableDefinition',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Plan one module-owned persistence table definition',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const PLAN_TABLE_DEFINITION_TOOL_NAME = 'submitTableDefinitionPlan';
export const PLAN_TABLE_DEFINITION_STEP_ID = '13-plan-table-definition';
const PLAN_TABLE_DEFINITION_ALIASES = [PLAN_TABLE_DEFINITION_STEP_ID, '13-plan-single-table', 'plan-table-definition'];

export interface PlanTableDefinitionResult {
  tableDefinition: Record<string, unknown> & {
    tableId: string;
    tableName: string;
    moduleId: string;
    layer: string;
    tableKind: string;
    accessPolicy: Record<string, unknown>;
  };
  defsPlan: {
    fileName: string;
    exportName: string;
    saveAsDefs: boolean;
  };
}

export type PlanTableDefinitionOutput = PlannerOutput<PlanTableDefinitionResult>;

const planTableDefinitionToolSchema = createPlannerVariableToolSchema(
  PLAN_TABLE_DEFINITION_TOOL_NAME,
  'Submit one module-owned persistence table definition plan.',
  {
    type: 'object',
    additionalProperties: false,
    required: ['tableDefinition', 'defsPlan'],
    properties: {
      tableDefinition: {
        type: 'object',
        additionalProperties: false,
        required: ['tableId', 'tableName', 'moduleId', 'ownership', 'layer', 'tableKind', 'accessPolicy'],
        properties: {
          tableId: { type: 'string' },
          tableName: { type: 'string' },
          moduleId: { type: 'string' },
          title: { type: 'string' },
          purpose: { type: 'string' },
          ownership: { const: 'moduleOwned' },
          rootEntity: { type: 'string' },
          layer: { const: 'layer_1_external' },
          tableKind: { const: 'transactional' },
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
                primaryKey: { type: 'boolean' },
                default: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
                description: { type: 'string' },
              },
            },
          },
          primaryKey: { type: 'array', items: { type: 'string' } },
          foreignRefs: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['fieldName', 'targetEntity', 'targetOwnership'],
              properties: {
                fieldName: { type: 'string' },
                targetEntity: { type: 'string' },
                targetOwnership: { enum: ['moduleOwned', 'mdmOwned', 'horizontalOwned', 'pluginOwned', 'existingModuleOwned', 'external'] },
                reason: { type: 'string' },
              },
            },
          },
          indexes: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['indexName', 'columns', 'reason'],
              properties: {
                indexName: { type: 'string' },
                columns: { type: 'array', items: { type: 'string' } },
                unique: { type: 'boolean' },
                reason: { type: 'string' },
              },
            },
          },
          detailsColumn: {
            type: 'object',
            additionalProperties: false,
            required: ['enabled'],
            properties: {
              enabled: { type: 'boolean' },
              columnName: { type: 'string' },
              jsonSchemaRef: { type: 'string' },
              reason: { type: 'string' },
            },
          },
          metricUpdatePolicy: {
            type: 'object',
            additionalProperties: false,
            required: ['feedsMetrics', 'updatedByLayer'],
            properties: {
              feedsMetrics: { type: 'boolean' },
              metricRefs: { type: 'array', items: { type: 'string' } },
              updatedByLayer: { const: 'layer_3_usecases' },
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
  if (!agent || !step) throw new Error('[agentPlanTableDefinition](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) table selector args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const finalPlan = getFinalizeSolutionPlanOutput(context);
  const persistenceIndex = getPlanPersistenceIndexOutput(context);
  const tableIndexItem = persistenceIndex.result.tables.find(table => table.tableId === args);
  if (!tableIndexItem) throw new Error(`[${agent.agentName}](beforePromptStep) table selector not found: ${args}`);

  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(PLAN_TABLE_DEFINITION_TOOL_NAME),
      buildHumanPrompt(args, finalPlan, persistenceIndex, tableIndexItem),
      planTableDefinitionToolSchema,
      PLAN_TABLE_DEFINITION_TOOL_NAME
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
  let output: PlanTableDefinitionOutput | undefined;

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    output = extractPlanTableDefinitionOutput(payload);
    validatePlanTableDefinitionOutput(output);
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentPlanTableDefinition returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentPlanTableDefinition returned status needs_input; keeping table definition draft.';
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);

  // /023: clear the full payload only when the .defs.ts was saved; getters and
  // the covered-set computation now read table definitions back from the saved files.
  let cleaner: 'input' | 'input_output' | undefined;
  if (status === 'completed' && output) {
    const saved = await saveNewSolutionPlanArtifacts(context, agent.agentName, step, output);
    cleaner = saved.length > 0 ? 'input_output' : 'input';
  }

  // T-006: when this child is the last live one, reconcile the approved index selectors vs the
  // saved artifacts; re-spawn missing children (limited rounds) before the fan-out is finalized.
  const reconcileIntents = await buildTableFanOutReconcileIntents(context, parentStep, step, hookSequential);

  // Parallel fan-out: the persistence index opened all table children at once, so this step
  // only validates/saves its own table and reports status — it does NOT chain the next one.
  return [...reconcileIntents, createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, cleaner)];
}

// T-006: expected selectors come from the approved persistence index; saved selectors from the
// plan artifacts manifest ('table' artifacts). Best-effort: never throws.
async function buildTableFanOutReconcileIntents(
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
): Promise<mls.msg.AgentIntent[]> {
  try {
    const expectedSelectors = getPlanPersistenceIndexOutput(context).result.tables.map(table => table.tableId);
    const savedSelectors = new Set<string>();
    for (const data of await readSavedPlanArtifactDataList(context, 'table')) {
      const table = data.tableDefinition;
      const id = table && typeof table === 'object' ? (table as Record<string, unknown>).tableId : undefined;
      if (typeof id === 'string' && id) savedSelectors.add(id);
    }
    return reconcileParallelDynamicFanOut(context, parentStep, step, hookSequential, { expectedSelectors, savedSelectors });
  } catch (error) {
    console.warn('[agentPlanTableDefinition] fan-out reconcile skipped:', error);
    return [];
  }
}

// /023: also reads table definitions back from saved .defs.ts when the task
// payload was cleared with cleaner="input_output".
export function getPlanTableDefinitionOutputs(context: mls.msg.ExecutionContext): Promise<PlanTableDefinitionOutput[]> {
  return getPlannerOutputsWithFileFallback(
    context,
    'agentPlanTableDefinition',
    'table',
    planTableDefinitionConfig,
    output => output.result.tableDefinition.tableId,
    validatePlanTableDefinitionOutput,
  );
}

function extractPlanTableDefinitionOutput(payload: unknown): PlanTableDefinitionOutput {
  return extractPlannerOutput(payload, planTableDefinitionConfig);
}

const planTableDefinitionConfig = {
  toolName: PLAN_TABLE_DEFINITION_TOOL_NAME,
  stepId: PLAN_TABLE_DEFINITION_STEP_ID,
  stepIdAliases: PLAN_TABLE_DEFINITION_ALIASES,
  preNormalizeResult: preNormalizePlanTableDefinitionResult,
  normalizeResult: normalizePlanTableDefinitionResult,
};

function preNormalizePlanTableDefinitionResult(value: unknown): unknown {
  const result = assertRecord(value, 'result');
  const tableDefinition = assertRecord(result.tableDefinition, 'result.tableDefinition');
  const ownership = normalizeTableOwnershipValue(tableDefinition.ownership);
  const metricUpdatePolicy = normalizeMetricUpdatePolicyValue(tableDefinition.metricUpdatePolicy);
  if (ownership === tableDefinition.ownership && metricUpdatePolicy === tableDefinition.metricUpdatePolicy) return value;

  return {
    ...result,
    tableDefinition: {
      ...tableDefinition,
      ownership,
      ...(metricUpdatePolicy === undefined ? {} : { metricUpdatePolicy }),
    },
  };
}

function normalizeTableOwnershipValue(value: unknown): unknown {
  if (value === 'moduleOwned') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  return record.kind === 'moduleOwned' ? 'moduleOwned' : value;
}

function normalizeMetricUpdatePolicyValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (record.updatedByLayer !== undefined) return value;
  if (record.feedsMetrics !== true) return value;
  return {
    ...record,
    updatedByLayer: 'layer_3_usecases',
  };
}

function normalizePlanTableDefinitionResult(value: unknown): PlanTableDefinitionResult {
  const result = assertRecord(value, 'result');
  const tableDefinition = assertRecord(result.tableDefinition, 'result.tableDefinition');
  const defsPlan = assertRecord(result.defsPlan, 'result.defsPlan');
  const tableId = assertString(tableDefinition.tableId, 'result.tableDefinition.tableId');
  const moduleId = assertString(tableDefinition.moduleId, 'result.tableDefinition.moduleId');
  const accessPolicy = normalizeAccessPolicy(tableDefinition);

  return {
    tableDefinition: {
      ...tableDefinition,
      tableId,
      tableName: assertString(tableDefinition.tableName, 'result.tableDefinition.tableName'),
      moduleId,
      ownership: assertString(tableDefinition.ownership, 'result.tableDefinition.ownership'),
      layer: assertString(tableDefinition.layer, 'result.tableDefinition.layer'),
      tableKind: assertString(tableDefinition.tableKind, 'result.tableDefinition.tableKind'),
      accessPolicy,
    },
    defsPlan: {
      fileName: assertString(defsPlan.fileName, 'result.defsPlan.fileName'),
      exportName: assertString(defsPlan.exportName, 'result.defsPlan.exportName'),
      saveAsDefs: assertBoolean(defsPlan.saveAsDefs, 'result.defsPlan.saveAsDefs'),
    },
  };
}

function normalizeAccessPolicy(tableDefinition: Record<string, unknown>): Record<string, unknown> {
  return assertRecord(tableDefinition.accessPolicy, 'result.tableDefinition.accessPolicy');
}

function assertBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean`);
  return value;
}

function validatePlanTableDefinitionOutput(output: PlanTableDefinitionOutput): void {
  const table = output.result.tableDefinition;
  if (table.ownership !== 'moduleOwned') throw new Error(`table ${table.tableId} must be moduleOwned`);
  if (table.layer !== 'layer_1_external') throw new Error(`table ${table.tableId} must be in layer_1_external`);
  if (table.tableKind !== 'transactional') throw new Error(`table ${table.tableId} must be transactional`);
  const directAccess = assertArray(table.accessPolicy.directAccessAllowedFor, 'tableDefinition.accessPolicy.directAccessAllowedFor');
  if (!directAccess.includes('layer_3_usecases')) throw new Error(`table ${table.tableId} must allow direct access for layer_3_usecases`);
  validateMetricUpdatePolicy(table);
  if (output.status === 'needs_input' && output.questions.length === 0) throw new Error('needs_input table definition must include questions');
}

function validateMetricUpdatePolicy(table: PlanTableDefinitionResult['tableDefinition']): void {
  if (table.metricUpdatePolicy === undefined) return;
  const policy = assertRecord(table.metricUpdatePolicy, 'tableDefinition.metricUpdatePolicy');
  if (policy.feedsMetrics === true && policy.updatedByLayer !== 'layer_3_usecases') {
    throw new Error(`table ${table.tableId} metricUpdatePolicy.updatedByLayer must be layer_3_usecases when feedsMetrics=true`);
  }
}

function buildHumanPrompt(
  args: string,
  finalPlan: FinalSolutionPlanOutput,
  persistenceIndex: PlanPersistenceIndexOutput,
  tableIndexItem: unknown,
): string {
  const compactContext = buildTableDefinitionContext(finalPlan, persistenceIndex, tableIndexItem);
  return `## Current table selector
${args}

## Focused table definition context
${JSON.stringify(compactContext, null, 2)}
`;
}

function buildTableDefinitionContext(
  finalPlan: FinalSolutionPlanOutput,
  persistenceIndex: PlanPersistenceIndexOutput,
  tableIndexItem: unknown,
): Record<string, unknown> {
  const table = assertRecord(tableIndexItem, 'tableIndexItem');
  const entityRefs = collectStringRefs(table.rootEntity, table.sourceEntities, table.embeddedEntities);
  const ruleRefs = collectStringRefs(table.rulesApplied, table.rules);
  const artifactRefs = collectStringRefs(table.readsByArtifacts, table.writesByArtifacts);

  return {
    module: finalPlan.result.module,
    persistenceScope: persistenceIndex.result.persistenceScope,
    selectedTable: table,
    relevantEntities: pickRelevantEntities(finalPlan.result.ontology.entities, entityRefs),
    relevantRules: pickRelevantArrayItems(finalPlan.result.rules, ruleRefs, ['ruleId', 'id', 'code', 'name']),
    artifactRefs: Array.from(artifactRefs),
    relevantArtifacts: pickRelevantArtifacts(finalPlan.result.approvedArtifacts, artifactRefs),
  };
}

function collectStringRefs(...values: unknown[]): Set<string> {
  const refs = new Set<string>();
  for (const value of values) collectStringRefsInto(refs, value);
  return refs;
}

function collectStringRefsInto(refs: Set<string>, value: unknown): void {
  if (typeof value === 'string' && value.trim()) {
    refs.add(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectStringRefsInto(refs, item));
    return;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    ['entityId', 'entityName', 'tableId', 'artifactId', 'workflowId', 'pageId', 'ruleId', 'id', 'name', 'signal'].forEach(key => {
      const item = record[key];
      if (typeof item === 'string' && item.trim()) refs.add(item.trim());
    });
  }
}

function pickRelevantEntities(entities: Record<string, unknown>, refs: Set<string>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entities)) {
    if (refs.has(key) || recordHasAnyRef(value, refs, ['entityId', 'name', 'displayName'])) picked[key] = value;
  }
  return picked;
}

function pickRelevantArrayItems(items: unknown[], refs: Set<string>, keys: string[]): unknown[] {
  if (refs.size === 0) return [];
  return items.filter(item => recordHasAnyRef(item, refs, keys));
}

function pickRelevantArtifacts(artifacts: FinalSolutionPlanOutput['result']['approvedArtifacts'], refs: Set<string>): Record<string, unknown[]> {
  const picked: Record<string, unknown[]> = {};
  for (const [artifactType, items] of Object.entries(artifacts)) {
    if (!Array.isArray(items)) continue;
    const selected = pickRelevantArrayItems(items, refs, ['artifactId', 'pageId', 'workflowId', 'agentId', 'signal', 'id', 'name', 'title']);
    if (selected.length > 0) picked[artifactType] = selected;
  }
  return picked;
}

function recordHasAnyRef(value: unknown, refs: Set<string>, keys: string[]): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return keys.some(key => {
    const item = record[key];
    return typeof item === 'string' && refs.has(item);
  });
}

const systemPrompt = `
<!-- modelType: codeinstruct -->
<!-- x-tool-strict: true -->

You are agentPlanTableDefinition for the collab.codes "newSolution" flow.
Plan exactly one module-owned persistence table definition for the current table selector.
Use the same language as the user for titles, descriptions, questions, and trace.
Use snake_case for table names and camelCase for ids.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## Rules
- Generate one table only: the table whose tableId equals the current selector.
- The table must be moduleOwned, transactional, and in layer_1_external.
- Set tableDefinition.ownership exactly to the string "moduleOwned". Do not return an ownership object.
- tableDefinition.moduleId is required and must equal the module id from persistenceScope/module context.
- defsPlan.exportName is required and should be a stable camelCase export name, such as {tableId}TableDefinition.
- defsPlan.saveAsDefs must be true.
- Use accessPolicy.directAccessAllowedFor: ["layer_3_usecases"]. Do not use a loose directAccess object as the canonical policy.
- Direct table access must be allowed only for layer_3_usecases; layer_2_controllers and pages cannot access tables directly.
- Do not create table definitions for MDM, horizontal, or plugin-owned entities.
- Always include physical columns for primary key, important foreign refs, status/lifecycle, date filters, and fields required by BFF queries/workflows.
- Use detailsColumn.enabled true when child/internal data should be stored as JSON/JSONB.
- Do not put fields in details when they are required for frequent filtering, joins, lifecycle, authorization, or independent updates.
- foreignRefs may point to MDM/horizontal/plugin entities, but must not imply creating those tables in this module.
- indexes must cover common lookup fields used by BFF commands, workflows, and agents.
- Include metricUpdatePolicy when base table changes should feed operational metrics. When metricUpdatePolicy.feedsMetrics is true, set updatedByLayer exactly to "layer_3_usecases".
- defsPlan.fileName should be stable and table-specific, such as tables/{tableId}.defs.ts.
- Use rule ids; do not write loose rule text.
- Do not generate TypeScript code.
- The focused context intentionally omits unrelated entities and artifacts. Do not infer extra tables or capabilities from omitted context.
`;
