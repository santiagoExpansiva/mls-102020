/// <mls fileReference="_102020_/l2/agents/agentNewMoleculeMaterialize.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { appendLongTermMemory } from '/_102027_/l2/aiAgentHelper.js';
import { convertFileToTag } from '/_102020_/l2/utils';
import { createStorFile } from '/_102027_/l2/libStor.js';


// import { skill as skillDesing } from '/_102020_/l2/skills/aura/design.js';
import { skill as skillAura } from '/_102020_/l2/skills/aura/overview.js';
import { skill as skillMolecule } from '/_102020_/l2/skills/aura/moleculeGeneration2.js';
import { skills as skillList } from '/_102020_/l2/skills/molecules/index';

export function createAgent(): IAgentAsync {
    return {
        agentName: "agentNewMoleculeMaterialize",
        agentProject: 102020,
        agentFolder: "agents",
        agentDescription: "New agent",
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

    if (!userPrompt || userPrompt.length < 5) throw new Error('invalid prompt');

    const data: { group: string, fileReference: string, skill: string } = JSON.parse(userPrompt);
    const baseMolecule = await getBaseMolecule();
    const userPrompt2 = await getSystemUser(context, data.fileReference, { skill: data.skill, group: data.group });

    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: [{
                type: "system",
                content: system1
                    // .replace("{{systemSkillDesign}}", skillDesing)
                    .replace("{{systemSkillAura}}", skillAura)
                    .replace("{{systemSkillMolecule}}", skillMolecule)
                    .replace("{{systemBaseMolecule}}", baseMolecule)

            }, {
                type: "human",
                content: userPrompt2
            }],
            taskTitle: `Creating molecule`,
            threadId: context.message.threadId,
            userMessage: context.message.content,
            longTermMemory: { group: data.group }
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
    const baseMolecule = await getBaseMolecule();
    const userPrompt = await getSystemUser(context, args);

    const continueIntent: mls.msg.AgentIntentPromptReady = {
        type: "prompt_ready",
        args,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        hookSequential,
        parentStepId: parentStep.stepId,
        humanPrompt: userPrompt,
        systemPrompt: system1
            // .replace("{{systemSkillDesign}}", skillDesing)
            .replace("{{systemSkillAura}}", skillAura)
            .replace("{{systemSkillMolecule}}", skillMolecule)
            .replace("{{systemBaseMolecule}}", baseMolecule)
    }

    return [continueIntent];
}


async function getSystemUser(context: mls.msg.ExecutionContext, fileReference: string, dataForTest?: { skill: string, group: string }) {

    const path = mls.stor.getPathToFile(fileReference);
    const files = await mls.stor.getFiles({ ...path, loadContent: false });

    let data: {
        skill: string;
        group: string;
        fileReference: string;
    } = { fileReference: '', skill: '', group: '' };

    if (dataForTest) {
        data = {
            fileReference,
            group: dataForTest.group,
            skill: dataForTest.skill
        }
    } else if (!files.defs) throw new Error(`[getSystemUser] invalid file: ${fileReference}`)
    else data = await getMoleculeSkill(files.defs);

    const skillByGroup = await getGroupSkill(data.group);
    const tagName = convertFileToTag(path);
    if (context.task) await appendLongTermMemory(context, { 'group': data.group });

    const system2 = `

    ## TagName : ${tagName}
    
    ## File Reference : ${data.fileReference}

    ## Skill Group: ${data.group}
    \`\`\`
        ${skillByGroup}
    \`\`\`


    ## Molecule ${tagName} specification:
    \`\`\`
        ${data.skill}
    \`\`\`

    `

    return system2;
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

    if (context.isTest) {
        console.info(output.ts)
        return [];
    }

    const data = await updateFiles(context, output);
    const group = context.task?.iaCompressed?.longMemory['group'];
    const fixCountRaw = context.task?.iaCompressed?.longMemory['fixCount'];
    const parsed = Number(fixCountRaw);
    const fixCount = Number.isNaN(parsed) ? 0 : parsed;

    if (data.hasErrors && fixCount < MaxFixEffort && !context.isTest) {

        const newCount = fixCount + 1;
        await appendLongTermMemory(context, { 'fixCount': newCount.toString() });

        const newStep: mls.msg.AgentIntentAddStep = {
            type: "add-step",
            messageId: context.message.orderAt,
            threadId: context.message.threadId,
            taskId: context.task?.PK || '',
            parentStepId: 1,
            stepTitle: `Fix errors: ${data.fileReference}`,
            step:
            {
                type: 'agent',
                stepId: 0,
                interaction: null,
                status: 'waiting_human_input',
                nextSteps: [],
                stepTitle: `Fix(${newCount})`,
                agentName: "agentNewMoleculeFix",
                prompt: data.fileReference,
                rags: null,
            }
        };

        return [newStep];
    }




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
            prompt: JSON.stringify({ group: group, fileReference: data.fileReference }),
            rags: null,
        }
    };

    return [newStep];
}

async function updateFiles(context: mls.msg.ExecutionContext, result: Result) {

    const molecule = result.ts;
    const fileReference = molecule.trim().split('\n')[0];
    const tripleSlash = mls.common.tripleslash.parseXMLTripleSlash(fileReference);
    let fileInfo = mls.stor.convertFileReferenceToFile(tripleSlash.variables['fileReference']);
    if (!fileReference || fileInfo.project < 1) throw new Error(`Invalid step in create file, incorrect meta fileRecerence: ${fileReference}`);
    const paramsTs = { ...fileInfo, content: molecule, versionRef: new Date().toISOString(), extension: ".ts" };

    const files = await mls.stor.getFiles({ ...fileInfo, loadContent: false });
    let modelTs: mls.editor.IModelTS;

    if (!files.ts) {
        const storFile = await createStorFile({
            extension: '.ts',
            folder: fileInfo.folder,
            level: fileInfo.level,
            project: fileInfo.project,
            shortName: fileInfo.shortName,
            source: molecule,
            status: 'new'
        }, true, true, true);

        modelTs = await storFile.getOrCreateModel();

    } else {
        modelTs = await updateStorFile(paramsTs);
    }

    const compileResultOk = await mls.l2.typescript.compileAndPostProcess(modelTs, true, false);
    console.info({ compileResultOk })

    return {
        fileReference: tripleSlash.variables['fileReference'],
        hasErrors: compileResultOk === false
    }

}

async function updateStorFile(params: { project: number, shortName: string, level: number, folder: string, content: string, extension: string, versionRef: string }): Promise<mls.editor.IModelBase> {

    const file = await mls.stor.addOrUpdateFile(params);
    if (!file) throw new Error('[agentNewMoleculeMaterialize] Invalid storFile');
    const path = mls.stor.getKeyToFile(params);
    console.log(`[agentNewMoleculeMaterialize] updating file: ${path}`);
    console.log(`[agentNewMoleculeMaterialize] updating content: ${params.content}`);

    const models = await file.getOrCreateModel();
    models.model.setValue(params.content);
    return models;

}


async function getGroupSkill(group: string) {

    const path = skillList.find((item) => item.name === group)?.skillReference;
    if (!path) throw new Error(`[getGroupSkill] skill for group not found: ${path}`);
    const module = await import(path);
    if (!module || !module.skill) throw new Error(`[getGroupSkill] skill for group not found: ${path}`);
    if (typeof module.skill !== 'string') throw new Error(`[getGroupSkill] invalid type of skill: ${path}, must be string`);
    return module.skill;

}

async function getBaseMolecule() {
    const key = mls.stor.getKeyToFile({ project: 102020, shortName: 'moleculeBase', folder: '', extension: '.ts', level: 2 })
    const storFile = mls.stor.files[key];
    if (!storFile) return '';
    const content = await storFile.getContent() as string;
    return content;
}

async function getMoleculeSkill(file: mls.stor.IFileInfo): Promise<{ skill: string, group: string, fileReference: string }> {

    const path = `/_${file.project}_/${file.folder ? file.folder + '/' : ''}${file.shortName}.defs.js`;
    const defs = await import(path);
    const fileReference = mls.stor.convertFileToFileReference(file);
    if (!defs) throw new Error(`[getMoleculeSkill] defs not found: ${path}`);
    if (!defs.skill) throw new Error(`[getMoleculeSkill] defs skill not found: ${path}`);
    if (!defs.group) throw new Error(`[getMoleculeSkill] defs group not found: ${path}`);

    return {
        skill: defs.skill,
        group: defs.group,
        fileReference: fileReference.replace('.defs.ts', '.ts')
    }

}

const system1 = `
<!-- modelType: codeinstruct -->

<!-- modelTypeList: geminiChat (2.5 pro), code (grok), deepseekchat, codeflash (gemini), deepseekreasoner, mini (4.1) ou nano (openai), codeinstruct (4.1), codereasoning(gpt5), code2 (kimi 2.5) -->

You are a senior Frontend Architect and Staff Software Engineer with 20+ years of experience building large-scale web applications using TypeScript, Lit, and state-driven architectures.

You must generate production-ready code that compiles without errors.
Task: Generate a molecule according the user request.

## Aura Overview
\`\`\`
{{systemSkillAura}}
\`\`\`

## Molecule Skill
\`\`\`
{{systemSkillMolecule}}
\`\`\`

## Molecule Class Base
\`\`\`typescript
{{systemBaseMolecule}}
\`\`\`

## Desing Skill
\`\`\`
{{systemSkillDesign}}
\`\`\`


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


