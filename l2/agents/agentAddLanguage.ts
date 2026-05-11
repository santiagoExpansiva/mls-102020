/// <mls fileReference="_102020_/l2/agents/agentAddLanguage.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { skill as skilli18n } from '/_102020_/l2/skills/aura/language.js';
import { appendLongTermMemory } from '/_102027_/l2/aiAgentHelper.js';


export function createAgent(): IAgentAsync {
    return {
        agentName: "agentAddLanguage",
        agentProject: 102020,
        agentFolder: "agents",
        agentDescription: "New i18n language",
        visibility: "public",
        beforePromptImplicit,
        beforePromptStep,
        afterPromptStep,
    };
}

async function beforePromptImplicit(
    agent: IAgentMeta,
    context: mls.msg.ExecutionContext,
    userPrompt: string,
): Promise<mls.msg.AgentIntent[]> {

    const paths: { languages: string[], fileReference: string }[] = JSON.parse(userPrompt);
    const inputs: mls.msg.IAMessageInputType[] = [{ type: "system", content: system1.replace('{{ skillLanguage }}', skilli18n) }];

    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: inputs,
            taskTitle: `Generating defs for ${paths.length} files`,
            threadId: context.message.threadId,
            userMessage: context.message.content,
            longTermMemory: {},
        },
        executionMode: {
            type: 'parallel',
            args: paths.map((item) => JSON.stringify(item))
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

    if (!args) throw new Error(`[beforePromptStep] args invalid`)
    const data = JSON.parse(args);
    console.info(`===process with args: ${args}`)
    const actuali18n = await getPagei18nBlock(data.fileReference);

    const continueParallel: mls.msg.AgentIntentPromptReady = {
        type: "prompt_ready",
        args,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        hookSequential,
        parentStepId: parentStep.stepId,
        humanPrompt: `

        Add languages: ${data.languages}

        ##File Reference: ${data.fileReference}

        ## Actual i18n:
        \`\`\`typescript 
        ${actuali18n}
        \`\`\`
        
        `
    }
    return [continueParallel];

}



async function beforePromptImplicit2(
    agent: IAgentMeta,
    context: mls.msg.ExecutionContext,
    userPrompt: string,
): Promise<mls.msg.AgentIntent[]> {

    if (!userPrompt || userPrompt.length < 5) throw new Error('invalid prompt');
    const data: { languages: string[], fileReference: string } = JSON.parse(userPrompt);
    const actuali18n = await getPagei18nBlock(data.fileReference);

    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: [{
                type: "system",
                content: system1
                    .replace('{{ skillLanguage }}', skilli18n)
                    .replace('{{ actuali18n }}', actuali18n)

            }, {
                type: "human",
                content: `Add languages : ${data.languages.join(',')} `
            }],
            taskTitle: `Adding language`,
            threadId: context.message.threadId,
            userMessage: context.message.content,
            longTermMemory: { 'fileReference': data.fileReference }
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

    const payload = (step.interaction?.payload?.[0]);
    if (payload?.type !== 'flexible' || !payload.result) throw new Error(`[afterPromptStep] invalid payload: ${payload}`)
    let status: mls.msg.AIStepStatus = 'completed';
    let intents: mls.msg.AgentIntent[] = [];

    const output: Output = payload;
    intents = await processOutput(context, output.result.i18n, output.result.fileReference);

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

    return [...intents, updateStatus];

}


async function getPagei18nBlock(fileReference: string) {

    const path = mls.stor.getPathToFile(fileReference);
    const files = await mls.stor.getFiles({ ...path, loadContent: false });
    if (!files.ts) throw new Error(`[getPagei18nBlock] invalid file: ${fileReference}`);
    const i18nBlock = await geti18nByFile(files.ts);
    return i18nBlock;
}

async function geti18nByFile(stor: mls.stor.IFileInfo) {
    const modelTS = await stor.getOrCreateModel();
    if (!modelTS) throw new Error(`[geti18nByFile] invalid models`);
    const source = modelTS.model.getValue();
    const startMarker = '/// **collab_i18n_start**';
    const endMarker = '/// **collab_i18n_end**';
    const startIdx = source.indexOf(startMarker);
    const endIdx = source.indexOf(endMarker);
    if (startIdx === -1 || endIdx === -1) return '';
    const i18nBlock = source.substring(startIdx, endIdx);
    return i18nBlock + '/// **collab_i18n_end**';
}

async function processOutput(context: mls.msg.ExecutionContext, newi18n: string, fileReference: string) {

    console.info(fileReference);
    console.info(newi18n);

    if (context.isTest) return [];


    if (!fileReference) throw new Error('[processOutput] Invalid fileReference')
    let fileInfo = mls.stor.convertFileReferenceToFile(fileReference);
    if (!fileReference || fileInfo.project < 1) throw new Error(`[processOutput] Invalid step in create file, incorrect meta fileRecerence: ${fileReference}`);
    const path = mls.stor.getPathToFile(fileReference);
    const files = await mls.stor.getFiles({ ...path, loadContent: false });
    if (!files.ts) throw new Error(`[processOutput] invalid file: ${fileReference}`);
    const modelTS = await files.ts.getOrCreateModel();
    if (!modelTS) throw new Error(`[geti18nByFile] invalid models`);
    const source = modelTS.model.getValue();
    const newValue = replaceI18nBlock(source, newi18n)
    const paramsTs = { ...fileInfo, content: newValue, versionRef: new Date().toISOString(), extension: ".ts" };
    await updateStorFile(paramsTs);
    return [];

}

function replaceI18nBlock(content: string, newBlock: string): string {
    const regex =
        /\/\/\/\s\*\*collab_i18n_start\*\*[\s\S]*?\/\/\/\s\*\*collab_i18n_end\*\*/g;

    return content.replace(regex, newBlock);
}

async function updateStorFile(params: { project: number, shortName: string, level: number, folder: string, content: string, extension: string, versionRef: string }): Promise<mls.editor.IModelBase> {

    const file = await mls.stor.addOrUpdateFile(params);
    if (!file) throw new Error('[agentNewMolecule] Invalid storFile');
    const path = mls.stor.getKeyToFile(params);
    const models = await file.getOrCreateModel();
    models.model.setValue(params.content);
    return models;

}

const system1 = `
<!-- modelType: translate -->

<!-- modelTypeList: geminiChat (2.5 pro), code (grok), deepseekchat, codeflash (gemini), deepseekreasoner, mini (4.1) ou nano (openai), codeinstruct (4.1), codereasoning(gpt5), code2 (kimi 2.5) -->

Você é um agente responsavel por adicionar uma nova linguagem i18n, seguindo o padrão estabelecido.

{{ skillLanguage }}

## Output format
You must return the object strictly as JSON
[[OutputSection]]

`

//#region OutputSection
export type Output =
    {
        type: "flexible";
        result: Result;
    }

export type Result = {
    i18n: string,
    fileReference: string // same prompt
}
//#endregion 

