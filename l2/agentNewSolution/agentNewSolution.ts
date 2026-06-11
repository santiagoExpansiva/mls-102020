/// <mls fileReference="_102020_/l2/agentNewSolution/agentNewSolution.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { getAgentStepByAgentName } from '/_102027_/l2/aiAgentHelper.js';
import {
  getExistingModuleFolders,
  saveTraceMemorySeed,
} from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import {
  normalizeInitialPlan,
  PLAN_IDS,
  type InitialNewSolutionPlan,
  type NewSolutionPlanId,
} from '/_102020_/l2/agentNewSolution/agentNewSolutionPlan.js';

export { normalizeInitialPlan, PLAN_IDS };
export type { InitialNewSolutionPlan, NewSolutionPlanId };

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentNewSolution',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Initialize new module or solution planning',
    visibility: 'public',
    beforePromptImplicit,
    afterPromptStep,
  };
}

type PlannedExecutionMode = 'sequential' | 'parallel_static' | 'parallel_dynamic' | 'manual_later';
type PlannedExecutionHost = 'client' | 'server' | 'either';

type PlannedAIPayload = mls.msg.AIPayload & {
  planning: StepPlanning;
};

type PlannedAgentStep = mls.msg.AIAgentStep & {
  planning: StepPlanning;
};

type PlannedClarificationStep = mls.msg.AIClarificationStep & {
  planning: StepPlanning;
};

interface StepPlanning {
  planId: NewSolutionPlanId;
  dependsOn: NewSolutionPlanId[];
  executionMode: PlannedExecutionMode;
  executionHost: PlannedExecutionHost;
  dynamicSource?: {
    sourcePlanId: NewSolutionPlanId;
    selectorField: string;
    argsField: string;
  };
}

async function beforePromptImplicit(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  userPrompt: string,
): Promise<mls.msg.AgentIntent[]> {

  const normalizedPrompt = (userPrompt || '').trim();
  if (normalizedPrompt.length < 5) throw new Error('invalid prompt');

  const folders = Array.from(getExistingModuleFolders());

  const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
    type: 'add-message-ai',
    request: {
      action: 'addMessageAI',
      agentName: agent.agentName,
      inputAI: [{
        type: 'system',
        content: systemPrompt
          .replace('{{folders}}', folders.join(', '))
          .replace('{{planIds}}', PLAN_IDS.join(', '))
      }, {
        type: 'human',
        content: normalizedPrompt
      }],
      taskTitle: 'newModule',
      threadId: context.message.threadId,
      userMessage: context.message.content,
      longTermMemory: {
        taskName: 'newModule',
        flowName: 'newSolution',
        // trace policy flag (not sent to LLM — `_` prefix). All planning agents
        // consult it via shouldSaveTrace before writing trace files. Default true.
        ...saveTraceMemorySeed(),
      },
    }
  };

  return [addMessageAI];
}

async function afterPromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
): Promise<mls.msg.AgentIntent[]> {
  if (!agent || !context || !step) throw new Error(`[afterPromptStep] invalid params, agent:${!!agent}, context:${!!context}, step:${!!step}`);

  // this is the ROOT planning step. It has no resolvable parent step,
  // so a thrown error here is dropped by the generic orchestration handler (the step
  // stays waiting_after_prompt and the task fails with no visible reason). Catch any
  // failure and surface it as a failed update-status with the real reason in traceMsg.
  try {
    const payload = step.interaction?.payload?.[0] as Output | undefined;
    if (!payload) throw new Error(`[afterPromptStep] missing payload`);

    if (payload.type === 'result') {
      const reason = typeof payload.result === 'string' && payload.result.trim()
        ? payload.result.trim()
        : 'agentNewSolution returned an error result';
      return [createUpdateStatusIntent(context, parentStep, step, hookSequential, 'failed', reason)];
    }

    if (payload.type !== 'flexible' || !payload.result) throw new Error(`[afterPromptStep] invalid payload: ${JSON.stringify(payload)}`);

    const initialPlan = normalizeInitialPlan(payload.result, getExistingModuleFolders());
    // Tentative module name only (LLM suggestion / prompt default). The FINAL name is approved by
    // the user in the requirements clarification, where it is validated and the module artifacts are
    // reserved. Nothing is written to disk here (no reservation, no trace) — writing before the name
    // is final created premature/duplicate module folders. See agentNewSolutionRequirements.
    payload.result.moduleName = initialPlan.moduleName;

    const plannedSteps = buildPlannedTree(initialPlan);
    const addStepIntents: mls.msg.AgentIntentAddStep[] = plannedSteps.map((plannedStep) => ({
      type: 'add-step',
      messageId: context.message.orderAt,
      threadId: context.message.threadId,
      taskId: context.task?.PK || '',
      parentStepId: step.stepId,
      step: plannedStep,
    }));

    return addStepIntents;
  } catch (error) {
    const reason = `[agentNewSolution] ${error instanceof Error ? error.message : String(error)}`;
    return [createUpdateStatusIntent(context, parentStep, step, hookSequential, 'failed', reason)];
  }
}

function createUpdateStatusIntent(
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
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
    // The root step has no resolvable parent; intentUpdateStatus requires an agent
    // parent, and the root itself is an agent step, so fall back to self-parent.
    parentStepId: parentStep?.stepId ?? step.stepId,
    stepId: step.stepId,
    status,
    traceMsg,
  };
}

function buildPlannedTree(initialPlan: InitialNewSolutionPlan): PlannedAgentStep[] {
  const title = (planId: NewSolutionPlanId) => getLocalizedTitle(initialPlan, planId);

  const requirementsChildren: PlannedAIPayload[] = [
    plannedClarification('req-clarification-answer', title('req-clarification-answer'), ['org-requirements']),
    plannedAgent('req-discover-scope', 'agentDiscoverSolutionScope', title('req-discover-scope'), ['req-clarification-answer'], 'sequential'),
    plannedAgent('req-recommend-implementations', 'agentRecommendImplementations', title('req-recommend-implementations'), ['req-discover-scope'], 'sequential'),
    plannedClarification('req-implementation-decisions', title('req-implementation-decisions'), ['req-recommend-implementations']),
  ];

  const plannerChildren: PlannedAIPayload[] = [
    plannedAgent('plan-solution-blueprint', 'agentSolutionBlueprint', title('plan-solution-blueprint'), ['req-implementation-decisions'], 'sequential'),
    plannedAgent('plan-blueprint-review', 'agentBlueprintReview', title('plan-blueprint-review'), ['plan-solution-blueprint'], 'sequential'),
    plannedAgent('plan-finalize-solution-plan', 'agentFinalizeSolutionPlan', title('plan-finalize-solution-plan'), ['plan-blueprint-review'], 'sequential'),
    plannedAgent('plan-mdm', 'agentPlanMDM', title('plan-mdm'), ['plan-finalize-solution-plan'], 'parallel_static'),
    plannedAgent('plan-horizontals', 'agentPlanHorizontals', title('plan-horizontals'), ['plan-finalize-solution-plan'], 'parallel_static'),
    plannedAgent('plan-plugins', 'agentPlanPlugins', title('plan-plugins'), ['plan-finalize-solution-plan'], 'parallel_static'),
    plannedAgent('plan-persistence-index', 'agentPlanPersistenceIndex', title('plan-persistence-index'), ['plan-mdm', 'plan-horizontals', 'plan-plugins'], 'sequential'),
    plannedAgent('plan-table-definition', 'agentPlanTableDefinition', title('plan-table-definition'), ['plan-persistence-index'], 'parallel_dynamic', {
      sourcePlanId: 'plan-persistence-index',
      selectorField: 'tableId',
      argsField: 'tableId',
    }),
    // Indices depend on the previous INDEX, not on the previous DEFINITION: a definition step only
    // fleshes out detail (columns/hypertable) for its own artifact and produces nothing the next
    // index consumes (the index agents only read summaries already present in the prior index —
    // see the `void tableDefinitions` notes in agentPlanMetricsIndex/UsecaseEntities/PageIndex).
    // This lets each definition run in parallel with the downstream indices instead of blocking them.
    plannedAgent('plan-metrics-index', 'agentPlanMetricsIndex', title('plan-metrics-index'), ['plan-persistence-index'], 'sequential'),
    plannedAgent('plan-metric-table-definition', 'agentPlanMetricTableDefinition', title('plan-metric-table-definition'), ['plan-metrics-index'], 'parallel_dynamic', {
      sourcePlanId: 'plan-metrics-index',
      selectorField: 'metricTableId',
      argsField: 'metricTableId',
    }),
    plannedAgent('plan-usecase-entities', 'agentPlanUsecaseEntities', title('plan-usecase-entities'), ['plan-persistence-index', 'plan-metrics-index'], 'sequential'),
    // Heavy per-usecase command signatures run as a parallel fan-out AFTER the (light) usecase
    // index. Downstream index steps (workflow/page/agents) depend on the index, not on this, so
    // they proceed in parallel; only coverage waits for these definitions.
    plannedAgent('plan-usecase-definition', 'agentPlanUsecaseDefinition', title('plan-usecase-definition'), ['plan-usecase-entities'], 'parallel_dynamic', {
      sourcePlanId: 'plan-usecase-entities',
      selectorField: 'usecaseId',
      argsField: 'usecaseId',
    }),
    plannedAgent('plan-workflow-index', 'agentPlanWorkflowIndex', title('plan-workflow-index'), ['plan-usecase-entities'], 'sequential'),
    plannedAgent('plan-workflow-definition', 'agentPlanWorkflowDefinition', title('plan-workflow-definition'), ['plan-workflow-index'], 'parallel_dynamic', {
      sourcePlanId: 'plan-workflow-index',
      selectorField: 'workflowId',
      argsField: 'workflowId',
    }),
    plannedAgent('plan-agents', 'agentPlanAgents', title('plan-agents'), ['plan-plugins', 'plan-usecase-entities', 'plan-workflow-definition'], 'sequential'),
    plannedAgent('plan-page-index', 'agentPlanPageIndex', title('plan-page-index'), ['plan-metrics-index', 'plan-workflow-index', 'plan-agents'], 'sequential'),
    plannedAgent('plan-page-definition', 'agentPlanPageDefinition', title('plan-page-definition'), ['plan-page-index'], 'parallel_dynamic', {
      sourcePlanId: 'plan-page-index',
      selectorField: 'pageId',
      argsField: 'pageId',
    }),
    plannedAgent('plan-validate-solution-coverage', 'agentValidateSolutionCoverage', title('plan-validate-solution-coverage'), ['plan-mdm', 'plan-horizontals', 'plan-plugins', 'plan-persistence-index', 'plan-table-definition', 'plan-metrics-index', 'plan-metric-table-definition', 'plan-usecase-entities', 'plan-usecase-definition', 'plan-workflow-definition', 'plan-agents', 'plan-page-definition'], 'sequential'),
  ];

  // The former materialization step is now the "Final data" (Dados finais) resume screen:
  // a no-LLM wrapper agent (agentNewSolutionFinal) whose child clarification step renders the
  // self-sufficient resume web component. Real materialization is deferred to a "next step".
  const finalChildren: PlannedAIPayload[] = [
    plannedClarification('final-resume', title('final-resume'), ['org-materialization']),
  ];

  return [
    plannedAgent('org-requirements', 'agentNewSolutionRequirements', title('org-requirements'), [], 'sequential', undefined, requirementsChildren, 'waiting_human_input'),
    plannedAgent('org-planner', 'agentNewSolutionPlanner', title('org-planner'), ['org-requirements'], 'sequential', undefined, plannerChildren),
    plannedAgent('org-materialization', 'agentNewSolutionFinal', title('org-materialization'), ['plan-validate-solution-coverage'], 'sequential', undefined, finalChildren),
  ];
}

function plannedAgent(
  planId: NewSolutionPlanId,
  agentName: string,
  stepTitle: string,
  dependsOn: NewSolutionPlanId[],
  executionMode: PlannedExecutionMode,
  dynamicSource?: StepPlanning['dynamicSource'],
  nextSteps: PlannedAIPayload[] = [],
  status: mls.msg.AIStepStatus = 'waiting_dependency',
): PlannedAgentStep {
  return {
    type: 'agent',
    stepId: 0,
    interaction: null,
    stepTitle,
    status,
    nextSteps,
    agentName,
    prompt: JSON.stringify({ planId }),
    rags: [],
    planning: {
      planId,
      dependsOn,
      executionMode,
      executionHost: 'client',
      dynamicSource,
    },
  };
}

function plannedClarification(
  planId: NewSolutionPlanId,
  stepTitle: string,
  dependsOn: NewSolutionPlanId[],
): PlannedClarificationStep {
  return {
    type: 'clarification',
    stepId: 0,
    interaction: null,
    stepTitle,
    status: 'waiting_dependency',
    nextSteps: [],
    json: JSON.stringify({ planId }),
    planning: {
      planId,
      dependsOn,
      executionMode: 'sequential',
      executionHost: 'client',
    },
  };
}

// System steps whose title must be fixed (never the LLM-generated one), so their names stay stable.
const FORCED_TITLE_PLAN_IDS = new Set<NewSolutionPlanId>(['org-materialization', 'final-resume']);

function getLocalizedTitle(initialPlan: InitialNewSolutionPlan, planId: NewSolutionPlanId): string {
  if (!FORCED_TITLE_PLAN_IDS.has(planId)) {
    const title = initialPlan.titles?.[planId];
    if (typeof title === 'string' && title.trim().length > 0 && title.trim().length < 140) {
      return title.trim();
    }
  }
  const lang = (initialPlan.userLanguage || '').toLowerCase().trim();
  const fallback = lang.startsWith('pt') ? fallbackTitlesPt : fallbackTitlesEn;
  return fallback[planId];
}

const fallbackTitlesEn: Record<NewSolutionPlanId, string> = {
  'org-requirements': 'Requirements',
  'org-planner': 'Planner',
  'org-materialization': 'Reviewing plan',
  'req-discover-scope': 'Discover solution scope',
  'req-clarification-answer': 'Answer initial clarification',
  'req-recommend-implementations': 'Recommend implementations',
  'req-implementation-decisions': 'Confirm implementation decisions',
  'plan-solution-blueprint': 'Create solution blueprint',
  'plan-blueprint-review': 'Review blueprint',
  'plan-finalize-solution-plan': 'Finalize solution plan',
  'plan-mdm': 'Plan MDM',
  'plan-horizontals': 'Plan horizontal modules',
  'plan-plugins': 'Plan plugins',
  'plan-persistence-index': 'Plan persistence index',
  'plan-table-definition': 'Plan table definitions',
  'plan-metrics-index': 'Plan metrics index',
  'plan-metric-table-definition': 'Plan metric table definitions',
  'plan-usecase-entities': 'Plan usecase entities',
  'plan-usecase-definition': 'Plan usecase definitions',
  'plan-workflow-index': 'Plan workflow index',
  'plan-workflow-definition': 'Plan workflow definitions',
  'plan-agents': 'Plan operational agents',
  'plan-page-index': 'Plan page index',
  'plan-page-definition': 'Plan page definitions',
  'plan-validate-solution-coverage': 'Validate solution coverage',
  'final-resume': 'Final planning summary',
};

const fallbackTitlesPt: Record<NewSolutionPlanId, string> = {
  'org-requirements': 'Requisitos',
  'org-planner': 'Planner',
  'org-materialization': 'Revendo plano',
  'req-discover-scope': 'Descobrir escopo da solucao',
  'req-clarification-answer': 'Responder clarificacao inicial',
  'req-recommend-implementations': 'Recomendar implementacoes',
  'req-implementation-decisions': 'Confirmar decisoes de implementacao',
  'plan-solution-blueprint': 'Criar blueprint da solucao',
  'plan-blueprint-review': 'Revisar blueprint',
  'plan-finalize-solution-plan': 'Finalizar plano da solucao',
  'plan-mdm': 'Planejar MDM',
  'plan-horizontals': 'Planejar modulos horizontais',
  'plan-plugins': 'Planejar plugins',
  'plan-persistence-index': 'Planejar indice de persistencia',
  'plan-table-definition': 'Planejar definicoes de tabelas',
  'plan-metrics-index': 'Planejar indice de metricas',
  'plan-metric-table-definition': 'Planejar definicoes de tabelas de metricas',
  'plan-usecase-entities': 'Planejar entidades e casos de uso',
  'plan-usecase-definition': 'Planejar definicoes de casos de uso',
  'plan-workflow-index': 'Planejar indice de workflows',
  'plan-workflow-definition': 'Planejar definicoes de workflows',
  'plan-agents': 'Planejar agentes operacionais',
  'plan-page-index': 'Planejar indice de paginas',
  'plan-page-definition': 'Planejar definicoes de paginas',
  'plan-validate-solution-coverage': 'Validar cobertura da solucao',
  'final-resume': 'Resumo final do planejamento',
};

const systemPrompt = `
<!-- modelType: codepro -->

You initialize the collab.codes "newModule" task.

Analyze the user's prompt and decide whether it is a request to create a module or a solution.
Use the same language as the user for all user-facing titles, todo descriptions, and open details.

If the prompt is not about creating a module or solution, return only:
{
  "type": "result",
  "result": "A short error message in the user's language"
}

If the prompt is valid, return only:
{
  "type": "flexible",
  "result": {
    "userLanguage": "ISO language code, such as pt-BR or en",
    "requestKind": "module | solution | module_solution",
    "moduleName": "short unused folder name for the module, lower camel case, for example petshop",
    "userPrompt": "copy of the user prompt",
    "titles": {
      "plan id from the list": "localized user-facing title"
    },
    "todoItems": [
      {
        "planId": "plan id from the list",
        "done": false,
        "title": "localized short title",
        "description": "localized implementation note"
      }
    ],
    "openDetails": [
      {
        "title": "localized detail title",
        "description": "localized question or decision still open"
      }
    ]
  }
}

Rules:
- Return valid JSON only.
- The titles object must include every plan id listed below.
- Choose a concise moduleName that can be used as l2/{moduleName}; it must be lower camel case, ASCII, and not in Already existing modules.
- Do not invent agent names, dependencies, selectors, or execution rules. Code owns those.
- Do not hard-code fixture examples (e.g. specific table names, page ids, or domain entities from any previous test case). Derive everything from the current user prompt, clarifications, and approved artifacts.
- Every todo item must have done=false.
- The flow runs client-side for now.

Already existing modules:
{{folders}}

Plan ids:
{{planIds}}

## Output format
Return only valid JSON in the following structure:
[[OutputSection]]
`;

//#region OutputSection
export type Output =
  {
    type: 'flexible';
    result: InitialNewSolutionPlan;
  } | {
    type: 'result';
    result: string;
  };

//#endregion

export function getInitialNewSolutionPlan(agent: IAgentMeta, context: mls.msg.ExecutionContext): InitialNewSolutionPlan {
  if (!agent || !context || !context.task) throw new Error(`[${agent.agentName}](getInitialNewSolutionPlan) Invalid context or agent`);
  const agentStep = getAgentStepByAgentName(context.task, agent.agentName);
  if (!agentStep) throw new Error(`[${agent.agentName}](getInitialNewSolutionPlan) no agent found`);

  const resultStep = agentStep.interaction?.payload?.[0];
  if (!resultStep || resultStep.type !== 'flexible' || !(resultStep as mls.msg.AIFlexibleResultStep).result) {
    throw new Error(`[${agent.agentName}](getInitialNewSolutionPlan) No flexible payload found for this agent.`);
  }

  return normalizeInitialPlan(
    (resultStep as mls.msg.AIFlexibleResultStep).result as InitialNewSolutionPlan,
    getExistingModuleFolders(),
  );
}
