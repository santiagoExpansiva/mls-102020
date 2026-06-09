/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanPageIndex.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PlannerOutput,
  assertArray,
  assertRecord,
  assertString,
  createHoldIndexForReviewIntents,
  createParallelDynamicAgentStepIntent,
  createPlannerPromptReadyIntent,
  createPlannerVariableToolSchema,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  findStepByPlanId,
  getActorIdSet,
  getPlannerOutputWithRepair,
  getPlanningContextSnapshot,
  summarizeRecords,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import type { FinalSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import { saveNewSolutionAgentTracePayload } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
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
    agentName: 'agentPlanPageIndex',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Plan the page index for the solution',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const PLAN_PAGE_INDEX_TOOL_NAME = 'submitPageIndexPlan';
export const PLAN_PAGE_INDEX_STEP_ID = '21-plan-page-index';
const PLAN_PAGE_INDEX_ALIASES = [PLAN_PAGE_INDEX_STEP_ID, 'plan-page-index'];

export interface PageIndexItem {
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
  primaryUserActions: string[];
  pageInputHints: string[];
  navigationRefs: unknown[];
  persistenceHints: string[];
  usecaseHints: string[];
  metricRefs: string[];
  rulesApplied: string[];
  bffCommandHints: unknown[];
}

export type PageFlowRefs = PageIndexItem['flowRefs'];
type PageFlowRefBucket = keyof PageFlowRefs;

export interface PlanPageIndexResult {
  pages: PageIndexItem[];
}

export type PlanPageIndexOutput = PlannerOutput<PlanPageIndexResult>;

const navigationRefSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['direction', 'pageId', 'trigger'],
  properties: {
    direction: { enum: ['inbound', 'outbound'] },
    pageId: { type: 'string' },
    trigger: { type: 'string' },
  },
};

const bffCommandHintSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'purpose', 'input', 'output'],
  properties: {
    name: { type: 'string' },
    purpose: { type: 'string' },
    input: { type: 'string' },
    output: { type: 'string' },
  },
};

export const PLAN_PAGE_INDEX_RESULT_SCHEMA: Record<string, unknown> = {
    type: 'object',
    additionalProperties: false,
    required: ['pages'],
    properties: {
      pages: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'pageId',
            'pageName',
            'actor',
            'purpose',
            'capabilities',
            'flowRefs',
            'pluginRefs',
            'mdmRefs',
            'primaryUserActions',
            'pageInputHints',
            'navigationRefs',
            'persistenceHints',
            'usecaseHints',
            'metricRefs',
            'rulesApplied',
            'bffCommandHints',
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
            primaryUserActions: { type: 'array', items: { type: 'string' } },
            pageInputHints: { type: 'array', items: { type: 'string' } },
            navigationRefs: { type: 'array', items: navigationRefSchema },
            persistenceHints: { type: 'array', items: { type: 'string' } },
            usecaseHints: { type: 'array', items: { type: 'string' } },
            metricRefs: { type: 'array', items: { type: 'string' } },
            rulesApplied: { type: 'array', items: { type: 'string' } },
            bffCommandHints: { type: 'array', items: bffCommandHintSchema },
          },
        },
      },
    },
};

const planPageIndexToolSchema = createPlannerVariableToolSchema(
  PLAN_PAGE_INDEX_TOOL_NAME,
  'Submit the page index for the newSolution plan.',
  PLAN_PAGE_INDEX_RESULT_SCHEMA
);

async function beforePromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
  args?: string,
): Promise<mls.msg.AgentIntent[]> {
  if (!agent || !step) throw new Error('[agentPlanPageIndex](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const planningContext = getPlanningContextSnapshot(context);
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

  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(PLAN_PAGE_INDEX_TOOL_NAME),
      buildHumanPrompt(
        args,
        planningContext.initialMetricsRequested,
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
      planPageIndexToolSchema,
      PLAN_PAGE_INDEX_TOOL_NAME
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
  let output: PlanPageIndexOutput | undefined;

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    output = extractPlanPageIndexOutput(payload);
    validatePlanPageIndexOutput(
      output,
      getPlanningContextSnapshot(context).initialMetricsRequested,
      getFinalizeSolutionPlanOutput(context),
      getPlanWorkflowIndexOutput(context)
    );
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentPlanPageIndex returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentPlanPageIndex returned status needs_input; keeping page index draft.';
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);

  // TODO-FINAL-023/024: hold the step open and run critic/repair before page definitions.
  if (status === 'completed' && output && output.status === 'ok') {
    return createHoldIndexForReviewIntents(context, parentStep, step, hookSequential, 'pageIndex');
  }

  const intents: mls.msg.AgentIntent[] = [
    createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined),
  ];

  if (status === 'completed' && output) intents.push(...createPageDefinitionParallelIntent(context, output));
  return intents;
}

export function getPlanPageIndexOutput(context: mls.msg.ExecutionContext): PlanPageIndexOutput {
  // TODO-FINAL-024: prefer the latest repaired index when a repair step exists.
  return getPlannerOutputWithRepair(context, 'agentPlanPageIndex', 'pageIndex', planPageIndexConfig, output =>
    validatePlanPageIndexOutput(
      output,
      getPlanningContextSnapshot(context).initialMetricsRequested,
      getFinalizeSolutionPlanOutput(context),
      getPlanWorkflowIndexOutput(context)
    )
  );
}

function extractPlanPageIndexOutput(payload: unknown): PlanPageIndexOutput {
  return extractPlannerOutput(payload, planPageIndexConfig);
}

export const planPageIndexConfig = {
  toolName: PLAN_PAGE_INDEX_TOOL_NAME,
  stepId: PLAN_PAGE_INDEX_STEP_ID,
  stepIdAliases: PLAN_PAGE_INDEX_ALIASES,
  normalizeResult: normalizePlanPageIndexResult,
};

export function normalizePlanPageIndexResult(value: unknown): PlanPageIndexResult {
  const result = assertRecord(value, 'result');
  return {
    pages: assertArray(result.pages, 'result.pages').map((item, index) => normalizePageIndexItem(item, `result.pages[${index}]`)),
  };
}

function normalizePageIndexItem(value: unknown, path: string): PageIndexItem {
  const page = assertRecord(value, path);
  const flowRefs = assertRecord(page.flowRefs, `${path}.flowRefs`);
  return {
    pageId: assertString(page.pageId, `${path}.pageId`),
    pageName: assertString(page.pageName, `${path}.pageName`),
    actor: assertString(page.actor, `${path}.actor`),
    purpose: assertString(page.purpose, `${path}.purpose`),
    capabilities: normalizeStringArray(page.capabilities, `${path}.capabilities`),
    flowRefs: {
      experienceFlows: normalizeStringArray(flowRefs.experienceFlows, `${path}.flowRefs.experienceFlows`),
      entityLifecycles: normalizeStringArray(flowRefs.entityLifecycles, `${path}.flowRefs.entityLifecycles`),
      taskWorkflows: normalizeStringArray(flowRefs.taskWorkflows, `${path}.flowRefs.taskWorkflows`),
      automations: normalizeStringArray(flowRefs.automations, `${path}.flowRefs.automations`),
    },
    pluginRefs: normalizeStringArray(page.pluginRefs, `${path}.pluginRefs`),
    mdmRefs: normalizeStringArray(page.mdmRefs, `${path}.mdmRefs`),
    primaryUserActions: normalizeStringArray(page.primaryUserActions, `${path}.primaryUserActions`),
    pageInputHints: normalizeStringArray(page.pageInputHints, `${path}.pageInputHints`),
    navigationRefs: assertArray(page.navigationRefs, `${path}.navigationRefs`),
    persistenceHints: normalizeStringArray(page.persistenceHints, `${path}.persistenceHints`),
    usecaseHints: normalizeStringArray(page.usecaseHints, `${path}.usecaseHints`),
    metricRefs: normalizeStringArray(page.metricRefs, `${path}.metricRefs`),
    rulesApplied: normalizeStringArray(page.rulesApplied, `${path}.rulesApplied`),
    bffCommandHints: assertArray(page.bffCommandHints, `${path}.bffCommandHints`),
  };
}

function normalizeStringArray(value: unknown, path: string): string[] {
  return assertArray(value, path).map((item, index) => assertString(item, `${path}[${index}]`));
}

export function validatePlanPageIndexOutput(
  output: PlanPageIndexOutput,
  initialMetricsRequested: boolean,
  finalPlan: FinalSolutionPlanOutput,
  workflowIndex: PlanWorkflowIndexOutput,
): void {
  const ids = new Set<string>();
  const finalPlanActorIds = getFinalPlanActorIds(finalPlan);
  for (const page of output.result.pages) {
    if (ids.has(page.pageId)) throw new Error(`duplicate pageId: ${page.pageId}`);
    ids.add(page.pageId);
    if (!finalPlanActorIds.has(page.actor)) {
      throw new Error(`page ${page.pageId} actor must match one of the final plan actorIds: ${page.actor}`);
    }
    validatePageFlowRefsAgainstWorkflowIndex(page.pageId, page.flowRefs, workflowIndex);
  }

  if (output.status === 'ok' && output.result.pages.length === 0) {
    throw new Error('page index must include at least one page');
  }

  if (output.status === 'ok' && initialMetricsRequested) {
    const dashboardActorIds = getMetricDashboardActorIds(finalPlan, finalPlanActorIds);
    const hasMetricDashboardPage = output.result.pages.some(page =>
      page.metricRefs.length > 0 && (dashboardActorIds.size === 0 || dashboardActorIds.has(page.actor))
    );
    if (!hasMetricDashboardPage) throw new Error('initial metrics dashboard requested, but no metric dashboard page was planned for the final plan actor');
  }

  if (output.status === 'needs_input' && output.questions.length === 0) {
    throw new Error('needs_input page index must include questions');
  }
}

// The bucket of a flowRef is fully determined by the workflow's executionMode, so a wrong
// bucket is a deterministic, mechanically-fixable error — NOT something to bounce to the LLM
// (the repair LLM often fails to fix it, killing the whole index/task). This function now
// AUTO-CORRECTS: it re-buckets every referenced workflow id by its executionMode and dedupes,
// mutating `flowRefs` in place. It only throws on a truly unknown workflow id.
export function validatePageFlowRefsAgainstWorkflowIndex(pageId: string, flowRefs: PageFlowRefs, workflowIndex: PlanWorkflowIndexOutput): void {
  const workflowsById = new Map(workflowIndex.result.workflows.map(workflow => [workflow.workflowId, workflow]));
  const buckets: PageFlowRefBucket[] = ['experienceFlows', 'entityLifecycles', 'taskWorkflows', 'automations'];

  const correctBucketById = new Map<string, PageFlowRefBucket>();
  const order: string[] = [];
  for (const bucket of buckets) {
    for (const workflowId of flowRefs[bucket]) {
      const workflow = workflowsById.get(workflowId);
      if (!workflow) throw new Error(`page ${pageId} flowRefs.${bucket} references unknown workflow ${workflowId}`);
      if (!correctBucketById.has(workflowId)) {
        correctBucketById.set(workflowId, getFlowRefBucketForExecutionMode(workflow.executionMode));
        order.push(workflowId);
      }
    }
  }

  // Rebuild the four buckets deterministically (dedup + correct placement by executionMode).
  flowRefs.experienceFlows = [];
  flowRefs.entityLifecycles = [];
  flowRefs.taskWorkflows = [];
  flowRefs.automations = [];
  for (const workflowId of order) {
    flowRefs[correctBucketById.get(workflowId)!].push(workflowId);
  }
}

function getFlowRefBucketForExecutionMode(executionMode: string): PageFlowRefBucket {
  if (executionMode === 'entityLifecycle') return 'entityLifecycles';
  if (executionMode === 'taskWorkflow') return 'taskWorkflows';
  if (executionMode === 'automation') return 'automations';
  if (executionMode === 'uiState' || executionMode === 'documentationOnly') return 'experienceFlows';
  throw new Error(`invalid workflow executionMode: ${executionMode}`);
}

function getFinalPlanActorIds(finalPlan: FinalSolutionPlanOutput): Set<string> {
  // TODO-FINAL-019: single source of the actor contract (shared getActorIdSet).
  return getActorIdSet(finalPlan.result.actors);
}

function getMetricDashboardActorIds(finalPlan: FinalSolutionPlanOutput, finalPlanActorIds: Set<string>): Set<string> {
  const actorIds = new Set<string>();
  finalPlan.result.approvedArtifacts.metricDashboards.forEach((dashboard, index) => {
    const record = assertRecord(dashboard, `result.approvedArtifacts.metricDashboards[${index}]`);
    if (record.actor === undefined) return;
    const actor = assertString(record.actor, `result.approvedArtifacts.metricDashboards[${index}].actor`);
    if (!finalPlanActorIds.has(actor)) {
      throw new Error(`metric dashboard actor must match one of the final plan actorIds: ${actor}`);
    }
    actorIds.add(actor);
  });
  return actorIds;
}

export function createPageDefinitionParallelIntent(context: mls.msg.ExecutionContext, output: PlanPageIndexOutput): mls.msg.AgentIntent[] {
  const placeholder = findStepByPlanId(context, 'plan-page-definition') as mls.msg.AIAgentStep | null;
  if (!placeholder || placeholder.type !== 'agent' || placeholder.status === 'completed') return [];

  const pageIds = output.result.pages.map(page => page.pageId);
  if (pageIds.length === 0) {
    return [createPlannerUpdateStatusIntent(context, placeholder, placeholder, 0, 'completed', 'No pages to define.')];
  }

  return [
    createParallelDynamicAgentStepIntent(
      context,
      placeholder,
      'agentPlanPageDefinition',
      'plan-page-definition:parallel',
      'Plan pages {{completed}}/{{total}}, errors: {{failed}}',
      pageIds,
      5
    ),
  ];
}

function buildHumanPrompt(
  args: string,
  initialMetricsRequested: boolean,
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
  // TODO-FINAL-009: the page index only needs summaries (ids + reason/title), not full
  // table/usecase/page-definition/materialization detail. Send a compact planning snapshot.
  void tableDefinitions; void metricTableDefinitions; void workflowDefinitions; // detail not needed to plan pages
  const fp = finalPlan.result;

  const snapshot = {
    initialMetricsRequested,
    module: fp.module,
    actors: summarizeRecords(fp.actors, ['actorId', 'title', 'description']),
    capabilities: summarizeRecords(fp.capabilities, ['capabilityId', 'id', 'title', 'priority']),
    userActions: summarizeRecords(fp.userActions, ['actionId', 'id', 'title', 'actor', 'capabilityId']),
    rules: summarizeRecords(fp.rules, ['ruleId', 'title']),
    // workflows: keep executionMode (needed for flowRefs bucketing) but drop full state machines.
    workflows: summarizeRecords(workflowIndex.result.workflows, ['workflowId', 'title', 'executionMode', 'createsTask', 'actors', 'relatedCapabilities']),
    metrics: {
      enabled: metricsIndex.result.metricsPlan.enabled,
      metricTables: summarizeRecords(metricsIndex.result.metricTables, ['metricTableId', 'title', 'purpose']),
      dashboards: summarizeRecords(metricsIndex.result.dashboardPages, ['metricDashboardId', 'title', 'actor', 'accessPolicy']),
    },
    persistenceTables: summarizeRecords(persistenceIndex.result.tables, ['tableId', 'title', 'rootEntity']),
    usecases: summarizeRecords(usecasePlan.result.usecases, ['usecaseId', 'title', 'actor']),
    plugins: summarizeRecords(plugins.result.plugins, ['pluginId', 'provider', 'reason']),
    mdmDomains: summarizeRecords(mdm.result.mdmDomains, ['domainId', 'title']),
    horizontalModules: summarizeRecords(horizontals.result.horizontalModules, ['horizontalModuleId', 'reason']),
    agents: summarizeRecords((agentsPlan.result as unknown as Record<string, unknown>).agents as unknown[] | undefined, ['agentId', 'id', 'title', 'reason']),
  };

  return `## Planned step args
${args}

## Page planning snapshot (summaries only; request detail later per page)
${JSON.stringify(snapshot, null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codeinstruct -->
<!-- x-tool-strict: true -->

You are agentPlanPageIndex for the collab.codes "newSolution" flow.
Plan only the page index. Do not define full page sections or organisms in this step.
Use the same language as the user for page names, purposes, questions, and trace.
Use English camelCase identifiers for pageId and command hint names.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## Rules
- Return only page summaries.
- Do not hard-code pages from a sample domain.
- Derive page ids and page names from actors, capabilities, workflows, and core user actions in the final solution plan.
- Include pages for every now capability that requires user interaction.
- Include staff or admin pages only when the domain has internal operations, backoffice review, fulfillment, setup, governance, or task workflows.
- Include admin-only metric dashboard pages when the metrics plan enables initial dashboards or initial metrics dashboard requested is true.
- Every page actor must be one of final solution plan actors[].actorId.
- Metric dashboard pages must use the actor id declared by approvedArtifacts.metricDashboards[].actor when present; otherwise use the most appropriate actorId from final solution plan actors.
- A commitment/confirmation page (booking, order, request, subscription, contract, or the domain's equivalent) must include the required subject, resource, service, or product selection before confirmation. The exact terms must come from the final solution plan.
- Add pageInputHints only when they help the later single-page step infer required page boundary inputs.
- Add navigationRefs only as lightweight references to related source or destination pages; do not include input mappings.
- Add persistenceHints only when they help the later single-page step connect BFF commands to module-owned table definitions.
- Add usecaseHints when they help the later single-page step connect BFF commands to layer_3_usecases.
- Add metricRefs for pages that display metric tables.
- If a page needs data from the backend, add command hints with name, purpose, and expected input or output summary.
- flowRefs must reference only workflow ids from the workflow index.
- Categorize flowRefs by workflow executionMode exactly: entityLifecycle -> entityLifecycles; taskWorkflow -> taskWorkflows; automation -> automations; uiState/documentationOnly -> experienceFlows.
- Do not put the same workflow id in more than one flowRefs bucket.
- Use rule ids; do not write loose rule text.
- Do not generate materialization details or TypeScript code.
`;
