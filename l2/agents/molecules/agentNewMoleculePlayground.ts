/// <mls fileReference="_102020_/l2/agents/molecules/agentNewMoleculePlayground.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { skill } from '/_102020_/l2/skills/molecules/playgroundGenerator.js';
import { skills as skillList } from '/_102020_/l2/skills/molecules/index';
import { convertFileToTag } from '/_102020_/l2/utils'
import { createStorFile } from '/_102027_/l2/libStor.js';

export function createAgent(): IAgentAsync {
    return {
        agentName: "agentNewMoleculePlayground",
        agentProject: 102020,
        agentFolder: "agents",
        agentDescription: "Agent for playground demonstration molecule",
        visibility: "public",
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

    const data: { group: string, fileReference: string } = JSON.parse(userPrompt);

    const path = mls.stor.getPathToFile(data.fileReference);
    const files = await mls.stor.getFiles({ ...path, loadContent: false });
    if (!files.ts) throw new Error(`(${agent.agentName})[beforePromptStep] invalid file`);
    const source = await getSource(files.ts);
    const usageSkill = await getUsageByGroupSkill(data.group);
    const tagName = convertFileToTag(path);

    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: [{
                type: "system",
                content: system1
                    .replace("{{ tagName }}", tagName)
                    .replace("{{ skill }}", skill)
                    .replace("{{ usageSkill }}", usageSkill)
            }, {
                type: "human",
                content: `#Molecule Source \n\n \`\`\`typescript \n ${source} \n\`\`\``
            }],
            taskTitle: `Prepare playground`,
            threadId: context.message.threadId,
            userMessage: context.message.content,
            longTermMemory: { "group": data.group }
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

    const data: { group: string, fileReference: string } = JSON.parse(args);
    console.info({ data });

    const path = mls.stor.getPathToFile(data.fileReference);
    const tagName = convertFileToTag(path);

    const files = await mls.stor.getFiles({ ...path, loadContent: false });
    if (!files.ts) throw new Error(`(${agent.agentName})[beforePromptStep] invalid file`);
    const source = await getSource(files.ts);
    const usageSkill = await getUsageByGroupSkill(data.group);

    console.info({
        tagNamePlaygrond: tagName
    })

    const continueIntent: mls.msg.AgentIntentPromptReady = {
        type: "prompt_ready",
        args,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        hookSequential,
        parentStepId: parentStep.stepId,
        humanPrompt: `#Molecule Source \n\n \`\`\`typescript \n ${source} \n\`\`\``,
        systemPrompt: system1
            .replace("{{ tagName }}", tagName)
            .replace("{{ skill }}", skill)
            .replace("{{ usageSkill }}", usageSkill)
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
    if (payload?.type !== 'flexible' || !payload.result) throw new Error(`[afterPromptStep] invalid payload: ${payload}`)
    let status: mls.msg.AIStepStatus = 'completed';
    let intents: mls.msg.AgentIntent[] = [];

    const output = payload.result;
    intents = await processOutput(context, output);

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

    if (intents.length > 0) return intents;
    return [updateStatus];

}

async function processOutput(context: mls.msg.ExecutionContext, output: IResult): Promise<mls.msg.AgentIntent[]> {

    const fileReference = output.fileReference;
    let fileInfo = mls.stor.convertFileReferenceToFile(fileReference);

    const files = await mls.stor.getFiles({ ...fileInfo, loadContent: false });
    const content2 = prepareContentHtml(output.html, output.examples);
    const paramsHtml = { ...fileInfo, content: content2, versionRef: new Date().toISOString(), extension: ".html" };

    if (!files.html) {

        const storFile = await createStorFile({
            extension: '.html',
            folder: fileInfo.folder,
            level: fileInfo.level,
            project: fileInfo.project,
            shortName: fileInfo.shortName,
            source: content2,
            status: 'new'
        }, true, true, true);

        const modelTs = await storFile.getOrCreateModel();
        if (modelTs) mls.editor.forceModelUpdate(modelTs.model);

    } else {
        await updateStorFile(paramsHtml);
    }

    if (context.isTest) return [];

    const group = context.task?.iaCompressed?.longMemory['group'];
    if (!group) return [];

    const indexStep: mls.msg.AgentIntentAddStep = {
        type: 'add-step',
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: 1,
        stepTitle: `Index page: ${group}`,
        step: {
            type: 'agent',
            stepId: 0,
            interaction: null,
            status: 'waiting_human_input',
            nextSteps: [],
            agentName: 'agentIndexGroupPage',
            prompt: group,
            rags: null,
        }
    };

    return [indexStep];
}

async function updateStorFile(params: { project: number, shortName: string, level: number, folder: string, content: string, extension: string, versionRef: string }): Promise<void> {
    const file = await mls.stor.addOrUpdateFile(params);
    if (!file) throw new Error('[agentNewMolecule] Invalid storFile');
    const path = mls.stor.getKeyToFile(params);
    console.log(`[agentNewMolecule] updating file: ${path}`);
    console.log(`[agentNewMolecule] updating content: ${params.content}`);

    const modelDefs = await file.getOrCreateModel();
    modelDefs.model.setValue(params.content);

}

export async function getSource(file: mls.stor.IFileInfo): Promise<string> {
    // change first line to new pattern
    if (!file) throw new Error(`[beforePromptStep] invalid args, file dont exists`)
    const source = (await file.getContent()) as string | null;
    if (typeof source !== 'string' || !source) throw new Error(`[beforePromptAtomic] invalid source`)
    return source;
}

async function getUsageByGroupSkill(group: string) {
    const path = skillList.find((item) => item.name === group)?.skillUsageReference;
    if (!path) throw new Error(`[getGroupSkill] skill for group not found: ${path}`);
    const module = await import(path);
    if (!module || !module.skill) throw new Error(`[getGroupSkill] skill for group not found: ${path}`);
    if (typeof module.skill !== 'string') throw new Error(`[getGroupSkill] invalid type of skill: ${path}, must be string`);
    return module.skill;

}

function prepareContentHtml(content: string, examples: IExamples[]): string {
    const state = generatePlaygroundState(examples);
    const content2 = content.replace('playgroundDinamicState', state);
    return content2;
}

function generatePlaygroundState(scenarios: IExamples[]): string {
    const playground: Record<string, Record<string, any>> = {};

    for (const scenario of scenarios) {
        for (const entry of scenario.state || []) {
            const parts = entry.stateName.split('.');

            if (parts.length !== 3 || parts[0] !== 'playground') continue;

            const key = parts[1];
            const prop = parts[2];
            const raw = entry.value;

            let parsed: any;
            try {
                parsed = JSON.parse(raw);
            } catch {
                parsed = raw;
            }

            if (!playground[key]) playground[key] = {};
            playground[key][prop] = parsed;
        }
    }

    return JSON.stringify({ playground });
}

const system1 = `
<!-- modelType: code -->
<!-- modelTypeList: geminiChat (2.5 pro), code (grok), deepseekchat, codeflash (gemini), deepseekreasoner, mini (4.1) ou nano (openai), codeinstruct (4.1), codereasoning(gpt5), code2 (kimi 2.5) -->

Task: Analyze the provided TypeScript code and produce usage examples for the component according to the following criteria:

# Generate at minimun 6 distinct examples, ensuring:
- Variation in attributes (props)
-Different uses of slots (when available)
-A mix of simple and advanced configurations

# The examples must:
-Be realistic and ready to use
-Follow best practices

## Molecule tagName
{{ tagName }}

##Playground Definition
{{ skill }}

##Component Group Usage 
{{ usageSkill }}


## Output format
You must return the object strictly as JSON
[[OutputSection]]

`

//#region OutputSection
export type Output =
    {
        type: "flexible";
        result: IResult;
    }

interface IResult {
    fileReference: string // same ts file
    examples: IExamples[],
    html: string;
}

interface IExamples {
    name: string,
    props: [
        {
            name: string,
            value: string
        }
    ],
    state: {
        stateName: string, // ex: playground.basic.readonly
        value: any // acording property type
    }[]
}
//#endregion 


