/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.ts" enhancement="_102027_/l2/enhancementAgent"/>

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
import { PlanHorizontalsOutput, getPlanHorizontalsOutput } from '/_102020_/l2/agentNewSolution/agentPlanHorizontals.js';
import { PlanMDMOutput, getPlanMDMOutput } from '/_102020_/l2/agentNewSolution/agentPlanMDM.js';
import { PlanPluginsOutput, getPlanPluginsOutput } from '/_102020_/l2/agentNewSolution/agentPlanPlugins.js';

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

const planPersistenceIndexToolSchema = createPlannerToolSchema(
  PLAN_PERSISTENCE_INDEX_TOOL_NAME,
  'Submit the module-owned persistence table index.',
  PLAN_PERSISTENCE_INDEX_STEP_ID,
  {
    type: 'object',
    additionalProperties: false,
    required: ['persistenceScope', 'tables'],
    properties: {
      persistenceScope: {
        type: 'object',
        additionalProperties: true,
        required: ['moduleId', 'newTablesRequired', 'metricsTablesRequired', 'excludedEntities'],
        properties: {
          moduleId: { type: 'string' },
          newTablesRequired: { type: 'boolean' },
          metricsTablesRequired: { type: 'boolean' },
          excludedEntities: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
      tables: { type: 'array', items: { type: 'object', additionalProperties: true } },
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
  if (!agent || !step) throw new Error('[agentPlanPersistenceIndex](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const finalPlan = getFinalizeSolutionPlanOutput(context);
  const mdmPlan = getPlanMDMOutput(context);
  const horizontalPlan = getPlanHorizontalsOutput(context);
  const pluginPlan = getPlanPluginsOutput(context);
  const snapshot = getPlanningContextSnapshot(context);

  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(PLAN_PERSISTENCE_INDEX_TOOL_NAME),
      buildHumanPrompt(args, finalPlan, mdmPlan, horizontalPlan, pluginPlan, snapshot.initialMetricsRequested),
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

  const intents: mls.msg.AgentIntent[] = [
    createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined),
  ];

  if (status === 'completed' && output) intents.push(...createFirstTableDefinitionIntent(context, output));
  return intents;
}

export function getPlanPersistenceIndexOutput(context: mls.msg.ExecutionContext): PlanPersistenceIndexOutput {
  return getPlannerOutput(context, 'agentPlanPersistenceIndex', planPersistenceIndexConfig, output => validatePlanPersistenceIndexOutput(output, getPlanningContextSnapshot(context).initialMetricsRequested));
}

function extractPlanPersistenceIndexOutput(payload: unknown): PlanPersistenceIndexOutput {
  return extractPlannerOutput(payload, planPersistenceIndexConfig);
}

const planPersistenceIndexConfig = {
  toolName: PLAN_PERSISTENCE_INDEX_TOOL_NAME,
  stepId: PLAN_PERSISTENCE_INDEX_STEP_ID,
  stepIdAliases: PLAN_PERSISTENCE_INDEX_ALIASES,
  normalizeResult: normalizePlanPersistenceIndexResult,
};

function normalizePlanPersistenceIndexResult(value: unknown): PlanPersistenceIndexResult {
  const result = assertRecord(value, 'result');
  const scope = assertRecord(result.persistenceScope, 'result.persistenceScope');
  return {
    persistenceScope: {
      moduleId: assertString(scope.moduleId, 'result.persistenceScope.moduleId'),
      newTablesRequired: Boolean(scope.newTablesRequired),
      metricsTablesRequired: Boolean(scope.metricsTablesRequired),
      excludedEntities: assertArray(scope.excludedEntities, 'result.persistenceScope.excludedEntities'),
    },
    tables: assertArray(result.tables, 'result.tables').map((item, index) => normalizePersistenceTable(item, `result.tables[${index}]`)),
  };
}

function normalizePersistenceTable(value: unknown, path: string): PersistenceTableIndexItem {
  const table = assertRecord(value, path);
  return {
    tableId: assertString(table.tableId, `${path}.tableId`),
    tableName: assertString(table.tableName, `${path}.tableName`),
    title: assertString(table.title, `${path}.title`),
    purpose: assertString(table.purpose, `${path}.purpose`),
    ownership: assertString(table.ownership, `${path}.ownership`),
    rootEntity: assertString(table.rootEntity, `${path}.rootEntity`),
    sourceEntities: normalizeStringArray(table.sourceEntities, `${path}.sourceEntities`),
    embeddedEntities: normalizeStringArray(table.embeddedEntities, `${path}.embeddedEntities`),
    persistencePattern: assertString(table.persistencePattern, `${path}.persistencePattern`),
    tableKind: assertString(table.tableKind, `${path}.tableKind`),
    detailsColumnRecommended: Boolean(table.detailsColumnRecommended),
    priority: assertPriority(table.priority, `${path}.priority`),
    readsByArtifacts: normalizeStringArray(table.readsByArtifacts, `${path}.readsByArtifacts`),
    writesByArtifacts: normalizeStringArray(table.writesByArtifacts, `${path}.writesByArtifacts`),
    rulesApplied: normalizeStringArray(table.rulesApplied, `${path}.rulesApplied`),
    reason: assertString(table.reason, `${path}.reason`),
  };
}

function validatePlanPersistenceIndexOutput(output: PlanPersistenceIndexOutput, initialMetricsRequested: boolean): void {
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

function createFirstTableDefinitionIntent(context: mls.msg.ExecutionContext, output: PlanPersistenceIndexOutput): mls.msg.AgentIntent[] {
  const placeholder = findStepByPlanId(context, 'plan-table-definition') as mls.msg.AIAgentStep | null;
  if (!placeholder || placeholder.type !== 'agent' || placeholder.status === 'completed') return [];

  const firstTable = output.result.tables[0];
  if (!firstTable) {
    return [createPlannerUpdateStatusIntent(context, placeholder, placeholder, 0, 'completed', 'No module-owned transactional tables to define.')];
  }

  return [
    createDynamicAgentStepIntent(
      context,
      placeholder,
      'agentPlanTableDefinition',
      `plan-table-definition:${firstTable.tableId}`,
      `Plan table ${firstTable.tableId}`,
      firstTable.tableId
    ),
  ];
}

function normalizeStringArray(value: unknown, path: string): string[] {
  return assertArray(value, path).map((item, index) => assertString(item, `${path}[${index}]`));
}

function buildHumanPrompt(
  args: string,
  finalPlan: FinalSolutionPlanOutput,
  mdmPlan: PlanMDMOutput,
  horizontalPlan: PlanHorizontalsOutput,
  pluginPlan: PlanPluginsOutput,
  initialMetricsRequested: boolean,
): string {
  return `## Planned step args
${args}

## Final solution plan
${JSON.stringify(finalPlan, null, 2)}

## MDM plan
${JSON.stringify(mdmPlan, null, 2)}

## Horizontal plan
${JSON.stringify(horizontalPlan, null, 2)}

## Plugin plan
${JSON.stringify(pluginPlan, null, 2)}

## Initial metrics/dashboard requested
${initialMetricsRequested}
`;
}

const systemPrompt = `
<!-- modelType: codepro -->

You are agentPlanPersistenceIndex for the collab.codes "newSolution" flow.
Plan only the persistence table index for new transactional tables owned by the current module.
Use the same language as the user for titles, purposes, reasons, questions, and trace.
Use English camelCase identifiers for tableId and snake_case tableName values.

## Tool mode
Call the "{{toolName}}" tool with the complete structured result.
Do not return prose.

## Rules
- Generate only module-owned new transactional tables.
- Normal transactional tables and metric tables are separate. This step plans transactional module-owned tables only.
- Set metricsTablesRequired true when initial metrics/dashboard was accepted.
- Do not generate tables for MDM entities; list them in excludedEntities with ownership "mdmOwned".
- Do not generate tables for horizontal module entities; list them in excludedEntities with ownership "horizontalOwned".
- Do not generate tables for plugin-owned entities; list them in excludedEntities with ownership "pluginOwned".
- Use embeddedEntities when an ontology entity or child collection should live inside the root table details column.
- persistencePattern must be one of singleEntity, aggregateJsonDetails, eventLog, lookup, readModel.
- Prefer aggregateJsonDetails when child data is normally read with the parent and does not need independent lifecycle or frequent filtering.
- Keep indexable operational data as physical columns in later table definitions.
- Transactional table definitions must prepare for layer_1_external; direct access must be restricted to layer_3_usecases later.
- Use rule ids; do not write loose rule text.
- Do not generate TypeScript code.

## Content Memory
actualDate: 2026-06-05
userName: Wagner
taskName: newModule
flowName: newSolution
`;
