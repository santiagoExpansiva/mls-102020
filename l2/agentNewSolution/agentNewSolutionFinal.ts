/// <mls fileReference="_102020_/l2/agentNewSolution/agentNewSolutionFinal.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { getAgentStepByAgentName } from '/_102027_/l2/aiAgentHelper.js';
import { normalizeModuleFolderName } from '/_102020_/l2/agentNewSolution/agentNewSolutionPlan.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentNewSolutionFinal',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Final "Dados finais" resume screen for the new solution flow',
    visibility: 'private',
    beforePromptStep,
    beforeClarificationStep,
  };
}

// No-LLM wrapper, same pattern as agentNewSolutionPlanner: completing this agent step makes its
// child clarification step ("Dados finais") eligible to render the resume screen.
async function beforePromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
): Promise<mls.msg.AgentIntent[]> {
  if (!agent || !context || !parentStep || !step) throw new Error('[agentNewSolutionFinal](beforePromptStep) invalid params');
  if (!context.task) throw new Error('[agentNewSolutionFinal](beforePromptStep) task invalid');

  const updateStatus: mls.msg.AgentIntentUpdateStatus = {
    type: 'update-status',
    hookSequential,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task.PK,
    parentStepId: parentStep.stepId,
    stepId: step.stepId,
    status: 'completed',
  };

  return [updateStatus];
}

// The screen is a self-sufficient web component (it reads process.defs.ts / health report on its
// own and drives "Encerrar" via msgApplyIntents). This hook only mounts it and hands over the
// minimal context the component needs to resolve position, finish the step and open next tasks.
async function beforeClarificationStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIClarificationStep,
  hookSequential: number,
  _json: unknown,
): Promise<HTMLElement> {
  if (!context.task) throw new Error('[agentNewSolutionFinal](beforeClarificationStep) invalid task');

  await import('/_102020_/l2/agentNewSolution/widgetNewSolutionResume.js');

  const div = document.createElement('div');
  const el = document.createElement('widget-new-solution-resume-102020');

  (el as unknown as { value: unknown }).value = {
    taskId: context.task.PK,
    moduleId: getModuleId(context),
    stepId: step.stepId,
    parentStepId: parentStep.stepId,
    hookSequential,
    senderId: context.message.senderId,
    threadId: context.message.threadId,
    messageId: context.message.orderAt,
  };

  div.appendChild(el);
  return div;
}

function getModuleId(context: mls.msg.ExecutionContext): string {
  if (!context.task) return 'module';
  const rootStep = getAgentStepByAgentName(context.task, 'agentNewSolution') as mls.msg.AIAgentStep | null;
  const payload = rootStep?.interaction?.payload?.[0] as mls.msg.AIFlexibleResultStep | undefined;
  const result = payload?.type === 'flexible' && payload.result && typeof payload.result === 'object'
    ? (payload.result as Record<string, unknown>)
    : undefined;
  const moduleName = typeof result?.moduleName === 'string' ? result.moduleName : '';
  return normalizeModuleFolderName(moduleName, 'module');
}
