/// <mls fileReference="_102020_/l2/agents/molecules/agentImproveMolecule.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { finishClarification } from '/_102027_/l2/aiAgentOrchestration.js';
import { appendLongTermMemory } from '/_102027_/l2/aiAgentHelper.js';
import { ClarificationData } from '/_102020_/l2/agents/molecules/agentNewMoleculePlannerClarification.js';

export function createAgent(): IAgentAsync {
    return {
        agentName: "agentImproveMolecule",
        agentProject: 102020,
        agentFolder: "agents",
        agentDescription: "Evaluates an improvement request and decides whether molecule definitions need to be updated",
        visibility: "public",
        beforePromptImplicit,
        afterPromptStep,
        beforeClarificationStep,
        scope: ['l2_preview']
    };
}

async function beforePromptImplicit(
    agent: IAgentMeta,
    context: mls.msg.ExecutionContext,
    userPrompt: string,
): Promise<mls.msg.AgentIntent[]> {

    if (!userPrompt || userPrompt.length < 5) throw new Error('invalid prompt');

    let data: IDataPrompt;
    if (context.isTest) {
        const testData = JSON.parse(userPrompt) as { fileReference: string; prompt: string };
        if (!testData.fileReference || !testData.prompt) throw new Error(`[${agent.agentName}] Invalid test prompt structure: missing fileReference or prompt`);
        data = { page: testData.fileReference.replace(/\.ts$/, ''), prompt: testData.prompt };
    } else {
        let pp = context.message.content
            .replace(`@@ ${agent.agentName}`, '')
            .replace(`@@${agent.agentName}`, '').trim();
        data = mls.common.safeParseArgs(pp) as IDataPrompt;
        if (!('page' in data) || !('prompt' in data)) throw new Error(`[${agent.agentName}] Invalid prompt structure: missing page and prompt`);
    }

    const currentDefs = await getContentByExtension(data.page, 'defs');
    const currentTs = await getContentByExtension(data.page, 'ts');

    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: [{
                type: "system",
                content: system1
                    .replace("{{currentDefs}}", currentDefs || '(no defs file found)')
                    .replace("{{currentTs}}", currentTs || '(no ts file found)')
            }, {
                type: "human",
                content: data.prompt
            }],
            taskTitle: `Evaluating improvement...`,
            threadId: context.message.threadId,
            userMessage: context.message.content,
            longTermMemory: { page: data.page, prompt: data.prompt }
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

    if (!agent || !context || !step) throw new Error(`[${agent.agentName}][afterPromptStep] invalid params`);

    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error(`[${agent.agentName}][afterPromptStep] missing payload`);

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

    // YES path: clarification step handles next intents
    if (payload.type === 'clarification') return [];

    // NO path: direct improvement
    if (payload.type !== 'flexible' || !payload.result) throw new Error(`[${agent.agentName}][afterPromptStep] invalid payload type: ${payload?.type}`);

    if (context.isTest) {
        const info = { payload, context };
        console.log('[Details]: ', info);
        return [updateStatus];
    }

    const page = context.task?.iaCompressed?.longMemory['page'] || payload.result.page;
    const position = context.task?.iaCompressed?.longMemory['position'] || 'left';

    const newStep: mls.msg.AgentIntentAddStep = {
        type: "add-step",
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: 1,
        stepTitle: 'Improving molecule',
        step: {
            type: 'agent',
            stepId: 0,
            interaction: null,
            status: 'waiting_human_input',
            nextSteps: [],
            agentName: "agentImproveMoleculeMaterialize",
            prompt: JSON.stringify({ page, prompt: payload.result.prompt, position }),
            rags: null,
        }
    };

    return [newStep, updateStatus];
    //return [newStep];
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

    await appendLongTermMemory(context, { defsFileReference: json.fileReference });
    const intentsToClarification: mls.msg.AgentIntent[] = processOutput(agent, context, parentStep, step, hookSequential, json);
    await import('/_102020_/l2/agents/molecules/agentNewMoleculePlannerClarification.js');
    const clariEl = document.createElement('agents--molecules--agent-new-molecule-planner-clarification-102020');
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

    const updateStatusPayload: mls.msg.AgentIntentUpdateStatus = {
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

    //return [newStep, updateStatusAgent, updateStatus];
    //return [newStep, updateStatusAgent]
    return [newStep, updateStatusPayload]
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

You are an analyst responsible for evaluating whether an improvement request to an existing web component requires updating its functional/visual requirements (defs) or only its implementation.


## Your task

Analyze the improvement request and decide:

### Option 1
**NEEDS DEFS UPDATE** if the request:
- Adds, removes, or changes a functional requirement
- Changes observable behavior (new state, new event, new slot tag, new property)
- Changes accessibility requirements
- Changes validation rules or constraints

In this case, return a \`clarification\` output with the FULL updated requirements (not just the changed parts).
Pre-populate all fields from the existing defs — only update what the improvement request changes.

### Option 2
**DIRECT IMPROVEMENT** if the request:
- Only changes visual style (colors, spacing, typography)
- Only changes layout or animation details
- Only fixes a bug without altering the functional contract
- Only adjusts an internal implementation detail

In this case, return a \`flexible\` output with the original page and prompt.

## Context
### Current molecule requirements (.defs.ts)
\`\`\`
{{currentDefs}}
\`\`\`

### Current molecule implementation (.ts)
\`\`\`typescript
{{currentTs}}
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
    } |
    {
        type: "flexible";
        result: IDataPrompt;
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
    page: string; // .ts final
    prompt: string; // original user prompt    
}
//#endregion
