/// <mls fileReference="_102020_/l2/agentNewSolution/agentNewSolutionRequirements.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { getAgentStepByAgentName, getAllSteps, notifyTaskChange } from '/_102027_/l2/aiAgentHelper.js';
import {
  saveNewSolutionAgentTracePayload,
  getExistingModuleFolders,
  getInitialModuleName,
  reserveNewSolutionModuleArtifacts,
  normalizeModuleFolderName,
} from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import {
  ImplementationRecommendation,
  RecommendImplementationsOutput,
  getRecommendImplementationsOutput,
} from '/_102020_/l2/agentNewSolution/agentRecommendImplementations.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentNewSolutionRequirements',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Collect initial requirements for a new solution',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
    beforeClarificationStep,
  };
}

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

  const initialPlan = getInitialPlan(context);
  // No reservation has happened yet (deferred to the clarification answer), so the in-progress
  // module is not in the folder list and does not need excluding.
  const existingFolders = getExistingProjectFolders();

  const continueIntent: mls.msg.AgentIntentPromptReady = {
    type: 'prompt_ready',
    args,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task.PK,
    hookSequential,
    parentStepId: parentStep.stepId,
    systemPrompt: systemPrompt.replace('{{folders}}', existingFolders.join(', ')),
    humanPrompt: buildHumanPrompt(initialPlan),
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
  if (!payload) throw new Error(`[afterPromptStep] missing payload`);

  if (payload.type === 'result') {
    await saveNewSolutionAgentTracePayload(context, agent.agentName, step);
    return [createUpdateStatusIntent(context, parentStep, step, hookSequential, 'failed')];
  }

  if (payload.type !== 'clarification' || !payload.json) {
    throw new Error(`[afterPromptStep] invalid payload: ${JSON.stringify(payload)}`);
  }

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);
  return [];
}

async function beforeClarificationStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIClarificationStep,
  hookSequential: number,
  json: any,
): Promise<HTMLElement> {
  if (!context.task) throw new Error(`[beforeClarificationStep] invalid task: undefined`);

  await import('/_102025_/l2/widgetQuestionsForClarification.js');

  const parsedJson = parseClarificationJson(json);
  const planId = (step as any).planning?.planId || parsedJson.planId;

  if (planId === 'req-implementation-decisions') {
    return createImplementationDecisionElement(agent, context, parentStep, step, hookSequential);
  }

  const div = document.createElement('div');
  const clariEl = document.createElement('widget-questions-for-clarification-102025');

  (clariEl as any).value = {
    taskId: context.task.PK,
    stepId: step.stepId,
    title: parsedJson.title,
    legends: parsedJson.legends || [],
    userLanguage: parsedJson.userLanguage || '',
    questions: parsedJson.questions,
  };
  clariEl.setAttribute('mode', 'new');

  clariEl.addEventListener('clarification-finish', (event: Event) => {
    const { detail } = event as CustomEvent<{ value: RequirementsClarification; action: 'continue' | 'cancel' }>;
    applyClarificationResult(agent, context, parentStep, step, hookSequential, detail.value, detail.action).catch(error => {
      console.error(`[${agent.agentName}](beforeClarificationStep) ${error.message || error}`);
    });
  });

  div.appendChild(clariEl);
  return div;
}

function createImplementationDecisionElement(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIClarificationStep,
  hookSequential: number,
): HTMLElement {
  if (!context.task) throw new Error(`[createImplementationDecisionElement] invalid task: undefined`);

  const recommendationsOutput = getRecommendImplementationsOutput(context);
  const clarification = buildImplementationDecisionClarification(recommendationsOutput);

  const div = document.createElement('div');
  const clariEl = document.createElement('widget-questions-for-clarification-102025');

  (clariEl as any).value = {
    taskId: context.task.PK,
    stepId: step.stepId,
    title: clarification.title,
    legends: clarification.legends,
    userLanguage: clarification.userLanguage,
    questions: clarification.questions,
  };
  clariEl.setAttribute('mode', 'new');

  clariEl.addEventListener('clarification-finish', (event: Event) => {
    const { detail } = event as CustomEvent<{ value: ImplementationDecisionClarification; action: 'continue' | 'cancel' }>;
    applyImplementationDecisionResult(agent, context, parentStep, step, hookSequential, detail.value, detail.action).catch(error => {
      console.error(`[${agent.agentName}](createImplementationDecisionElement) ${error.message || error}`);
    });
  });

  div.appendChild(clariEl);
  return div;
}

async function applyClarificationResult(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIClarificationStep,
  hookSequential: number,
  value: RequirementsClarification,
  action: 'continue' | 'cancel',
): Promise<void> {
  if (!context.task) throw new Error(`[${agent.agentName}](applyClarificationResult) task invalid`);

  // The module name is FINALIZED here (first clarification). Use the user's answer, falling back to
  // the root's tentative name (LLM suggestion / prompt default) when the answer omits it. Validate
  // it against existing folders: if it already exists, abort the task instead of creating a
  // duplicate. Only after this is the module reserved and trace/artifacts start being written.
  let finalModuleName: string | undefined;
  let collisionMsg: string | undefined;
  if (action === 'continue') {
    const tentative = getInitialModuleName(context);
    finalModuleName = normalizeModuleFolderName(readModuleNameAnswer(value) || tentative, tentative);
    if (getExistingModuleFolders().has(finalModuleName)) {
      const lang = (value.userLanguage || '').toLowerCase();
      collisionMsg = lang.startsWith('pt')
        ? `O módulo "${finalModuleName}" já existe. Escolha outro nome para o módulo.`
        : `Module "${finalModuleName}" already exists. Please choose a different module name.`;
    }
  }

  // A name collision turns the approval into a failure (aborts the task with a clear reason).
  const effectiveAction: 'continue' | 'cancel' = collisionMsg ? 'cancel' : action;
  const status: mls.msg.AIStepStatus = effectiveAction === 'continue' ? 'completed' : 'failed';
  const intents: mls.msg.AgentIntent[] = [
    createUpdateStatusIntent(context, parentStep, step, hookSequential, status, collisionMsg),
  ];

  if (effectiveAction === 'continue' && finalModuleName) {
    const initialPlan = getInitialPlan(context);
    await reserveNewSolutionModuleArtifacts({
      moduleName: finalModuleName,
      requestKind: initialPlan.requestKind,
      userLanguage: initialPlan.userLanguage,
      userPrompt: initialPlan.userPrompt,
    });

    const answerResult = normalizeClarificationAnswer(value);
    answerResult.answers.moduleName = finalModuleName; // authoritative name for the whole run
    const plannedAnswerStep = findStepByPlanId(context.task, 'req-clarification-answer');

    intents.unshift(createClarificationAnswerResultIntent(context, parentStep, answerResult));

    if (plannedAnswerStep) {
      intents.push(createUpdateStatusIntent(context, parentStep, plannedAnswerStep, hookSequential, 'completed'));
    }
  }

  const response = await mls.api.msgApplyIntents({
    userId: context.message.senderId,
    intents,
  });

  if (!response || response.statusCode !== 200) {
    throw new Error((response as mls.msg.ResponseBase | undefined)?.msg || 'Error applying clarification result');
  }

  const ret = response as mls.msg.ResponseApplyIntents;
  context.task = ret.task;
  if (ret.message) context.message = ret.message;
  notifyTaskChange(context);

  const queueFrontEnd = context.task.iaCompressed?.queueFrontEnd || [];
  const hasHookToContinue = effectiveAction === 'continue' && queueFrontEnd.some(hook => hook.type !== 'pooling');

  if (mls.isTraceAgent) {
    console.log(
      `[${agent.agentName}](applyClarificationResult) queueFrontEnd:${queueFrontEnd.length}, hasHookToContinue:${hasHookToContinue}`
    );
  }

  if (hasHookToContinue) {
    const { continuePoolingTask } = await import('/_102027_/l2/aiAgentOrchestration.js');
    await continuePoolingTask(context);
  }
}

async function applyImplementationDecisionResult(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIClarificationStep,
  hookSequential: number,
  value: ImplementationDecisionClarification,
  action: 'continue' | 'cancel',
): Promise<void> {
  if (!context.task) throw new Error(`[${agent.agentName}](applyImplementationDecisionResult) task invalid`);

  const status: mls.msg.AIStepStatus = action === 'continue' ? 'completed' : 'failed';
  const intents: mls.msg.AgentIntent[] = [
    createUpdateStatusIntent(context, parentStep, step, hookSequential, status),
  ];

  if (action === 'continue') {
    const recommendationOutput = getRecommendImplementationsOutput(context);
    const decisionResult = normalizeImplementationDecisionAnswer(value, recommendationOutput);
    intents.unshift(createImplementationDecisionResultIntent(context, parentStep, decisionResult));
  }

  const response = await mls.api.msgApplyIntents({
    userId: context.message.senderId,
    intents,
  });

  if (!response || response.statusCode !== 200) {
    throw new Error((response as mls.msg.ResponseBase | undefined)?.msg || 'Error applying implementation decision result');
  }

  const ret = response as mls.msg.ResponseApplyIntents;
  context.task = ret.task;
  if (ret.message) context.message = ret.message;
  notifyTaskChange(context);

  const queueFrontEnd = context.task.iaCompressed?.queueFrontEnd || [];
  const hasHookToContinue = action === 'continue' && queueFrontEnd.some(hook => hook.type !== 'pooling');

  if (mls.isTraceAgent) {
    console.log(
      `[${agent.agentName}](applyImplementationDecisionResult) queueFrontEnd:${queueFrontEnd.length}, hasHookToContinue:${hasHookToContinue}`
    );
  }

  if (hasHookToContinue) {
    const { continuePoolingTask } = await import('/_102027_/l2/aiAgentOrchestration.js');
    await continuePoolingTask(context);
  }
}

function createClarificationAnswerResultIntent(
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  answerResult: RequirementsClarificationAnswer,
): mls.msg.AgentIntentAddStep {
  return {
    type: 'add-step',
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    parentStepId: parentStep.stepId,
    step: {
      type: 'result',
      stepId: 0,
      interaction: null,
      stepTitle: answerResult.title,
      status: 'completed',
      nextSteps: [],
      result: JSON.stringify(answerResult, null, 2),
      planning: {
        planId: 'req-clarification-answer',
        dependsOn: ['org-requirements'],
        executionMode: 'manual_later',
        executionHost: 'client',
      },
    } as mls.msg.AIResultStep,
  };
}

function createImplementationDecisionResultIntent(
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  decisionResult: ImplementationDecisionResult,
): mls.msg.AgentIntentAddStep {
  return {
    type: 'add-step',
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    parentStepId: parentStep.stepId,
    step: {
      type: 'result',
      stepId: 0,
      interaction: null,
      stepTitle: decisionResult.title,
      status: 'completed',
      nextSteps: [],
      result: JSON.stringify(decisionResult, null, 2),
      planning: {
        planId: 'req-implementation-decisions',
        dependsOn: ['req-recommend-implementations'],
        executionMode: 'manual_later',
        executionHost: 'client',
      },
    } as mls.msg.AIResultStep,
  };
}

function createUpdateStatusIntent(
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIPayload,
  hookSequential: number,
  status: mls.msg.AIStepStatus,
  traceMsg?: string,
): mls.msg.AgentIntentUpdateStatus {
  return {
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
}

function readModuleNameAnswer(value: RequirementsClarification): string | undefined {
  const answer = value.questions?.moduleName?.answer;
  return typeof answer === 'string' && answer.trim() ? answer.trim() : undefined;
}

function normalizeClarificationAnswer(value: RequirementsClarification): RequirementsClarificationAnswer {
  const answers = Object.fromEntries(
    Object.entries(value.questions || {}).map(([key, question]) => [key, question.answer ?? ''])
  );

  return {
    title: value.title || 'Initial requirements answer',
    userLanguage: value.userLanguage || '',
    answers,
  };
}

function buildImplementationDecisionClarification(output: RecommendImplementationsOutput): ImplementationDecisionClarification {
  const recommendations = output.result.recommendations;
  const questions: Record<string, RequirementsQuestion> = {};

  for (const [index, recommendation] of recommendations.entries()) {
    const key = getRecommendationQuestionId(recommendation, index);
    const defaultPriority = recommendation.defaultPriority || recommendation.priority;
    questions[key] = {
        type: 'select',
        question: formatRecommendationQuestion(recommendation),
        answer: defaultPriority,
        options: [
          { id: 'now', label: 'now' },
          { id: 'soon', label: 'soon' },
          { id: 'later', label: 'later' },
          { id: 'never', label: 'never' },
        ],
      };
  }

  return {
    title: 'Decisoes de implementacao',
    userLanguage: '',
    userPrompt: '',
    questions,
    legends: [
      'Revise as recomendacoes e ajuste a prioridade quando necessario.',
      'Use "never" para recusar uma recomendacao nesta solucao.',
    ],
  };
}

function normalizeImplementationDecisionAnswer(
  value: ImplementationDecisionClarification,
  output: RecommendImplementationsOutput,
): ImplementationDecisionResult {
  const recommendations = output.result.recommendations;
  const decisions = recommendations.map((recommendation, index): ImplementationDecisionItem => {
    const key = getRecommendationQuestionId(recommendation, index);
    const answer = value.questions?.[key]?.answer;
    const decidedPriority = normalizeDecisionPriority(answer, recommendation.defaultPriority || recommendation.priority);

    return {
      recommendationId: recommendation.recommendationId,
      artifactType: recommendation.artifactType,
      title: recommendation.title,
      description: recommendation.description,
      originalPriority: recommendation.priority,
      defaultPriority: recommendation.defaultPriority,
      decidedPriority,
      accepted: decidedPriority !== 'never',
      requiresClientDecision: recommendation.requiresClientDecision,
      dependencies: recommendation.dependencies,
      reason: recommendation.reason,
    };
  });

  return {
    title: value.title || 'Decisoes de implementacao',
    userLanguage: value.userLanguage || '',
    sourceStepId: output.stepId,
    sourceSchemaVersion: output.schemaVersion,
    decisions,
    trace: [
      'Decisoes criadas a partir de agentRecommendImplementations.',
      `Total de recomendacoes avaliadas: ${decisions.length}.`,
      `Recomendacoes aceitas: ${decisions.filter(item => item.accepted).length}.`,
    ],
  };
}

function getRecommendationQuestionId(recommendation: ImplementationRecommendation, index: number): string {
  return `recommendation_${index}_${toSafeQuestionId(recommendation.recommendationId)}`;
}

function formatRecommendationQuestion(recommendation: ImplementationRecommendation): string {
  return [
    `${recommendation.title} [${recommendation.artifactType}]`,
    recommendation.description,
    `Motivo: ${recommendation.reason}`,
    `Padrao: ${recommendation.defaultPriority}.`,
  ].join('\n');
}

function normalizeDecisionPriority(value: unknown, fallback: ImplementationDecisionPriority): ImplementationDecisionPriority {
  if (value === 'now' || value === 'soon' || value === 'later' || value === 'never') return value;
  return fallback;
}

function toSafeQuestionId(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'item';
}

function parseClarificationJson(value: any): any {
  if (typeof value !== 'string') return value || {};
  const trimmed = value.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed);
}

function findStepByPlanId(task: mls.msg.TaskData, planId: string): mls.msg.AIPayload | null {
  const allSteps = getAllSteps(task.iaCompressed?.nextSteps);
  return allSteps.find(step => (step as any).planning?.planId === planId) || null;
}

function getInitialPlan(context: mls.msg.ExecutionContext): InitialNewSolutionPlanSummary {
  if (!context.task) throw new Error('[getInitialPlan] task invalid');

  const agentStep = getAgentStepByAgentName(context.task, 'agentNewSolution') as mls.msg.AIAgentStep | null;
  const payload = agentStep?.interaction?.payload?.[0] as mls.msg.AIFlexibleResultStep | undefined;
  const result = payload?.type === 'flexible' ? payload.result as InitialNewSolutionPlanSummary : undefined;

  if (!result || typeof result !== 'object') throw new Error('[getInitialPlan] initial plan not found');
  if (!result.userPrompt || typeof result.userPrompt !== 'string') throw new Error('[getInitialPlan] user prompt not found');

  return result;
}

function getExistingProjectFolders(): string[] {
  return Array.from(getExistingModuleFolders());
}

function buildHumanPrompt(initialPlan: InitialNewSolutionPlanSummary): string {
  return `## Initial user prompt
${initialPlan.userPrompt}

## Initial new solution plan
${JSON.stringify(initialPlan, null, 2)}
`;
}

    const systemPrompt = `
    <!-- modelType: codeinstruct -->

You are the first requirements clarification agent for the collab.codes "newModule" flow.

Generate the first simple clarification for the client.
Keep this clarification intentionally small. Do not ask about architecture, plugins, workflows, MDM, payments, or implementation details yet.

Use the same language as the user.
Every question must include a useful default answer in the "answer" field.

Always include one question about whether the user wants an initial metrics/dashboard for the MVP.
The question, labels and default answer must be written in the user's language (see userLanguage / "Use the same language as the user"). The meaning must be: "do you want basic operational metrics and an admin dashboard in the first version?" with a positive default.

Already existing modules:
{{folders}}

Return only valid JSON.

If the request is invalid for a module or solution, return:
{
  "type": "result",
  "result": "Short error message in the user's language"
}

For a valid request, return:
{
  "type": "clarification",
  "json": {
    "userLanguage": "ISO language code, such as pt-BR or en",
    "title": "Clarification 1/2",
    "userPrompt": "copy of the initial user prompt",
    "questions": {
      "languages": { "type": "open", "question": "", "answer": "" },
      "moduleName": { "type": "open", "question": "", "answer": "" },
      "roles": { "type": "open", "question": "", "answer": "" },
      "publicTarget": { "type": "open", "question": "", "answer": "" },
      "mainGoal": { "type": "open", "question": "", "answer": "" },
      "initialMetricsDashboard": {
        "type": "select",
        "question": "",
        "answer": "",
        "options": [
          { "id": "basic", "label": "" },
          { "id": "later", "label": "" },
          { "id": "none", "label": "" }
        ]
      },
      "visualStyle": { "type": "open", "question": "", "answer": "" },
      "openQuestion1": { "type": "open", "question": "", "answer": "" },
      "openQuestion2": { "type": "open", "question": "", "answer": "" }
    },
    "legends": [
      "Localized short note explaining this is the first clarification.",
      "Localized short note explaining that detailed planning comes later."
    ]
  }
}

## Output format
Return only valid JSON in the following structure:
[[OutputSection]]
`;

//#region OutputSection
export type Output = {
  type: 'clarification';
  json: RequirementsClarification;
} | {
  type: 'result';
  result: string;
};

export interface RequirementsClarification {
  userLanguage: string;
  title: string;
  userPrompt: string;
  questions: Record<string, RequirementsQuestion>;
  legends: string[];
}

export interface RequirementsQuestion {
  type: 'open' | 'select' | 'boolean' | 'MoSCoW' | 'range';
  question: string;
  answer: string | boolean;
  options?: {
    id: string;
    label: string;
  }[];
}
//#endregion

export interface RequirementsClarificationAnswer {
  title: string;
  userLanguage: string;
  answers: Record<string, string | boolean>;
}

type ImplementationDecisionPriority = 'now' | 'soon' | 'later' | 'never';

interface ImplementationDecisionClarification extends RequirementsClarification {
  questions: Record<string, RequirementsQuestion>;
}

export interface ImplementationDecisionItem {
  recommendationId: string;
  artifactType: ImplementationRecommendation['artifactType'];
  title: string;
  description: string;
  originalPriority: ImplementationDecisionPriority;
  defaultPriority: ImplementationDecisionPriority;
  decidedPriority: ImplementationDecisionPriority;
  accepted: boolean;
  requiresClientDecision: boolean;
  dependencies: string[];
  reason: string;
}

export interface ImplementationDecisionResult {
  title: string;
  userLanguage: string;
  sourceStepId: string;
  sourceSchemaVersion: string;
  decisions: ImplementationDecisionItem[];
  trace: string[];
}

interface InitialNewSolutionPlanSummary {
  userLanguage: string;
  requestKind: string;
  userPrompt: string;
  titles?: Record<string, string>;
  todoItems?: unknown[];
  openDetails?: unknown[];
}

export function getRequirementsClarificationAnswer(context: mls.msg.ExecutionContext): RequirementsClarificationAnswer {
  if (!context.task) throw new Error('[getRequirementsClarificationAnswer] task invalid');

  const requirementsStep = getAgentStepByAgentName(context.task, 'agentNewSolutionRequirements') as mls.msg.AIAgentStep | null;
  if (!requirementsStep) throw new Error('[getRequirementsClarificationAnswer] requirements step not found');

  const answerStep = (requirementsStep.nextSteps || []).find(step =>
    step.type === 'result' &&
    (step as any).planning?.planId === 'req-clarification-answer'
  ) as mls.msg.AIResultStep | undefined;

  if (!answerStep?.result) throw new Error('[getRequirementsClarificationAnswer] clarification answer not found');
  return JSON.parse(answerStep.result) as RequirementsClarificationAnswer;
}
