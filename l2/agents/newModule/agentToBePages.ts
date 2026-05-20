/// <mls fileReference="_102020_/l2/agents/newModule/agentToBePages.ts" enhancement="_102027_/l2/enhancementAgent" />

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { getAgentStepByAgentName, getTemporaryContext, findPreviousAgentStep } from '/_102027_/l2/aiAgentHelper.js';
import { addMessage } from '/_102025_/l2/collabMessagesHelper.js';
import { updateVariableJson } from '/_102027_/l2/defsAST.js';
import { createStorFile, IReqCreateStorFile } from '/_102027_/l2/libStor.js';

export function createAgent(): IAgentAsync {
        return {
                agentName: "agentToBePages",
                agentProject: 102020,
                agentFolder: "agents/newModule",
                agentDescription: "Generate Page List",
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

        if (!userPrompt) throw new Error('invalid prompt');

        const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
                type: "add-message-ai",
                request: {
                        action: 'addMessageAI',
                        agentName: agent.agentName,
                        inputAI: [{
                                type: "system",
                                content: system1 //.replace("{{systemExperienceConstraints}}", systemExperienceConstraints)
                        }, {
                                type: "human",
                                content: userPrompt
                        }],
                        taskTitle: agent.agentDescription,
                        threadId: context.message.threadId,
                        userMessage: `test ${agent.agentName}`,
                        longTermMemory: {},
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
                humanPrompt: args || '',
                systemPrompt: system1 // .replace("{{systemExperienceConstraints}}", systemExperienceConstraints)
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

        const payload = (step.interaction?.payload?.[0]) as Output || undefined;
        if (payload?.type !== 'flexible' || !payload.result) throw new Error(`[afterPromptStep] invalid payload: ${payload}`)
        let status: mls.msg.AIStepStatus = 'completed';

        const output = payload.result;
        console.info(output);
        const intents = await processOutputToBePages(context, output as ToBePages, parentStep);

        const updateStatus: mls.msg.AgentIntentUpdateStatus = {
                type: 'update-status',
                hookSequential,
                messageId: context.message.orderAt,
                threadId: context.message.threadId,
                taskId: context.task?.PK || '',
                parentStepId: parentStep.stepId,
                stepId: step.stepId,
                cleaner: 'input_output',
                status
        };

        return [...intents, updateStatus];

}

async function processOutputToBePages(context: mls.msg.ExecutionContext, toBePages: ToBePages, parentStep: mls.msg.AIAgentStep): Promise<mls.msg.AgentIntent[]> {


        if (context.isTest) return [];

        let module = context.task?.iaCompressed?.longMemory['moduleName'];
        if (!module) throw new Error('[ToBePages]: Not found moduleName');

        const pages = toBePages.pages;//.slice(0, 3)
        for (const page of pages) {

                (page as any).status = 'draft';

                const refDef = `_${mls.actualProject || 0}_/l2/${module}/${page.pageName}.defs.ts`;
                const srcDefs = updateVariableJson('/// <mls fileReference="' + refDef + '"  enhancement="_blank"/>\n\n', 'definition', page);

                await saveFile(refDef, srcDefs);

        }

        const key = mls.stor.getKeyToFile({ project: mls.actualProject || 0, level: 2, shortName: 'module', folder: module, extension: '.defs.ts' });

        if (!mls.stor.files[key]) throw new Error("[agentTobePages] Not found ontology");

        const src = await mls.stor.files[key].getContent() as string;

        const stepOri = context.task ? (findPreviousAgentStep(context.task, parentStep.stepId))?.stepId : parentStep.stepId;
          
        const newStep: mls.msg.AgentIntentAddStep = {
                type: "add-step",
                messageId: context.message.orderAt,
                threadId: context.message.threadId,
                taskId: context.task?.PK || '',
                parentStepId: stepOri || parentStep.stepId,
                step:
                {
                        type: 'agent',
                        stepId: 0,
                        interaction: null,
                        status: 'waiting_human_input',
                        nextSteps: [],
                        agentName: 'agentInterfaceOntology',
                        prompt: src,
                        rags: [],
                }
        };

        return [newStep];

        /*const paths = toBePages.pages.map((page) => page.pageName)//.slice(0, 1);

        const newStep: mls.msg.AgentIntentAddStep = {
                type: "add-step",
                messageId: context.message.orderAt,
                threadId: context.message.threadId,
                taskId: context.task?.PK || '',
                stepTitle: "Initializing pages: {{completed}} of {{total}}, errors: {{failed}}",
                parentStepId: 1,
                step:
                {
                        type: 'agent',
                        stepId: 0,
                        interaction: null,
                        status: 'waiting_human_input',
                        nextSteps: [],
                        agentName: "agentToBePage",
                        prompt: `[agentToBePages] ${JSON.stringify({ toBePages, moduleName: '' })}`,
                        rags: null,
                        onFailure: 'wait_after_prompt'
                },
                executionMode: {
                        type: 'parallel',
                        args: paths
                }
        };

        return [newStep];*/


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



export function getPayloadToBePages(context: mls.msg.ExecutionContext): ToBePages | undefined {

        if (!context.task) return undefined;
        const agentName = 'agentToBePages'
        const agentStep = getAgentStepByAgentName(context.task, agentName); // Only one agent execution must exist in this task
        if (!agentStep) throw new Error(`[${agentName}] [getPayload] no agent found`);

        const resultStep = agentStep.interaction?.payload?.[0];
        if (!resultStep || resultStep.type !== "flexible" || !resultStep.result) throw new Error(`[${agentName}] [getPayload] No step clarification found for this agent.`);
        let payloadToBePages: ToBePages | string = resultStep.result;
        if (typeof payloadToBePages === "string") payloadToBePages = JSON.parse(payloadToBePages) as ToBePages;
        return payloadToBePages;
}


/*
"agentToBePages",
"t1, gemini-2.5-pro, 42s, $0.0192, 7.1/10",
"t2, gpt-5.2, 40s, $0.0477, 8.8/10",
"t3, grok-code-fast-1, 26s, $0.0036, 6.2/10",
"t4, moonshotai/kimi-k2.5, 61s, $0.0156, 5.8/10 - double deffinition of staff pages, json formatting issues, loop"*/
const system1 = `
<!-- modelType: codeinstruct -->
<!-- modelTypeList: geminiChat ?/10 , code (grok) ?/10, deepseekchat ?/10, codeflash (gemini) ?/10, deepseekreasoner ?/10, mini (4.1) ou nano (openai) ?/10, codeinstruct (4.1) ?/10, codereasoning(gpt5) ?/10, code2 (kimi 2.5) ?/10 -->

You are a senior BUSINESS Analyst.

Task: Generate ToBePages from the given 'Experience Model' and 'Capabilities Summary'.

Step-by-step (MANDATORY):
1) Read screens[] from the Experience Model.
2) For each screens[i], create exactly one pages[i].
3) pages[i].screenId MUST equal screens[i].screenId (same order, 1:1).
4) Do not create extra pages and do not skip screens.

Rules:
- Do NOT invent screens/pages that are not in screens[].
- Navigation is handled by the AppShell; pages must NOT include menus/tabs/navigation controls.
- Sections are content containers. If a section uses tabs/panels, set mode="exclusive" (only one organism visible at a time).
- Organisms are layout containers with a single purpose (no business logic).
- Do NOT define molecules or atoms yet.
- Do NOT define technical implementation.
- You MUST follow experienceConstraints when deciding organisms and interaction patterns.

## Output format
You must return the object strictly as JSON, no spaces, no indent, minified
[[OutputSection]]
`

export const systemExperienceConstraints = `
## Experience Constraints
[[ExperienceConstraints]]
`

//#region ExperienceConstraints 
const experienceConstraints = {
        navigationMode: "state-driven",
        listLoadingPattern: "infinite-scroll",
        // pagination | load-more | infinite-scroll
        dialogPattern: "modal",
        // modal | inline | none
        allowPopups: false,

        allowMultiplePanels: false,
        // false -> Prefer tab-based layout for complex entity screens (identification, relationships, contracts, incidents).
        // true  -> Allow multiple panels visible at the same time (modern stacked layout).

        preferInlineEditing: true,
        preferOptimisticUpdates: true,
        navigationContainer: "appShell",
        screenPersistence: "keep-alive",
        layoutStructure: {
                separateContextSection: true,
                // true = create "header" section for contextual organisms
                // false = allow context organisms inside "main"
                preferSingleMainSection: false,
                // true = collapse all organisms into "main"
                allowedSections: ["header", "main", "aside", "footer"],
                contextSectionName: "header",
                mainSectionName: "main"
        }
}
//#endregion


//#region OutputSection
export type Output = {
        type: "flexible";
        result: ToBePages;
};
export interface ToBePages {
        pages: Page[];
}
export interface Page {
        screenId: string;
        pageName: string; // ex: listProducts
        actor: string; // "customer" | "staff" | "admin"
        purpose: string;
        sections: Section[];
}
export interface Section {
        sectionName: string; // main, aside, header, footer, ...
        mode: "stack" | "exclusive";
        organisms: Organism[];
}
export interface Organism {
        organismName: string;  // e.g. "listProductsTop5", always prefixed with pageName in camelCase
        purpose: string;       // Short description of the organism's single responsibility
        rulesApplied: string[];
}
//#endregion

