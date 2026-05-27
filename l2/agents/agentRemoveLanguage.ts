/// <mls fileReference="_102020_/l2/agents/agentRemoveLanguage.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { skill as skilli18n } from '/_102020_/l2/skills/aura/language.js';
import { waitModelIdle } from '/_102027_/l2/libModel.js';

export function createAgent(): IAgentAsync {
    return {
        agentName: "agentRemoveLanguage",
        agentProject: 102020,
        agentFolder: "agents",
        agentDescription: "Remove i18n language",
        visibility: "private",
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

    const [dataUser] = JSON.parse(userPrompt) as { languages: { code: string, name: string }[], projectId: number }[];
    const paths: { languages: string[], fileReference: string }[] = await getPaths(dataUser.languages, dataUser.projectId);
    const inputs: mls.msg.IAMessageInputType[] = [{ type: "system", content: system1.replace('{{ skillLanguage }}', skilli18n) }];

    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: inputs,
            taskTitle: `Remove language`,
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

        Remove languages: ${data.languages}

        ##File Reference: ${data.fileReference}

        ## Actual i18n:
        \`\`\`typescript 
        ${actuali18n}
        \`\`\`
        
        `
    }
    return [continueParallel];

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


async function getPaths(languages: { code: string, name: string }[], project: number): Promise<{ languages: string[], fileReference: string }[]> {
    if (!project) throw new Error(`[getPaths] invalid project`);
    const module = await import(`/_${project}_/l2/project.js`);
    if (!module?.projectConfig?.modules) throw new Error(`[getPaths] no modules configured in project`);
    const modules: { name: string, path: string }[] = module.projectConfig.modules;

    const result: { languages: string[], fileReference: string }[] = [];

    for (const mod of modules) {

        const moduleConfig = await import(`/_${project}_/l2/${mod}/module.js`);
        if (!moduleConfig?.skills) continue;

        const sharedFolder = `${moduleConfig.web.sharedPath}`
            .replace(/^\/?_\d+_\/l2\//, '')
            .replace(/^\/|\/$/g, '');

        const sharedFiles = Object.values(mls.stor.files).filter((f: mls.stor.IFileInfo) =>
            f.project === project &&
            f.folder === sharedFolder &&
            f.extension === '.ts'
        );

        for (const storFile of sharedFiles as mls.stor.IFileInfo[]) {
            const model = await storFile.getOrCreateModel();
            if (!model) continue;
            const source: string = model.model.getValue();

            const presentLangs = languages
                .filter(lang => _hasLanguageInI18nBlock(source, lang.code))
                .map(lang => lang.code);

            if (presentLangs.length === 0) continue;

            // @ts-ignore
            const fileReference = mls.stor.convertFileToFileReference(storFile);
            result.push({ languages: presentLangs, fileReference });
        }

    }

    return result;
}

function _hasLanguageInI18nBlock(source: string, lang: string): boolean {
    const startMarker = '/// **collab_i18n_start**';
    const endMarker = '/// **collab_i18n_end**';
    const startIdx = source.indexOf(startMarker);
    const endIdx = source.indexOf(endMarker);
    if (startIdx === -1 || endIdx === -1) return false;

    const i18nBlock = source.substring(startIdx, endIdx);

    const keyPatterns = [
        new RegExp(`\\b${lang}\\s*:`, 'm'),
        new RegExp(`['"]${lang}['"]\\s*:`, 'm'),
    ];

    return keyPatterns.some(pattern => pattern.test(i18nBlock));
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
    const models = await file.getOrCreateModel();
    models.model.pushEditOperations(
        [],
        [{
            range: models.model.getFullModelRange(),
            text: params.content,
        }],
        () => null,
    );

    mls.editor.forceModelUpdate(models.model);
    await waitModelIdle(models);
    return models;

}

const system1 = `
<!-- modelType: codeinstruct -->

<!-- modelTypeList: geminiChat (2.5 pro), code (grok), deepseekchat, codeflash (gemini), deepseekreasoner, mini (4.1) ou nano (openai), codeinstruct (4.1), codereasoning(gpt5), code2 (kimi 2.5) -->

You are an agent responsible for removing an existing i18n new language, following the established standard.

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

