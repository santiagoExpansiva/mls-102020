/// <mls fileReference="_102020_/l2/agents/agentImproveMoleculeDefs.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { appendLongTermMemory } from '/_102027_/l2/aiAgentHelper.js';

export function createAgent(): IAgentAsync {
    return {
        agentName: "agentImproveMoleculeDefs",
        agentProject: 102020,
        agentFolder: "agents",
        agentDescription: "Updates molecule defs based on approved improvement requirements",
        visibility: "private",
        beforePromptImplicit,
        beforePromptStep,
        afterPromptStep
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
            }, {
                type: "human",
                content: context.message.content
            }],
            taskTitle: `Updating defs...`,
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

    const continueIntent: mls.msg.AgentIntentPromptReady = {
        type: "prompt_ready",
        args,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        hookSequential,
        parentStepId: parentStep.stepId,
        humanPrompt: args || '',
        systemPrompt: system1
    }

    return [continueIntent];
}

async function afterPromptStep(
    agent: IAgentMeta,
    context: mls.msg.ExecutionContext,
    parentStep: mls.msg.AIAgentStep,
    step: mls.msg.AIAgentStep,
    hookSequential: number,
): Promise<mls.msg.AgentIntent[]> {

    if (!agent || !context || !step) throw new Error(`[afterPromptStep] invalid params, agent:${!!agent}, context:${!!context}, step:${!!step}`);

    const payload = (step.interaction?.payload?.[0]);
    if (payload?.type !== 'flexible' || !payload.result) throw new Error(`[afterPromptStep] invalid payload: ${payload}`);

    const status: mls.msg.AIStepStatus = 'completed';
    const output: IResult = payload.result;
    await updateExistingDefs(output.skillMd, output.fileReference, output.group);

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

    if (context.isTest) return [updateStatus];

    const page = context.task?.iaCompressed?.longMemory['page'] || output.fileReference;
    const position = context.task?.iaCompressed?.longMemory['position'] || 'left';
    const prompt = context.task?.iaCompressed?.longMemory['prompt'] || '';

    if (context.task) await appendLongTermMemory(context, { group: output.group });

    const newStep: mls.msg.AgentIntentAddStep = {
        type: "add-step",
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: 1,
        stepTitle: `Improving molecule: ${output.fileReference}`,
        step: {
            type: 'agent',
            stepId: 0,
            interaction: null,
            status: 'waiting_human_input',
            nextSteps: [],
            agentName: "agentNewMoleculeMaterialize",
            prompt: output.fileReference, //JSON.stringify({ page, prompt, position }),
            rags: null,
        }
    };

    return [newStep, updateStatus];
}

async function updateExistingDefs(skill: string, fileReference: string, group: string): Promise<void> {

    let fileInfo = mls.stor.convertFileReferenceToFile(fileReference);
    if (!fileReference || fileInfo.project < 1) throw new Error(`[updateExistingDefs] Invalid fileReference: ${fileReference}`);

    const skillNormalized = skill.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    const defsFileReference = fileReference.replace('.ts', '.defs.ts');

    const template = `/// <mls fileReference="${defsFileReference}" enhancement="_blank" />

// Do not change – automatically generated code.

export const group = '${group}';
export const skill = \`${skillNormalized}\`;

`;

    const params = { ...fileInfo, content: template, extension: '.defs.ts', versionRef: new Date().toISOString() };
    const file = await mls.stor.addOrUpdateFile(params);
    if (!file) throw new Error(`[updateExistingDefs] addOrUpdateFile returned null for: ${fileReference}`);

    const model = await file.getOrCreateModel();
    if (model) mls.editor.forceModelUpdate(model.model);

}

const system1 = `
<!-- modelType: codepro -->
<!-- modelTypeList: geminiChat (2.5 pro), code (grok), deepseekchat, codeflash (gemini), deepseekreasoner, mini (4.1) ou nano (openai), codeinstruct (4.1), codereasoning(gpt5), code2 (kimi 2.5) -->

You are a planner responsible for updating a skill.md based on approved improvement requirements.

You receive a JSON with updated functional and visual requirements for an existing molecule.
Your task is to rewrite the skill.md to reflect these requirements, preserving existing behaviors not affected by the change.

Follow this structure:

# Metadata
- TagName:

# Objective
A clear description of what the molecule does from a user or system perspective.

# Responsibilities
- Describe observable behaviors only
- Focus on what the molecule must do, not how

# Constraints
- Define rules, limitations, and expected behaviors
- Prevent invalid states or misuse

# Notes
- Optional clarifications about behavior

Strict rules:
- DO NOT include implementation details
- DO NOT mention code, frameworks, or technical solutions
- DO NOT describe how something should be built
- Focus only on behavior and expected outcomes
- Use simple and clear language
- Keep items concise and functional

If any implementation detail is included, remove it and rewrite.

## Output format
You must return the object strictly as JSON
[[OutputSection]]
`

//#region OutputSection
export type Output =
    {
        type: "flexible";
        result: IResult
    }

interface IResult {
    fileReference: string,
    group: string,
    skillMd: string,
}
//#endregion
