/// <mls fileReference="_102020_/l2/agents/molecules/agentNewMoleculeFix.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { getPath } from '/_102027_/l2/utils.js';
import { appendLongTermMemory } from '/_102027_/l2/aiAgentHelper.js';

export function createAgent(): IAgentAsync {
    return {
        agentName: "agentNewMoleculeFix",
        agentProject: 102020,
        agentFolder: "agents",
        agentDescription: "Fix compile errors in new molecule",
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

    const system = await prepareSystem(userPrompt);

    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: [{
                type: "system",
                content: system

            }, {
                type: "human",
                content: 'Fix component errors',
            }],
            taskTitle: `Fix molecule`,
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

    const system = await prepareSystem(args);

    const continueIntent: mls.msg.AgentIntentPromptReady = {
        type: "prompt_ready",
        args,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        hookSequential,
        parentStepId: parentStep.stepId,
        humanPrompt: 'Fix molecule errors',
        systemPrompt: system
    }

    return [continueIntent];
}


async function prepareSystem(fileReference: string) {

    const path = mls.stor.getPathToFile(fileReference);
    const files = await mls.stor.getFiles({ ...path, loadContent: true });
    if (!files || !files.ts || !files.tsContent) throw new Error('[agentNewMoleculeFix] ts content is null')

    const content = files.tsContent;
    const modelTs = await files.ts.getOrCreateModel() as mls.editor.IModelTS;
    const imports = modelTs.compilerResults?.imports || [];
    const defs = await getDefinitonsByImports(imports);
    const str = defs.map((def) => ` **importName: ${def.importName}**\n${def.definition}`)
    const markersTs = modelTs ? monaco.editor.getModelMarkers({ resource: modelTs.model.uri }) : [];
    const errors = modelTs.compilerResults?.errors || [];
    const errorsMonaco = markersTs.filter(marker => marker.severity === monaco.MarkerSeverity.Error);
    const warningsMonaco = markersTs.filter(marker => marker.severity === monaco.MarkerSeverity.Warning);

    system1 = system1.replace("{{typescriptSource}}", content)
        .replace("{{typescriptImportsDefinition}}", str.join('\n'))
        .replace("{{typescriptCompileErrors}}", JSON.stringify(errors))
        .replace("{{typescriptMonacoErrors}}", JSON.stringify(errorsMonaco))
        .replace("{{typescriptMonacoWarnings}}", JSON.stringify(warningsMonaco));

    return system1;

}

async function getDefinitonsByImports(imports: string[]) {

    const definitionsData: { importName: string, definition: string }[] = [];
    for await (let importName of imports) {
        if (!importName.startsWith('./')) continue;
        const fullPath = importName.replace('./', '');
        const iPath = getPath(fullPath);
        if (!iPath) throw new Error('[getDefinitonsByImports] not found path:' + fullPath);
        const keyToStorFile = mls.stor.getKeyToFiles(iPath.project, 2, iPath.shortName, iPath.folder, '.ts');
        const storFile = mls.stor.files[keyToStorFile];
        if (!storFile) continue;
        const modelTs = await storFile.getOrCreateModel() as mls.editor.IModelTS;
        if (!modelTs) continue;
        await mls.l2.typescript.compileAndPostProcess(modelTs, false, false);
        const definition = modelTs.compilerResults?.prodDTS || '';
        if (definition) {
            definitionsData.push({
                definition,
                importName
            })
        }

    }

    return definitionsData;

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

    return [...intents, updateStatus];

}

const MaxFixEffort = 2;

async function processOutput(context: mls.msg.ExecutionContext, output: Result): Promise<mls.msg.AgentIntent[]> {

    const molecule = output.ts;
    const fileReferenceLine = molecule.trim().split('\n')[0];
    const tripleSlash = mls.common.tripleslash.parseXMLTripleSlash(fileReferenceLine);
    const fileReference = tripleSlash.variables['fileReference'];

    let fileInfo = mls.stor.convertFileReferenceToFile(fileReference);
    if (!fileReferenceLine || fileInfo.project < 1) throw new Error(`Invalid step in create file, incorrect meta fileRecerence: ${fileReferenceLine}`);

    const keyToFiles = await mls.stor.getKeyToFile({ ...fileInfo });
    const storFile = mls.stor.files[keyToFiles];
    if (!storFile) throw new Error('[agentNewMoleculeFix] Invalid storFile');
    const modelTs: mls.editor.IModelTS = await storFile.getOrCreateModel();
    modelTs.model.setValue(output.ts);
    const compileResultOk = await mls.l2.typescript.compileAndPostProcess(modelTs, true, false);

    const fixCountRaw = context.task?.iaCompressed?.longMemory['fixCount'];
    const parsed = Number(fixCountRaw);
    const fixCount = Number.isNaN(parsed) ? 0 : parsed;

    if (compileResultOk) {
        const nextStep = context.task?.iaCompressed?.longMemory['nextStep'];
        if (nextStep === 'finish') return [];

        console.info('Fix ok, call playground agent');
        const group = context.task?.iaCompressed?.longMemory['group'];

        const newStep: mls.msg.AgentIntentAddStep = {
            type: "add-step",
            messageId: context.message.orderAt,
            threadId: context.message.threadId,
            taskId: context.task?.PK || '',
            parentStepId: 1,
            stepTitle: 'Preparing playground',
            step:
            {
                type: 'agent',
                stepId: 0,
                interaction: null,
                status: 'waiting_human_input',
                nextSteps: [],
                agentName: "agentNewMoleculePlayground",
                prompt: JSON.stringify({ group: group, fileReference }),
                rags: null,
            }
        };

        return [newStep];
    }

    if (!compileResultOk && fixCount >= MaxFixEffort) {
        throw new Error('[agentNewMoleculeFix] Maximum fix effort achieved');
    }

    const newCount = fixCount + 1;
    await appendLongTermMemory(context, { 'fixCount': newCount.toString() });
    const newStep: mls.msg.AgentIntentAddStep = {
        type: "add-step",
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: 1,
        stepTitle: `Fix errors: ${fileReference}`,
        step:
        {
            type: 'agent',
            stepId: 0,
            interaction: null,
            status: 'waiting_human_input',
            nextSteps: [],
            stepTitle: `Fix(${newCount})`,
            agentName: "agentNewMoleculeFix",
            prompt: fileReference,
            rags: null,
        }
    };
    return [newStep];


}

let system1 = `
<!-- modelType: codeinstruct -->

You are an agent specialized in fixing errors in web components developed with the Lit framework and tailwind.  
You will receive a TypeScript along with a JSON definition (style metadata with general information)

The source file will be provided together with a summary of the errors found in the file. Your task is to:

1. Review the errors and identify which changes need to be made  
2. Apply only the necessary changes  

## FILE TYPESCRIPT
### Source
{{typescriptSource}}

### Imports Definitions
{{typescriptImportsDefinition}}

### Compilation Errors
{{typescriptCompileErrors}}

### Monaco Errors
{{typescriptMonacoErrors}}

### Monaco Warnings
{{typescriptMonacoWarnings}}


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
    ts: string,
}
//#endregion 
