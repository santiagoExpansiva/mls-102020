/// <mls fileReference="_102020_/l2/agentNewSolution/agentNewSolutionRequirements.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { getAgentStepByAgentName, getAllSteps, notifyTaskChange } from '/_102027_/l2/aiAgentHelper.js';

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
    return [createUpdateStatusIntent(context, parentStep, step, hookSequential, 'failed')];
  }

  if (payload.type !== 'clarification' || !payload.json) {
    throw new Error(`[afterPromptStep] invalid payload: ${JSON.stringify(payload)}`);
  }

  return [];
}

async function beforeClarificationStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIClarificationStep,
  hookSequential: number,
  json: RequirementsClarification,
): Promise<HTMLElement> {
  if (!context.task) throw new Error(`[beforeClarificationStep] invalid task: undefined`);

  await import('/_100554_/l2/widgetQuestionsForClarification.js');

  const div = document.createElement('div');
  const clariEl = document.createElement('widget-questions-for-clarification-100554');

  (clariEl as any).value = {
    taskId: context.task.PK,
    stepId: step.stepId,
    title: json.title,
    legends: json.legends || [],
    userLanguage: json.userLanguage || '',
    questions: json.questions,
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

  const status: mls.msg.AIStepStatus = action === 'continue' ? 'completed' : 'failed';
  const intents: mls.msg.AgentIntent[] = [
    createUpdateStatusIntent(context, parentStep, step, hookSequential, status),
  ];

  if (action === 'continue') {
    const answerResult = normalizeClarificationAnswer(value);
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
  const hasHookToContinue = action === 'continue' && queueFrontEnd.some(hook => hook.type !== 'pooling');

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

function createUpdateStatusIntent(
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIPayload,
  hookSequential: number,
  status: mls.msg.AIStepStatus,
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
  };
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
  return Array.from(new Set(
    Object.values(mls.stor.files)
      .filter(f => f.project === mls.actualProject && f.level !== 3 && f.folder)
      .map(f => f.folder)
  ));
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

Always include one question about whether the user wants an initial metrics/dashboard.
For Portuguese, this question should be equivalent to "Deseja metricas/dashboard inicial?".
The default answer should be equivalent to "Sim, metricas basicas operacionais".

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
