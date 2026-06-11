/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PlannerOutput,
  Priority,
  assertArray,
  assertPriority,
  assertRecord,
  assertString,
  optionalString,
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
import { readExistingModuleTables, saveNewSolutionAgentTracePayload } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import type { ExistingModuleTable } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { getPlanHorizontalsOutput } from '/_102020_/l2/agentNewSolution/agentPlanHorizontals.js';
import type { PlanHorizontalsOutput } from '/_102020_/l2/agentNewSolution/agentPlanHorizontals.js';
import { getPlanMDMOutput } from '/_102020_/l2/agentNewSolution/agentPlanMDM.js';
import type { PlanMDMOutput } from '/_102020_/l2/agentNewSolution/agentPlanMDM.js';
import { getPlanPluginsOutput } from '/_102020_/l2/agentNewSolution/agentPlanPlugins.js';
import type { PlanPluginsOutput } from '/_102020_/l2/agentNewSolution/agentPlanPlugins.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentPlanPersistenceIndex',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Plan the persistence table index for module-owned tables',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const PLAN_PERSISTENCE_INDEX_TOOL_NAME = 'submitPersistenceIndex';
export const PLAN_PERSISTENCE_INDEX_STEP_ID = '12-plan-persistence-index';
const PLAN_PERSISTENCE_INDEX_ALIASES = [PLAN_PERSISTENCE_INDEX_STEP_ID, 'plan-persistence-index'];

export interface PersistenceTableIndexItem {
  tableId: string;
  tableName: string;
  title: string;
  purpose: string;
  ownership: string;
  rootEntity: string;
  sourceEntities: string[];
  embeddedEntities: string[];
  persistencePattern: string;
  tableKind: string;
  detailsColumnRecommended: boolean;
  priority: Priority;
  readsByArtifacts: string[];
  writesByArtifacts: string[];
  rulesApplied: string[];
  reason: string;
}

export interface PlanPersistenceIndexResult {
  persistenceScope: {
    moduleId: string;
    newTablesRequired: boolean;
    metricsTablesRequired: boolean;
    excludedEntities: unknown[];
  };
  tables: PersistenceTableIndexItem[];
}

export type PlanPersistenceIndexOutput = PlannerOutput<PlanPersistenceIndexResult>;

export const PLAN_PERSISTENCE_INDEX_RESULT_SCHEMA: Record<string, unknown> = {
    type: 'object',
    additionalProperties: false,
    required: ['persistenceScope', 'tables'],
    properties: {
      persistenceScope: {
        type: 'object',
        additionalProperties: false,
        required: ['moduleId', 'newTablesRequired', 'metricsTablesRequired', 'excludedEntities'],
        properties: {
          moduleId: { type: 'string' },
          newTablesRequired: { type: 'boolean' },
          metricsTablesRequired: { type: 'boolean' },
          excludedEntities: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['entityId', 'ownership', 'reason'],
              properties: {
                entityId: { type: 'string' },
                // A5: 'existingModuleOwned' = table already persisted by another existing module
                // (set moduleRef); 'metricOwned' = realized as a metric table of THIS module
                // (planned by the metrics index). Never use 'mdmOwned' as a catch-all.
                ownership: { enum: ['mdmOwned', 'horizontalOwned', 'pluginOwned', 'existingModuleOwned', 'metricOwned', 'external'] },
                moduleRef: { type: 'string' },
                reason: { type: 'string' },
              },
            },
          },
        },
      },
      tables: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'tableId',
            'tableName',
            'title',
            'purpose',
            'ownership',
            'rootEntity',
            'sourceEntities',
            'embeddedEntities',
            'persistencePattern',
            'tableKind',
            'detailsColumnRecommended',
            'priority',
            'readsByArtifacts',
            'writesByArtifacts',
            'rulesApplied',
            'reason',
          ],
          properties: {
            tableId: { type: 'string' },
            tableName: { type: 'string' },
            title: { type: 'string' },
            purpose: { type: 'string' },
            ownership: { const: 'moduleOwned' },
            rootEntity: { type: 'string' },
            sourceEntities: { type: 'array', items: { type: 'string' } },
            embeddedEntities: { type: 'array', items: { type: 'string' } },
            persistencePattern: { enum: ['singleEntity', 'aggregateJsonDetails', 'eventLog', 'lookup', 'readModel'] },
            tableKind: { const: 'transactional' },
            detailsColumnRecommended: { type: 'boolean' },
            priority: { enum: ['now', 'soon', 'later', 'never'] },
            readsByArtifacts: { type: 'array', items: { type: 'string' } },
            writesByArtifacts: { type: 'array', items: { type: 'string' } },
            rulesApplied: { type: 'array', items: { type: 'string' } },
            reason: { type: 'string' },
          },
        },
      },
    },
};

const planPersistenceIndexToolSchema = createPlannerVariableToolSchema(
  PLAN_PERSISTENCE_INDEX_TOOL_NAME,
  'Submit the module-owned persistence table index.',
  PLAN_PERSISTENCE_INDEX_RESULT_SCHEMA
);

async function beforePromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
  args?: string,
): Promise<mls.msg.AgentIntent[]> {
  if (!agent || !step) throw new Error('[agentPlanPersistenceIndex](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const finalPlan = getFinalizeSolutionPlanOutput(context);
  const mdmPlan = getPlanMDMOutput(context);
  const horizontalPlan = getPlanHorizontalsOutput(context);
  const pluginPlan = getPlanPluginsOutput(context);
  const snapshot = getPlanningContextSnapshot(context);
  // A5: tables persisted by OTHER existing modules — maintenance/extension runs must exclude
  // those entities as 'existingModuleOwned' (moduleRef), never as the 'mdmOwned' catch-all.
  const currentModuleName = assertString(finalPlan.result.module.moduleName, 'result.module.moduleName');
  const existingModuleTables = await readExistingModuleTables(currentModuleName);

  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(PLAN_PERSISTENCE_INDEX_TOOL_NAME),
      buildHumanPrompt(args, finalPlan, mdmPlan, horizontalPlan, pluginPlan, snapshot.initialMetricsRequested, existingModuleTables),
      planPersistenceIndexToolSchema,
      PLAN_PERSISTENCE_INDEX_TOOL_NAME
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
  let output: PlanPersistenceIndexOutput | undefined;

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    output = extractPlanPersistenceIndexOutput(payload);
    validatePlanPersistenceIndexOutput(output, getPlanningContextSnapshot(context).initialMetricsRequested);
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentPlanPersistenceIndex returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentPlanPersistenceIndex returned status needs_input; keeping persistence index draft.';
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);

  // /024: when the index is valid, hold this step open and run the
  // critic/repair checkpoint before releasing table definitions and downstream steps.
  if (status === 'completed' && output && output.status === 'ok') {
    return createHoldIndexForReviewIntents(context, parentStep, step, hookSequential, 'persistenceIndex');
  }

  const intents: mls.msg.AgentIntent[] = [
    createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined),
  ];

  if (status === 'completed' && output) intents.push(...createTableDefinitionParallelIntent(context, output));
  return intents;
}

export function getPlanPersistenceIndexOutput(context: mls.msg.ExecutionContext): PlanPersistenceIndexOutput {
  // prefer the latest repaired index when a repair step exists.
  return getPlannerOutputWithRepair(context, 'agentPlanPersistenceIndex', 'persistenceIndex', planPersistenceIndexConfig, output => validatePlanPersistenceIndexOutput(output, getPlanningContextSnapshot(context).initialMetricsRequested));
}

function extractPlanPersistenceIndexOutput(payload: unknown): PlanPersistenceIndexOutput {
  return extractPlannerOutput(payload, planPersistenceIndexConfig);
}

export const planPersistenceIndexConfig = {
  toolName: PLAN_PERSISTENCE_INDEX_TOOL_NAME,
  stepId: PLAN_PERSISTENCE_INDEX_STEP_ID,
  stepIdAliases: PLAN_PERSISTENCE_INDEX_ALIASES,
  normalizeResult: normalizePlanPersistenceIndexResult,
};

export function normalizePlanPersistenceIndexResult(value: unknown): PlanPersistenceIndexResult {
  const result = assertRecord(value, 'result');
  const scope = assertRecord(result.persistenceScope, 'result.persistenceScope');
  return {
    persistenceScope: {
      moduleId: assertString(scope.moduleId, 'result.persistenceScope.moduleId'),
      newTablesRequired: assertBoolean(scope.newTablesRequired, 'result.persistenceScope.newTablesRequired'),
      metricsTablesRequired: assertBoolean(scope.metricsTablesRequired, 'result.persistenceScope.metricsTablesRequired'),
      excludedEntities: assertArray(scope.excludedEntities, 'result.persistenceScope.excludedEntities'),
    },
    tables: assertArray(result.tables, 'result.tables').map((item, index) => normalizePersistenceTable(item, `result.tables[${index}]`)),
  };
}

function normalizePersistenceTable(value: unknown, path: string): PersistenceTableIndexItem {
  const table = assertRecord(value, path);
  const rootEntity = optionalString(table.rootEntity, `${path}.rootEntity`)
    || optionalString(table.entityName, `${path}.entityName`)
    || optionalString(table.entityId, `${path}.entityId`);
  const reason = optionalString(table.reason, `${path}.reason`);
  const purpose = optionalString(table.purpose, `${path}.purpose`) || reason;
  const title = optionalString(table.title, `${path}.title`)
    || optionalString(table.tableTitle, `${path}.tableTitle`)
    || rootEntity
    || optionalString(table.tableName, `${path}.tableName`)
    || optionalString(table.tableId, `${path}.tableId`);
  const embeddedEntities = normalizeStringArray(table.embeddedEntities || [], `${path}.embeddedEntities`);
  const persistencePattern = optionalString(table.persistencePattern, `${path}.persistencePattern`) || (embeddedEntities.length > 0 ? 'aggregateJsonDetails' : 'singleEntity');

  if (!rootEntity) throw new Error(`${path}.rootEntity must be a non-empty string`);
  if (!purpose) throw new Error(`${path}.purpose must be a non-empty string`);
  if (!title) throw new Error(`${path}.title must be a non-empty string`);

  return {
    tableId: assertString(table.tableId, `${path}.tableId`),
    tableName: assertString(table.tableName, `${path}.tableName`),
    title,
    purpose,
    ownership: normalizePersistenceOwnership(table.ownership, `${path}.ownership`),
    rootEntity,
    sourceEntities: normalizeStringArray(table.sourceEntities || [rootEntity], `${path}.sourceEntities`),
    embeddedEntities,
    persistencePattern,
    tableKind: optionalString(table.tableKind, `${path}.tableKind`) || 'transactional',
    detailsColumnRecommended: assertBoolean(table.detailsColumnRecommended, `${path}.detailsColumnRecommended`),
    priority: table.priority === undefined ? 'now' : assertPriority(table.priority, `${path}.priority`),
    readsByArtifacts: normalizeStringArray(table.readsByArtifacts || [], `${path}.readsByArtifacts`),
    writesByArtifacts: normalizeStringArray(table.writesByArtifacts || [], `${path}.writesByArtifacts`),
    rulesApplied: normalizeStringArray(table.rulesApplied || table.rules || [], `${path}.rulesApplied`),
    reason: reason || purpose,
  };
}

function normalizePersistenceOwnership(value: unknown, path: string): string {
  return assertString(value, path);
}

function assertBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean`);
  return value;
}

export function validatePlanPersistenceIndexOutput(output: PlanPersistenceIndexOutput, initialMetricsRequested: boolean): void {
  const ids = new Set<string>();
  for (const table of output.result.tables) {
    if (ids.has(table.tableId)) throw new Error(`duplicate tableId: ${table.tableId}`);
    ids.add(table.tableId);
    if (table.ownership !== 'moduleOwned') throw new Error(`table ${table.tableId} must be moduleOwned`);
    if (table.tableKind !== 'transactional') throw new Error(`table ${table.tableId} must be transactional`);
  }
  if (output.status === 'ok' && output.result.persistenceScope.newTablesRequired && output.result.tables.length === 0) {
    throw new Error('newTablesRequired is true, but tables is empty');
  }
  if (output.status === 'ok' && initialMetricsRequested && !output.result.persistenceScope.metricsTablesRequired) {
    throw new Error('initial metrics requested, but metricsTablesRequired is false');
  }
  if (output.status === 'needs_input' && output.questions.length === 0) throw new Error('needs_input persistence index must include questions');
}

// Table definitions are independent per tableId, so they run in controlled parallel
// (like metric table / page / workflow definitions), not as a serial chain.
export function createTableDefinitionParallelIntent(context: mls.msg.ExecutionContext, output: PlanPersistenceIndexOutput): mls.msg.AgentIntent[] {
  const placeholder = findStepByPlanId(context, 'plan-table-definition') as mls.msg.AIAgentStep | null;
  if (!placeholder || placeholder.type !== 'agent' || placeholder.status === 'completed') return [];

  const tableIds = output.result.tables.map(table => table.tableId);
  if (tableIds.length === 0) {
    return [createPlannerUpdateStatusIntent(context, placeholder, placeholder, 0, 'completed', 'No module-owned transactional tables to define.')];
  }

  return [
    createParallelDynamicAgentStepIntent(
      context,
      placeholder,
      'agentPlanTableDefinition',
      'plan-table-definition:parallel',
      'Plan tables {{completed}}/{{total}}, errors: {{failed}}',
      tableIds,
      5
    ),
  ];
}

function normalizeStringArray(value: unknown, path: string): string[] {
  return assertArray(value, path).map((item, index) => normalizeStringRef(item, `${path}[${index}]`));
}

function normalizeStringRef(value: unknown, path: string): string {
  return assertString(value, path);
}

function buildHumanPrompt(
  args: string,
  finalPlan: FinalSolutionPlanOutput,
  mdmPlan: PlanMDMOutput,
  horizontalPlan: PlanHorizontalsOutput,
  pluginPlan: PlanPluginsOutput,
  initialMetricsRequested: boolean,
  existingModuleTables: ExistingModuleTable[],
): string {
  // compact context. The persistence index only needs entity ownership and
  // who reads/writes what — not the full final plan, ontology fields or full mdm/horizontal/plugin
  // bodies. Ontology fields are added later in the table definitions.
  const reduced = {
    finalPlan: compactFinalPlan(finalPlan.result),
    mdmDomains: summarizeRecords(mdmPlan.result.mdmDomains, ['domainId', 'title', 'masterEntities']),
    horizontalModules: summarizeRecords(horizontalPlan.result.horizontalModules, ['horizontalModuleId', 'reusedOntologyRefs']),
    plugins: summarizeRecords(pluginPlan.result.plugins, ['pluginId', 'provider']),
    initialMetricsRequested,
    // A5: tables that ALREADY exist in other modules of this project. Entities persisted by them
    // go to excludedEntities with ownership 'existingModuleOwned' + moduleRef.
    existingModulesInventory: existingModuleTables.map(table => ({
      moduleId: table.moduleId,
      tableId: table.tableId,
      tableName: table.tableName,
      rootEntity: table.rootEntity,
      kind: table.kind,
    })),
  };

  return `## Planned step args
${args}

## Reduced persistence-planning context
${JSON.stringify(reduced, null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codeinstruct -->
<!-- x-tool-strict: true -->

You are agentPlanPersistenceIndex for the collab.codes "newSolution" flow.
Plan only the persistence table index for new transactional tables owned by the current module.
Use the same language as the user for titles, purposes, reasons, questions, and trace.
Use English camelCase identifiers for tableId and snake_case tableName values.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## Rules
- Generate only module-owned new transactional tables.
- For each tables[] item, set ownership exactly to "moduleOwned".
- Generate tables only for entities/artifacts that are present in the final solution plan approvedArtifacts, ontology, workflows, or usecase signals.
- Do not introduce scheduling, payment, finance, cart, order, delivery, or other feature tables unless they are explicitly approved in the final solution plan.
- Payment, finance, notification, document, and plugin-owned records must be excluded when they belong to horizontal modules or plugins.
- Normal transactional tables and metric tables are separate. This step plans transactional module-owned tables only.
- Set metricsTablesRequired true when initial metrics/dashboard was accepted.
- Do not generate tables for MDM entities; list them in excludedEntities with ownership "mdmOwned".
- Do not generate tables for horizontal module entities; list them in excludedEntities with ownership "horizontalOwned".
- Do not generate tables for plugin-owned entities; list them in excludedEntities with ownership "pluginOwned".
- Do not generate tables for entities already persisted by ANOTHER existing module (see the existing modules inventory): list them in excludedEntities with ownership "existingModuleOwned" and moduleRef set to that module id. NEVER label them "mdmOwned" — mdmOwned is only for master data in the shared MDM platform.
- Entities realized as metric tables of THIS module are excluded with ownership "metricOwned" (they are planned by the metrics index, not here).
- Use embeddedEntities when an ontology entity or child collection should live inside the root table details column.
- persistencePattern must be one of singleEntity, aggregateJsonDetails, eventLog, lookup, readModel.
- Prefer aggregateJsonDetails when child data is normally read with the parent and does not need independent lifecycle or frequent filtering.
- Keep indexable operational data as physical columns in later table definitions.
- Transactional table definitions must prepare for layer_1_external; direct access must be restricted to layer_3_usecases later.
- Use rule ids; do not write loose rule text.
- Do not generate TypeScript code.
`;
