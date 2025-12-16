/// <mls shortName="agentNewPrototype3" project="102020" enhancement="_blank" folder="agents" />

import { IAgent, svg_agent } from '/_100554_/l2/aiAgentBase.js';
import { getPromptByHtml } from '/_100554_/l2/aiPrompts.js';
import { getPayload2, PayLoad2 } from '/_102020_/l2/agents/agentNewPrototype2.js';

import {
    getNextPendingStepByAgentName,
    getNextInProgressStepByAgentName,
    getAgentStepByAgentName,
    notifyTaskChange,
    updateTaskTitle,
    updateStepStatus,
    getNextPendentStep
} from "/_100554_/l2/aiAgentHelper.js";

import {
    startNewInteractionInAiTask,
    startNewAiTask,
    addNewStep,
    ClarificationQuestions,
} from "/_100554_/l2/aiAgentOrchestration.js";

const agentName = "agentNewPrototype3";
const project = 102020;

export function createAgent(): IAgent {
    return {
        agentName,
        avatar_url: svg_agent,
        agentDescription: "Agent for create a new Module - 3",
        visibility: "private",
        async beforePrompt(context: mls.msg.ExecutionContext): Promise<void> {
            return _beforePrompt(context);
        },
        async afterPrompt(context: mls.msg.ExecutionContext): Promise<void> {
            return _afterPrompt(context);
        },
        async replayForSupport(context: mls.msg.ExecutionContext, payload: mls.msg.AIPayload[]): Promise<void> {
            return _replayForSupport(context, payload);
        }
    };
}

const _beforePrompt = async (context: mls.msg.ExecutionContext): Promise<void> => {
    const taskTitle = "Planning 3...";
    if (!context || !context.message) throw new Error(`[${agentName}](_beforePrompt) Invalid context`);

    if (!context.task) {
        // use mock
        const inputs: any = await getPrompts(getPayload2Mock());
        await startNewAiTask(agentName, taskTitle, context.message.content, context.message.threadId, context.message.senderId, inputs, context, _afterPrompt);
        return;
    }

    const step: mls.msg.AIAgentStep | null = getNextPendingStepByAgentName(context.task, agentName);
    if (!step) {
        throw new Error(`[${agentName}](beforePrompt) No pending step found for this agent.`);
    }
    const inputs = await getPrompts(getPayload2(context));
    await startNewInteractionInAiTask(agentName, taskTitle, inputs, context, _afterPrompt, step.stepId);
}

const _afterPrompt = async (context: mls.msg.ExecutionContext): Promise<void> => {
    if (!context || !context.message || !context.task) throw new Error(`[${agentName}](afterPrompt) Invalid context`);
    const step: mls.msg.AIAgentStep | null = getNextInProgressStepByAgentName(context.task, agentName);
    if (!step) throw new Error(`[${agentName}](afterPrompt) No in progress interaction found.`);
    context = await updateStepStatus(context, step.stepId, "completed", "no more agents");
    notifyTaskChange(context);
    // await createFiles(context);
    if (!context.task) throw new Error(`[${agentName}](afterPrompt) Invalid context task`);
    context.task = await updateTaskTitle(context.task, "Ok, see mind map");

    const stepPendent = getNextPendentStep(context.task);
    if (!stepPendent) throw new Error(`[${agentName}](afterPrompt) Invalid next stepPendent`);

    const newStep: mls.msg.AIPayload = {
        agentName: 'agentNewPrototype4',
        prompt: '0',
        status: 'pending',
        stepId: stepPendent.stepId + 1,
        interaction: null,
        nextSteps: null,
        rags: null,
        type: 'agent'
    }
    await addNewStep(context, stepPendent.stepId, [newStep]);

}


const _replayForSupport = async (context: mls.msg.ExecutionContext, payload: mls.msg.AIPayload[]): Promise<void> => {
    throw new Error("[replayForSupport] not implemented");
}

async function getPrompts(payload2: PayLoad2): Promise<mls.msg.IAMessageInputType[]> {
    if (!payload2 || !payload2.moduleDetails.userPrompt) throw new Error(`Erro [${agentName}] getPrompts: invalid userPrompt`);

    const data: Record<string, string> = {
        userPrompt: payload2.moduleDetails.userPrompt,
        resumeClarification: JSON.stringify({
            title: payload2.title,
            userLanguage: payload2.userLanguage,
            executionRegions: payload2.executionRegions,
            questions: payload2.questions,
            moduleDetails: {
                goal: payload2.moduleDetails.goal,
                requirements: payload2.moduleDetails.requirements
            }
        }, null, 2),
    }

    const prompts = await getPromptByHtml({ project, shortName: agentName, folder: 'agents', data })
    return prompts;
}

function getPayload2Mock(): PayLoad2 {
    return {
        userLanguage: "pt-BR",
        executionRegions: ["BR"],
        title: "Esclarecimento 2/2",
        moduleDetails: {
            userPrompt: "criar um web site para petshop",
            goal: "Desenvolver um website completo para petshop com funcionalidades de agendamento de serviços e loja online, direcionado para donos de pets, com tom amigável e profissional",
            requirements: [
                "Website para petshop com público-alvo donos de pets",
                "Dois papéis de usuário: administrador e cliente",
                "Tom amigável e profissional",
                "Idioma: apenas português",
                "Funcionalidades principais: agendamento de serviços e loja online",
                "Criação de conteúdo e imagens necessária",
                "Design moderno e limpo como referência"
            ]
        },
        analysisResult: {
            essentialProblems: [
                "Não foram especificados quais tipos de serviços serão oferecidos (banho, tosa, consulta veterinária, etc.)",
                "Falta definição dos produtos que serão vendidos na loja online",
                "Não há especificação sobre sistema de pagamento e métodos aceitos",
                "Ausência de definição sobre gestão de estoque para a loja online",
                "Não foram definidos os fluxos de trabalho para agendamentos (confirmação, cancelamento, reagendamento)"
            ]
        },
        questions: {
            servicesOffered: {
                type: "open",
                question: "Quais serviços específicos o petshop oferece? (ex: banho, tosa, consulta veterinária, vacinação, hospedagem)",
                answer: "Banho, tosa, consulta veterinária e vacinação"
            },
            productsCategories: {
                type: "open",
                question: "Quais categorias de produtos serão vendidas na loja online? (ex: ração, brinquedos, acessórios, medicamentos)",
                answer: "Ração, brinquedos, acessórios e produtos de higiene"
            },
            paymentMethods: {
                type: "open",
                question: "Quais métodos de pagamento devem ser aceitos? (ex: cartão, PIX, boleto, dinheiro)",
                answer: "Cartão de crédito, PIX e boleto"
            },
            appointmentFlow: {
                type: "open",
                question: "Como deve funcionar o fluxo de agendamento? (confirmação automática, aprovação manual, lembretes)",
                answer: "Confirmação automática com lembretes por email"
            },
            businessHours: {
                type: "open",
                question: "Quais são os horários de funcionamento e dias da semana que o petshop atende?",
                answer: "Segunda a sábado, das 8h às 18h"
            },
            inventoryManagement: {
                type: "MoSCoW",
                question: "O sistema deve incluir gestão automática de estoque para os produtos?",
                answer: "should"
            },
            loyaltyProgram: {
                type: "MoSCoW",
                question: "Deve haver um programa de fidelidade ou sistema de pontos para clientes?",
                answer: "could"
            },
            petProfiles: {
                type: "MoSCoW",
                question: "Os clientes devem poder criar perfis detalhados para seus pets (histórico médico, preferências)?",
                answer: "should"
            },
            deliveryService: {
                type: "MoSCoW",
                question: "O site deve incluir opções de entrega para produtos comprados online?",
                answer: "could"
            },
            socialIntegration: {
                type: "MoSCoW",
                question: "Deve haver integração com redes sociais para compartilhamento e login?",
                answer: "could"
            }
        },
        legends: [
            "Legenda",
            "Must – Essencial | Should – Importante | Could – Desejável | Won't – Não será feito"
        ]
    };
}

export function getPayload3(context: mls.msg.ExecutionContext): PayLoad3 {
    if (!context || !context.task) throw new Error(`[${agentName}] [getPayload] Invalid context`);
    const agentStep = getAgentStepByAgentName(context.task, agentName); // Only one agent execution must exist in this task
    if (!agentStep) throw new Error(`[${agentName}] [getPayload] no agent found`);

    // get result
    const resultStep = agentStep.interaction?.payload?.[0];
    if (!resultStep || resultStep.type !== "flexible" || !resultStep.result) throw new Error(`[${agentName}] [getPayload] No step flexible found for this agent.`);
    let payload3: PayLoad3 | string = resultStep.result;
    if (typeof payload3 === "string") payload3 = JSON.parse(payload3) as PayLoad3;
    return payload3;
}

export interface PayLoad3 {
    finalModuleDetails: {
        userLanguage: string;
        executionRegions: string;
        userPrompt: string;
        moduleGoal: string;
        moduleName: string;
        requirements: string[];
        userRequestsEnhancements: UserRequestsEnhancements[];
    },
    pages: PageDefinition[],
    plugins: PluginDefinition[],
    pagesWireframe: PagesWireframe[],
    organism: Organism[],
    visualIdentity: VisualIdentity,
    menu: MenuDefinition[]
}

export interface VisualIdentity {
    logoDescription: string; // English description of style and concept used to generate an SVG logo
    fontFamily: string;      // Preferred font family for headings and body
    iconStyle?: "outline" | "solid" | "duotone" | "custom"; // General icon preference
    illustrationStyle?: string; // Describe the visual style of illustrations (e.g., flat, 3D, line art)
    colorPalette: {
        primary: string; // HEX color
        secondary: string;
        text: string;
        background: string;
        border: string;
        error: string;
        warning: string;
        success: string;
    }
}

export interface UserRequestsEnhancements {
    description: string;
    priority: "could" | "should";
}
export interface PageDefinition {
    pageSequential: number;
    pageName: string;
    pageGoal: string;
    pageRequirements: string[];
}
export interface PluginDefinition {
    pluginSequential: number;
    pluginName: string
    pluginType: "ui" | "third-party";
    pluginGoal: string;
    pluginRequirements: string[];
}
export interface PagesWireframe {
    pageSequential: number;
    pageName: string;
    pageHtml: string[];
}
export interface Organism {
    organismSequential: number;
    organismTag: string;
    planning: {
        context: string;
        goal: string;
        userStories: UserStories[];
        userRequestsEnhancements?: Planning[];
        constraints?: string[];
    }
}
export interface UserStories {
    story: string;
    derivedRequirements: Planning[];
}
export interface Planning {
    description: string; // Description of the planning
    comment?: string; // Optional comment or notes
}

export interface MenuDefinition {
    pageName: string,
    title: string,
    auth: 'admin' | 'user',
    icon: string // svg icon
}

