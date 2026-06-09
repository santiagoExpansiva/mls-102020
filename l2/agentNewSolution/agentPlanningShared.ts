/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanningShared.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { getAgentStepByAgentName, getAllSteps } from '/_102027_/l2/aiAgentHelper.js';
import {
  getDiscoverSolutionScopeOutput,
  wantsInitialMetricsDashboard,
} from '/_102020_/l2/agentNewSolution/agentDiscoverSolutionScope.js';
import type { DiscoverSolutionScopeOutput } from '/_102020_/l2/agentNewSolution/agentDiscoverSolutionScope.js';
import {
  getRecommendImplementationsOutput,
} from '/_102020_/l2/agentNewSolution/agentRecommendImplementations.js';
import type { RecommendImplementationsOutput } from '/_102020_/l2/agentNewSolution/agentRecommendImplementations.js';
import {
  getRequirementsClarificationAnswer,
} from '/_102020_/l2/agentNewSolution/agentNewSolutionRequirements.js';
import type {
  ImplementationDecisionResult,
  RequirementsClarificationAnswer,
} from '/_102020_/l2/agentNewSolution/agentNewSolutionRequirements.js';
import { normalizeModuleFolderName } from '/_102020_/l2/agentNewSolution/agentNewSolutionPlan.js';
import {
  extractPlannerOutput,
  parseMaybeJson,
  PLANNER_SCHEMA_VERSION as PLANNER_SCHEMA_VERSION_VALUE,
  type PlannerExtractConfig,
  type PlannerOutput,
} from '/_102020_/l2/agentNewSolution/agentPlanningExtract.js';
import { readSavedPlanArtifactDataList } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';

export {
  PLANNER_SCHEMA_VERSION,
  assertArray,
  assertPriority,
  assertRecord,
  assertString,
  assertStringArray,
  createPlannerToolSchema,
  createPlannerVariableToolSchema,
  extractPlannerOutput,
  isRecord,
  normalizeStringList,
  optionalString,
  parseMaybeJson,
} from '/_102020_/l2/agentNewSolution/agentPlanningExtract.js';
export type {
  PlannerExtractConfig,
  PlannerOutput,
  PlannerStatus,
  Priority,
} from '/_102020_/l2/agentNewSolution/agentPlanningExtract.js';

export interface InitialNewSolutionPlanSummary {
  userLanguage: string;
  requestKind: string;
  moduleName: string;
  userPrompt: string;
  titles?: Record<string, string>;
  todoItems?: unknown[];
  openDetails?: unknown[];
}

export interface PlanningContextSnapshot {
  initialPlan: InitialNewSolutionPlanSummary;
  clarificationAnswer: RequirementsClarificationAnswer;
  discoveredScope: DiscoverSolutionScopeOutput;
  recommendations: RecommendImplementationsOutput;
  implementationDecisions: ImplementationDecisionResult;
  initialMetricsRequested: boolean;
}

export function createPlannerPromptReadyIntent(
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  hookSequential: number,
  args: string,
  systemPrompt: string,
  humanPrompt: string,
  toolSchema: mls.msg.LLMTool,
  toolName: string,
): mls.msg.AgentIntentPromptReady {
  if (!context.task) throw new Error('[createPlannerPromptReadyIntent] task invalid');

  return {
    type: 'prompt_ready',
    args,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task.PK,
    hookSequential,
    parentStepId: parentStep.stepId,
    systemPrompt,
    humanPrompt,
    tools: [toolSchema],
    toolChoice: {
      type: 'function',
      function: { name: toolName },
    },
  };
}

export function createPlannerUpdateStatusIntent(
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
  status: mls.msg.AIStepStatus,
  traceMsg?: string,
  cleaner?: 'input' | 'input_output',
): mls.msg.AgentIntentUpdateStatus {
  const intent: mls.msg.AgentIntentUpdateStatus = {
    type: 'update-status',
    hookSequential,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    parentStepId: parentStep.stepId,
    stepId: step.stepId,
    status,
    traceMsg,
  };

  if (cleaner) intent.cleaner = cleaner;
  return intent;
}

export function getPlannerOutput<T>(
  context: mls.msg.ExecutionContext,
  agentName: string,
  config: PlannerExtractConfig<T>,
  validate?: (output: PlannerOutput<T>) => void,
): PlannerOutput<T> {
  if (!context.task) throw new Error('[getPlannerOutput] task invalid');

  const agentStep = getAgentStepByAgentName(context.task, agentName) as mls.msg.AIAgentStep | null;
  if (!agentStep) throw new Error(`[getPlannerOutput] ${agentName} step not found`);

  const payload = agentStep.interaction?.payload?.[0];
  if (!payload) throw new Error(`[getPlannerOutput] ${agentName} payload not found`);

  const output = extractPlannerOutput(payload, config);
  validate?.(output);
  return output;
}

export function getPlannerOutputs<T>(
  context: mls.msg.ExecutionContext,
  agentName: string,
  config: PlannerExtractConfig<T>,
  validate?: (output: PlannerOutput<T>) => void,
): PlannerOutput<T>[] {
  if (!context.task) throw new Error('[getPlannerOutputs] task invalid');

  const allSteps = getAllSteps(context.task.iaCompressed?.nextSteps);
  const outputs: PlannerOutput<T>[] = [];

  for (const step of allSteps) {
    if (step.type !== 'agent' || (step as mls.msg.AIAgentStep).agentName !== agentName) continue;
    const payload = step.interaction?.payload?.[0];
    if (!payload) continue;
    const output = extractPlannerOutput(payload, config);
    validate?.(output);
    outputs.push(output);
  }

  return outputs;
}

/**
 * TODO-FINAL-010/023: read fan-out definition outputs preferring task payloads, falling back
 * to the saved .defs.ts artifacts when the payload was cleared with cleaner="input_output".
 * Saved artifacts are reconstructed into PlannerOutput via config.normalizeResult; task payloads
 * override file copies (more recent within the same run). Results are deduped/sorted by getId.
 */
export async function getPlannerOutputsWithFileFallback<T>(
  context: mls.msg.ExecutionContext,
  agentName: string,
  artifactType: string,
  config: PlannerExtractConfig<T>,
  getId: (output: PlannerOutput<T>) => string,
  validate?: (output: PlannerOutput<T>) => void,
): Promise<PlannerOutput<T>[]> {
  const byId = new Map<string, PlannerOutput<T>>();

  for (const data of await readSavedPlanArtifactDataList(context, artifactType)) {
    let output: PlannerOutput<T>;
    try {
      output = {
        runId: 'from-file',
        stepId: config.stepId,
        schemaVersion: PLANNER_SCHEMA_VERSION_VALUE,
        status: 'ok',
        result: config.normalizeResult(data),
        questions: [],
        trace: [],
      };
      validate?.(output);
    } catch {
      continue;
    }
    byId.set(getId(output), output);
  }

  for (const output of getPlannerOutputs(context, agentName, config, validate)) {
    byId.set(getId(output), output);
  }

  return [...byId.values()].sort((a, b) => getId(a).localeCompare(getId(b)));
}

export function findStepByPlanId(context: mls.msg.ExecutionContext, planId: string): mls.msg.AIPayload | null {
  if (!context.task) throw new Error('[findStepByPlanId] task invalid');
  const allSteps = getAllSteps(context.task.iaCompressed?.nextSteps);
  return allSteps.find(step => (step as any).planning?.planId === planId) || null;
}

export function createDynamicAgentStepIntent(
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  agentName: string,
  planId: string,
  stepTitle: string,
  args: string,
  parentInsertStep?: mls.msg.AIAgentStep,
): mls.msg.AgentIntentAddStep {
  const parentPlanning = (parentStep as any).planning;
  const dependencyPlanId = parentPlanning?.dynamicSource?.sourcePlanId || parentPlanning?.planId || '';
  const insertParent = parentInsertStep || parentStep;

  return {
    type: 'add-step',
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    parentStepId: insertParent.stepId,
    step: {
      type: 'agent',
      stepId: 0,
      interaction: null,
      stepTitle,
      status: 'waiting_human_input',
      nextSteps: [],
      agentName,
      prompt: args,
      rags: [],
      planning: {
        planId,
        dependsOn: dependencyPlanId ? [dependencyPlanId] : [],
        executionMode: 'sequential',
        executionHost: 'client',
      },
    } as mls.msg.AIAgentStep,
  };
}

export function createParallelDynamicAgentStepIntent(
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  agentName: string,
  planId: string,
  stepTitle: string,
  args: string[],
  maxParallel: number = 5,
): mls.msg.AgentIntentAddStep {
  if (!context.task) throw new Error('[createParallelDynamicAgentStepIntent] task invalid');
  if (args.length === 0) throw new Error('[createParallelDynamicAgentStepIntent] args empty');

  const parentPlanning = (parentStep as any).planning;
  const dependencyPlanId = parentPlanning?.dynamicSource?.sourcePlanId || parentPlanning?.planId || '';

  return {
    type: 'add-step',
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task.PK,
    parentStepId: parentStep.stepId,
    step: {
      type: 'agent',
      stepId: 0,
      interaction: {
        input: [{
          type: 'system',
          content: '<!-- modelType: codeinstruct -->',
        }],
        cost: 0,
        trace: [`queued ${args.length} parallel dynamic args for ${agentName}`],
        payload: null,
      },
      stepTitle,
      status: 'in_progress',
      nextSteps: [],
      agentName,
      prompt: JSON.stringify({ planId }),
      rags: [],
      planning: {
        planId,
        dependsOn: dependencyPlanId ? [dependencyPlanId] : [],
        executionMode: 'parallel_dynamic',
        executionHost: 'client',
        dynamicSource: parentPlanning?.dynamicSource,
      },
    } as mls.msg.AIAgentStep,
    executionMode: {
      type: 'parallel',
      args,
      maxParallel,
    },
  };
}

// TODO-FINAL-023 / TODO-FINAL-024: critic/repair checkpoint support for plan indices.
export const CRITIC_PLAN_INDEX_AGENT_NAME = 'agentCriticPlanIndex';
export const REPAIR_PLAN_INDEX_AGENT_NAME = 'agentRepairPlanIndex';
export const MAX_PLAN_INDEX_CRITIC_ATTEMPTS = 3; // initial critic + up to 2 repair/critic rounds

export interface PlanIndexReviewArgs {
  indexName: string;
  attempt: number;
}

export function buildPlanIndexReviewArgs(indexName: string, attempt: number): string {
  return JSON.stringify({ indexName, attempt });
}

export function parsePlanIndexReviewArgs(args: string | undefined): PlanIndexReviewArgs {
  const parsed = parseMaybeJson(args || '');
  if (!isRecordValue(parsed)) throw new Error(`[parsePlanIndexReviewArgs] invalid args: ${args}`);
  const indexName = typeof parsed.indexName === 'string' ? parsed.indexName : '';
  const attempt = typeof parsed.attempt === 'number' && parsed.attempt > 0 ? parsed.attempt : 1;
  if (!indexName) throw new Error(`[parsePlanIndexReviewArgs] missing indexName in args: ${args}`);
  return { indexName, attempt };
}

export function repairPlanIndexToolName(indexName: string): string {
  const safe = indexName.replace(/[^a-zA-Z0-9]/g, '');
  return `submitRepaired${safe.charAt(0).toUpperCase()}${safe.slice(1)}`;
}

/**
 * Creates the critic step as a direct child of the index step.
 * The index step must stay non-terminal (in_progress) while critic/repair children run,
 * so downstream steps that depend on the index planId remain locked until approval.
 */
export function createPlanIndexReviewStepIntent(
  context: mls.msg.ExecutionContext,
  indexStep: mls.msg.AIAgentStep,
  agentName: string,
  indexName: string,
  attempt: number,
  stepTitle: string,
): mls.msg.AgentIntentAddStep {
  const kind = agentName === REPAIR_PLAN_INDEX_AGENT_NAME ? 'repair' : 'critic';
  return createDynamicAgentStepIntent(
    context,
    indexStep,
    agentName,
    `plan-index-${kind}:${indexName}:${attempt}`,
    stepTitle,
    buildPlanIndexReviewArgs(indexName, attempt),
  );
}

/** Intents returned by an index agent to hold the step open and start the critic checkpoint. */
export function createHoldIndexForReviewIntents(
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  indexStep: mls.msg.AIAgentStep,
  hookSequential: number,
  indexName: string,
): mls.msg.AgentIntent[] {
  return [
    createPlannerUpdateStatusIntent(
      context,
      parentStep,
      indexStep,
      hookSequential,
      'in_progress',
      `index generated; waiting critic/repair checkpoint for ${indexName} (TODO-FINAL-023/024)`,
    ),
    createPlanIndexReviewStepIntent(context, indexStep, CRITIC_PLAN_INDEX_AGENT_NAME, indexName, 1, `Review ${indexName} (critic 1)`),
  ];
}

export function findParentStepOfStep(context: mls.msg.ExecutionContext, stepId: number): mls.msg.AIPayload | null {
  if (!context.task) throw new Error('[findParentStepOfStep] task invalid');
  const allSteps = getAllSteps(context.task.iaCompressed?.nextSteps);
  for (const step of allSteps) {
    if (step.nextSteps?.some(child => child.stepId === stepId)) return step;
    if (step.interaction?.payload?.some(child => child.stepId === stepId)) return step;
  }
  return null;
}

export function findLatestPlanIndexReviewStep(
  context: mls.msg.ExecutionContext,
  agentName: string,
  indexName: string,
  onlyCompleted: boolean = true,
): mls.msg.AIAgentStep | null {
  if (!context.task) throw new Error('[findLatestPlanIndexReviewStep] task invalid');
  const allSteps = getAllSteps(context.task.iaCompressed?.nextSteps);
  let latest: mls.msg.AIAgentStep | null = null;

  for (const step of allSteps) {
    if (step.type !== 'agent') continue;
    const agentStep = step as mls.msg.AIAgentStep;
    if (agentStep.agentName !== agentName) continue;
    if (onlyCompleted && agentStep.status !== 'completed') continue;
    try {
      const args = parsePlanIndexReviewArgs(agentStep.prompt);
      if (args.indexName !== indexName) continue;
    } catch {
      continue;
    }
    if (!latest || agentStep.stepId > latest.stepId) latest = agentStep;
  }

  return latest;
}

/**
 * TODO-FINAL-024: read a plan index output preferring the latest completed repaired version.
 * Falls back to the original index agent payload when no repair step exists.
 */
export function getPlannerOutputWithRepair<T>(
  context: mls.msg.ExecutionContext,
  sourceAgentName: string,
  indexName: string,
  config: PlannerExtractConfig<T>,
  validate?: (output: PlannerOutput<T>) => void,
): PlannerOutput<T> {
  const repairStep = findLatestPlanIndexReviewStep(context, REPAIR_PLAN_INDEX_AGENT_NAME, indexName, true);
  const repairPayload = repairStep?.interaction?.payload?.[0];

  if (repairPayload) {
    const repairConfig: PlannerExtractConfig<T> = {
      ...config,
      toolName: repairPlanIndexToolName(indexName),
      stepId: `repair:${indexName}`,
      stepIdAliases: [config.stepId, ...(config.stepIdAliases || []), `repair:${indexName}`],
    };
    const output = extractPlannerOutput(repairPayload, repairConfig);
    validate?.(output);
    return output;
  }

  return getPlannerOutput(context, sourceAgentName, config, validate);
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// TODO-FINAL-006..009: token-reduction helpers. Each definition/index agent only needs the
// artifacts its selector references, not the full plan. These build reduced, per-item context.

/** Keep only records whose id (any of `keys`) is in `ids`. Non-records are dropped. */
export function pickRecordsByIds(items: unknown[] | undefined, ids: Set<string>, keys: string[]): unknown[] {
  if (!Array.isArray(items) || ids.size === 0) return [];
  return items.filter(item => {
    if (!isRecordValue(item)) return false;
    return keys.some(key => {
      const value = item[key];
      return typeof value === 'string' && ids.has(value);
    });
  });
}

/** Project records down to a small set of fields (drops everything else). */
export function summarizeRecords(items: unknown[] | undefined, keys: string[]): unknown[] {
  if (!Array.isArray(items)) return [];
  return items.map(item => {
    if (!isRecordValue(item)) return item;
    const summary: Record<string, unknown> = {};
    for (const key of keys) {
      if (item[key] !== undefined) summary[key] = item[key];
    }
    return Object.keys(summary).length > 0 ? summary : item;
  });
}

/**
 * TODO-FINAL-030 (R1): compact view of the final solution plan for the index agents' prompts.
 * Drops the heavy parts (ontology entity `fields` by default, full approvedArtifacts bodies) and
 * keeps ids/titles/refs — which is all the index agents need to decide scope. Cuts the biggest
 * input contributor (the full final plan, ~29KB) to a few KB. Pass includeOntologyFields=true
 * only when a consumer genuinely needs field shapes.
 */
export function compactFinalPlan(finalPlanResultValue: unknown, includeOntologyFields: boolean = false): Record<string, unknown> {
  const finalPlanResult = isRecordValue(finalPlanResultValue) ? finalPlanResultValue : {};
  const ontology = isRecordValue(finalPlanResult.ontology) ? finalPlanResult.ontology : {};
  const entities = isRecordValue(ontology.entities) ? ontology.entities : {};
  const ontologyEntities: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entities)) {
    if (!isRecordValue(value)) { ontologyEntities[key] = value; continue; }
    ontologyEntities[key] = {
      title: value.title,
      kind: value.kind,
      ownership: value.ownership,
      statusEnum: value.statusEnum,
      lifecycleStates: value.lifecycleStates,
      ...(includeOntologyFields ? { fields: value.fields } : {}),
    };
  }
  const approved = isRecordValue(finalPlanResult.approvedArtifacts) ? finalPlanResult.approvedArtifacts : {};
  const summ = (value: unknown, keys: string[]) => summarizeRecords(Array.isArray(value) ? value : [], keys);

  return {
    module: finalPlanResult.module,
    actors: summ(finalPlanResult.actors, ['actorId', 'title']),
    capabilities: summ(finalPlanResult.capabilities, ['capabilityId', 'title', 'actor', 'priority']),
    userActions: summ(finalPlanResult.userActions, ['actionId', 'id', 'title', 'actor', 'capabilityId']),
    rules: summ(finalPlanResult.rules, ['ruleId', 'title']),
    ontologyEntities,
    approvedArtifacts: {
      pages: summ(approved.pages, ['pageId', 'id', 'title', 'actor']),
      workflows: summ(approved.workflows, ['workflowId', 'id', 'title', 'executionMode']),
      plugins: summ(approved.plugins, ['pluginId', 'id', 'provider']),
      agents: summ(approved.agents, ['agentId', 'id', 'title']),
      horizontalModules: summ(approved.horizontalModules, ['horizontalModuleId', 'id', 'title']),
      mdm: summ(approved.mdm, ['domainId', 'id', 'title']),
      metricTables: summ(approved.metricTables, ['metricTableId', 'id', 'title']),
      metricDashboards: summ(approved.metricDashboards, ['metricDashboardId', 'id', 'title', 'actor']),
      usecaseEntities: summ(approved.usecaseEntities, ['usecaseEntityId', 'id', 'title']),
    },
  };
}

/**
 * TODO-FINAL-019: single source for the actor contract. All agents/validators compare against
 * `finalPlan.result.actors[].actorId` — never hard-coded names ("admin", "administrator", ...)
 * or translations. This keeps the flow language-agnostic (pt-BR/en-US/...). Pass the actors array.
 */
export function getActorIdSet(actors: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(actors)) return ids;
  for (const actor of actors) {
    if (isRecordValue(actor) && typeof actor.actorId === 'string' && actor.actorId.trim()) ids.add(actor.actorId);
  }
  return ids;
}

/** Collect non-empty string values from the given fields of a record into a target set. */
export function collectStringRefs(record: unknown, fields: string[], target: Set<string>): void {
  if (!isRecordValue(record)) return;
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value.trim()) target.add(value);
    else if (Array.isArray(value)) {
      for (const item of value) if (typeof item === 'string' && item.trim()) target.add(item);
    }
  }
}

export function getPlanningContextSnapshot(context: mls.msg.ExecutionContext): PlanningContextSnapshot {
  const clarificationAnswer = getRequirementsClarificationAnswer(context);
  return {
    initialPlan: getInitialNewSolutionPlanSummary(context),
    clarificationAnswer,
    discoveredScope: getDiscoverSolutionScopeOutput(context),
    recommendations: getRecommendImplementationsOutput(context),
    implementationDecisions: getImplementationDecisionResult(context),
    initialMetricsRequested: wantsInitialMetricsDashboard(clarificationAnswer),
  };
}

export function getInitialNewSolutionPlanSummary(context: mls.msg.ExecutionContext): InitialNewSolutionPlanSummary {
  if (!context.task) throw new Error('[getInitialNewSolutionPlanSummary] task invalid');

  const agentStep = getAgentStepByAgentName(context.task, 'agentNewSolution') as mls.msg.AIAgentStep | null;
  const payload = agentStep?.interaction?.payload?.[0] as mls.msg.AIFlexibleResultStep | undefined;
  const result = payload?.type === 'flexible' ? payload.result as InitialNewSolutionPlanSummary : undefined;

  if (!result || typeof result !== 'object') throw new Error('[getInitialNewSolutionPlanSummary] initial plan not found');
  if (!result.userPrompt || typeof result.userPrompt !== 'string') throw new Error('[getInitialNewSolutionPlanSummary] user prompt not found');
  result.moduleName = normalizeModuleFolderName(result.moduleName, result.userPrompt);
  return result;
}

export function getImplementationDecisionResult(context: mls.msg.ExecutionContext): ImplementationDecisionResult {
  if (!context.task) throw new Error('[getImplementationDecisionResult] task invalid');

  const allSteps = getAllSteps(context.task.iaCompressed?.nextSteps);
  const step = allSteps.find(item =>
    item.type === 'result' &&
    (item as any).planning?.planId === 'req-implementation-decisions' &&
    (item as mls.msg.AIResultStep).result
  ) as mls.msg.AIResultStep | undefined;

  if (!step?.result) throw new Error('[getImplementationDecisionResult] implementation decisions not found');
  const parsed = parseMaybeJson(step.result) as ImplementationDecisionResult;
  if (!parsed || !Array.isArray(parsed.decisions)) throw new Error('[getImplementationDecisionResult] invalid implementation decisions');
  return parsed;
}

export function hasAcceptedArtifact(decisions: ImplementationDecisionResult, artifactType: string): boolean {
  return decisions.decisions.some(item => item.artifactType === artifactType && item.accepted && item.decidedPriority !== 'never');
}

export function hasAcceptedNowArtifact(decisions: ImplementationDecisionResult, artifactType: string): boolean {
  return decisions.decisions.some(item => item.artifactType === artifactType && item.accepted && item.decidedPriority === 'now');
}
