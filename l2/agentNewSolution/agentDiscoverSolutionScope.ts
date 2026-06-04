/// <mls fileReference="_102020_/l2/agentNewSolution/agentDiscoverSolutionScope.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { getAgentStepByAgentName, getAllSteps } from '/_102027_/l2/aiAgentHelper.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentDiscoverSolutionScope',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Discover the likely scope and artifact needs for a new solution',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const DISCOVER_SOLUTION_SCOPE_TOOL_NAME = 'submitSolutionScopeDraft';
export const DISCOVER_SOLUTION_SCOPE_SCHEMA_VERSION = '2026-06-02';
export const DISCOVER_SOLUTION_SCOPE_STEP_ID = '03-discover-scope';

type ScopeStatus = 'ok' | 'needs_input' | 'failed';
type Priority = 'now' | 'soon' | 'later' | 'never';

interface InitialNewSolutionPlanSummary {
  userLanguage: string;
  requestKind: string;
  userPrompt: string;
  titles?: Record<string, string>;
  todoItems?: unknown[];
  openDetails?: unknown[];
}

interface RequirementsClarificationAnswer {
  title: string;
  userLanguage: string;
  answers: Record<string, string | boolean | string[]>;
}

export interface SolutionScopeActor {
  actorId: string;
  title?: string;
  description: string;
}

export interface SolutionScopeCapability {
  capabilityId: string;
  title?: string;
  description?: string;
  actor: string;
  priority: Priority;
}

export interface SolutionArtifactSignal {
  signal: string;
  title?: string;
  actor?: string;
  reason: string;
  priority?: Priority;
  mdmKind?: string;
}

export interface SolutionScopeDraft {
  domain: string;
  summary: string;
  actors: SolutionScopeActor[];
  capabilities: SolutionScopeCapability[];
  artifactSignals: {
    pages: SolutionArtifactSignal[];
    workflows: SolutionArtifactSignal[];
    plugins: SolutionArtifactSignal[];
    agents: SolutionArtifactSignal[];
    horizontalModules: SolutionArtifactSignal[];
    mdm: SolutionArtifactSignal[];
    metrics: SolutionArtifactSignal[];
    usecases: SolutionArtifactSignal[];
  };
  businessRisks: string[];
  missingContext: string[];
}

export interface DiscoverSolutionScopeOutput {
  runId: string;
  stepId: typeof DISCOVER_SOLUTION_SCOPE_STEP_ID;
  schemaVersion: typeof DISCOVER_SOLUTION_SCOPE_SCHEMA_VERSION;
  status: ScopeStatus;
  result: SolutionScopeDraft;
  questions: string[];
  trace: string[];
}

export interface DiscoverSolutionScopeToolArguments {
  type: 'flexible';
  result: DiscoverSolutionScopeOutput;
}

export interface DiscoverSolutionScopeToolCall {
  toolName: typeof DISCOVER_SOLUTION_SCOPE_TOOL_NAME;
  arguments: DiscoverSolutionScopeToolArguments | DiscoverSolutionScopeOutput | string;
}

export type Output =
  {
    type: 'flexible';
    result: DiscoverSolutionScopeOutput | DiscoverSolutionScopeToolCall | DiscoverSolutionScopeToolArguments;
  } | DiscoverSolutionScopeToolCall | {
    type: 'result';
    result: string;
  };

export const discoverSolutionScopeToolSchema = {
  type: 'function',
  function: {
    name: DISCOVER_SOLUTION_SCOPE_TOOL_NAME,
    description: 'Submit a validated scope draft for the newSolution planner.',
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
            stepId: { const: DISCOVER_SOLUTION_SCOPE_STEP_ID },
            schemaVersion: { const: DISCOVER_SOLUTION_SCOPE_SCHEMA_VERSION },
            status: { enum: ['ok', 'needs_input', 'failed'] },
            result: {
              type: 'object',
              additionalProperties: false,
              required: ['domain', 'summary', 'actors', 'capabilities', 'artifactSignals', 'businessRisks', 'missingContext'],
              properties: {
                domain: { type: 'string' },
                summary: { type: 'string' },
                actors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['actorId', 'description'],
                    properties: {
                      actorId: { type: 'string' },
                      title: { type: 'string' },
                      description: { type: 'string' },
                    },
                  },
                },
                capabilities: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['capabilityId', 'actor', 'priority'],
                    properties: {
                      capabilityId: { type: 'string' },
                      title: { type: 'string' },
                      description: { type: 'string' },
                      actor: { type: 'string' },
                      priority: { enum: ['now', 'soon', 'later', 'never'] },
                    },
                  },
                },
                artifactSignals: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['pages', 'workflows', 'plugins', 'agents', 'horizontalModules', 'mdm', 'metrics', 'usecases'],
                  properties: {
                    pages: { type: 'array', items: { $ref: '#/$defs/artifactSignal' } },
                    workflows: { type: 'array', items: { $ref: '#/$defs/artifactSignal' } },
                    plugins: { type: 'array', items: { $ref: '#/$defs/artifactSignal' } },
                    agents: { type: 'array', items: { $ref: '#/$defs/artifactSignal' } },
                    horizontalModules: { type: 'array', items: { $ref: '#/$defs/artifactSignal' } },
                    mdm: { type: 'array', items: { $ref: '#/$defs/artifactSignal' } },
                    metrics: { type: 'array', items: { $ref: '#/$defs/artifactSignal' } },
                    usecases: { type: 'array', items: { $ref: '#/$defs/artifactSignal' } },
                  },
                },
                businessRisks: { type: 'array', items: { type: 'string' } },
                missingContext: { type: 'array', items: { type: 'string' } },
              },
            },
            questions: { type: 'array', items: { type: 'string' } },
            trace: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      $defs: {
        artifactSignal: {
          type: 'object',
          additionalProperties: false,
          required: ['signal', 'reason'],
          properties: {
            signal: { type: 'string' },
            title: { type: 'string' },
            actor: { type: 'string' },
            reason: { type: 'string' },
            priority: { enum: ['now', 'soon', 'later', 'never'] },
            mdmKind: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

async function beforePromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
  args?: string,
): Promise<mls.msg.AgentIntent[]> {
  if (!args) throw new Error(`(${agent.agentName})[beforePromptStep] args invalid`);
  if (!context.task) throw new Error(`(${agent.agentName})[beforePromptStep] task invalid`);

  const initialPlan = getInitialNewSolutionPlanSummary(context);
  const clarificationAnswer = getRequirementsClarificationAnswer(context);

  const continueIntent: mls.msg.AgentIntentPromptReady = {
    type: 'prompt_ready',
    args,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task.PK,
    hookSequential,
    parentStepId: parentStep.stepId,
    systemPrompt: buildSystemPrompt(),
    humanPrompt: buildHumanPrompt(args, initialPlan, clarificationAnswer),
  };

  return [continueIntent];
}

async function afterPromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
): Promise<mls.msg.AgentIntent[]> {
  if (!agent || !context || !step) throw new Error(`[afterPromptStep] invalid params`);

  const payload = step.interaction?.payload?.[0] as Output | undefined;
  let status: mls.msg.AIStepStatus = 'completed';

  try {
    if (!payload) throw new Error('missing payload');
    const output = extractDiscoverSolutionScopeOutput(payload);
    const requirementsAnswer = context.task ? getRequirementsClarificationAnswer(context) : undefined;
    validateDiscoverSolutionScopeOutput(output, { initialMetricsRequested: wantsInitialMetricsDashboard(requirementsAnswer) });
    if (output.status !== 'ok') status = 'failed';
  } catch (error) {
    console.error(`[${agent.agentName}](afterPromptStep) ${error instanceof Error ? error.message : error}`);
    status = 'failed';
  }

  const updateStatus: mls.msg.AgentIntentUpdateStatus = {
    type: 'update-status',
    hookSequential,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    parentStepId: parentStep.stepId,
    stepId: step.stepId,
    status,
  };

  if (status === 'completed') updateStatus.cleaner = 'input';
  return [updateStatus];
}

function buildSystemPrompt(): string {
  return systemPrompt
    .split('{{toolName}}').join(DISCOVER_SOLUTION_SCOPE_TOOL_NAME)
    .replace('{{toolSchema}}', JSON.stringify(discoverSolutionScopeToolSchema, null, 2));
}

function buildHumanPrompt(
  args: string,
  initialPlan: InitialNewSolutionPlanSummary,
  clarificationAnswer: RequirementsClarificationAnswer,
): string {
  return `## Planned step args
${args}

## Initial user prompt
${initialPlan.userPrompt}

## Initial new solution plan
${JSON.stringify(initialPlan, null, 2)}

## First clarification answer
${JSON.stringify(clarificationAnswer, null, 2)}
`;
}

function createSignalFromString(value: string): SolutionArtifactSignal {
  return {
    signal: toCamelSignal(value),
    reason: value,
  };
}

function createCapabilityFromString(value: string): SolutionScopeCapability {
  return {
    capabilityId: toCamelSignal(value),
    actor: 'unknown',
    priority: 'now',
    title: value,
  };
}

function createActorFromString(value: string): SolutionScopeActor {
  return {
    actorId: toCamelSignal(value),
    title: value,
    description: value,
  };
}

function extractDiscoverSolutionScopeOutput(payload: unknown): DiscoverSolutionScopeOutput {
  const value = parseMaybeJson(payload);
  if (!isRecord(value)) throw new Error('tool payload must be an object');

  if (value.type === 'result') throw new Error(String(value.result || 'agent returned result error'));

  const directOutput = tryNormalizeOutput(value);
  if (directOutput) return directOutput;

  if (value.type === 'flexible') {
    const flexibleResult = parseMaybeJson(value.result);
    const outputFromFlexibleResult = tryNormalizeOutput(flexibleResult);
    if (outputFromFlexibleResult) return outputFromFlexibleResult;

    const outputFromFlexibleTool = tryExtractToolArguments(flexibleResult);
    if (outputFromFlexibleTool) return outputFromFlexibleTool;
  }

  const outputFromTool = tryExtractToolArguments(value);
  if (outputFromTool) return outputFromTool;

  const outputFromOpenAIToolCall = tryExtractOpenAIToolCall(value);
  if (outputFromOpenAIToolCall) return outputFromOpenAIToolCall;

  throw new Error('payload does not contain a recognized tool call or flexible scope output');
}

function tryExtractOpenAIToolCall(value: Record<string, unknown>): DiscoverSolutionScopeOutput | null {
  const toolCalls = value.tool_calls;
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null;

  const call = toolCalls.find(item => {
    const record = isRecord(item) ? item : null;
    const fn = record && isRecord(record.function) ? record.function : null;
    return fn?.name === DISCOVER_SOLUTION_SCOPE_TOOL_NAME;
  });

  if (!isRecord(call)) return null;
  const fn = call.function;
  if (!isRecord(fn)) return null;
  return normalizeToolArguments(fn.arguments);
}

function tryExtractToolArguments(value: unknown): DiscoverSolutionScopeOutput | null {
  const record = parseMaybeJson(value);
  if (!isRecord(record)) return null;
  if (record.toolName !== DISCOVER_SOLUTION_SCOPE_TOOL_NAME) return null;
  return normalizeToolArguments(record.arguments);
}

function normalizeToolArguments(value: unknown): DiscoverSolutionScopeOutput {
  const args = parseMaybeJson(value);
  if (!isRecord(args)) throw new Error('tool arguments must be an object');

  const directOutput = tryNormalizeOutput(args);
  if (directOutput) return directOutput;

  if (args.type === 'flexible') {
    const output = tryNormalizeOutput(parseMaybeJson(args.result));
    if (output) return output;
  }

  throw new Error('tool arguments do not contain a flexible scope output');
}

function tryNormalizeOutput(value: unknown): DiscoverSolutionScopeOutput | null {
  const output = parseMaybeJson(value);
  if (!isRecord(output)) return null;
  if (output.stepId !== DISCOVER_SOLUTION_SCOPE_STEP_ID || output.schemaVersion !== DISCOVER_SOLUTION_SCOPE_SCHEMA_VERSION) return null;
  return normalizeDiscoverSolutionScopeOutput(output);
}

function normalizeDiscoverSolutionScopeOutput(value: Record<string, unknown>): DiscoverSolutionScopeOutput {
  const result = assertRecord(value.result, 'result');
  const artifactSignals = assertRecord(result.artifactSignals, 'result.artifactSignals');

  return {
    runId: assertString(value.runId, 'runId'),
    stepId: assertConst(value.stepId, DISCOVER_SOLUTION_SCOPE_STEP_ID, 'stepId'),
    schemaVersion: assertConst(value.schemaVersion, DISCOVER_SOLUTION_SCOPE_SCHEMA_VERSION, 'schemaVersion'),
    status: assertStatus(value.status, 'status'),
    result: {
      domain: assertString(result.domain, 'result.domain'),
      summary: assertString(result.summary, 'result.summary'),
      actors: normalizeActors(result.actors, 'result.actors'),
      capabilities: normalizeCapabilities(result.capabilities, 'result.capabilities'),
      artifactSignals: {
        pages: normalizeSignals(artifactSignals.pages, 'result.artifactSignals.pages'),
        workflows: normalizeSignals(artifactSignals.workflows, 'result.artifactSignals.workflows'),
        plugins: normalizeSignals(artifactSignals.plugins, 'result.artifactSignals.plugins'),
        agents: normalizeSignals(artifactSignals.agents, 'result.artifactSignals.agents'),
        horizontalModules: normalizeSignals(artifactSignals.horizontalModules, 'result.artifactSignals.horizontalModules'),
        mdm: normalizeSignals(artifactSignals.mdm, 'result.artifactSignals.mdm'),
        metrics: normalizeSignals(artifactSignals.metrics, 'result.artifactSignals.metrics'),
        usecases: normalizeSignals(artifactSignals.usecases, 'result.artifactSignals.usecases'),
      },
      businessRisks: assertStringArray(result.businessRisks, 'result.businessRisks'),
      missingContext: assertStringArray(result.missingContext, 'result.missingContext'),
    },
    questions: assertStringArray(value.questions, 'questions'),
    trace: assertStringArray(value.trace, 'trace'),
  };
}

function validateDiscoverSolutionScopeOutput(
  output: DiscoverSolutionScopeOutput,
  options: { initialMetricsRequested: boolean },
): void {
  if (output.status === 'ok' && output.result.artifactSignals.mdm.length === 0) {
    throw new Error('MDM is mandatory and artifactSignals.mdm must not be empty');
  }

  if (output.status === 'ok' && options.initialMetricsRequested && output.result.artifactSignals.metrics.length === 0) {
    throw new Error('initial metrics/dashboard was requested, but artifactSignals.metrics is empty');
  }

  if (output.status === 'needs_input' && output.questions.length === 0 && output.result.missingContext.length === 0) {
    throw new Error('needs_input output must include questions or missingContext');
  }
}

function normalizeActors(value: unknown, path: string): SolutionScopeActor[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);

  return value.map((item, index) => {
    if (typeof item === 'string') return createActorFromString(item);
    const record = assertRecord(item, `${path}[${index}]`);
    return {
      actorId: assertString(record.actorId, `${path}[${index}].actorId`),
      title: optionalString(record.title, `${path}[${index}].title`),
      description: assertString(record.description, `${path}[${index}].description`),
    };
  });
}

function normalizeCapabilities(value: unknown, path: string): SolutionScopeCapability[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);

  return value.map((item, index) => {
    if (typeof item === 'string') return createCapabilityFromString(item);
    const record = assertRecord(item, `${path}[${index}]`);
    return {
      capabilityId: assertString(record.capabilityId, `${path}[${index}].capabilityId`),
      title: optionalString(record.title, `${path}[${index}].title`),
      description: optionalString(record.description, `${path}[${index}].description`),
      actor: assertString(record.actor, `${path}[${index}].actor`),
      priority: assertPriority(record.priority, `${path}[${index}].priority`),
    };
  });
}

function normalizeSignals(value: unknown, path: string): SolutionArtifactSignal[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);

  return value.map((item, index) => {
    if (typeof item === 'string') return createSignalFromString(item);
    const record = assertRecord(item, `${path}[${index}]`);
    return {
      signal: assertString(record.signal, `${path}[${index}].signal`),
      title: optionalString(record.title, `${path}[${index}].title`),
      actor: optionalString(record.actor, `${path}[${index}].actor`),
      reason: assertString(record.reason, `${path}[${index}].reason`),
      priority: optionalPriority(record.priority, `${path}[${index}].priority`),
      mdmKind: optionalString(record.mdmKind, `${path}[${index}].mdmKind`),
    };
  });
}

function getInitialNewSolutionPlanSummary(context: mls.msg.ExecutionContext): InitialNewSolutionPlanSummary {
  if (!context.task) throw new Error('[getInitialNewSolutionPlanSummary] task invalid');

  const agentStep = getAgentStepByAgentName(context.task, 'agentNewSolution') as mls.msg.AIAgentStep | null;
  const payload = agentStep?.interaction?.payload?.[0] as mls.msg.AIFlexibleResultStep | undefined;
  const result = payload?.type === 'flexible' ? payload.result as InitialNewSolutionPlanSummary : undefined;

  if (!result || typeof result !== 'object') throw new Error('[getInitialNewSolutionPlanSummary] initial plan not found');
  if (!result.userPrompt || typeof result.userPrompt !== 'string') throw new Error('[getInitialNewSolutionPlanSummary] user prompt not found');
  return result;
}

function getRequirementsClarificationAnswer(context: mls.msg.ExecutionContext): RequirementsClarificationAnswer {
  if (!context.task) throw new Error('[getRequirementsClarificationAnswer] task invalid');

  const allSteps = getAllSteps(context.task.iaCompressed?.nextSteps);
  const answerStep = allSteps.find(item =>
    item.type === 'result' &&
    (item as any).planning?.planId === 'req-clarification-answer' &&
    (item as mls.msg.AIResultStep).result
  ) as mls.msg.AIResultStep | undefined;

  if (!answerStep?.result) throw new Error('[getRequirementsClarificationAnswer] clarification answer not found');
  const parsed = JSON.parse(answerStep.result) as RequirementsClarificationAnswer;
  if (!parsed.answers || typeof parsed.answers !== 'object') throw new Error('[getRequirementsClarificationAnswer] invalid clarification answer');
  return parsed;
}

function wantsInitialMetricsDashboard(answer?: RequirementsClarificationAnswer): boolean {
  const raw = answer?.answers?.initialMetricsDashboard;
  if (raw === undefined) return false;
  if (raw === false) return false;
  if (raw === true) return true;

  const value = Array.isArray(raw) ? raw.join(' ') : String(raw);
  const normalized = normalizeText(value);

  if (/\b(none|no|nao|later|depois|futuro|sem)\b/.test(normalized)) return false;
  return /\b(sim|yes|basic|basico|metric|dashboard|painel)\b/.test(normalized);
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function toCamelSignal(value: string): string {
  const words = normalizeText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'signal';
  return words
    .map((word, index) => index === 0 ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join('');
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  return JSON.parse(trimmed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  return value;
}

function assertString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${path} must be a non-empty string`);
  return value.trim();
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return assertString(value, path);
}

function assertStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value.map((item, index) => assertString(item, `${path}[${index}]`));
}

function assertConst<T extends string>(value: unknown, expected: T, path: string): T {
  if (value !== expected) throw new Error(`${path} must be ${expected}`);
  return expected;
}

function assertStatus(value: unknown, path: string): ScopeStatus {
  if (value === 'ok' || value === 'needs_input' || value === 'failed') return value;
  throw new Error(`${path} must be ok, needs_input, or failed`);
}

function assertPriority(value: unknown, path: string): Priority {
  if (value === 'now' || value === 'soon' || value === 'later' || value === 'never') return value;
  throw new Error(`${path} must be now, soon, later, or never`);
}

function optionalPriority(value: unknown, path: string): Priority | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return assertPriority(value, path);
}

const systemPrompt = `
<!-- modelType: codeinstruct -->

You are agentDiscoverSolutionScope for the collab.codes "newModule" flow.

Analyze the original user prompt and the first clarification answer.
Your goal is to identify what kinds of artifacts this solution probably needs.

Use the same language as the user for titles, descriptions, reasons, risks, questions, and trace.
Use English camelCase identifiers for domain, actorId, capabilityId, and artifact signal IDs.

## Tool mode

Behave as if you are calling the tool "{{toolName}}".
The current message interface still expects a JSON payload, so encode the tool call in this exact shape:

{
  "type": "flexible",
  "result": {
    "toolName": "{{toolName}}",
    "arguments": {
      "type": "flexible",
      "result": {
        "runId": "run01",
        "stepId": "03-discover-scope",
        "schemaVersion": "2026-06-02",
        "status": "ok",
        "result": {
          "domain": "",
          "summary": "",
          "actors": [],
          "capabilities": [],
          "artifactSignals": {
            "pages": [],
            "workflows": [],
            "plugins": [],
            "agents": [],
            "horizontalModules": [],
            "mdm": [],
            "metrics": [],
            "usecases": []
          },
          "businessRisks": [],
          "missingContext": []
        },
        "questions": [],
        "trace": []
      }
    }
  }
}

## Tool schema

{{toolSchema}}

## Rules

- Return only valid JSON. Do not use markdown fences.
- MDM is mandatory. Always include at least one MDM signal and explain why it is needed.
- If the clarification answer requests initial metrics/dashboard, include metrics and admin dashboard signals.
- Identify backend use case needs when the solution has writes, lifecycle transitions, BFF commands, metric updates, or aggregate maintenance.
- Differentiate static pages from workflows.
- Detect external integrations only when the prompt or clarification implies them.
- Do not use hard-coded domain assumptions. Infer required domain actions from the requested solution.
- When the domain contains a booking, reservation, order, subscription, approval, service request, rental, or similar commitment, identify the resource, item, or service being committed and the user action that selects or confirms it.
- Use status "needs_input" only when the scope cannot be safely drafted without another client decision; then include questions or missingContext.
- Use status "failed" only for structural impossibility.
`;

export function getDiscoverSolutionScopeOutput(context: mls.msg.ExecutionContext): DiscoverSolutionScopeOutput {
  if (!context.task) throw new Error('[getDiscoverSolutionScopeOutput] task invalid');

  const agentStep = getAgentStepByAgentName(context.task, 'agentDiscoverSolutionScope') as mls.msg.AIAgentStep | null;
  if (!agentStep) throw new Error('[getDiscoverSolutionScopeOutput] scope agent step not found');

  const payload = agentStep.interaction?.payload?.[0] as Output | undefined;
  if (!payload) throw new Error('[getDiscoverSolutionScopeOutput] scope payload not found');

  const output = extractDiscoverSolutionScopeOutput(payload);
  validateDiscoverSolutionScopeOutput(output, {
    initialMetricsRequested: wantsInitialMetricsDashboard(getRequirementsClarificationAnswer(context)),
  });
  return output;
}

export function getDiscoverSolutionScopeDraft(context: mls.msg.ExecutionContext): SolutionScopeDraft {
  return getDiscoverSolutionScopeOutput(context).result;
}
