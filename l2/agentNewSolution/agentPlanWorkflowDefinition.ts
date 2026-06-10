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
  collectStringRefs,
  extractPlannerOutput,
  getPlannerOutputsWithFileFallback,
  isRecord,
  pickRecordsByIds,
  reconcileParallelDynamicFanOut,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import type { FinalSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import { readSavedPlanArtifactDataList, saveNewSolutionAgentTracePayload, saveNewSolutionPlanArtifacts } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { getPlanMetricTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanMetricTableDefinition.js';
import type { PlanMetricTableDefinitionOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricTableDefinition.js';
import { getPlanMetricsIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricsIndex.js';
import { getPlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
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

export type WorkflowScope = 'singleModule' | 'multiModule' | 'multiModuleExternal';

export interface WorkflowPageRefByModule {
  moduleId: string;
  pageId: string;
}

export interface WorkflowEntityRefByModule {
  moduleId: string;
  entity: string;
}

export interface WorkflowWritesArtifact {
  moduleId: string;
  artifactType: 'table' | 'metricTable' | 'usecase' | 'page' | 'pluginConnection' | 'workflow';
  artifactId: string;
}

export interface PlanWorkflowDefinitionResult {
  workflowDefinition: Record<string, unknown> & {
    workflowId: string;
    title: string;
    purpose: string;
    executionMode: string;
    createsTask: boolean;
    // per-module impact metadata (always present; arrays may be empty).
    workflowScope: WorkflowScope;
    moduleRefs: string[];
    pageRefsByModule: WorkflowPageRefByModule[];
    entityRefsByModule: WorkflowEntityRefByModule[];
    writesArtifacts: WorkflowWritesArtifact[];
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
          'workflowScope',
          'moduleRefs',
          'pageRefsByModule',
          'entityRefsByModule',
          'writesArtifacts',
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
          // T-008: canonical camelCase ids (tableId/metricTableId), never physical snake_case names.
          persistenceRefs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Canonical camelCase tableId/metricTableId refs from the persistence/metrics indices (never physical snake_case table names)',
          },
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
          // explicit per-module impact metadata so a future maintenance agent
          // can read a global l4 workflow and know exactly which modules/pages/entities/artifacts
          // it touches. Arrays may be empty (single-module workflows), but must be present.
          workflowScope: { enum: ['singleModule', 'multiModule', 'multiModuleExternal'] },
          moduleRefs: { type: 'array', items: { type: 'string' } },
          pageRefsByModule: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['moduleId', 'pageId'],
              properties: {
                moduleId: { type: 'string' },
                pageId: { type: 'string' },
              },
            },
          },
          entityRefsByModule: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['moduleId', 'entity'],
              properties: {
                moduleId: { type: 'string' },
                entity: { type: 'string' },
              },
            },
          },
          writesArtifacts: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['moduleId', 'artifactType', 'artifactId'],
              properties: {
                moduleId: { type: 'string' },
                artifactType: { enum: ['table', 'metricTable', 'usecase', 'page', 'pluginConnection', 'workflow'] },
                artifactId: { type: 'string' },
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
  const tableDefinitions = await getPlanTableDefinitionOutputs(context);
  const metricTableDefinitions = await getPlanMetricTableDefinitionOutputs(context);

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
    // Deterministic id coercion (same rationale as page definition): each parallel child's prompt
    // contains only this workflow's index item, so the content is always for the selector — a
    // workflowId different from the selector is a label slip. Coerce instead of failing the child.
    if (workflowSelector && output.result.workflowDefinition.workflowId !== workflowSelector) {
      console.log(`[${agent.agentName}](afterPromptStep) coercing workflowId '${output.result.workflowDefinition.workflowId}' to selector '${workflowSelector}'`);
      output.result.workflowDefinition.workflowId = workflowSelector;
    }
    const persistenceIdMaps = buildWorkflowPersistenceIdMaps(context);
    deriveWorkflowPersistenceRefs(output, persistenceIdMaps); // T-009
    normalizeWorkflowPersistenceRefs(output, persistenceIdMaps); // T-008
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

  // /023: clear the full payload only when the .defs.ts was saved; the coverage
  // validator and downstream readers now read workflow definitions back from the saved files.
  let cleaner: 'input' | 'input_output' | undefined;
  if (status === 'completed' && output) {
    const saved = await saveNewSolutionPlanArtifacts(context, agent.agentName, step, output);
    cleaner = saved.length > 0 ? 'input_output' : 'input';
  }

  // T-006: when this child is the last live one, reconcile the approved index selectors vs the
  // saved artifacts; re-spawn missing children (limited rounds) before the fan-out is finalized.
  const reconcileIntents = await buildWorkflowFanOutReconcileIntents(context, parentStep, step, hookSequential);

  const updateIntent = createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, cleaner);
  return [...reconcileIntents, updateIntent];
}

// T-008/T-009: canonical id maps from the persistence and metrics indices.
interface WorkflowPersistenceIdMaps {
  knownIds: Set<string>; // tableIds + metricTableIds (canonical camelCase)
  idByName: Map<string, string>; // physical snake_case tableName -> canonical id
}

function buildWorkflowPersistenceIdMaps(context: mls.msg.ExecutionContext): WorkflowPersistenceIdMaps {
  const knownIds = new Set<string>();
  const idByName = new Map<string, string>();
  try {
    for (const table of getPlanPersistenceIndexOutput(context).result.tables) {
      knownIds.add(table.tableId);
      if (table.tableName) idByName.set(table.tableName, table.tableId);
    }
  } catch { /* persistence index unavailable: skip table resolution */ }
  try {
    for (const metricTable of getPlanMetricsIndexOutput(context).result.metricTables) {
      knownIds.add(metricTable.metricTableId);
      if (metricTable.tableName) idByName.set(metricTable.tableName, metricTable.metricTableId);
    }
  } catch { /* metrics index unavailable: skip metric resolution */ }
  return { knownIds, idByName };
}

/**
 * T-009: persistenceRefs must be the superset implied by what the workflow writes (E-011/E-012).
 * Deterministically union the current refs with metricRefs that resolve to metric tables and
 * writesArtifacts of type table/metricTable, instead of accepting an empty list.
 */
function deriveWorkflowPersistenceRefs(output: PlanWorkflowDefinitionOutput, maps: WorkflowPersistenceIdMaps): void {
  if (output.status !== 'ok') return;
  const workflow = output.result.workflowDefinition;
  const refs = new Set<string>();
  const addKnown = (ref: unknown) => {
    if (typeof ref !== 'string' || !ref.trim()) return;
    const value = ref.trim();
    if (maps.knownIds.has(value)) refs.add(value);
    else if (maps.idByName.has(value)) refs.add(maps.idByName.get(value)!);
  };

  for (const ref of Array.isArray(workflow.persistenceRefs) ? workflow.persistenceRefs : []) {
    if (typeof ref === 'string' && ref.trim()) refs.add(ref.trim());
  }
  // metricRefs that resolve to metric tables (dashboard refs do not resolve and stay out).
  for (const ref of Array.isArray(workflow.metricRefs) ? workflow.metricRefs : []) addKnown(ref);
  for (const artifact of workflow.writesArtifacts || []) {
    if (artifact && (artifact.artifactType === 'table' || artifact.artifactType === 'metricTable')) addKnown(artifact.artifactId);
  }

  workflow.persistenceRefs = [...refs];
}

/**
 * T-008: persistenceRefs must use the canonical camelCase id (tableId/metricTableId), never the
 * physical snake_case table name (E-010). Resolves each ref against the persistence and metrics
 * indices (tableName -> tableId map), normalizes the refs in place, and throws (failing the
 * child step) when a ref cannot be resolved to any known id.
 */
function normalizeWorkflowPersistenceRefs(output: PlanWorkflowDefinitionOutput, maps: WorkflowPersistenceIdMaps): void {
  if (output.status !== 'ok') return;
  const workflow = output.result.workflowDefinition;
  const refs = Array.isArray(workflow.persistenceRefs) ? workflow.persistenceRefs : [];
  if (refs.length === 0) return;
  if (maps.knownIds.size === 0 && maps.idByName.size === 0) return;

  const unresolved: string[] = [];
  const normalized: string[] = [];
  for (const ref of refs) {
    if (typeof ref !== 'string' || !ref.trim()) continue;
    const value = ref.trim();
    if (maps.knownIds.has(value)) {
      normalized.push(value);
    } else if (maps.idByName.has(value)) {
      console.log(`[agentPlanWorkflowDefinition] normalizing persistenceRef '${value}' to canonical id '${maps.idByName.get(value)}' (T-008)`);
      normalized.push(maps.idByName.get(value)!);
    } else {
      unresolved.push(value);
    }
  }

  if (unresolved.length > 0) {
    throw new Error(`workflow ${workflow.workflowId} persistenceRefs do not resolve to any tableId/metricTableId: ${unresolved.join(', ')}`);
  }
  workflow.persistenceRefs = [...new Set(normalized)];
}

// T-006: expected selectors come from the approved workflow index; saved selectors from the
// plan artifacts manifest ('workflow' artifacts). Best-effort: never throws.
async function buildWorkflowFanOutReconcileIntents(
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
): Promise<mls.msg.AgentIntent[]> {
  try {
    const expectedSelectors = getPlanWorkflowIndexOutput(context).result.workflows.map(workflow => workflow.workflowId);
    const savedSelectors = new Set<string>();
    for (const data of await readSavedPlanArtifactDataList(context, 'workflow')) {
      const workflow = data.workflowDefinition;
      const id = workflow && typeof workflow === 'object' ? (workflow as Record<string, unknown>).workflowId : undefined;
      if (typeof id === 'string' && id) savedSelectors.add(id);
    }
    return reconcileParallelDynamicFanOut(context, parentStep, step, hookSequential, { expectedSelectors, savedSelectors });
  } catch (error) {
    console.warn('[agentPlanWorkflowDefinition] fan-out reconcile skipped:', error);
    return [];
  }
}

// /023: also reads workflow definitions back from saved .defs.ts when the task
// payload was cleared with cleaner="input_output".
export function getPlanWorkflowDefinitionOutputs(context: mls.msg.ExecutionContext): Promise<PlanWorkflowDefinitionOutput[]> {
  return getPlannerOutputsWithFileFallback(
    context,
    'agentPlanWorkflowDefinition',
    'workflow',
    planWorkflowDefinitionConfig,
    output => output.result.workflowDefinition.workflowId,
    output => validatePlanWorkflowDefinitionOutput(output, output.result.workflowDefinition.workflowId),
  );
}

function extractPlanWorkflowDefinitionOutput(payload: unknown): PlanWorkflowDefinitionOutput {
  return extractPlannerOutput(payload, planWorkflowDefinitionConfig);
}

const planWorkflowDefinitionConfig = {
  toolName: PLAN_WORKFLOW_DEFINITION_TOOL_NAME,
  stepId: PLAN_WORKFLOW_DEFINITION_STEP_ID,
  stepIdAliases: PLAN_WORKFLOW_DEFINITION_ALIASES,
  preNormalizeResult: preNormalizePlanWorkflowDefinitionResult,
  normalizeResult: normalizePlanWorkflowDefinitionResult,
};

function preNormalizePlanWorkflowDefinitionResult(value: unknown): unknown {
  const result = assertRecord(value, 'result');
  const workflowDefinition = assertRecord(result.workflowDefinition, 'result.workflowDefinition');
  const transitions = workflowDefinition.transitions;
  if (!Array.isArray(transitions)) return value;

  const refFields = ['persistenceRefs', 'usecaseRefs', 'metricRefs'];
  const topLevelRefs = new Map<string, Set<string>>();
  for (const field of refFields) {
    const values = workflowDefinition[field];
    topLevelRefs.set(field, new Set(Array.isArray(values) ? values.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []));
  }

  let changed = false;
  const normalizedTransitions = transitions.map(transition => {
    if (!isRecord(transition)) return transition;

    const normalizedTransition: Record<string, unknown> = { ...transition };
    for (const field of refFields) {
      const transitionRefs = normalizedTransition[field];
      if (transitionRefs === undefined) continue;
      changed = true;
      if (Array.isArray(transitionRefs)) {
        const targetRefs = topLevelRefs.get(field);
        for (const ref of transitionRefs) {
          if (typeof ref === 'string' && ref.trim()) targetRefs?.add(ref);
        }
      }
      delete normalizedTransition[field];
    }
    return normalizedTransition;
  });

  if (!changed) return value;

  return {
    ...result,
    workflowDefinition: {
      ...workflowDefinition,
      transitions: normalizedTransitions,
      persistenceRefs: Array.from(topLevelRefs.get('persistenceRefs') || []),
      usecaseRefs: Array.from(topLevelRefs.get('usecaseRefs') || []),
      metricRefs: Array.from(topLevelRefs.get('metricRefs') || []),
    },
  };
}

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
      // 
      workflowScope: normalizeWorkflowScope(workflowDefinition.workflowScope),
      moduleRefs: normalizeStringArray(workflowDefinition.moduleRefs, 'result.workflowDefinition.moduleRefs'),
      pageRefsByModule: assertArray(workflowDefinition.pageRefsByModule ?? [], 'result.workflowDefinition.pageRefsByModule')
        .map((item, index) => normalizePageRefByModule(item, `result.workflowDefinition.pageRefsByModule[${index}]`)),
      entityRefsByModule: assertArray(workflowDefinition.entityRefsByModule ?? [], 'result.workflowDefinition.entityRefsByModule')
        .map((item, index) => normalizeEntityRefByModule(item, `result.workflowDefinition.entityRefsByModule[${index}]`)),
      writesArtifacts: assertArray(workflowDefinition.writesArtifacts ?? [], 'result.workflowDefinition.writesArtifacts')
        .map((item, index) => normalizeWritesArtifact(item, `result.workflowDefinition.writesArtifacts[${index}]`)),
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

// helpers
function normalizeStringArray(value: unknown, path: string): string[] {
  return assertArray(value ?? [], path).map((item, index) => assertString(item, `${path}[${index}]`));
}

function normalizeWorkflowScope(value: unknown): WorkflowScope {
  if (value === 'singleModule' || value === 'multiModule' || value === 'multiModuleExternal') return value;
  throw new Error(`result.workflowDefinition.workflowScope must be singleModule, multiModule or multiModuleExternal`);
}

function normalizePageRefByModule(value: unknown, path: string): WorkflowPageRefByModule {
  const record = assertRecord(value, path);
  return {
    moduleId: assertString(record.moduleId, `${path}.moduleId`),
    pageId: assertString(record.pageId, `${path}.pageId`),
  };
}

function normalizeEntityRefByModule(value: unknown, path: string): WorkflowEntityRefByModule {
  const record = assertRecord(value, path);
  return {
    moduleId: assertString(record.moduleId, `${path}.moduleId`),
    entity: assertString(record.entity, `${path}.entity`),
  };
}

function normalizeWritesArtifact(value: unknown, path: string): WorkflowWritesArtifact {
  const record = assertRecord(value, path);
  const artifactType = assertString(record.artifactType, `${path}.artifactType`);
  const allowed = new Set(['table', 'metricTable', 'usecase', 'page', 'pluginConnection', 'workflow']);
  if (!allowed.has(artifactType)) throw new Error(`${path}.artifactType must be one of ${[...allowed].join(', ')}`);
  return {
    moduleId: assertString(record.moduleId, `${path}.moduleId`),
    artifactType: artifactType as WorkflowWritesArtifact['artifactType'],
    artifactId: assertString(record.artifactId, `${path}.artifactId`),
  };
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

  // keep workflowScope coherent with moduleRefs so impact analysis is reliable.
  if (output.status === 'ok') {
    const moduleCount = new Set(workflow.moduleRefs).size;
    if (workflow.workflowScope === 'singleModule' && moduleCount > 1) {
      throw new Error(`workflow ${workflow.workflowId} is singleModule but moduleRefs has ${moduleCount} modules`);
    }
    if ((workflow.workflowScope === 'multiModule' || workflow.workflowScope === 'multiModuleExternal') && moduleCount < 2) {
      throw new Error(`workflow ${workflow.workflowId} is ${workflow.workflowScope} but moduleRefs has fewer than 2 modules`);
    }
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
  // send only what THIS workflow references, not all workflows/tables/metrics.
  void workflowIndex; // the selected index item below is enough
  const fp = finalPlan.result;

  const tableIds = new Set(workflowIndexItem.persistenceRefs);
  const usecaseIds = new Set(workflowIndexItem.usecaseRefs);
  const metricIds = new Set(workflowIndexItem.metricRefs);
  const actorIds = new Set(workflowIndexItem.actors);
  const ruleIds = new Set(workflowIndexItem.rulesApplied);
  const capabilityIds = new Set(workflowIndexItem.relatedCapabilities);

  const selectedTables = pickRecordsByIds(tableDefinitions.map(t => t.result.tableDefinition), tableIds, ['tableId']);
  const selectedUsecases = pickRecordsByIds(usecasePlan.result.usecases, usecaseIds, ['usecaseId']);
  const selectedMetricTableDefs = pickRecordsByIds(metricTableDefinitions.map(m => m.result.metricTableDefinition), metricIds, ['metricTableId']);

  const entityNames = new Set<string>(workflowIndexItem.relatedEntities);
  for (const table of selectedTables) collectStringRefs(table, ['rootEntity', 'sourceEntities', 'embeddedEntities'], entityNames);
  for (const usecase of selectedUsecases) collectStringRefs(usecase, ['inputEntities', 'outputEntities'], entityNames);
  const ontologySubset: Record<string, unknown> = {};
  for (const key of Object.keys(fp.ontology.entities)) {
    if (entityNames.has(key)) ontologySubset[key] = fp.ontology.entities[key];
  }

  const reduced = {
    workflowSelector: args,
    workflowIndexItem,
    module: fp.module,
    actors: pickRecordsByIds(fp.actors, actorIds, ['actorId']),
    capabilities: pickRecordsByIds(fp.capabilities, capabilityIds, ['capabilityId', 'id']),
    rules: pickRecordsByIds(fp.rules, ruleIds, ['ruleId']),
    ontologyEntities: ontologySubset,
    backendArchitecture: usecasePlan.result.backendArchitecture,
    controllerRules: usecasePlan.result.controllerRules,
    usecases: selectedUsecases,
    usecaseEntities: usecasePlan.result.usecaseEntities,
    tables: selectedTables,
    metricTableDefinitions: selectedMetricTableDefs,
  };

  return `## Current workflow selector
${args}

## Reduced workflow context (only what this workflow references)
${JSON.stringify(reduced, null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codeinstruct -->
<!-- x-tool-strict: true -->

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
- Put persistenceRefs, usecaseRefs, and metricRefs only at workflowDefinition top level, never inside transitions.
- Transition actions must only write entity fields and enum values declared in the final solution plan.
- Include persistenceRefs with module-owned table ids when transitions read or write local persisted state.
- persistenceRefs must use the canonical camelCase tableId (or metricTableId) exactly as defined in the persistence/metrics indices — NEVER the physical snake_case table name (e.g. use "propertyTable" style ids, not "property_table").
- Include usecaseRefs when transitions mutate module-owned data through layer_3_usecases.
- Include metricRefs when transitions feed operational metrics; metric updates happen in backend use cases, not pages.
- relatedPages is a DERIVED field filled later by code (pages do not exist yet at this point): always return relatedPages as an empty array []. Never invent page ids.
- Do not reference MDM, horizontal, or plugin-owned entities as new module tables.
- defsPlan.fileName should be stable and workflow-specific, such as workflows/{workflowId}.defs.ts.
- defsPlan.exportName should be a stable camelCase export name, such as {workflowId}Def.
- defsPlan.saveAsDefs must be true.
- Use rule ids; do not write loose rule text.

## Module-impact metadata
The workflow is saved as a GLOBAL artifact in l4/workflows. Declare its module impact explicitly so a maintenance agent can compute the blast radius without reading free text:
- workflowScope: "singleModule" when every page/entity/artifact belongs to the current module; "multiModule" when more than one module participates; "multiModuleExternal" when more than one module participates AND an external integration (plugin) is dominant.
- moduleRefs: every module id the workflow touches (include the current module). singleModule => exactly one; multiModule/multiModuleExternal => two or more.
- pageRefsByModule: each related page paired with the moduleId that owns it (reconcile relatedPages with their module).
- entityRefsByModule: each entity the workflow reads/writes paired with the moduleId where it lives (use this when the same entity name can appear in different modules).
- writesArtifacts: the modular artifacts the workflow may require changing, each as { moduleId, artifactType, artifactId } (artifactType one of table, metricTable, usecase, page, pluginConnection, workflow).
- All five fields are required; use empty arrays when nothing applies, but set workflowScope correctly.
- Do not generate TypeScript code.
`;
