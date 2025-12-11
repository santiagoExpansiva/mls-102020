/// <mls shortName="agentNewPrototype" project="102020" enhancement="_100554_enhancementLit" folder="agents" />

import { html, TemplateResult } from 'lit';
import { IAgent, svg_agent } from '/_100554_/l2/aiAgentBase.js';
import { getPromptByHtml } from '/_100554_/l2/aiPrompts.js';
import '/_100554_/l2/widgetQuestionsForClarification.js';
import '/_102020_/l2/agents/agentNewPrototypeFeedback.js';

import {
    getNextPendingStepByAgentName,
    getNextInProgressStepByAgentName,
    getAgentStepByAgentName,
    getNextStepIdAvaliable,
    getInteractionStepId,
    getStepById,
    notifyTaskChange,
    updateStepStatus,
    updateTaskTitle
} from "/_100554_/l2/aiAgentHelper.js";

import {
    startNewInteractionInAiTask,
    startNewAiTask,
    executeNextStep,
    addNewStep,
    ClarificationValue,
    startClarification
} from "/_100554_/l2/aiAgentOrchestration.js";

const agentName = "agentNewPrototype";
const project = 102020;

export function createAgent(): IAgent {
    return {
        agentName,
        avatar_url: svg_agent,
        agentDescription: "Agent for create a new Module",
        visibility: "public",
        async beforePrompt(context: mls.msg.ExecutionContext): Promise<void> {
            return _beforePrompt(context);
        },
        async afterPrompt(context: mls.msg.ExecutionContext): Promise<void> {
            return _afterPrompt(context);
        },
        async beforeClarification(context: mls.msg.ExecutionContext, stepId: number, readOnly: boolean): Promise<HTMLDivElement | null> {
            return _beforeClarification(context, stepId, readOnly);
        },
        async afterClarification(context: mls.msg.ExecutionContext, stepId: number, clarification: ClarificationValue): Promise<void> {
            return _afterClarification(context, stepId, clarification);
        },
        async getFeedBack(task: mls.msg.TaskData): Promise<TemplateResult> {
            return _getFeedBack(task);
        }

    };
}

const _beforePrompt = async (context: mls.msg.ExecutionContext): Promise<void> => {
    const taskTitle = "Planning...";
    if (!context || !context.message) throw new Error(`[${agentName}](_beforePrompt) Invalid context`);

    if (!context.task) {
        const inputs: any = await getPrompts(context.message.content || getPromptMock());
        //const inputs: any = await getPrompts(getPromptMock());
        await startNewAiTask(agentName, taskTitle, context.message.content, context.message.threadId, context.message.senderId, inputs, context, _afterPrompt, { "project": mls.actualProject?.toString() || '0' });
        return;
    }
    const step: mls.msg.AIAgentStep | null = getNextPendingStepByAgentName(context.task, agentName);
    if (!step) throw new Error(`[${agentName}](beforePrompt) No pending step found for this agent.`);

    if (!step.prompt) throw new Error(`[${agentName}](beforePrompt) No prompt found in step for this agent.`);
    const inputs = await getPrompts(step.prompt);
    await startNewInteractionInAiTask(agentName, taskTitle, inputs, context, _afterPrompt, step.stepId);
}

const _afterPrompt = async (context: mls.msg.ExecutionContext): Promise<void> => {
    if (!context || !context.message || !context.task) throw new Error(`[${agentName}](afterPrompt) Invalid context`);
    const step: mls.msg.AIAgentStep | null = getNextInProgressStepByAgentName(context.task, agentName);
    if (!step) throw new Error(`[${agentName}](afterPrompt) No in progress interaction found.`);
    context = await updateStepStatus(context, step.stepId, "completed");
    if (context.task) context.task = await updateTaskTitle(context.task, "Waiting for user");
    notifyTaskChange(context);
    await executeNextStep(context);
}

const _getFeedBack = async (task: mls.msg.TaskData): Promise<TemplateResult> => {
    if (!task) throw new Error(`[${agentName}](getFeedBack) Invalid task`);
    return html`<agents--agent-new-prototype-feedback-102020 .task=${task}></agents--agent-new-prototype-feedback-102020>`
}

const _beforeClarification = async (context: mls.msg.ExecutionContext, stepId: number, readOnly: boolean): Promise<HTMLDivElement | null> => {
    const projectStart = context.task?.iaCompressed?.longMemory['project'];
    if (mls.actualProject?.toString() !== projectStart) {
        const div = document.createElement('div');
        div.innerHTML = 'This task may only be continued on project: ' + projectStart;
        return div;
    }
    return startClarification(context, stepId, readOnly);
}

const _afterClarification = async (context: mls.msg.ExecutionContext, stepId: number, clarification: ClarificationValue): Promise<void> => {
    // only execute after button 'continue'
    if (!context || !context.message || !context.task) throw new Error(`[${agentName}](afterClarification) Invalid context`);
    if (!clarification) throw new Error(`[${agentName}](afterClarification) Invalid json after clarification`);

    const newStep: mls.msg.AIPayload = {
        type: 'agent',
        agentName: `${agentName}2`,
        prompt: '...',
        status: 'pending',
        stepId: getNextStepIdAvaliable(context.task),
        interaction: null,
        nextSteps: null,
        rags: null
    }
    // complete this step (payload) and push another step
    await addNewStep(context, stepId, [newStep], "Waiting ...");
}

async function getPrompts(userPrompt: string): Promise<mls.msg.IAMessageInputType[]> {
    if (!userPrompt) throw new Error(`Erro [${agentName}](getPrompts) invalid userPrompt`);
    const dataForReplace = {
        userPrompt
    }
    const prompts = await getPromptByHtml({ project, shortName: agentName, folder: 'agents', data: dataForReplace })
    return prompts;
}

function getPromptMock(): string {
    return "criar site petshop";
}

export function getPayload1(context: mls.msg.ExecutionContext): PayLoad1 {
    if (!context || !context.task) throw new Error(`[${agentName}](getPayload1) Invalid context`);
    const agentStep = getAgentStepByAgentName(context.task, agentName); // Only one agent execution must exist in this task
    if (!agentStep) throw new Error(`[${agentName}](getPayload1) no agent found`);

    // get result
    const resultStep = agentStep.interaction?.payload?.[0];
    if (!resultStep || resultStep.type !== "clarification" || !resultStep.json) throw new Error(`[${agentName}] [getPayload] No step clarification found for this agent.`);
    let payload1: PayLoad1 | string = resultStep.json;
    if (typeof payload1 === "string") payload1 = JSON.parse(payload1) as PayLoad1;

    // get userPrompt
    payload1.userPrompt = agentStep?.interaction?.input.find((input) => input.type === 'human')?.content || '';

    return payload1;
}

export interface PayLoad1 {
    userPrompt: string;
    userLanguage: string;
    title: string;
    questions: Record<string, Question>;
    legends: string[];
}
export interface Question {
    type: "open";
    question: string;
    answer: string;
}