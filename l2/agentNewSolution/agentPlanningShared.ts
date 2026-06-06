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
  type PlannerExtractConfig,
  type PlannerOutput,
} from '/_102020_/l2/agentNewSolution/agentPlanningExtract.js';

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
