/// <mls fileReference="_102020_/l2/agents/molecules/agentImproveMoleculeMaterialize.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { appendLongTermMemory } from '/_102027_/l2/aiAgentHelper.js';
import { skill as skillAura } from '/_102020_/l2/skills/aura/overview.js';
import { skill as skillMolecule } from '/_102020_/l2/skills/aura/moleculeGeneration2.js';
import { skills as skillList } from '/_102020_/l2/skills/molecules/index';

export function createAgent(): IAgentAsync {
    return {
        agentName: "agentImproveMoleculeMaterialize",
        agentProject: 102020,
        agentFolder: "agents",
        agentDescription: "Applies targeted improvements to an existing molecule source file",
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

    if (!userPrompt || userPrompt.length < 5) throw new Error('invalid prompt');

    const data: IDataPrompt = JSON.parse(userPrompt);
    const { systemContext, humanContent, groupSkill } = await preparePrompts(context, data);

    const baseMolecule = await getBaseMolecule();
    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: [{
                type: "system",
                content: system1
                    .replace("{{systemSkillAura}}", skillAura)
                    .replace("{{systemSkillMolecule}}", skillMolecule)
                    .replace("{{systemBaseMolecule}}", baseMolecule)
                    .replace("{{systemSkillGroup}}", groupSkill)
                    .replace("{{currentTs}}", systemContext)
            }, {
                type: "human",
                content: humanContent
            }],
            taskTitle: `Improving molecule...`,
            threadId: context.message.threadId,
            userMessage: context.message.content,
            longTermMemory: { page: data.page }
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
    const { systemContext, humanContent, groupSkill } = await preparePrompts(context, data);

    const baseMolecule = await getBaseMolecule();
    const continueIntent: mls.msg.AgentIntentPromptReady = {
        type: "prompt_ready",
        args,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        hookSequential,
        parentStepId: parentStep.stepId,
        humanPrompt: humanContent,
        systemPrompt: system1
            .replace("{{systemSkillAura}}", skillAura)
            .replace("{{systemSkillMolecule}}", skillMolecule)
            .replace("{{systemBaseMolecule}}", baseMolecule)
            .replace("{{systemSkillGroup}}", groupSkill)
            .replace("{{currentTs}}", systemContext)
    }

    return [continueIntent];
}

async function preparePrompts(context: mls.msg.ExecutionContext, data: IDataPrompt): Promise<{ systemContext: string; humanContent: string; groupSkill: string }> {
    const currentTs = await getContentByExtension(data.page, 'ts');
    const defsContent = await getContentByExtension(data.page, 'defs');
    const groupMatch = defsContent.match(/export const group = '([^']+)'/);
    const group = groupMatch?.[1] || '';
    const groupSkill = group ? await getGroupSkill(group) : '';
    if (context.task) await appendLongTermMemory(context, { page: data.page });
    return {
        systemContext: currentTs || '(no ts file found)',
        humanContent: data.prompt,
        groupSkill
    };
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

    let status: mls.msg.AIStepStatus = 'completed';
    let intents: mls.msg.AgentIntent[] = [];

    try {
        if (!context.isTest) {
            intents = await processOutput(context, payload.result);
        } else {
            console.info(payload.result.ts);
        }
    } catch (e) {
        console.error(e);
        status = 'failed';
    }

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

    // When needsPlayground is true, a child agent (agentNewMoleculePlayground) will be triggered.
    // Per parent-agent pattern: do not include updateStatus alongside add-step to avoid breaking child execution.
    const hasChildAgent = intents.some((i) => i.type === 'add-step');
    if (hasChildAgent) return intents;

    return [...intents, updateStatus];
}

async function processOutput(context: mls.msg.ExecutionContext, result: IResult): Promise<mls.msg.AgentIntent[]> {

    const fileReference = await updateMoleculeTs(context, result.ts);
    if (!result.needsPlayground) return [];

    const group = await getGroup(context, fileReference);

    const newStep: mls.msg.AgentIntentAddStep = {
        type: "add-step",
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: 1,
        stepTitle: 'Preparing playground',
        step: {
            type: 'agent',
            stepId: 0,
            interaction: null,
            status: 'waiting_human_input',
            nextSteps: [],
            agentName: "agentNewMoleculePlayground",
            prompt: JSON.stringify({ group, fileReference }),
            rags: null,
        }
    };

    return [newStep];
}

async function updateMoleculeTs(context: mls.msg.ExecutionContext, ts: string): Promise<string> {

    const firstLine = ts.trim().split('\n')[0];
    const tripleSlash = mls.common.tripleslash.parseXMLTripleSlash(firstLine);
    const fileReference = tripleSlash.variables['fileReference'];
    let fileInfo = mls.stor.convertFileReferenceToFile(fileReference);
    if (!fileReference || fileInfo.project < 1) throw new Error(`[updateMoleculeTs] invalid fileReference: ${fileReference}`);

    const paramsTs = { ...fileInfo, content: ts, versionRef: new Date().toISOString(), extension: ".ts" };
    const file = await mls.stor.addOrUpdateFile(paramsTs);
    if (!file) throw new Error('[updateMoleculeTs] addOrUpdateFile returned null');

    const models = await file.getOrCreateModel() as mls.editor.IModelTS;
    models.model.setValue(ts);

    await mls.l2.typescript.compileAndPostProcess(models, true, false);

    return fileReference;
}

async function getGroup(context: mls.msg.ExecutionContext, fileReference: string): Promise<string> {

    const groupFromMemory = context.task?.iaCompressed?.longMemory['group'];
    if (groupFromMemory) return groupFromMemory;

    const path = mls.stor.getPathToFile(fileReference);
    const files = await mls.stor.getFiles({ ...path, loadContent: false });
    if (!files.defs) throw new Error(`[getGroup] defs not found for: ${fileReference}`);

    const defsPath = `/_${files.defs.project}_/${files.defs.folder ? files.defs.folder + '/' : ''}${files.defs.shortName}.defs.js`;
    const defs = await import(defsPath);
    if (!defs?.group) throw new Error(`[getGroup] group not found in defs: ${defsPath}`);
    return defs.group;
}

async function getGroupSkill(group: string): Promise<string> {
    const path = skillList.find((item) => item.name === group)?.skillReference;
    if (!path) return '';
    const module = await import(path);
    if (!module?.skill || typeof module.skill !== 'string') return '';
    return module.skill;
}

async function getBaseMolecule(): Promise<string> {
    const key = mls.stor.getKeyToFile({ project: 102020, shortName: 'moleculeBase', folder: '', extension: '.ts', level: 2 });
    const storFile = mls.stor.files[key];
    if (!storFile) return '';
    const content = await storFile.getContent() as string;
    return content;
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
<!-- modelType: codeinstruct -->

You are an agent specialized in applying targeted improvements to an existing Lit web component molecule.

You will receive the current TypeScript source and a specific improvement request.
Apply only what is asked — preserve all existing behaviors, structure, and style not mentioned.

## RULES
1. Return the complete updated TypeScript source.
2. Do not remove or modify the first line (/// mls triple-slash reference).
3. Preserve existing behaviors not affected by the improvement request.
4. Apply only what is explicitly requested.
5. Add inline comments in English only for new implementations.

## needsPlayground field
Set \`needsPlayground: true\` if the change affects how the component is used or rendered externally:
- Added, removed, or renamed a \`@property\` decorator
- Added or removed a slot
- Added or removed a dispatched custom event
- Changed the \`render()\` template structure (new elements, new conditional sections)

Set \`needsPlayground: false\` if only internal behavior changed:
- Bug fix in logic not related to rendering
- Style-only change (CSS variables, colors, spacing, typography)
- Refactor with no observable difference from outside the component

## Context


### Aura Overview
\`\`\`
{{systemSkillAura}}
\`\`\`

### Molecule Generation Skill
\`\`\`
{{systemSkillMolecule}}
\`\`\`

### Molecule Class Base
\`\`\`typescript
{{systemBaseMolecule}}
\`\`\`

### Group Contract
\`\`\`
{{systemSkillGroup}}
\`\`\`

### Current molecule source
\`\`\`typescript
{{currentTs}}
\`\`\`

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
    ts: string;
    needsPlayground: boolean;
}

interface IDataPrompt {
    page: string;
    prompt: string;
}
//#endregion
