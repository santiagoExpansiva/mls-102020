/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanUsecaseEntities.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PlannerOutput,
  assertArray,
  assertRecord,
  assertString,
  compactFinalPlan,
  summarizeRecords,
  createHoldIndexForReviewIntents,
  createPlannerPromptReadyIntent,
  createPlannerVariableToolSchema,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  getPlannerOutputWithRepair,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import type { FinalSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import { saveNewSolutionAgentTracePayload, saveNewSolutionPlanArtifacts } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { getPlanMetricTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanMetricTableDefinition.js';
import type { PlanMetricTableDefinitionOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricTableDefinition.js';
import { getPlanMetricsIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricsIndex.js';
import type { PlanMetricsIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricsIndex.js';
import { getPlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import type { PlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import { getPlanTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';
import type { PlanTableDefinitionOutput } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentPlanUsecaseEntities',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Plan layer_3 usecase entities and usecases',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const PLAN_USECASE_ENTITIES_TOOL_NAME = 'submitUsecaseEntitiesPlan';
export const PLAN_USECASE_ENTITIES_STEP_ID = '16-plan-usecase-entities';
const PLAN_USECASE_ENTITIES_ALIASES = [PLAN_USECASE_ENTITIES_STEP_ID, 'plan-usecase-entities'];

export interface PlanUsecaseEntitiesResult {
  backendArchitecture: Record<string, unknown>;
  /**
   * Domain entity abstractions used by layer_3 usecases (identified by usecaseEntityId).
   * These group related usecases by domain concept (e.g. OrderEntity, PaymentEntity).
   * Correspond to `approvedArtifacts.usecaseEntities` in the final plan, but at a finer
   * granularity: one approved entity group may produce N individual usecases.
   */
  usecaseEntities: unknown[];
  /**
   * Individual usecase operations (identified by usecaseId, e.g. 'createOrder').
   * These are what validators and usecaseRefs reference — never usecaseEntityId.
   * Coverage validator builds its usecaseIds set from this array.
   */
  usecases: unknown[];
  controllerRules: {
    bffMustCallUsecases: boolean;
    bffDirectTableAccessForbidden: boolean;
  };
}

export type PlanUsecaseEntitiesOutput = PlannerOutput<PlanUsecaseEntitiesResult>;

/** Ownership values for table references — mirrors foreignRefs.targetOwnership in table definitions. */
export type TableOwnership = 'moduleOwned' | 'mdmOwned' | 'horizontalOwned' | 'pluginOwned';

/**
 * A table reference with explicit ownership so the materializer knows whether to call
 * ctx.data.mdm* (mdmOwned) or a module-local layer_1 runtime (moduleOwned).
 */
export interface TableRef {
  tableName: string;
  ownership: TableOwnership;
}

const TABLE_OWNERSHIP_ENUM: TableOwnership[] = ['moduleOwned', 'mdmOwned', 'horizontalOwned', 'pluginOwned'];

/** JSON schema fragment reused in usecaseEntities.sourceTables and usecases.readsTables/writesTables. */
const TABLE_REF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tableName', 'ownership'],
  properties: {
    tableName: { type: 'string' },
    ownership: { enum: TABLE_OWNERSHIP_ENUM },
  },
} as const;

export const PLAN_USECASE_ENTITIES_RESULT_SCHEMA: Record<string, unknown> = {
    type: 'object',
    additionalProperties: false,
    required: ['backendArchitecture', 'usecaseEntities', 'usecases', 'controllerRules'],
    properties: {
      backendArchitecture: {
        type: 'object',
        additionalProperties: false,
        required: ['pattern', 'layer2Responsibility', 'layer3Responsibility', 'layer1Responsibility'],
        properties: {
          pattern: { type: 'string' },
          layer2Responsibility: { type: 'string' },
          layer3Responsibility: { type: 'string' },
          layer1Responsibility: { type: 'string' },
        },
      },
      usecaseEntities: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['usecaseEntityId', 'title', 'purpose', 'sourceTables', 'allowedOperations', 'layer'],
          properties: {
            usecaseEntityId: { type: 'string' },
            title: { type: 'string' },
            purpose: { type: 'string' },
            sourceTables: { type: 'array', items: TABLE_REF_SCHEMA },
            allowedOperations: { type: 'array', items: { type: 'string' } },
            layer: { const: 'layer_3_usecases' },
            rulesApplied: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      usecases: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['usecaseId', 'title', 'purpose', 'actor', 'layer', 'inputEntities', 'outputEntities', 'readsTables', 'writesTables', 'rulesApplied'],
          properties: {
            usecaseId: { type: 'string' },
            title: { type: 'string' },
            purpose: { type: 'string' },
            actor: { type: 'string' },
            layer: { const: 'layer_3_usecases' },
            inputEntities: { type: 'array', items: { type: 'string' } },
            outputEntities: { type: 'array', items: { type: 'string' } },
            readsTables: { type: 'array', items: TABLE_REF_SCHEMA },
            writesTables: { type: 'array', items: TABLE_REF_SCHEMA },
            // TODO (usecase commands): each command must declare its input/output as structured
            // typed fields (not just a name), so the materialization step can generate signatures.
            commands: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['commandId', 'input', 'output'],
                properties: {
                  commandId: { type: 'string' },
                  input: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['name', 'type', 'required'],
                      properties: {
                        name: { type: 'string' },
                        type: { type: 'string' },
                        required: { type: 'boolean' },
                      },
                    },
                  },
                  output: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['name', 'type'],
                      properties: {
                        name: { type: 'string' },
                        type: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
            rulesApplied: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      controllerRules: {
        type: 'object',
        additionalProperties: false,
        required: ['bffMustCallUsecases', 'bffDirectTableAccessForbidden'],
        properties: {
          bffMustCallUsecases: { type: 'boolean' },
          bffDirectTableAccessForbidden: { type: 'boolean' },
        },
      },
    },
};

const planUsecaseEntitiesToolSchema = createPlannerVariableToolSchema(
  PLAN_USECASE_ENTITIES_TOOL_NAME,
  'Submit layer_3 usecase entities and usecases planning.',
  PLAN_USECASE_ENTITIES_RESULT_SCHEMA
);

async function beforePromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
  args?: string,
): Promise<mls.msg.AgentIntent[]> {
  if (!agent || !step) throw new Error('[agentPlanUsecaseEntities](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const finalPlan = getFinalizeSolutionPlanOutput(context);
  const persistenceIndex = getPlanPersistenceIndexOutput(context);
  const tableDefinitions = await getPlanTableDefinitionOutputs(context);
  const metricsIndex = getPlanMetricsIndexOutput(context);
  const metricTableDefinitions = await getPlanMetricTableDefinitionOutputs(context);

  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(PLAN_USECASE_ENTITIES_TOOL_NAME),
      buildHumanPrompt(args, finalPlan, persistenceIndex, tableDefinitions, metricsIndex, metricTableDefinitions),
      planUsecaseEntitiesToolSchema,
      PLAN_USECASE_ENTITIES_TOOL_NAME
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
  let output: PlanUsecaseEntitiesOutput | undefined;

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    output = extractPlanUsecaseEntitiesOutput(payload);
    validatePlanUsecaseEntitiesOutput(output, getPlanPersistenceIndexOutput(context).result.tables.length > 0);
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentPlanUsecaseEntities returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentPlanUsecaseEntities returned status needs_input; keeping usecase plan draft.';
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);

  // TODO-FINAL-023/024: hold the step open and run critic/repair before approving the usecase plan.
  // The incremental artifact save moves to the critic approval path (possibly with a repaired plan).
  if (status === 'completed' && output && output.status === 'ok') {
    return createHoldIndexForReviewIntents(context, parentStep, step, hookSequential, 'usecasePlan');
  }

  if (status === 'completed' && output) await saveNewSolutionPlanArtifacts(context, agent.agentName, step, output);
  return [createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined)];
}

export function getPlanUsecaseEntitiesOutput(context: mls.msg.ExecutionContext): PlanUsecaseEntitiesOutput {
  // TODO-FINAL-024: prefer the latest repaired index when a repair step exists.
  return getPlannerOutputWithRepair(context, 'agentPlanUsecaseEntities', 'usecasePlan', planUsecaseEntitiesConfig, output => validatePlanUsecaseEntitiesOutput(output, getPlanPersistenceIndexOutput(context).result.tables.length > 0));
}

function extractPlanUsecaseEntitiesOutput(payload: unknown): PlanUsecaseEntitiesOutput {
  return extractPlannerOutput(payload, planUsecaseEntitiesConfig);
}

export const planUsecaseEntitiesConfig = {
  toolName: PLAN_USECASE_ENTITIES_TOOL_NAME,
  stepId: PLAN_USECASE_ENTITIES_STEP_ID,
  stepIdAliases: PLAN_USECASE_ENTITIES_ALIASES,
  normalizeResult: normalizePlanUsecaseEntitiesResult,
};

export function normalizePlanUsecaseEntitiesResult(value: unknown): PlanUsecaseEntitiesResult {
  const result = assertRecord(value, 'result');
  const controllerRules = assertRecord(result.controllerRules, 'result.controllerRules');
  return {
    backendArchitecture: normalizeBackendArchitecture(result.backendArchitecture),
    usecaseEntities: assertArray(result.usecaseEntities, 'result.usecaseEntities').map((item, index) => normalizeUsecaseEntity(item, `result.usecaseEntities[${index}]`)),
    usecases: assertArray(result.usecases, 'result.usecases').map((item, index) => normalizeUsecase(item, `result.usecases[${index}]`)),
    controllerRules: {
      bffMustCallUsecases: assertBoolean(controllerRules.bffMustCallUsecases, 'result.controllerRules.bffMustCallUsecases'),
      bffDirectTableAccessForbidden: assertBoolean(controllerRules.bffDirectTableAccessForbidden, 'result.controllerRules.bffDirectTableAccessForbidden'),
    },
  };
}

function assertBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean`);
  return value;
}

function normalizeBackendArchitecture(value: unknown): Record<string, unknown> {
  const architecture = assertRecord(value, 'result.backendArchitecture');
  assertString(architecture.pattern, 'result.backendArchitecture.pattern');
  assertString(architecture.layer2Responsibility, 'result.backendArchitecture.layer2Responsibility');
  assertString(architecture.layer3Responsibility, 'result.backendArchitecture.layer3Responsibility');
  assertString(architecture.layer1Responsibility, 'result.backendArchitecture.layer1Responsibility');
  return architecture;
}

function normalizeUsecaseEntity(value: unknown, path: string): unknown {
  const entity = assertRecord(value, path);
  assertString(entity.usecaseEntityId, `${path}.usecaseEntityId`);
  assertString(entity.title, `${path}.title`);
  assertString(entity.purpose, `${path}.purpose`);
  normalizeTableRefArray(entity.sourceTables, `${path}.sourceTables`);
  normalizeStringArray(entity.allowedOperations, `${path}.allowedOperations`);
  if (entity.layer !== 'layer_3_usecases') throw new Error(`${path}.layer must be layer_3_usecases`);
  if (entity.rulesApplied !== undefined) normalizeStringArray(entity.rulesApplied, `${path}.rulesApplied`);
  return entity;
}

function normalizeUsecase(value: unknown, path: string): unknown {
  const usecase = assertRecord(value, path);
  assertString(usecase.usecaseId, `${path}.usecaseId`);
  assertString(usecase.title, `${path}.title`);
  assertString(usecase.purpose, `${path}.purpose`);
  assertString(usecase.actor, `${path}.actor`);
  if (usecase.layer !== 'layer_3_usecases') throw new Error(`${path}.layer must be layer_3_usecases`);
  normalizeStringArray(usecase.inputEntities, `${path}.inputEntities`);
  normalizeStringArray(usecase.outputEntities, `${path}.outputEntities`);
  normalizeTableRefArray(usecase.readsTables, `${path}.readsTables`);
  normalizeTableRefArray(usecase.writesTables, `${path}.writesTables`);
  if (usecase.commands !== undefined) {
    assertArray(usecase.commands, `${path}.commands`).forEach((cmd, index) => normalizeUsecaseCommand(cmd, `${path}.commands[${index}]`));
  }
  normalizeStringArray(usecase.rulesApplied, `${path}.rulesApplied`);
  return usecase;
}

function normalizeUsecaseCommand(value: unknown, path: string): unknown {
  const command = assertRecord(value, path);
  assertString(command.commandId, `${path}.commandId`);
  assertArray(command.input, `${path}.input`).forEach((field, index) => {
    const record = assertRecord(field, `${path}.input[${index}]`);
    assertString(record.name, `${path}.input[${index}].name`);
    assertString(record.type, `${path}.input[${index}].type`);
    if (typeof record.required !== 'boolean') throw new Error(`${path}.input[${index}].required must be a boolean`);
  });
  assertArray(command.output, `${path}.output`).forEach((field, index) => {
    const record = assertRecord(field, `${path}.output[${index}]`);
    assertString(record.name, `${path}.output[${index}].name`);
    assertString(record.type, `${path}.output[${index}].type`);
  });
  return command;
}

function normalizeTableRef(value: unknown, path: string): TableRef {
  const ref = assertRecord(value, path);
  const tableName = assertString(ref.tableName, `${path}.tableName`);
  const ownership = assertString(ref.ownership, `${path}.ownership`);
  if (!TABLE_OWNERSHIP_ENUM.includes(ownership as TableOwnership)) {
    throw new Error(`${path}.ownership must be one of: ${TABLE_OWNERSHIP_ENUM.join(', ')}`);
  }
  return { tableName, ownership: ownership as TableOwnership };
}

function normalizeTableRefArray(value: unknown, path: string): TableRef[] {
  return assertArray(value, path).map((item, index) => normalizeTableRef(item, `${path}[${index}]`));
}

function normalizeStringArray(value: unknown, path: string): string[] {
  return assertArray(value, path).map((item, index) => assertString(item, `${path}[${index}]`));
}

export function validatePlanUsecaseEntitiesOutput(output: PlanUsecaseEntitiesOutput, hasModuleTables: boolean): void {
  if (!output.result.controllerRules.bffMustCallUsecases) throw new Error('bffMustCallUsecases must be true');
  if (!output.result.controllerRules.bffDirectTableAccessForbidden) throw new Error('bffDirectTableAccessForbidden must be true');
  if (output.status === 'ok' && hasModuleTables && output.result.usecaseEntities.length === 0) {
    throw new Error('module tables exist, but usecaseEntities is empty');
  }
  if (output.status === 'ok' && hasModuleTables && output.result.usecases.length === 0) {
    throw new Error('module tables exist, but usecases is empty');
  }
  if (output.status === 'needs_input' && output.questions.length === 0) throw new Error('needs_input usecase plan must include questions');
}

function buildHumanPrompt(
  args: string,
  finalPlan: FinalSolutionPlanOutput,
  persistenceIndex: PlanPersistenceIndexOutput,
  tableDefinitions: PlanTableDefinitionOutput[],
  metricsIndex: PlanMetricsIndexOutput,
  metricTableDefinitions: PlanMetricTableDefinitionOutput[],
): string {
  // TODO-FINAL-030 (R1): compact context. Usecase planning references tables/entities by id/name
  // and ownership (to mark mdm/horizontal/plugin), and which metrics to update — not the full
  // final plan, full table columns or full metric table definitions.
  const reduced = {
    finalPlan: compactFinalPlan(finalPlan.result),
    persistenceTables: summarizeRecords(persistenceIndex.result.tables, ['tableId', 'tableName', 'rootEntity', 'sourceEntities', 'embeddedEntities']),
    excludedEntities: summarizeRecords(persistenceIndex.result.persistenceScope.excludedEntities, ['entityId', 'ownership']),
    metricTables: summarizeRecords(metricsIndex.result.metricTables, ['metricTableId', 'tableName', 'sourceBaseTables', 'sourceEntities']),
  };
  void tableDefinitions; void metricTableDefinitions; // column/hypertable detail not needed here

  return `## Planned step args
${args}

## Reduced usecase-planning context
${JSON.stringify(reduced, null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codeinstruct -->
<!-- x-tool-strict: true -->
  
You are agentPlanUsecaseEntities for the collab.codes "newSolution" flow.
Plan entities and use cases for layer_3_usecases.
The goal is to create .defs data that will later materialize backend use case files. Do not generate TypeScript code.
Use the same language as the user for titles, purposes, questions, and trace.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## Rules
- Create usecase entities for module-owned aggregate entities that are read or written by BFF commands, workflows, agents, or metrics.
- Include metric table update responsibilities in the use cases that write base transactional tables.
- If an aggregate has child data stored in details, maintain the parent and child data in the same use case.
- layer_2_controllers must always call layer_3_usecases.
- Only layer_3_usecases may access tables from layer_1_external.
- BFF commands generated later must be able to reference these use cases by usecaseId.
- Do not generate TypeScript code.

## Concepts (TODO-FINAL-020) — do not confuse these three
- approvedArtifacts.usecaseEntities (final plan): plan-level list of approved usecase ENTITY GROUPS (e.g. "OrderEntity"). It is a coarse approval signal, NOT a 1:1 target.
- usecaseEntities (this output): the layer_3 aggregate entities you DETAIL here (usecaseEntityId, sourceTables, allowedOperations). You MAY consolidate several approved groups into fewer entities — the COUNT need NOT match approvedArtifacts.usecaseEntities.
- usecases (this output): INDIVIDUAL operations (usecaseId, actor, reads/writes, commands). Workflows/agents/BFF reference operations by usecaseId, never by usecaseEntityId.
Coverage compares usecases by usecaseId; it must NOT require parity between approvedArtifacts.usecaseEntities and usecaseEntities.

## Usecase commands (input/output)
Each command in a usecase's commands[] must declare its signature as structured typed fields:
- commandId: stable camelCase id of the command.
- input: array of { name, type, required } — the parameters the command receives (empty array when none).
- output: array of { name, type } — the fields the command returns (empty array when none).
Use concise primitive/domain types in "type" (e.g. string, number, boolean, date, or an entity/enum id). Do not embed free-form JSON; only the declared fields.

## Table references (sourceTables, readsTables, writesTables)
Each entry must be an object { tableName, ownership } — never a plain string.
Set ownership based on who owns the table:
- "moduleOwned"    — tables in this module's layer_1_external (from the table definitions context)
- "mdmOwned"       — entities in persistenceIndex.excludedEntities with ownership "mdmOwned"; accessed at runtime via ctx.data.mdmDocument / ctx.data.mdmEntityIndex (project 102034)
- "horizontalOwned"— entities excluded with ownership "horizontalOwned"
- "pluginOwned"    — entities excluded with ownership "pluginOwned"
MDM-owned tables must still appear in readsTables/writesTables so the materializer knows the usecase depends on MDM, but with ownership "mdmOwned".
`;
