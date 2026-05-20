/// <mls fileReference="_102020_/l2/agents/newModule/agentInterfaceOntology.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { createStorFile, IReqCreateStorFile } from '/_102027_/l2/libStor.js';

export function createAgent(): IAgentAsync {
    return {
        agentName: "agentInterfaceOntology",
        agentProject: 102020,
        agentFolder: "agents/newModule",
        agentDescription: "New agent",
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

    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: [{
                type: "system",
                content: system1.replace('{{projectI}}', (mls.actualProject || 0).toString()).replace('{{ontologyJso}}', userPrompt),
            }, {
                type: "human",
                content: 'Create the ontology module'
            }],
            taskTitle: `Test 1`,
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
        humanPrompt: 'Create the ontology module l1',
        systemPrompt: system1.replace('{{projectI}}', (mls.actualProject || 0).toString()).replace('{{ontologyJso}}', args)
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
        cleaner: "input_output",
        status
    };

    return [...intents, updateStatus];

}

async function processOutput(context: mls.msg.ExecutionContext, output: any): Promise<mls.msg.AgentIntent[]> {

    if (!output.outputPath || !output.srcFile) throw new Error('[agentInterfaceOntology] Incomplet information');

    await saveFile(output.outputPath, output.srcFile);

    return [];
}

async function saveFile(ref: string, src: string) {

    const info = mls.stor.convertFileReferenceToFile(ref);
    const k = mls.stor.getKeyToFile(info);
    let sf = mls.stor.files[k];

    if (!sf) {
        const param: IReqCreateStorFile = {
            ...info,
            source: src
        }

        sf = await createStorFile(param, true, true, true);

    } else {

        const m = await sf.getOrCreateModel();
        if (m && m.model) m.model.setValue(src);

    }

    await mls.stor.localStor.setContent(sf, { contentType: 'string', content: src });
}


const system1 = `
<!-- modelType: codereasoning-->
<!-- modelTypeList: geminiChat (2.5 pro), code (grok), deepseekchat, codeflash (gemini), deepseekreasoner, mini (4.1) ou nano (openai), codeinstruct (4.1), codereasoning(gpt5), code2 (kimi 2.5) -->

You are a TypeScript code generator for the MLS framework.

Your task is to generate the content of the file \`l1/{moduleName}/module.ts\` based on the ontology JSON provided below.

## Rules

### File header
The first line must be:
\`\`\`
/// <mls fileReference="_{projectId}_/l1/{moduleName}/module.ts" enhancement="_blank" />
\`\`\`
Where \`{moduleName}\` comes from \`meta.moduleName\` and \`{projectId}\` is \`{{projectI}}\`.

### Entity interfaces
For each entry in \`ontology.entities\`, generate a TypeScript interface named \`{Prefix}{EntityName}\` where \`{Prefix}\` is \`meta.moduleName\` in PascalCase.

Field mapping rules:
- \`type: "string"\` → \`string\`
- \`type: "number"\` → \`number\`
- \`type: "boolean"\` → \`boolean\`
- Field with \`values\` array → union literal type: \`'val1' | 'val2' | ...\`
- Field with \`required: false\` → optional property: \`fieldName?: type\`
- All other fields → required: \`fieldName: type\`

### Update params interfaces
For each entity, generate a \`{Prefix}Update{EntityName}Params\` interface:
- The field named \`id\` (or the first field if none is named \`id\`) is **required**
- All other fields are **optional**
- For fields that have \`values\` (union types), reference the entity interface instead of repeating the union: \`{Prefix}{EntityName}['fieldName']\`
- Always append \`author?: string;\` at the end (for audit trail)

### SeedResult interface
After all entities and update params, add:
\`\`\`typescript
export interface {Prefix}SeedResult {
  insertedCount: number;
  totalCount: number;
  seededAt: string;
}
\`\`\`

## Input ontology
\`\`\`json
{{ontologyJso}}
\`\`\`


## Output format
You must return the object strictly as JSON
[[OutputSection]]

`

//#region OutputSection
export type Output =
    {
        type: "flexible";
        result: {
            outputPath: string, // same value fileReference
            srcFile: string,
        };
    }
//#endregion 


