/// <mls fileReference="_102020_/l2/agents/newModule/agentOntologyGapCheck.ts" enhancement="_102027_/l2/enhancementAgent" />

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { findPreviousAgentStep } from '/_102027_/l2/aiAgentHelper.js';
import { updateVariableJson, getVariableJson } from '/_102027_/l2/defsAST.js';
import { ModuleToBe } from '/_102020_/l2/agents/newModule/agentToBeConceptual.js';

export function createAgent(): IAgentAsync {
    return {
        agentName: "agentOntologyGapCheck",
        agentProject: 102020,
        agentFolder: "agents/newModule",
        agentDescription: "Verify ontology covers all page data needs",
        visibility: "private",
        beforePromptImplicit,
        beforePromptStep,
        afterPromptStep
    };
}

function getOntologyStorFile(moduleName: string) {
    const key = mls.stor.getKeyToFile({ project: mls.actualProject || 0, level: 2, shortName: 'module', folder: moduleName, extension: '.defs.ts' });
    const sf = mls.stor.files[key];
    if (!sf) throw new Error('[agentOntologyGapCheck] ontology file not found');
    return sf;
}

async function buildSystemPrompt(moduleName: string, pagesJson: string): Promise<string> {
    const sf = getOntologyStorFile(moduleName);
    const src = await sf.getContent() as string;
    const ontology = getVariableJson<ModuleToBe>(src, 'ontology');
    return system1
        .replace('{{ontology}}', JSON.stringify(ontology, null, 2))
        .replace('{{pages}}', pagesJson);
}

async function beforePromptImplicit(
    agent: IAgentMeta,
    context: mls.msg.ExecutionContext,
    userPrompt: string,
): Promise<mls.msg.AgentIntent[]> {
    if (!userPrompt) throw new Error('invalid prompt');
    const info = JSON.parse(userPrompt) as { pages: unknown; moduleName: string };
    const systemPrompt = await buildSystemPrompt(info.moduleName, JSON.stringify(info.pages, null, 2));
    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: [
                { type: 'system', content: systemPrompt },
                { type: 'human', content: 'Check the ontology for gaps' }
            ],
            taskTitle: agent.agentDescription,
            threadId: context.message.threadId,
            userMessage: context.message.content,
            longTermMemory: { moduleName: info.moduleName }
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
    const info = JSON.parse(args) as { pages: unknown; moduleName: string };
    const systemPrompt = await buildSystemPrompt(info.moduleName, JSON.stringify(info.pages, null, 2));
    const continueIntent: mls.msg.AgentIntentPromptReady = {
        type: "prompt_ready",
        args,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        hookSequential,
        parentStepId: parentStep.stepId,
        humanPrompt: 'Check the ontology for gaps',
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
    if (!agent || !context || !step || !step.interaction?.payload)
        throw new Error('[afterPromptStep] invalid params');

    const payload = step.interaction.payload[0] as Output | undefined;
    if (!payload || payload.type !== 'flexible' || !payload.result)
        throw new Error('[afterPromptStep] invalid payload');

    const result = payload.result;
    const moduleName = context.task?.iaCompressed?.longMemory['moduleName'] as string;
    if (!moduleName) throw new Error('[agentOntologyGapCheck] moduleName not found');

    const sf = getOntologyStorFile(moduleName);
    let ontologyContent: string;

    if (result.hasGaps && result.newEntities && Object.keys(result.newEntities).length > 0) {
        const m = await sf.getOrCreateModel();
        const currentSrc = m.model.getValue() as string;
        console.info('antes', currentSrc);
        console.info('add', result.newEntities);
        const moduleToBe = getVariableJson<ModuleToBe>(currentSrc, 'ontology');
    
        moduleToBe.ontology = moduleToBe.ontology ?? { entities: {} };
        moduleToBe.ontology.entities = { ...moduleToBe.ontology.entities, ...result.newEntities };
        ontologyContent = updateVariableJson(currentSrc, 'ontology', moduleToBe);
        m.model.setValue(ontologyContent);
        await mls.stor.localStor.setContent(sf, { contentType: 'string', content: ontologyContent });
    } else {
        ontologyContent = await sf.getContent() as string;
    }

    const stepOri = context.task ? (findPreviousAgentStep(context.task, parentStep.stepId))?.stepId : parentStep.stepId;

    const newStep: mls.msg.AgentIntentAddStep = {
        type: "add-step",
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: stepOri || parentStep.stepId,
        step: {
            type: 'agent',
            stepId: 0,
            interaction: null,
            status: 'waiting_human_input',
            nextSteps: [],
            agentName: 'agentInterfaceOntology',
            prompt: ontologyContent,
            rags: [],
        }
    };

    const updateStatus: mls.msg.AgentIntentUpdateStatus = {
        type: 'update-status',
        hookSequential,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: parentStep.stepId,
        stepId: step.stepId,
        cleaner: 'input_output',
        status: 'completed'
    };

    return [newStep, updateStatus];
}

const system1 = `
<!-- modelType: codeinstruct -->
<!-- modelTypeList: geminiChat ?/10 , code (grok) ?/10, deepseekchat ?/10, codeflash (gemini) ?/10, deepseekreasoner ?/10, mini (4.1) ou nano (openai) ?/10, codeinstruct (4.1) ?/10, codereasoning(gpt5) ?/10, code2 (kimi 2.5) ?/10 -->

You are a senior Domain Architect with 20+ years of experience in system design.

Your task is to verify whether an existing ontology covers all the data needs implied by a set of page definitions.

## Current Ontology
\`\`\`json
{{ontology}}
\`\`\`

## Page Definitions
\`\`\`json
{{pages}}
\`\`\`

## Instructions

Analyze each page's purpose and actor, and the purpose of each organism within it.
Identify domain entities that would logically be required to implement these pages but are NOT present in the current ontology.

Focus on:
- Entities implied by organism purposes (e.g. "show order history" implies an Order entity)
- Junction or relationship entities needed to connect existing entities
- Entities implied by page actors and their workflows

Do NOT add entities that:
- Already exist in the ontology (even with a slightly different name)
- Are purely technical (sessions, logs, cache, tokens)
- Can be modeled as fields within an existing entity

## Entity structure (follow this schema exactly for each new entity)

Each entry in 'newEntities' must follow this structure:
\`\`\`
"EntityName": <EntityDefinition>
\`\`\`

Rules:
- Every entity MUST have an 'id' field of type string
- Use 'values' for closed enumerations
- Use 'required: false' for optional fields
- 'rules' references rule IDs from the existing ontology rules (only reference rules that exist)
- Field names must be in the same language as the existing ontology fields

IMPORTANT: When hasGaps is true, return ONLY the new missing entities in 'newEntities'.
Do NOT repeat or copy existing entities — they will be merged automatically.

## Output format
Return strictly JSON, no spaces, no indent, minified
[[OutputSection]]
`;

//#region OutputSection
export type Output = {
    type: "flexible";
    result: GapCheckResult;
};

export type GapCheckResult =
    | {
        hasGaps: false;
        summary: string;
    }
    | {
        hasGaps: true;
        summary: string;
        newEntities: Record<string, EntityDefinition>; // ONLY the missing entities — existing ones are merged in code
    };

export interface EntityDefinition {
    description?: string;

    fields: Record<string, EntityField>;

    // References business/platform rules that apply to this entity
    rules?: string[];
}

export interface EntityField {
    type: string;
    required?: boolean; // default = true
    values?: string[]; // Closed set, used for validation, DB schema and UI generation
    constraints?: string; // Free-text helper for LLMs and humans (never executable)
}
//#endregion
