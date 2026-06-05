/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanTableDefinition.ts" enhancement="_102027_/l2/enhancementAgent"/>

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
import { PlanPersistenceIndexOutput, getPlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';

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

const planTableDefinitionToolSchema = createPlannerToolSchema(
  PLAN_TABLE_DEFINITION_TOOL_NAME,
  'Submit one module-owned persistence table definition plan.',
  PLAN_TABLE_DEFINITION_STEP_ID,
  {
    type: 'object',
    additionalProperties: false,
    required: ['tableDefinition', 'defsPlan'],
    properties: {
      tableDefinition: { type: 'object', additionalProperties: true },
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

  const intents: mls.msg.AgentIntent[] = [
    createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined),
  ];

  if (status === 'completed' && output) intents.push(...createNextTableDefinitionIntent(context, output));
  return intents;
}

export function getPlanTableDefinitionOutputs(context: mls.msg.ExecutionContext): PlanTableDefinitionOutput[] {
  return getPlannerOutputs(context, 'agentPlanTableDefinition', planTableDefinitionConfig, validatePlanTableDefinitionOutput);
}

function extractPlanTableDefinitionOutput(payload: unknown): PlanTableDefinitionOutput {
  return extractPlannerOutput(payload, planTableDefinitionConfig);
}

const planTableDefinitionConfig = {
  toolName: PLAN_TABLE_DEFINITION_TOOL_NAME,
  stepId: PLAN_TABLE_DEFINITION_STEP_ID,
  stepIdAliases: PLAN_TABLE_DEFINITION_ALIASES,
  normalizeResult: normalizePlanTableDefinitionResult,
};

function normalizePlanTableDefinitionResult(value: unknown): PlanTableDefinitionResult {
  const result = assertRecord(value, 'result');
  const tableDefinition = assertRecord(result.tableDefinition, 'result.tableDefinition');
  const defsPlan = assertRecord(result.defsPlan, 'result.defsPlan');
  return {
    tableDefinition: {
      ...tableDefinition,
      tableId: assertString(tableDefinition.tableId, 'result.tableDefinition.tableId'),
      tableName: assertString(tableDefinition.tableName, 'result.tableDefinition.tableName'),
      moduleId: assertString(tableDefinition.moduleId, 'result.tableDefinition.moduleId'),
      layer: assertString(tableDefinition.layer, 'result.tableDefinition.layer'),
      tableKind: assertString(tableDefinition.tableKind, 'result.tableDefinition.tableKind'),
      accessPolicy: assertRecord(tableDefinition.accessPolicy, 'result.tableDefinition.accessPolicy'),
    },
    defsPlan: {
      fileName: assertString(defsPlan.fileName, 'result.defsPlan.fileName'),
      exportName: assertString(defsPlan.exportName, 'result.defsPlan.exportName'),
      saveAsDefs: Boolean(defsPlan.saveAsDefs),
    },
  };
}

function validatePlanTableDefinitionOutput(output: PlanTableDefinitionOutput): void {
  const table = output.result.tableDefinition;
  if (table.layer !== 'layer_1_external') throw new Error(`table ${table.tableId} must be in layer_1_external`);
  if (table.tableKind !== 'transactional') throw new Error(`table ${table.tableId} must be transactional`);
  const directAccess = assertArray(table.accessPolicy.directAccessAllowedFor, 'tableDefinition.accessPolicy.directAccessAllowedFor');
  if (!directAccess.includes('layer_3_usecases')) throw new Error(`table ${table.tableId} must allow direct access for layer_3_usecases`);
  if (output.status === 'needs_input' && output.questions.length === 0) throw new Error('needs_input table definition must include questions');
}

function createNextTableDefinitionIntent(context: mls.msg.ExecutionContext, currentOutput: PlanTableDefinitionOutput): mls.msg.AgentIntent[] {
  const persistenceIndex = getPlanPersistenceIndexOutput(context);
  const covered = new Set(getPlanTableDefinitionOutputs(context).map(output => output.result.tableDefinition.tableId));
  covered.add(currentOutput.result.tableDefinition.tableId);

  const nextTable = persistenceIndex.result.tables.find(table => !covered.has(table.tableId));
  const placeholder = findStepByPlanId(context, 'plan-table-definition') as mls.msg.AIAgentStep | null;
  if (!placeholder || placeholder.type !== 'agent') return [];

  if (nextTable) {
    return [
      createDynamicAgentStepIntent(
        context,
        placeholder,
        'agentPlanTableDefinition',
        `plan-table-definition:${nextTable.tableId}`,
        `Plan table ${nextTable.tableId}`,
        nextTable.tableId
      ),
    ];
  }

  return [createPlannerUpdateStatusIntent(context, placeholder, placeholder, 0, 'completed', 'All dynamic table definitions completed.')];
}

function buildHumanPrompt(
  args: string,
  finalPlan: FinalSolutionPlanOutput,
  persistenceIndex: PlanPersistenceIndexOutput,
  tableIndexItem: unknown,
): string {
  return `## Current table selector
${args}

## Selected table index item
${JSON.stringify(tableIndexItem, null, 2)}

## Final solution plan
${JSON.stringify(finalPlan, null, 2)}

## Persistence index
${JSON.stringify(persistenceIndex, null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codepro -->

You are agentPlanTableDefinition for the collab.codes "newSolution" flow.
Plan exactly one module-owned persistence table definition for the current table selector.
Use the same language as the user for titles, descriptions, questions, and trace.
Use snake_case for table names and camelCase for ids.

## Tool mode
Call the "{{toolName}}" tool with the complete structured result.
Do not return prose.

## Rules
- Generate one table only: the table whose tableId equals the current selector.
- The table must be moduleOwned, transactional, and in layer_1_external.
- Direct table access must be allowed only for layer_3_usecases; layer_2_controllers and pages cannot access tables directly.
- Do not create table definitions for MDM, horizontal, or plugin-owned entities.
- Always include physical columns for primary key, important foreign refs, status/lifecycle, date filters, and fields required by BFF queries/workflows.
- Use detailsColumn.enabled true when child/internal data should be stored as JSON/JSONB.
- Do not put fields in details when they are required for frequent filtering, joins, lifecycle, authorization, or independent updates.
- foreignRefs may point to MDM/horizontal/plugin entities, but must not imply creating those tables in this module.
- indexes must cover common lookup fields used by BFF commands, workflows, and agents.
- Include metricUpdatePolicy when base table changes should feed operational metrics. The actual update must happen in backend use cases, not in pages.
- defsPlan.fileName should be stable and table-specific, such as tables/{tableId}.defs.ts.
- Use rule ids; do not write loose rule text.
- Do not generate TypeScript code.

## Content Memory
actualDate: 2026-06-05
userName: Wagner
taskName: newModule
flowName: newSolution
`;
