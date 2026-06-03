/// <mls fileReference="_102020_/l2/agents/molecules/agentNewMolecule.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { skills as skillList } from '/_102020_/l2/skills/molecules/index';

export function createAgent() {
    return {
        agentName: "agentNewMolecule",
        agentProject: 102020,
        agentFolder: "agents",
        agentDescription: "Agent Planner for a new moleculle",
        visibility: "public",
        beforePromptImplicit,
        afterPromptStep,
    };
}

async function beforePromptImplicit(
    agent: IAgentMeta,
    context: mls.msg.ExecutionContext,
    userPrompt: string,
): Promise<mls.msg.AgentIntent[]> {

    if (!userPrompt || userPrompt.length < 5) throw new Error('invalid prompt');

    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: [{
                type: "system",
                content: system1
                    .replace("{{ groups }}", JSON.stringify(skillList, null, 2))
            }, {
                type: "human",
                content: context.message.content
            }],
            taskTitle: `Planner...`,
            threadId: context.message.threadId,
            userMessage: context.message.content,
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
    const payload = (step.interaction?.payload?.[0]) as any;

    if (!['flexible', 'result'].includes(payload?.type))
        throw new Error(`Payload type invalid: ${payload?.type}`);
    console.info(payload.result.group);

    let status: mls.msg.AIStepStatus = 'completed';

    const updateStatus: mls.msg.AgentIntentUpdateStatus = {
        type: 'update-status',
        hookSequential,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: parentStep.stepId,
        stepId: step.stepId,
        status
    };

    if (context.isTest || payload.type === 'result')
        return [updateStatus];

    const isValidGroup = skillList.find((item) => item.name === payload.result.group);
    if (!isValidGroup)
        throw new Error(`[afterPromptStep] invalid group: ${payload.result.group}`);

    const newStep: mls.msg.AgentIntentAddStep = {
        type: "add-step",
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: 1,
        stepTitle: 'Preparing requisits',
        step: {
            type: 'agent',
            stepId: 0,
            interaction: null,
            status: 'waiting_human_input',
            nextSteps: [],
            agentName: "agentNewMoleculePlanner",
            prompt: JSON.stringify(payload.result),
            rags: null,
        }
    };
    const intents: mls.msg.AgentIntent[] = [newStep];
    return intents;

}

const system1 = `
<!-- modelType: deepseekchat -->

Tasks: Understand the purpose of the widget by analyzing the original user prompt and identify the correct group 
If the original prompt is not about creating a web component, return an error asking the user to redo the request.

##Avaliables groups
{{ groups }}

## Output format
You must return the object strictly as JSON
[[OutputSection]]
`;

//#region OutputSection
export type Output =
    {
        type: "flexible";
        result: {
            group: string,
            prompt: string // user prompt fixed if needed
        };
    } |
    {
        type: "result";
        result: string
    }
//#endregion 


