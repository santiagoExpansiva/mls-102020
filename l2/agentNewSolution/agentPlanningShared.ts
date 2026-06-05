/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanningShared.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { getAgentStepByAgentName, getAllSteps } from '/_102027_/l2/aiAgentHelper.js';
import {
  DiscoverSolutionScopeOutput,
  getDiscoverSolutionScopeOutput,
  wantsInitialMetricsDashboard,
} from '/_102020_/l2/agentNewSolution/agentDiscoverSolutionScope.js';
import {
  RecommendImplementationsOutput,
  getRecommendImplementationsOutput,
} from '/_102020_/l2/agentNewSolution/agentRecommendImplementations.js';
import {
  ImplementationDecisionResult,
  RequirementsClarificationAnswer,
  getRequirementsClarificationAnswer,
} from '/_102020_/l2/agentNewSolution/agentNewSolutionRequirements.js';
import { normalizeModuleFolderName } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';

export const PLANNER_SCHEMA_VERSION = '2026-06-02';

export type PlannerStatus = 'ok' | 'needs_input' | 'failed';
export type Priority = 'now' | 'soon' | 'later' | 'never';

export interface InitialNewSolutionPlanSummary {
  userLanguage: string;
  requestKind: string;
  moduleName: string;
  userPrompt: string;
  titles?: Record<string, string>;
  todoItems?: unknown[];
  openDetails?: unknown[];
}

export interface PlannerOutput<T> {
  runId: string;
  stepId: string;
  schemaVersion: typeof PLANNER_SCHEMA_VERSION;
  status: PlannerStatus;
  result: T;
  questions: string[];
  trace: string[];
}

export interface PlanningContextSnapshot {
  initialPlan: InitialNewSolutionPlanSummary;
  clarificationAnswer: RequirementsClarificationAnswer;
  discoveredScope: DiscoverSolutionScopeOutput;
  recommendations: RecommendImplementationsOutput;
  implementationDecisions: ImplementationDecisionResult;
  initialMetricsRequested: boolean;
}

export interface PlannerExtractConfig<T> {
  toolName: string;
  stepId: string;
  stepIdAliases?: string[];
  schemaVersion?: typeof PLANNER_SCHEMA_VERSION;
  schemaVersionAliases?: string[];
  normalizeResult: (value: unknown) => T;
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

export function createPlannerToolSchema(
  toolName: string,
  description: string,
  stepId: string,
  resultSchema: Record<string, unknown>,
): mls.msg.LLMTool {
  return {
    type: 'function',
    function: {
      name: toolName,
      description,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'result'],
        properties: {
          type: { const: 'flexible' },
          result: {
            type: 'object',
            additionalProperties: false,
            required: ['runId', 'stepId', 'schemaVersion', 'status', 'result', 'questions', 'trace'],
            properties: {
              runId: { type: 'string' },
              stepId: { const: stepId },
              schemaVersion: { const: PLANNER_SCHEMA_VERSION },
              status: { enum: ['ok', 'needs_input', 'failed'] },
              result: resultSchema,
              questions: {
                type: 'array',
                items: { type: 'string' },
              },
              trace: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
    },
  } as unknown as mls.msg.LLMTool;
}

export function extractPlannerOutput<T>(payload: unknown, config: PlannerExtractConfig<T>): PlannerOutput<T> {
  const value = parseMaybeJson(payload);
  if (!isRecord(value)) throw new Error('tool payload must be an object');

  if (value.type === 'result') throw new Error(String(value.result || 'agent returned result error'));

  const directOutput = tryNormalizePlannerOutput(value, config);
  if (directOutput) return directOutput;

  if (value.type === 'flexible') {
    const flexibleResult = parseMaybeJson(value.result);
    const outputFromFlexibleResult = tryNormalizePlannerOutput(flexibleResult, config);
    if (outputFromFlexibleResult) return outputFromFlexibleResult;

    const outputFromFlexibleTool = tryExtractToolArguments(flexibleResult, config);
    if (outputFromFlexibleTool) return outputFromFlexibleTool;
  }

  const outputFromTool = tryExtractToolArguments(value, config);
  if (outputFromTool) return outputFromTool;

  const outputFromOpenAIToolCall = tryExtractOpenAIToolCall(value, config);
  if (outputFromOpenAIToolCall) return outputFromOpenAIToolCall;

  throw new Error(`payload does not contain a recognized ${config.toolName} tool output`);
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
): mls.msg.AgentIntentAddStep {
  return {
    type: 'add-step',
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    parentStepId: parentStep.stepId,
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
        dependsOn: [(parentStep as any).planning?.planId || ''],
        executionMode: 'sequential',
        executionHost: 'client',
      },
    } as mls.msg.AIAgentStep,
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

function tryExtractOpenAIToolCall<T>(value: Record<string, unknown>, config: PlannerExtractConfig<T>): PlannerOutput<T> | null {
  const toolCalls = value.tool_calls;
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null;

  const call = toolCalls.find(item => {
    const record = isRecord(item) ? item : null;
    const fn = record && isRecord(record.function) ? record.function : null;
    return fn?.name === config.toolName;
  });

  if (!isRecord(call)) return null;
  const fn = call.function;
  if (!isRecord(fn)) return null;
  return normalizeToolArguments(fn.arguments, config);
}

function tryExtractToolArguments<T>(value: unknown, config: PlannerExtractConfig<T>): PlannerOutput<T> | null {
  const record = parseMaybeJson(value);
  if (!isRecord(record)) return null;
  if (record.toolName !== config.toolName) return null;
  return normalizeToolArguments(record.arguments, config);
}

function normalizeToolArguments<T>(value: unknown, config: PlannerExtractConfig<T>, depth: number = 0): PlannerOutput<T> {
  const args = parseMaybeJson(value);
  if (!isRecord(args)) throw new Error('tool arguments must be an object');

  const directOutput = tryNormalizePlannerOutput(args, config);
  if (directOutput) return directOutput;

  const resultValue = parseMaybeJson(args.result);
  const output = tryNormalizePlannerOutput(resultValue, config);
  if (output) return output;

  const outputFromNestedResultTool = tryExtractToolArguments(resultValue, config);
  if (outputFromNestedResultTool) return outputFromNestedResultTool;

  if (args.arguments !== undefined && depth < 3) {
    const outputFromNestedArguments = tryNormalizeNestedToolArguments(args.arguments, config, depth + 1);
    if (outputFromNestedArguments) return outputFromNestedArguments;
  }

  const bareResultOutput = tryNormalizeBareResult(args, config);
  if (bareResultOutput) return bareResultOutput;

  throw new Error(`tool arguments do not contain ${config.stepId} output`);
}

function tryNormalizeNestedToolArguments<T>(value: unknown, config: PlannerExtractConfig<T>, depth: number): PlannerOutput<T> | null {
  try {
    return normalizeToolArguments(value, config, depth);
  } catch {
    return null;
  }
}

function tryNormalizeBareResult<T>(value: Record<string, unknown>, config: PlannerExtractConfig<T>): PlannerOutput<T> | null {
  try {
    return {
      runId: optionalString(value.runId, 'runId') || 'provider-tool-call',
      stepId: config.stepId,
      schemaVersion: PLANNER_SCHEMA_VERSION,
      status: isPlannerStatus(value.status) ? value.status : 'ok',
      result: config.normalizeResult(value),
      questions: normalizeStringList(value.questions, 'questions'),
      trace: normalizeStringList(value.trace, 'trace'),
    };
  } catch {
    return null;
  }
}

function isPlannerStatus(value: unknown): value is PlannerStatus {
  return value === 'ok' || value === 'needs_input' || value === 'failed';
}

function tryNormalizePlannerOutput<T>(value: unknown, config: PlannerExtractConfig<T>): PlannerOutput<T> | null {
  const output = parseMaybeJson(value);
  if (!isRecord(output)) return null;
  if (output.schemaVersion !== undefined && !isKnownSchemaVersion(output.schemaVersion, config)) return null;
  if (output.stepId !== undefined && !isKnownStepId(output.stepId, config)) return null;
  if (output.result === undefined) return null;
  if (isToolWrapper(output.result, config.toolName)) return null;
  if (isNestedPlannerOutput(output.result, config)) return null;

  return {
    runId: optionalString(output.runId, 'runId') || 'provider-tool-call',
    stepId: config.stepId,
    schemaVersion: PLANNER_SCHEMA_VERSION,
    status: output.status === undefined ? 'ok' : assertPlannerStatus(output.status, 'status'),
    result: config.normalizeResult(output.result),
    questions: normalizeStringList(output.questions, 'questions'),
    trace: normalizeStringList(output.trace, 'trace'),
  };
}

function isToolWrapper(value: unknown, toolName: string): boolean {
  const record = parseMaybeJson(value);
  return isRecord(record) && record.toolName === toolName && record.arguments !== undefined;
}

function isNestedPlannerOutput<T>(value: unknown, config: PlannerExtractConfig<T>): boolean {
  const record = parseMaybeJson(value);
  if (!isRecord(record)) return false;
  if (record.result === undefined) return false;
  if (record.stepId !== undefined) return isKnownStepId(record.stepId, config);
  return record.runId !== undefined || record.schemaVersion !== undefined || isPlannerStatus(record.status);
}

function isKnownStepId<T>(value: unknown, config: PlannerExtractConfig<T>): boolean {
  return [config.stepId, ...(config.stepIdAliases || [])].includes(value as string);
}

function isKnownSchemaVersion<T>(value: unknown, config: PlannerExtractConfig<T>): boolean {
  return [config.schemaVersion || PLANNER_SCHEMA_VERSION, ...(config.schemaVersionAliases || ['1.0'])].includes(value as string);
}

export function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  return JSON.parse(trimmed);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  return value;
}

export function assertArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value;
}

export function assertString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${path} must be a non-empty string`);
  return value.trim();
}

export function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return assertString(value, path);
}

export function assertStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value.map((item, index) => assertString(item, `${path}[${index}]`));
}

export function normalizeStringList(value: unknown, path: string): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map((item, index) => normalizeStringListItem(item, `${path}[${index}]`));
  if (isRecord(value)) {
    return Object.entries(value).map(([key, item]) => {
      const normalized = normalizeStringListItem(item, `${path}.${key}`);
      return normalized || key;
    });
  }
  return [assertString(value, path)];
}

export function assertPriority(value: unknown, path: string): Priority {
  if (value === 'now' || value === 'soon' || value === 'later' || value === 'never') return value;
  throw new Error(`${path} must be now, soon, later, or never`);
}

function normalizeStringListItem(value: unknown, path: string): string {
  if (typeof value === 'string') return assertString(value, path);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (isRecord(value)) {
    const parts = [
      optionalString(value.title, `${path}.title`),
      optionalString(value.question, `${path}.question`),
      optionalString(value.description, `${path}.description`),
      optionalString(value.reason, `${path}.reason`),
      optionalString(value.message, `${path}.message`),
    ].filter((item): item is string => !!item);
    if (parts.length > 0) return parts.join(' - ');
    return JSON.stringify(value);
  }
  throw new Error(`${path} must be a string-compatible value`);
}

function assertPlannerStatus(value: unknown, path: string): PlannerStatus {
  if (value === 'ok' || value === 'needs_input' || value === 'failed') return value;
  throw new Error(`${path} must be ok, needs_input, or failed`);
}
