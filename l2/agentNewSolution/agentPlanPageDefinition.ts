/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanPageDefinition.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PLANNER_SCHEMA_VERSION,
  PlannerOutput,
  assertArray,
  assertRecord,
  assertString,
  createPlannerPromptReadyIntent,
  createPlannerVariableToolSchema,
  createPlannerUpdateStatusIntent,
  collectStringRefs,
  extractPlannerOutput,
  getPlannerOutputs,
  pickRecordsByIds,
  reconcileParallelDynamicFanOut,
  summarizeRecords,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import type { FinalSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import { readSavedPlanArtifactDataList, saveNewSolutionAgentTracePayload, saveNewSolutionPlanArtifacts } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { getPlanAgentsOutput } from '/_102020_/l2/agentNewSolution/agentPlanAgents.js';
import type { PlanAgentsOutput } from '/_102020_/l2/agentNewSolution/agentPlanAgents.js';
import { getPlanHorizontalsOutput } from '/_102020_/l2/agentNewSolution/agentPlanHorizontals.js';
import type { PlanHorizontalsOutput } from '/_102020_/l2/agentNewSolution/agentPlanHorizontals.js';
import { getPlanMDMOutput } from '/_102020_/l2/agentNewSolution/agentPlanMDM.js';
import type { PlanMDMOutput } from '/_102020_/l2/agentNewSolution/agentPlanMDM.js';
import { getPlanMetricTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanMetricTableDefinition.js';
import type { PlanMetricTableDefinitionOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricTableDefinition.js';
import { getPlanMetricsIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricsIndex.js';
import type { PlanMetricsIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricsIndex.js';
import { getPlanPageIndexOutput, validatePageFlowRefsAgainstWorkflowIndex } from '/_102020_/l2/agentNewSolution/agentPlanPageIndex.js';
import type { PageIndexItem, PlanPageIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPageIndex.js';
import { getPlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import type { PlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import { getPlanPluginsOutput } from '/_102020_/l2/agentNewSolution/agentPlanPlugins.js';
import type { PlanPluginsOutput } from '/_102020_/l2/agentNewSolution/agentPlanPlugins.js';
import { getPlanTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';
import type { PlanTableDefinitionOutput } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';
import { getPlanUsecaseEntitiesOutput } from '/_102020_/l2/agentNewSolution/agentPlanUsecaseEntities.js';
import type { PlanUsecaseEntitiesOutput } from '/_102020_/l2/agentNewSolution/agentPlanUsecaseEntities.js';
import { getPlanWorkflowDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanWorkflowDefinition.js';
import type { PlanWorkflowDefinitionOutput } from '/_102020_/l2/agentNewSolution/agentPlanWorkflowDefinition.js';
import { getPlanWorkflowIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanWorkflowIndex.js';
import type { PlanWorkflowIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanWorkflowIndex.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentPlanPageDefinition',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Plan one page definition and its BFF commands from the page index',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const PLAN_PAGE_DEFINITION_TOOL_NAME = 'submitPageDefinitionPlan';
export const PLAN_PAGE_DEFINITION_STEP_ID = 'plan-page-definition';
const PLAN_PAGE_DEFINITION_ALIASES = [PLAN_PAGE_DEFINITION_STEP_ID, 'plan-page-definition'];

export interface PageInputSpec {
  name: string;
  type: string;
  required?: boolean;
  sources: string[];
  description?: string;
  entityRef?: string;
  fieldRef?: string;
}

export interface NavigationRefSpec {
  direction: string;
  pageId: string;
  trigger: string;
  description?: string;
}

export interface OrganismSpec {
  organismName: string;
  purpose: string;
  userActions: string[];
  requiredEntities: string[];
  readsFields: string[];
  writesFields: string[];
  rulesApplied: string[];
}

export interface PageSectionSpec {
  sectionName: string;
  mode: string;
  organisms: OrganismSpec[];
}

export interface PageDefinitionSpec {
  pageId: string;
  pageName: string;
  actor: string;
  purpose: string;
  capabilities: string[];
  flowRefs: {
    experienceFlows: string[];
    entityLifecycles: string[];
    taskWorkflows: string[];
    automations: string[];
  };
  pluginRefs: string[];
  mdmRefs: string[];
  pageInputs: PageInputSpec[];
  navigationRefs: NavigationRefSpec[];
  sections: PageSectionSpec[];
}

export interface BffCommandInputField {
  name: string;
  type: string;
  required: boolean;
}

export interface BffCommandOutputField {
  name: string;
  type: string;
}

export interface BffCommandSpec {
  commandName: string;
  purpose: string;
  kind: 'query' | 'command' | 'mutation';
  input: BffCommandInputField[];
  output: BffCommandOutputField[];
  readsEntities: string[];
  writesEntities: string[];
  readsTables: string[];
  writesTables: string[];
  usecaseRefs: string[];
  layerContract: {
    controllerLayer: string;
    mustCallLayer: string;
    directTableAccessForbidden: boolean;
  };
  rulesApplied: string[];
}

export interface PlanPageDefinitionResult {
  pageDefinition: PageDefinitionSpec;
  bffCommands: BffCommandSpec[];
}

export type PlanPageDefinitionOutput = PlannerOutput<PlanPageDefinitionResult>;

const navigationRefSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['direction', 'pageId', 'trigger'],
  properties: {
    direction: { type: 'string' },
    pageId: { type: 'string' },
    trigger: { type: 'string' },
    description: { type: 'string' },
  },
};

// =============================================================================
// WARNING — this json schema is MECHANICALLY ENFORCED (x-tool-strict).
// The systemPrompt of this agent contains <!-- x-tool-strict: true -->: the
// collab-llm proxy validates the tool call arguments against this schema with
// ajv and REJECTS any LLM response that violates it (one retry via
// alternate_alias, then 502 with errorCode TOOL_ARGS_SCHEMA). When changing
// any schema below:
//  - keep `required` and `additionalProperties: false` accurate — a field
//    listed in required will now REJECT responses that omit it;
//  - keep the schema compatible with ajv draft 2020-12 ($defs/$ref/enum ok);
//  - keep the TypeScript types/normalizers (PageInputSpec etc.) and the
//    prompt in sync with the schema.
// =============================================================================
const pageInputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'type', 'sources'],
  properties: {
    name: { type: 'string' },
    type: { type: 'string' },
    required: { type: 'boolean' },
    sources: { type: 'array', items: { type: 'string' } },
    description: { type: 'string' },
    entityRef: { type: 'string' },
    fieldRef: { type: 'string' },
  },
};

const organismSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['organismName', 'purpose', 'userActions', 'requiredEntities', 'readsFields', 'writesFields', 'rulesApplied'],
  properties: {
    organismName: { type: 'string' },
    purpose: { type: 'string' },
    userActions: { type: 'array', items: { type: 'string' } },
    requiredEntities: { type: 'array', items: { type: 'string' } },
    readsFields: { type: 'array', items: { type: 'string' } },
    writesFields: { type: 'array', items: { type: 'string' } },
    rulesApplied: { type: 'array', items: { type: 'string' } },
  },
};

const sectionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['sectionName', 'mode', 'organisms'],
  properties: {
    sectionName: { type: 'string' },
    mode: { type: 'string' },
    organisms: { type: 'array', items: organismSchema },
  },
};

const bffCommandSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'commandName', 'purpose', 'kind', 'input', 'output',
    'readsEntities', 'writesEntities', 'readsTables', 'writesTables',
    'usecaseRefs', 'layerContract', 'rulesApplied'
  ],
  properties: {
    commandName: { type: 'string' },
    purpose: { type: 'string' },
    kind: { enum: ['query', 'command', 'mutation'] },
    // Structured typed fields (closed objects) so the schema is strict-ready (x-tool-strict).
    // Previously free-form objects (additionalProperties:true), which blocked native strict.
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
    readsEntities: { type: 'array', items: { type: 'string' } },
    writesEntities: { type: 'array', items: { type: 'string' } },
    readsTables: { type: 'array', items: { type: 'string' } },
    writesTables: { type: 'array', items: { type: 'string' } },
    usecaseRefs: { type: 'array', items: { type: 'string' } },
    layerContract: {
      type: 'object',
      additionalProperties: false,
      required: ['controllerLayer', 'mustCallLayer', 'directTableAccessForbidden'],
      properties: {
        controllerLayer: { type: 'string' },
        mustCallLayer: { type: 'string' },
        directTableAccessForbidden: { type: 'boolean' },
      },
    },
    rulesApplied: { type: 'array', items: { type: 'string' } },
  },
};

const planPageDefinitionToolSchema = createPlannerVariableToolSchema(
  PLAN_PAGE_DEFINITION_TOOL_NAME,
  'Submit one page definition plan (pageDefinition + bffCommands) for the current page selector.',
  {
    type: 'object',
    additionalProperties: false,
    required: ['pageDefinition', 'bffCommands'],
    properties: {
      pageDefinition: {
        type: 'object',
        additionalProperties: false,
        required: [
          'pageId', 'pageName', 'actor', 'purpose', 'capabilities',
          'flowRefs', 'pluginRefs', 'mdmRefs', 'pageInputs', 'navigationRefs', 'sections'
        ],
        properties: {
          pageId: { type: 'string' },
          pageName: { type: 'string' },
          actor: { type: 'string' },
          purpose: { type: 'string' },
          capabilities: { type: 'array', items: { type: 'string' } },
          flowRefs: {
            type: 'object',
            additionalProperties: false,
            required: ['experienceFlows', 'entityLifecycles', 'taskWorkflows', 'automations'],
            properties: {
              experienceFlows: { type: 'array', items: { type: 'string' } },
              entityLifecycles: { type: 'array', items: { type: 'string' } },
              taskWorkflows: { type: 'array', items: { type: 'string' } },
              automations: { type: 'array', items: { type: 'string' } },
            },
          },
          pluginRefs: { type: 'array', items: { type: 'string' } },
          mdmRefs: { type: 'array', items: { type: 'string' } },
          pageInputs: { type: 'array', items: pageInputSchema },
          navigationRefs: { type: 'array', items: navigationRefSchema },
          sections: { type: 'array', items: sectionSchema },
        },
      },
      bffCommands: { type: 'array', items: bffCommandSchema },
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
  if (!agent || !step) throw new Error('[agentPlanPageDefinition](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) page selector args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const finalPlan = getFinalizeSolutionPlanOutput(context);
  const mdm = getPlanMDMOutput(context);
  const horizontals = getPlanHorizontalsOutput(context);
  const plugins = getPlanPluginsOutput(context);
  const persistenceIndex = getPlanPersistenceIndexOutput(context);
  const tableDefinitions = await getPlanTableDefinitionOutputs(context);
  const metricsIndex = getPlanMetricsIndexOutput(context);
  const metricTableDefinitions = await getPlanMetricTableDefinitionOutputs(context);
  const usecasePlan = getPlanUsecaseEntitiesOutput(context);
  const workflowIndex = getPlanWorkflowIndexOutput(context);
  const workflowDefinitions = await getPlanWorkflowDefinitionOutputs(context);
  const agentsPlan = getPlanAgentsOutput(context);
  const pageIndex = getPlanPageIndexOutput(context);

  const pageIndexItem = pageIndex.result.pages.find(p => p.pageId === args);
  if (!pageIndexItem) throw new Error(`[${agent.agentName}](beforePromptStep) page selector not found in index: ${args}`);

  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(PLAN_PAGE_DEFINITION_TOOL_NAME),
      buildHumanPrompt(
        args,
        pageIndexItem,
        pageIndex,
        finalPlan,
        mdm,
        horizontals,
        plugins,
        persistenceIndex,
        tableDefinitions,
        metricsIndex,
        metricTableDefinitions,
        usecasePlan,
        workflowIndex,
        workflowDefinitions,
        agentsPlan
      ),
      planPageDefinitionToolSchema,
      PLAN_PAGE_DEFINITION_TOOL_NAME
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
  let output: PlanPageDefinitionOutput | undefined;
  const pageSelector = getPageSelector(step);

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    output = extractPlanPageDefinitionOutput(payload);
    // Deterministic id coercion: the selector (from the page index) is authoritative. Each parallel
    // child's reduced prompt contains ONLY this page's index item, so the generated content is always
    // for the selector's page — a pageId different from the selector is just a label slip (or a swap
    // with a sibling). Coerce it to the selector instead of failing the child.
    if (pageSelector && output.result.pageDefinition.pageId !== pageSelector) {
      console.warn(`[${agent.agentName}](afterPromptStep) coercing pageId '${output.result.pageDefinition.pageId}' to selector '${pageSelector}'`);
      output.result.pageDefinition.pageId = pageSelector;
    }
    validatePlanPageDefinitionOutput(output, pageSelector, getPlanWorkflowIndexOutput(context));
    validateBffCommandUsecaseRefs(output, pageSelector, context); // T-007
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentPlanPageDefinition returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentPlanPageDefinition returned status needs_input; keeping page definition draft.';
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);

  // /023: clear the full payload (input_output) only when the .defs.ts was
  // actually saved; the coverage validator now reads page definitions back from the saved
  // files via getPlanPageDefinitionOutputs. If the save produced nothing, keep the payload
  // (cleaner="input") so the page is not lost from the task.
  let cleaner: 'input' | 'input_output' | undefined;
  if (status === 'completed' && output) {
    const saved = await saveNewSolutionPlanArtifacts(context, agent.agentName, step, output);
    cleaner = saved.length > 0 ? 'input_output' : 'input';
  }

  // T-006: when this child is the last live one, reconcile the approved index selectors vs the
  // saved artifacts; re-spawn missing children (limited rounds) before the fan-out is finalized.
  const reconcileIntents = await buildPageFanOutReconcileIntents(context, parentStep, step, hookSequential);

  const updateIntent = createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, cleaner);
  return [...reconcileIntents, updateIntent];
}

// T-007: every bffCommand usecaseRef must exist in the approved usecase plan (E-005/E-006).
// A page child that references a missing usecase fails instead of saving a broken definition.
function validateBffCommandUsecaseRefs(output: PlanPageDefinitionOutput, pageSelector: string, context: mls.msg.ExecutionContext): void {
  if (output.status !== 'ok') return;
  const usecaseIds = new Set<string>();
  for (const usecase of getPlanUsecaseEntitiesOutput(context).result.usecases) {
    if (!usecase || typeof usecase !== 'object') continue;
    const id = (usecase as Record<string, unknown>).usecaseId;
    if (typeof id === 'string' && id) usecaseIds.add(id);
  }
  if (usecaseIds.size === 0) return;

  const unknown: string[] = [];
  for (const command of output.result.bffCommands) {
    for (const ref of command.usecaseRefs) {
      if (!usecaseIds.has(ref)) unknown.push(`${command.commandName}:${ref}`);
    }
  }
  if (unknown.length > 0) {
    throw new Error(`page ${pageSelector} references usecases missing from the usecase plan: ${unknown.join(', ')}`);
  }
}

// T-006: expected selectors come from the approved page index; saved selectors from the
// plan artifacts manifest ('page' artifacts). Best-effort: never throws.
async function buildPageFanOutReconcileIntents(
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
): Promise<mls.msg.AgentIntent[]> {
  try {
    const expectedSelectors = getPlanPageIndexOutput(context).result.pages.map(page => page.pageId);
    const savedSelectors = new Set<string>();
    for (const data of await readSavedPlanArtifactDataList(context, 'page')) {
      const page = data.pageDefinition;
      const id = page && typeof page === 'object' ? (page as Record<string, unknown>).pageId : undefined;
      if (typeof id === 'string' && id) savedSelectors.add(id);
    }
    return reconcileParallelDynamicFanOut(context, parentStep, step, hookSequential, { expectedSelectors, savedSelectors });
  } catch (error) {
    console.warn('[agentPlanPageDefinition] fan-out reconcile skipped:', error);
    return [];
  }
}

// /023: page definition payloads are cleared from the task with
// cleaner="input_output" once the .defs.ts is saved, so this getter must also read the saved
// files. Fast path: task payloads (present for not-yet-saved or failed steps). Fallback: the
// saved page artifacts, reconstructed into PlannerOutput. Merge by pageId, task payload wins.
export async function getPlanPageDefinitionOutputs(context: mls.msg.ExecutionContext): Promise<PlanPageDefinitionOutput[]> {
  const workflowIndex = getPlanWorkflowIndexOutput(context);
  const validate = (output: PlanPageDefinitionOutput) =>
    validatePlanPageDefinitionOutput(output, output.result.pageDefinition.pageId, workflowIndex);

  const byPageId = new Map<string, PlanPageDefinitionOutput>();

  for (const data of await readSavedPlanArtifactDataList(context, 'page')) {
    const output = wrapSavedPageDefinitionOutput(data);
    if (!output) continue;
    validate(output);
    byPageId.set(output.result.pageDefinition.pageId, output);
  }

  // Task payloads override file copies (more recent within the same run).
  for (const output of getPlannerOutputs(context, 'agentPlanPageDefinition', planPageDefinitionConfig, validate)) {
    byPageId.set(output.result.pageDefinition.pageId, output);
  }

  return [...byPageId.values()].sort((a, b) => a.result.pageDefinition.pageId.localeCompare(b.result.pageDefinition.pageId));
}

function wrapSavedPageDefinitionOutput(data: Record<string, unknown>): PlanPageDefinitionOutput | null {
  try {
    return {
      runId: 'from-file',
      stepId: PLAN_PAGE_DEFINITION_STEP_ID,
      schemaVersion: PLANNER_SCHEMA_VERSION,
      status: 'ok',
      result: normalizePlanPageDefinitionResult(data),
      questions: [],
      trace: [],
    };
  } catch (error) {
    console.warn('[wrapSavedPageDefinitionOutput] could not rebuild a saved page definition', error);
    return null;
  }
}

function extractPlanPageDefinitionOutput(payload: unknown): PlanPageDefinitionOutput {
  return extractPlannerOutput(payload, planPageDefinitionConfig);
}

const planPageDefinitionConfig = {
  toolName: PLAN_PAGE_DEFINITION_TOOL_NAME,
  stepId: PLAN_PAGE_DEFINITION_STEP_ID,
  stepIdAliases: PLAN_PAGE_DEFINITION_ALIASES,
  normalizeResult: normalizePlanPageDefinitionResult,
};

function normalizePlanPageDefinitionResult(value: unknown): PlanPageDefinitionResult {
  const result = assertRecord(value, 'result');
  const pageDefinition = assertRecord(result.pageDefinition, 'result.pageDefinition');
  const bffCommands = assertArray(result.bffCommands || [], 'result.bffCommands');

  return {
    pageDefinition: normalizePageDefinition(pageDefinition, 'result.pageDefinition'),
    bffCommands: bffCommands.map((cmd, i) => normalizeBffCommand(cmd, `result.bffCommands[${i}]`)),
  };
}

function normalizePageDefinition(value: unknown, path: string): PageDefinitionSpec {
  const p = assertRecord(value, path);
  const flowRefs = assertRecord(p.flowRefs, `${path}.flowRefs`);
  return {
    pageId: assertString(p.pageId, `${path}.pageId`),
    pageName: assertString(p.pageName, `${path}.pageName`),
    actor: assertString(p.actor, `${path}.actor`),
    purpose: assertString(p.purpose, `${path}.purpose`),
    capabilities: normalizeStringArray(p.capabilities, `${path}.capabilities`),
    flowRefs: {
      experienceFlows: normalizeStringArray(flowRefs.experienceFlows, `${path}.flowRefs.experienceFlows`),
      entityLifecycles: normalizeStringArray(flowRefs.entityLifecycles, `${path}.flowRefs.entityLifecycles`),
      taskWorkflows: normalizeStringArray(flowRefs.taskWorkflows, `${path}.flowRefs.taskWorkflows`),
      automations: normalizeStringArray(flowRefs.automations, `${path}.flowRefs.automations`),
    },
    pluginRefs: normalizeStringArray(p.pluginRefs, `${path}.pluginRefs`),
    mdmRefs: normalizeStringArray(p.mdmRefs, `${path}.mdmRefs`),
    pageInputs: assertArray(p.pageInputs || [], `${path}.pageInputs`).map((inp, i) => normalizePageInput(inp, `${path}.pageInputs[${i}]`)),
    navigationRefs: assertArray(p.navigationRefs || [], `${path}.navigationRefs`).map((nr, i) => normalizeNavigationRef(nr, `${path}.navigationRefs[${i}]`)),
    sections: assertArray(p.sections || [], `${path}.sections`).map((sec, i) => normalizeSection(sec, `${path}.sections[${i}]`)),
  };
}

function normalizePageInput(value: unknown, path: string): PageInputSpec {
  const inp = assertRecord(value, path);
  return {
    name: assertString(inp.name, `${path}.name`),
    type: assertString(inp.type, `${path}.type`),
    required: typeof inp.required === 'boolean' ? inp.required : undefined,
    sources: normalizeStringArray(inp.sources, `${path}.sources`),
    description: optionalStringValue(inp.description),
    entityRef: optionalStringValue(inp.entityRef),
    fieldRef: optionalStringValue(inp.fieldRef),
  };
}

function normalizeNavigationRef(value: unknown, path: string): NavigationRefSpec {
  const nr = assertRecord(value, path);
  return {
    direction: assertString(nr.direction, `${path}.direction`),
    pageId: assertString(nr.pageId, `${path}.pageId`),
    trigger: assertString(nr.trigger, `${path}.trigger`),
    description: optionalStringValue(nr.description),
  };
}

function normalizeSection(value: unknown, path: string): PageSectionSpec {
  const sec = assertRecord(value, path);
  return {
    sectionName: assertString(sec.sectionName, `${path}.sectionName`),
    mode: assertString(sec.mode, `${path}.mode`),
    organisms: assertArray(sec.organisms || [], `${path}.organisms`).map((org, i) => normalizeOrganism(org, `${path}.organisms[${i}]`)),
  };
}

function normalizeOrganism(value: unknown, path: string): OrganismSpec {
  const org = assertRecord(value, path);
  return {
    organismName: assertString(org.organismName, `${path}.organismName`),
    purpose: assertString(org.purpose, `${path}.purpose`),
    userActions: normalizeStringArray(org.userActions, `${path}.userActions`),
    requiredEntities: normalizeStringArray(org.requiredEntities, `${path}.requiredEntities`),
    readsFields: normalizeStringArray(org.readsFields, `${path}.readsFields`),
    writesFields: normalizeStringArray(org.writesFields, `${path}.writesFields`),
    rulesApplied: normalizeStringArray(org.rulesApplied, `${path}.rulesApplied`),
  };
}

function normalizeBffCommand(value: unknown, path: string): BffCommandSpec {
  const cmd = assertRecord(value, path);
  const layerContract = assertRecord(cmd.layerContract, `${path}.layerContract`);
  return {
    commandName: assertString(cmd.commandName, `${path}.commandName`),
    purpose: assertString(cmd.purpose, `${path}.purpose`),
    kind: assertString(cmd.kind, `${path}.kind`) as BffCommandSpec['kind'],
    input: normalizeBffInputFields(cmd.input, `${path}.input`),
    output: normalizeBffOutputFields(cmd.output, `${path}.output`),
    readsEntities: normalizeStringArray(cmd.readsEntities, `${path}.readsEntities`),
    writesEntities: normalizeStringArray(cmd.writesEntities, `${path}.writesEntities`),
    readsTables: normalizeStringArray(cmd.readsTables, `${path}.readsTables`),
    writesTables: normalizeStringArray(cmd.writesTables, `${path}.writesTables`),
    usecaseRefs: normalizeStringArray(cmd.usecaseRefs, `${path}.usecaseRefs`),
    layerContract: {
      controllerLayer: assertString(layerContract.controllerLayer, `${path}.layerContract.controllerLayer`),
      mustCallLayer: assertString(layerContract.mustCallLayer, `${path}.layerContract.mustCallLayer`),
      directTableAccessForbidden: !!layerContract.directTableAccessForbidden,
    },
    rulesApplied: normalizeStringArray(cmd.rulesApplied, `${path}.rulesApplied`),
  };
}

function normalizeBffInputFields(value: unknown, path: string): BffCommandInputField[] {
  return assertArray(value || [], path).map((item, index) => {
    const field = assertRecord(item, `${path}[${index}]`);
    return {
      name: assertString(field.name, `${path}[${index}].name`),
      type: assertString(field.type, `${path}[${index}].type`),
      required: !!field.required,
    };
  });
}

function normalizeBffOutputFields(value: unknown, path: string): BffCommandOutputField[] {
  return assertArray(value || [], path).map((item, index) => {
    const field = assertRecord(item, `${path}[${index}]`);
    return {
      name: assertString(field.name, `${path}[${index}].name`),
      type: assertString(field.type, `${path}[${index}].type`),
    };
  });
}

function normalizeStringArray(value: unknown, path: string): string[] {
  return assertArray(value || [], path).map((item, index) => assertString(item, `${path}[${index}]`));
}

function optionalStringValue(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  return undefined;
}

function validatePlanPageDefinitionOutput(output: PlanPageDefinitionOutput, pageSelector: string, workflowIndex: PlanWorkflowIndexOutput): void {
  const page = output.result.pageDefinition;
  if (!pageSelector) throw new Error('page selector not found in step prompt or prepared input');
  if (!page.pageId || page.pageId !== pageSelector) {
    throw new Error(`pageDefinition.pageId must match selector ${pageSelector}`);
  }
  validatePageFlowRefsAgainstWorkflowIndex(page.pageId, page.flowRefs, workflowIndex);
  if (output.status === 'needs_input' && output.questions.length === 0) {
    throw new Error('needs_input page definition must include questions');
  }
  // Basic structural checks per prompt guidance
  if (output.status === 'ok') {
    if (!Array.isArray(page.pageInputs)) throw new Error('pageDefinition.pageInputs must be an array (even if empty)');
    if (!Array.isArray(page.navigationRefs)) throw new Error('pageDefinition.navigationRefs must be an array (even if empty)');
    if (!Array.isArray(page.sections)) throw new Error('pageDefinition.sections must be present');
    // Note: the heuristic identifier/pageInput cross-check
    // (validateSpecificActionRequiredInputs) was removed in June 2026 — it
    // produced false positives on valid plans (e.g. item ids nested in cart
    // arrays). Structural conformity is now enforced by x-tool-strict (ajv
    // against the tool schema, in collab-llm).
  }
}

function getPageSelector(step: mls.msg.AIAgentStep): string {
  return normalizeSelector(step.prompt)
    || extractSelectorFromPreparedInput(step, 'Current page selector')
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
  pageIndexItem: PageIndexItem,
  pageIndex: PlanPageIndexOutput,
  finalPlan: FinalSolutionPlanOutput,
  mdm: PlanMDMOutput,
  horizontals: PlanHorizontalsOutput,
  plugins: PlanPluginsOutput,
  persistenceIndex: PlanPersistenceIndexOutput,
  tableDefinitions: PlanTableDefinitionOutput[],
  metricsIndex: PlanMetricsIndexOutput,
  metricTableDefinitions: PlanMetricTableDefinitionOutput[],
  usecasePlan: PlanUsecaseEntitiesOutput,
  workflowIndex: PlanWorkflowIndexOutput,
  workflowDefinitions: PlanWorkflowDefinitionOutput[],
  agentsPlan: PlanAgentsOutput,
): string {
  // send only the artifacts THIS page references, not the whole plan.
  void horizontals; void agentsPlan; void persistenceIndex; // not needed for a single page definition
  const fp = finalPlan.result;

  const flowIds = new Set<string>([
    ...pageIndexItem.flowRefs.experienceFlows,
    ...pageIndexItem.flowRefs.entityLifecycles,
    ...pageIndexItem.flowRefs.taskWorkflows,
    ...pageIndexItem.flowRefs.automations,
  ]);
  const tableIds = new Set(pageIndexItem.persistenceHints);
  const usecaseIds = new Set(pageIndexItem.usecaseHints);
  const metricIds = new Set(pageIndexItem.metricRefs);
  const pluginIds = new Set(pageIndexItem.pluginRefs);
  const mdmIds = new Set(pageIndexItem.mdmRefs);
  const ruleIds = new Set(pageIndexItem.rulesApplied);
  const capabilityIds = new Set(pageIndexItem.capabilities);

  const tableDefs = tableDefinitions.map(t => t.result.tableDefinition);
  const selectedTables = pickRecordsByIds(tableDefs, tableIds, ['tableId']);
  const selectedMetricTableDefs = pickRecordsByIds(metricTableDefinitions.map(m => m.result.metricTableDefinition), metricIds, ['metricTableId']);
  const selectedMetricIndexTables = pickRecordsByIds(metricsIndex.result.metricTables, metricIds, ['metricTableId']);
  const selectedDashboards = pickRecordsByIds(metricsIndex.result.dashboardPages, metricIds, ['metricDashboardId']);
  const selectedUsecases = pickRecordsByIds(usecasePlan.result.usecases, usecaseIds, ['usecaseId']);

  // Ontology entities referenced by the selected tables/usecases/mdm refs.
  const entityNames = new Set<string>(mdmIds);
  for (const table of selectedTables) collectStringRefs(table, ['rootEntity', 'sourceEntities', 'embeddedEntities'], entityNames);
  for (const usecase of selectedUsecases) collectStringRefs(usecase, ['inputEntities', 'outputEntities'], entityNames);
  const ontologySubset: Record<string, unknown> = {};
  for (const key of Object.keys(fp.ontology.entities)) {
    if (entityNames.has(key)) ontologySubset[key] = fp.ontology.entities[key];
  }

  const reduced = {
    pageSelector: args,
    pageIndexItem,
    module: fp.module,
    actor: pickRecordsByIds(fp.actors, new Set([pageIndexItem.actor]), ['actorId'])[0] || pageIndexItem.actor,
    capabilities: pickRecordsByIds(fp.capabilities, capabilityIds, ['capabilityId', 'id']),
    rules: pickRecordsByIds(fp.rules, ruleIds, ['ruleId']),
    ontologyEntities: ontologySubset,
    backendArchitecture: usecasePlan.result.backendArchitecture,
    controllerRules: usecasePlan.result.controllerRules,
    usecases: selectedUsecases,
    usecaseEntities: usecasePlan.result.usecaseEntities,
    tables: selectedTables,
    metrics: {
      indexTables: selectedMetricIndexTables,
      tableDefinitions: selectedMetricTableDefs,
      dashboards: selectedDashboards,
    },
    workflows: {
      index: pickRecordsByIds(workflowIndex.result.workflows, flowIds, ['workflowId']),
      definitions: pickRecordsByIds(workflowDefinitions.map(w => w.result.workflowDefinition), flowIds, ['workflowId']),
    },
    plugins: pickRecordsByIds(plugins.result.plugins, pluginIds, ['pluginId']),
    mdm: pickRecordsByIds(mdm.result.mdmDomains, mdmIds, ['domainId']),
    // Slim page list for navigationRefs only (id/name/actor/purpose), not the full index.
    navigablePages: summarizeRecords(pageIndex.result.pages, ['pageId', 'pageName', 'actor', 'purpose']),
  };

  return `## Current page selector
${args}

## Reduced page context (only what this page references)
${JSON.stringify(reduced, null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codeinstruct -->
<!-- x-tool-strict: true -->

You are agentPlanPageDefinition for the collab.codes "newSolution" flow.
Plan exactly one page definition and its supporting BFF commands for the current page selector.
Use the same language as the user for page names, purposes, descriptions, questions, and trace.
Use English camelCase identifiers for pageId and commandName.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## Rules
- Generate one page only: the page whose pageId equals the current selector (from page index item).
- Read the matching PageIndexItem for actor, purpose, capabilities, flowRefs, hints, and bffCommandHints.
- Derive sections/organisms from capabilities, primary user actions, and required selections for commitment pages.
- Every organism that needs backend data must have at least one corresponding BFF command.
- BFF commands must declare kind (query/command/mutation), readsEntities/writesEntities, readsTables/writesTables for module-owned tables, and usecaseRefs.
- Expose AI/operational usecases hinted for this page as explicit actions (BFF commands) on the relevant detail page — e.g. a content-generation usecase as an action on the entity's detail page, an AI qualification usecase on the corresponding detail page. A usecase exposed to users must have a page consumer (T-015).
- BFF command input/output are arrays of typed fields, not free-form objects: input items are { name, type, required }, output items are { name, type }. Use empty arrays when there are none. Use concise primitive/domain types (string, number, boolean, date, or an entity/enum id).
- layerContract must be { controllerLayer: "layer_2_controllers", mustCallLayer: "layer_3_usecases", directTableAccessForbidden: true }.
- Do not put MDM/horizontal/plugin-owned tables in readsTables/writesTables; use mdmRefs/pluginRefs and entity refs instead.
- Metric dashboard pages must use the actor declared for metrics in the final plan (commonly an "admin" or back-office actor) and must read metric data only via usecaseRefs.
- pageInputs describe the page boundary contract (route params, query, session, prior step result, etc.). Use empty array when the page can open standalone.
- For detail/status/edit/confirmation pages, declare required external identifiers (the id of the main subject or commitment record from the ontology) in pageInputs with appropriate sources (routeParam, previousStepResult, ...). Never use names from any sample domain.
- If a detail/update/edit/status/cancel/refund/lifecycle BFF command has an identifier input such as {entity}Id, the matching pageInputs entry must exist and must use required: true.
- If such a BFF command does not expose the identifier name in its input schema, the page must still include at least one required identifier pageInput for the main subject or commitment record.
- Do not require contextual identifiers as pageInputs when they are resolved by authentication/session/current cart, such as userId, customerId, sessionId, cartId, or carrinhoId.
- navigationRefs are lightweight references only (direction, pageId, trigger, optional description). Never include inputMapping.
- Commitment/confirmation pages (booking, order, request, subscription, contract, or the domain-equivalent commitment action) must include selection organisms before the confirm action; selection organisms must read the selected entity fields and the confirm command must write the relationship to the commitment entity. All names must come from the final plan and ontology.
- Use rule ids from catalogs (e.g. RULE_*) in rulesApplied; never loose rule text.
- flowRefs must reference only existing workflow ids and must categorize by workflow executionMode exactly: entityLifecycle -> entityLifecycles; taskWorkflow -> taskWorkflows; automation -> automations; uiState/documentationOnly -> experienceFlows.
- Do not put the same workflow id in more than one flowRefs bucket.
- Do not generate frontend code, materialization, or .defs implementation details.
- defs are produced later; focus on the conceptual page + BFF contract.
- If information is insufficient for a firm plan, return status "needs_input" with questions.
`;
