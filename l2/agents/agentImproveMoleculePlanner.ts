/// <mls fileReference="_102020_/l2/agents/agentImproveMoleculePlanner.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { finishClarification } from '/_102027_/l2/aiAgentOrchestration.js';
import { skills as skillList } from '/_102020_/l2/skills/molecules/index';
import { ClarificationData } from '/_102020_/l2/agents/agentNewMoleculePlannerClarification.js';

export function createAgent(): IAgentAsync {
    return {
        agentName: "agentImproveMoleculePlanner",
        agentProject: 102020,
        agentFolder: "agents",
        agentDescription: "Plans updated requirements for an existing molecule that needs a defs change",
        visibility: "private",
        beforePromptImplicit,
        beforePromptStep,
        afterPromptStep,
        beforeClarificationStep
    };
}

async function beforePromptImplicit(
    agent: IAgentMeta,
    context: mls.msg.ExecutionContext,
    userPrompt: string,
): Promise<mls.msg.AgentIntent[]> {

    if (!userPrompt || userPrompt.length < 5) throw new Error('invalid prompt');

    const data: IDataPrompt = JSON.parse(userPrompt);
    const { systemPrompt, humanPrompt } = await buildPrompts(data);

    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: [{
                type: "system",
                content: systemPrompt
            }, {
                type: "human",
                content: humanPrompt
            }],
            taskTitle: `Planning improvement...`,
            threadId: context.message.threadId,
            userMessage: context.message.content,
        }
    };
    return [addMessageAI];
}

async function beforePromptStep(
    agent: IAgentMeta,
    context: mls.msg.ExecutionContext,
    parentStep: mls.msg.AIAgentStep,
    step: mls.msg.AIAgentStep,
    hookSequential: number,
    args?: string
): Promise<mls.msg.AgentIntent[]> {

    if (!args) throw new Error(`(${agent.agentName})[beforePromptStep] args invalid`);

    const data: IDataPrompt = JSON.parse(args);
    const { systemPrompt, humanPrompt } = await buildPrompts(data);

    const continueIntent: mls.msg.AgentIntentPromptReady = {
        type: "prompt_ready",
        args,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        hookSequential,
        parentStepId: parentStep.stepId,
        humanPrompt,
        systemPrompt
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

    if (!agent || !context || !step) throw new Error(`[${agent.agentName}][afterPromptStep] invalid params`);

    const payload = step.interaction?.payload?.[0];
    if (payload?.type !== 'clarification' || !payload.json) throw new Error(`[${agent.agentName}][afterPromptStep] invalid payload: ${payload?.type}`);

    if (context.isTest) { console.info(JSON.stringify(payload.json, null, 2)); }

    return [];
}

async function beforeClarificationStep(
    agent: IAgentMeta,
    context: mls.msg.ExecutionContext,
    parentStep: mls.msg.AIAgentStep,
    step: mls.msg.AIClarificationStep,
    hookSequential: number,
    json: ClarificationData
): Promise<HTMLElement> {

    if (!context.task) throw new Error(`[${agent.agentName}][beforeClarificationStep] invalid task: undefined`);

    const intentsToClarification: mls.msg.AgentIntent[] = processOutput(agent, context, parentStep, step, hookSequential, json);
    await import('/_102020_/l2/agents/agentNewMoleculePlannerClarification.js');
    const clariEl = document.createElement('agents--agent-new-molecule-planner-clarification-102020');
    (clariEl as any).data = json;

    clariEl.addEventListener('clarification-finish', (e: Event) => {
        const { detail } = e as CustomEvent<{ value: unknown; action: "continue" | "cancel" }>;
        const { value, action } = detail;
        const normalizedValue = `\`\`\`json \n ${JSON.stringify(value, null, 2)} \n \`\`\``;

        finishClarification(
            agent,
            step.stepId,
            parentStep.stepId,
            intentsToClarification,
            context,
            normalizedValue,
            action
        );
    });

    return clariEl;
}

function processOutput(
    agent: IAgentMeta,
    context: mls.msg.ExecutionContext,
    parentStep: mls.msg.AIAgentStep,
    step: mls.msg.AIClarificationStep,
    hookSequential: number,
    _suggestions: ClarificationData
): mls.msg.AgentIntent[] {

    const updateStatus: mls.msg.AgentIntentUpdateStatus = {
        type: 'update-status',
        hookSequential,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: parentStep.stepId,
        stepId: step.stepId,
        status: 'completed'
    };

    const updateStatusAgent: mls.msg.AgentIntentUpdateStatus = {
        type: 'update-status',
        hookSequential,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: 1,
        stepId: parentStep.stepId,
        status: 'completed'
    };

    const newStep: mls.msg.AgentIntentAddStep = {
        type: "add-step",
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: 1,
        stepTitle: 'Updating molecule defs',
        step: {
            type: 'agent',
            stepId: 0,
            interaction: null,
            status: 'waiting_human_input',
            nextSteps: [],
            agentName: "agentImproveMoleculeDefs",
            prompt: `{{clarification}}`,
            rags: null,
        }
    };

    return [newStep, updateStatusAgent, updateStatus];
}

async function buildPrompts(data: IDataPrompt): Promise<{ systemPrompt: string; humanPrompt: string }> {
    const currentDefs = await getContentByExtension(data.fileReference, 'defs');
    const groupSkill = await getGroupSkill(data.group);

    const systemPrompt = system1
        .replace('{{fileReference}}', data.fileReference)
        .replace('{{currentDefs}}', currentDefs || '(no defs file found)')
        .replace('{{groupSkill}}', groupSkill)
        .replace('{{group}}', data.group);

    return { systemPrompt, humanPrompt: data.prompt };
}

async function getGroupSkill(group: string): Promise<string> {
    const path = skillList.find((item) => item.name === group)?.skillReference;
    if (!path) throw new Error(`[getGroupSkill] skill for group not found: ${group}`);
    const module = await import(path);
    if (!module || !module.skill) throw new Error(`[getGroupSkill] skill module invalid: ${path}`);
    if (typeof module.skill !== 'string') throw new Error(`[getGroupSkill] invalid skill type: ${path}`);
    return module.skill;
}

async function getContentByExtension(page: string, ext: 'ts' | 'less' | 'html' | 'defs'): Promise<string> {
    const normalizedPage = page.replace(/^(_\d+_)(?!\/l2\/)/, '$1/l2/');
    const path = mls.stor.getPathToFile(normalizedPage);
    const files = await mls.stor.getFiles({ ...path, loadContent: false });
    const file = (files as any)[ext] as mls.stor.IFileInfo | undefined;
    if (!file) return '';
    const source = (await file.getContent()) as string | null;
    return source || '';
}

const system1 = `
<!-- modelType: codepro -->
<!-- modelTypeList: geminiChat (2.5 pro), code (grok), deepseekchat, codeflash (gemini), deepseekreasoner, mini (4.1) ou nano (openai), codeinstruct (4.1), codereasoning(gpt5), code2 (kimi 2.5) -->

You are a requirements analyst responsible for updating the functional and visual requirements of an existing web component (molecule) that needs to be improved.

## CRITICAL: fileReference
The fileReference must be preserved exactly as: {{fileReference}}.ts
Do NOT suggest a new name or path.

## Your task

1. Analyze the improvement request in context of the existing requirements.
2. Map the requested changes to the group contract (properties, slot tags, events, visual states).
3. Produce the complete updated requirements — preserving everything not affected by the improvement.

## RULES

- You MUST keep \`fileReference\` as: {{fileReference}}.ts
- You MUST NOT add properties, events, or slot tags that are not in the group contract.
- You MUST NOT include implementation details (no HTML, no CSS, no framework patterns).
- You MUST NOT ask questions — make decisions based on existing requirements and the group contract.
- Preserve all existing requirements that are not affected by the improvement request.
- Every requirement must be a concrete, actionable, declarative statement.

## Current molecule requirements (.defs.ts)
\`\`\`
{{currentDefs}}
\`\`\`

## GroupName: {{group}}

\`\`\`md
{{groupSkill}}
\`\`\`

## Output format
You must return the object strictly as JSON
[[OutputSection]]
`;

//#region OutputSection
export type Output =
    {
        type: "clarification";
        json: TClarification;
    }

export interface TClarification {
    fileReference: string;
    description: string;
    prompt: string;
    group: string;
    functionalRequirements: string[];
    visualRequirements: string[];
}

interface IDataPrompt {
    group: string;
    prompt: string;
    fileReference: string;
}
//#endregion
