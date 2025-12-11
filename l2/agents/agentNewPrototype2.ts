/// <mls shortName="agentNewPrototype2" project="102020" enhancement="_blank" folder="agents" />

import { IAgent, svg_agent } from '/_100554_/l2/aiAgentBase.js';
import { getPromptByHtml } from '/_100554_/l2/aiPrompts.js';
import { getPayload1, PayLoad1 } from '/_102020_/l2/agents/agentNewPrototype.js';

import {
    getNextPendingStepByAgentName,
    getStepById,
    getNextStepIdAvaliable,
    getAgentStepByAgentName,
    notifyTaskChange,
    getNextInProgressStepByAgentName,
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

const agentName = "agentNewPrototype2";
const project = 102020;

export function createAgent(): IAgent {
    return {
        agentName,
        avatar_url: svg_agent,
        agentDescription: "Agent for create a new Module - 2",
        visibility: "private",
        async beforePrompt(context: mls.msg.ExecutionContext): Promise<void> {
            return _beforePrompt(context);
        },
        async afterPrompt(context: mls.msg.ExecutionContext): Promise<void> {
            return _afterPrompt(context);
        },
        async replayForSupport(context: mls.msg.ExecutionContext, payload: mls.msg.AIPayload[]): Promise<void> {
            return _replayForSupport(context, payload);
        },
        async beforeClarification(context: mls.msg.ExecutionContext, stepId: number): Promise<HTMLDivElement | null> {
            return _beforeClarification(context, stepId);
        },
        async afterClarification(context: mls.msg.ExecutionContext, stepId: number, clarification: ClarificationValue): Promise<void> {
            return _afterClarification(context, stepId, clarification);
        }
    };
}

interface DataForPrompt {
    clarification: any,
    userPrompt: string
}

const _beforePrompt = async (context: mls.msg.ExecutionContext): Promise<void> => {
    const taskTitle = "Planning 2...";
    if (!context || !context.message) throw new Error(`[${agentName}](_beforePrompt) Invalid context`);

    if (!context.task) {
        // use mock
        const inputs: any = await getPrompts(getPayload1Mock());
        await startNewAiTask(agentName, taskTitle, context.message.content, context.message.threadId, context.message.senderId, inputs, context, _afterPrompt);
        return;
    }

    const step: mls.msg.AIAgentStep | null = getNextPendingStepByAgentName(context.task, agentName);
    if (!step) {
        throw new Error(`[${agentName}](beforePrompt) No pending step found for this agent.`);
    }
    // context.task = await updateStepStatus(context.task, step.stepId, "in_progress");
    // don't need updateStepStatus, addInteractionAiTask put this task in 'in_process'
    const inputs = await getPrompts(getPayload1(context));
    await startNewInteractionInAiTask(agentName, taskTitle, inputs, context, _afterPrompt, step.stepId);
}

const _afterPrompt = async (context: mls.msg.ExecutionContext): Promise<void> => {
    if (!context || !context.message || !context.task) throw new Error(`[${agentName}](_afterPrompt) Invalid context`);
    const step: mls.msg.AIAgentStep | null = getNextInProgressStepByAgentName(context.task, agentName);
    if (!step) throw new Error(`[${agentName}](afterPrompt) No in progress interaction found.`);
    context = await updateStepStatus(context, step.stepId, "completed");
    if (context.task) context.task = await updateTaskTitle(context.task, "Waiting for user");

    notifyTaskChange(context);
    await executeNextStep(context);
}

const _replayForSupport = async (context: mls.msg.ExecutionContext, payload: mls.msg.AIPayload[]): Promise<void> => {
    throw new Error("[replayForSupport] not implemented");
}

const _beforeClarification = async (context: mls.msg.ExecutionContext, stepId: number): Promise<HTMLDivElement | null> => {
    const projectStart = context.task?.iaCompressed?.longMemory['project'];
    if (mls.actualProject?.toString() !== projectStart) {
        const div = document.createElement('div');
        div.innerHTML = 'This task may only be continued on project: ' + projectStart;
        return div;
    }
    return startClarification(context, stepId);
}

const _afterClarification = async (context: mls.msg.ExecutionContext, stepId: number, clarification: ClarificationValue): Promise<void> => {
    if (!context || !context.message || !context.task) throw new Error(`[${agentName}](afterClarification) Invalid context`);
    if (!clarification) throw new Error(`[${agentName}](afterClarification) Invalid json after clarification`);

    const step: mls.msg.AIPayload | null = getStepById(context.task, stepId);
    if (!step || step.type !== "clarification") {
        throw new Error(`[${agentName}](afterClarification) No found step: ${stepId} for this agent.`);
    }

    const newStep: mls.msg.AIPayload = {
        type: 'agent',
        agentName: 'agentGeneratePrototype3',
        status: 'pending',
        prompt: "...",
        stepId: getNextStepIdAvaliable(context.task),
        interaction: null,
        nextSteps: null,
        rags: null
    }
    // complete this step (payload) and push another step
    await addNewStep(context, step.stepId, [newStep], "Waiting ...");
}

async function getPrompts(payload1: PayLoad1): Promise<mls.msg.IAMessageInputType[]> {
    if (!payload1 || !payload1.title || !payload1.userPrompt) throw new Error(`Erro [${agentName}](getPrompts) invalid payload1`);
    const data: Record<string, string> = {
        userPrompt: payload1.userPrompt,
        resumeClarification: JSON.stringify({
            title: payload1.title,
            userLanguage: payload1.userLanguage,
            questions: payload1.questions
        }, null, 2)
    }
    return await getPromptByHtml({ project, shortName: agentName, folder: 'agents', data })
}

function getPayload1Mock(): PayLoad1 {
    return {
        userPrompt: "criar um web site para petshop",
        userLanguage: "pt-BR",
        title: "Esclarecimento 1/2",
        questions: {
            roles: {
                type: "open",
                question: "Quais papéis de usuário o site deve ter? (ex: administrador, cliente, funcionário)",
                answer: "Administrador e cliente"
            },
            publicTarget: {
                type: "open",
                question: "Qual é o público-alvo principal do site? (ex: donos de pets, veterinários, fornecedores)",
                answer: "Donos de pets"
            },
            tone: {
                type: "open",
                question: "Qual tom o site deve transmitir? (ex: amigável, profissional, descontraído)",
                answer: "Amigável e profissional"
            },
            languages: {
                type: "open",
                question: "O site deve ser multilíngue? Se sim, quais idiomas?",
                answer: "Apenas português"
            },
            openQuestion1: {
                type: "open",
                question: "Quais funcionalidades principais o site deve ter? (ex: agendamento, loja online, blog)",
                answer: "Agendamento de serviços e loja online"
            },
            openQuestion2: {
                type: "open",
                question: "Você já possui conteúdo e imagens para o site ou precisa que sejam criados?",
                answer: "Preciso que sejam criados"
            },
            openQuestion3: {
                type: "open",
                question: "Há alguma referência de design ou sites que você gostaria que fossem usados como inspiração?",
                answer: "Sim, sites modernos e limpos"
            }
        },
        legends: [
            "Este é o primeiro esclarecimento",
            "antes de criar algo"
        ]
    }
}

export function getPayload2(context: mls.msg.ExecutionContext): PayLoad2 {
    if (!context || !context.task) throw new Error(`[${agentName}] [getPayload] Invalid context`);
    const agentStep = getAgentStepByAgentName(context.task, agentName); // Only one agent execution must exist in this task
    if (!agentStep) throw new Error(`[${agentName}] [getPayload] no agent found`);

    // get result
    const resultStep = agentStep.interaction?.payload?.[0];
    if (!resultStep || resultStep.type !== "clarification" || !resultStep.json) throw new Error(`[${agentName}] [getPayload] No step clarification found for this agent.`);
    let payload2: PayLoad2 | string = resultStep.json;
    if (typeof payload2 === "string") payload2 = JSON.parse(payload2) as PayLoad2;
    return payload2;
}

export interface PayLoad2 {
    userLanguage: string;
    executionRegions: string[];
    title: string;
    moduleDetails: {
        userPrompt: string;
        goal: string;
        requirements: string[];
    },
    analysisResult: {
        essentialProblems: string[];
    },
    questions: Record<string, OpenQuestion | QuestionMoSCoW>;
    legends: string[];
}
export interface OpenQuestion {
    type: "open";
    question: string;
    answer: string;
}
export interface QuestionMoSCoW {
    type: "MoSCoW";
    question: string;
    answer: "must" | "should" | "could" | "won't";
}