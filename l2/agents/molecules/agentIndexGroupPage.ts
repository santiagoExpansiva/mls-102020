/// <mls fileReference="_102020_/l2/agents/molecules/agentIndexGroupPage.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { appendLongTermMemory } from '/_102027_/l2/aiAgentHelper.js';
import { skill as indexGroupPageSkill } from '/_102020_/l2/skills/molecules/indexGroupPage.js';
import { skills as skillList } from '/_102020_/l2/skills/molecules/index';
import { createStorFile } from '/_102027_/l2/libStor.js';

export function createAgent(): IAgentAsync {
    return {
        agentName: "agentIndexGroupPage",
        agentProject: 102020,
        agentFolder: "agents",
        agentDescription: "Generates the index showcase page (index.ts + index.html) for a molecule group",
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

    if (!userPrompt || userPrompt.length < 3) throw new Error('invalid prompt');
    if (!mls.actualProject) throw new Error(`(${agent.agentName})[beforePromptImplicit] project invalid`);

    const group = userPrompt.trim();
    const { systemPrompt, humanPrompt } = await buildPrompts(agent.agentName, group);

    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: [{
                type: "system",
                content: systemPrompt,
            }, {
                type: "human",
                content: humanPrompt,
            }],
            taskTitle: `Generating index page for ${group}`,
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
    if (!mls.actualProject) throw new Error(`(${agent.agentName})[beforePromptStep] project invalid`);

    const group = args.trim();
    const { systemPrompt, humanPrompt } = await buildPrompts(agent.agentName, group);

    const continueIntent: mls.msg.AgentIntentPromptReady = {
        type: "prompt_ready",
        args,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        hookSequential,
        parentStepId: parentStep.stepId,
        humanPrompt,
        systemPrompt,
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

    if (!agent || !context || !step) throw new Error(`[afterPromptStep] invalid params`);

    const payload = (step.interaction?.payload?.[0]);
    if (payload?.type !== 'flexible' || !payload.result) throw new Error(`[afterPromptStep] invalid payload: ${payload}`);

    const updateStatus: mls.msg.AgentIntentUpdateStatus = {
        type: 'update-status',
        hookSequential,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: parentStep.stepId,
        stepId: step.stepId,
        status: 'completed',
    };

    if (context.isTest) {
        console.info(JSON.stringify(payload.result, null, 2));
        return [updateStatus];
    }

    const { fileReference, compileOk } = await writeFiles(payload.result);

    if (!compileOk) {
        await appendLongTermMemory(context, { nextStep: 'finish' });
        const fixStep: mls.msg.AgentIntentAddStep = {
            type: 'add-step',
            messageId: context.message.orderAt,
            threadId: context.message.threadId,
            taskId: context.task?.PK || '',
            parentStepId: 1,
            stepTitle: `Fix errors: ${fileReference}`,
            step: {
                type: 'agent',
                stepId: 0,
                interaction: null,
                status: 'waiting_human_input',
                nextSteps: [],
                agentName: 'agentNewMoleculeFix',
                prompt: fileReference,
                rags: null,
            }
        };
        return [fixStep];
    }

    return [updateStatus];
}

// =========================================================================== HELPERS

async function buildPrompts(agentName: string, group: string): Promise<{ systemPrompt: string; humanPrompt: string }> {

    if (!mls.actualProject) throw new Error(`(${agentName})[buildPrompts] project invalid`);

    const groupEntry = skillList.find((s) => s.name === group);
    if (!groupEntry) throw new Error(`(${agentName})[buildPrompts] group not found in skills index: ${group}`);

    const usageSkill = await getGroupUsageSkill(agentName, groupEntry.skillUsageReference);
    const moleculeFiles = getMoleculeFiles(group);

    if (moleculeFiles.length === 0)
        throw new Error(`(${agentName})[buildPrompts] no molecules found in storage for group: ${group}`);

    const fileReference = `_${mls.actualProject}_/l2/molecules/${group}/index.ts`;

    const systemPrompt = system1
        .replace('{{ skill }}', indexGroupPageSkill)
        .replace('{{ groupName }}', group)
        .replace('{{ groupDescription }}', groupEntry.description)
        .replace('{{ usageSkill }}', usageSkill)
        .replace('{{ moleculeFiles }}', moleculeFiles.join('\n'))
        .replace('{{ actualProjectId }}', mls.actualProject.toString())
        .replace('{{ fileReference }}', fileReference);

    const humanPrompt = `Generate the index showcase page for molecule group: ${group}\nMolecules: ${moleculeFiles.join(', ')}`;

    return { systemPrompt, humanPrompt };
}

function getMoleculeFiles(group: string): string[] {
    const groupFolder = `molecules/${group.toLowerCase()}`;
    return Object.keys(mls.stor.files)
        .map((key) => mls.stor.files[key])
        .filter((sf) =>
            sf.project === mls.actualProject &&
            sf.extension === '.ts' &&
            sf.folder === groupFolder &&
            sf.shortName !== 'index'
        )
        .map((sf) => sf.shortName);
}

async function getGroupUsageSkill(agentName: string, skillReference: string): Promise<string> {
    const module = await import(skillReference);
    if (!module || !module.skill) throw new Error(`(${agentName})[getGroupUsageSkill] skill not found at: ${skillReference}`);
    if (typeof module.skill !== 'string') throw new Error(`(${agentName})[getGroupUsageSkill] invalid skill type at: ${skillReference}`);
    return module.skill;
}

async function writeFiles(output: Result): Promise<{ fileReference: string; compileOk: boolean }> {

    const firstLine = output.ts.trim().split('\n')[0];
    const tripleSlash = mls.common.tripleslash.parseXMLTripleSlash(firstLine);
    const fileReference = tripleSlash.variables['fileReference'];
    if (!fileReference) throw new Error(`[writeFiles] could not parse fileReference from triple-slash header`);

    const fileInfo = mls.stor.convertFileReferenceToFile(fileReference);
    if (fileInfo.project < 1) throw new Error(`[writeFiles] invalid fileReference: ${fileReference}`);

    const files = await mls.stor.getFiles({ ...fileInfo, loadContent: false });

    // ── Write index.html ─────────────────────────────────────────────────────
    const paramsHtml = { ...fileInfo, content: output.html, versionRef: new Date().toISOString(), extension: '.html' };

    if (!files.html) {
        const storFile = await createStorFile({
            extension: '.html',
            folder: fileInfo.folder,
            level: fileInfo.level,
            project: fileInfo.project,
            shortName: fileInfo.shortName,
            source: output.html,
            status: 'new',
        }, true, true, true);
        const modelHtml = await storFile.getOrCreateModel();
        if (modelHtml) mls.editor.forceModelUpdate(modelHtml.model);
    } else {
        const file = await mls.stor.addOrUpdateFile(paramsHtml);
        if (!file) throw new Error('[writeFiles] failed to update index.html');
        const modelHtml = await file.getOrCreateModel();
        modelHtml.model.setValue(output.html);
    }

    // ── Write index.ts ──────────────────────────────────────────────────────
    let modelTs: mls.editor.IModelTS;
    const paramsTs = { ...fileInfo, content: output.ts, versionRef: new Date().toISOString(), extension: '.ts' };

    if (!files.ts) {
        const storFile = await createStorFile({
            extension: '.ts',
            folder: fileInfo.folder,
            level: fileInfo.level,
            project: fileInfo.project,
            shortName: fileInfo.shortName,
            source: output.ts,
            status: 'new',
        }, true, true, true);
        modelTs = await storFile.getOrCreateModel();
    } else {
        const file = await mls.stor.addOrUpdateFile(paramsTs);
        if (!file) throw new Error('[writeFiles] failed to update index.ts');
        modelTs = await file.getOrCreateModel();
        modelTs.model.setValue(output.ts);
    }

    // ── Compile ──────────────────────────────────────────────────────────────
    const compileOk = await mls.l2.typescript.compileAndPostProcess(modelTs, true, false);
    console.info({ compileOk });

    return { fileReference, compileOk };
}

// =========================================================================== SYSTEM PROMPT

const system1 = `
<!-- modelType: codeinstruct -->

You are a Senior Frontend Engineer generating a showcase index page for a molecule group using Lit.

## Project info
- actualProjectId: {{ actualProjectId }}
- target fileReference: {{ fileReference }}

## Generation skill (follow strictly)
{{ skill }}

## Group: {{ groupName }}
Description: {{ groupDescription }}

## Group usage skill (property and contract reference)
\`\`\`md
{{ usageSkill }}
\`\`\`

## TypeScript/Lit binding rules
- String properties: attribute binding — \`placeholder="..."\`, \`name="..."\`
- Boolean properties: Lit property binding — \`.isEditing=\${true}\`, \`.disabled=\${false}\`
- Number properties: Lit property binding — \`.minSelection=\${1}\`, \`.maxSelection=\${3}\`
- Never use attribute binding for booleans or numbers in TypeScript Lit templates.

## Available molecules in the group (shortName without extension)
{{ moleculeFiles }}


## Output format
You must return the object strictly as JSON
[[OutputSection]]
`;

//#region OutputSection
export type Output = {
    type: "flexible";
    result: Result;
}

export type Result = {
    ts: string;   // full index.ts content including triple-slash header
    html: string; // index.html content — only the custom element tag line
}
//#endregion
