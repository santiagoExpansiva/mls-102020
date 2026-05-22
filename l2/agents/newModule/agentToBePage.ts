/// <mls fileReference="_102020_/l2/agents/newModule/agentToBePage.ts" enhancement="_102027_/l2/enhancementAgent" />

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { createStorFile, IReqCreateStorFile } from '/_102027_/l2/libStor.js';
import { findPreviousAgentStep } from '/_102027_/l2/aiAgentHelper.js';
import { updateVariableJson, updateVariableText } from '/_102027_/l2/defsAST.js';
import { addImport, addRoute, extractRouteHandlers } from "/_102020_/l2/newModule/astRouter.js";

export function createAgent(): IAgentAsync {
    return {
        agentName: "agentToBePage",
        agentProject: 102020,
        agentFolder: "agents/newModule",
        agentDescription: "Implement Page",
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

    if (!userPrompt) throw new Error('invalid prompt');

    // userPrompt contains all we need
    const info = JSON.parse(userPrompt);
    const ontology = await getOntology(info.moduleName);

    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: [
                { type: 'system', content: system1.replace('{{ontology}}', ontology).replace('{{moduleName}}', info.moduleName) },
                { type: 'human', content: userPrompt }
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

    if (args.startsWith("[agentToBePages]")) {

        const continueParallel1: mls.msg.AgentIntentPromptReady = {
            type: "prompt_ready",
            args,
            messageId: context.message.orderAt,
            threadId: context.message.threadId,
            taskId: context.task?.PK || '',
            hookSequential,
            parentStepId: 1,
            humanPrompt: '',
            systemPrompt: system1
        }
        return [continueParallel1];

    }

    const continueParallel: mls.msg.AgentIntentPromptReady = {
        type: "prompt_ready",
        args,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        hookSequential,
        parentStepId: parentStep.stepId,
        humanPrompt: args,
        //systemPrompt: system1
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

    if (step.status === 'waiting_after_prompt_with_error') {
        console.info('[' + agent.agentName + '] Chegou com erro:', step);
        return [];
    }

    if (!agent || !context || !step || !step.interaction || !step.interaction.payload) throw new Error(`[afterPromptStep] invalid params, agent:${!!agent}, context:${!!context}, step:${!!step}`);

    const payload = step.interaction.payload[0] as Output | undefined;
    if (!payload || payload.type !== 'flexible' || !payload.result) throw new Error(`[afterPromptStep] invalid payload`);

    const output = payload.result as ToBePages;
    const intents = await processOutput(context, output, agent, step);


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
    return [...intents];

}

async function processOutput(context: mls.msg.ExecutionContext, output: ToBePages, agent: IAgentMeta, parentStep: mls.msg.AIAgentStep): Promise<mls.msg.AgentIntent[]> {

    // preciso do modulo
    let module = context.task?.iaCompressed?.longMemory['moduleName'];
    if (!module) throw new Error('Not found moduleName:' + agent.agentName);

    const refDef = `_${mls.actualProject || 0}_/l2/${module}/${output.pages[0].pageName}.defs.ts`;
    let srcDefs = updateVariableJson('/// <mls fileReference="' + refDef + '"  enhancement="_blank"/>\n\n', 'definition', output);

    srcDefs = addPipeLine(srcDefs, module, output.pages[0].pageName, refDef);

    await saveFile(refDef, srcDefs);

    await addRouters(output, module, output.pages[0].pageName);

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
            agentName: 'agentMaterialize',
            prompt: refDef,
            rags: [],
            onFailure: 'wait_after_prompt'
        }
    };

    return [newStep];


}

function addPipeLine(src: string, moduleName: string, shortName: string, defsPath: string): string {

    //contract
    let newSrc = generateContract(src, defsPath, moduleName);

    //shared
    newSrc = generateShared(newSrc, defsPath, moduleName);

    // page
    newSrc = generatePage(newSrc, defsPath, moduleName, shortName);

    //pipeLine
    newSrc = updateVariableJson(newSrc, 'materializeIndex', generatePipeLine(moduleName, shortName));

    return newSrc;
}

async function addRouters(tobe: ToBePages, moduleName: string, shortName: string) {

    const key = mls.stor.getKeyToFile({ project: mls.actualProject || 0, level: 1, folder: `${moduleName}/layer_2_controllers`, shortName: "router", extension: ".ts" });
    if (!mls.stor.files[key]) throw new Error('[toBePage]Not found router file');

    const sf = mls.stor.files[key];

    let src = await sf.getContent() as string;

    const routes = extractRouteHandlers(tobe, moduleName);
    const pathImport = `/_${mls.actualProject}_/l1/${moduleName}/layer_2_controllers/${shortName}.js`

    routes.forEach((rt) => {

        const [state, nmFunc] = rt;
        src = addRoute(src, state, nmFunc);
        src = addImport(src, {
            kind: 'value',
            names: [nmFunc],
            from: pathImport,
        })

    });

    await saveFile(mls.stor.convertFileToFileReference(sf), src);


}



function generateContract(src: string, defsPath: string, moduleName: string) {
    return updateVariableText(src, 'contractSpec', `
## Pages spec
\\\`\\\`\\\`JSON
    [[(${defsPath}).definition]]
\\\`\\\`\\\`

## Ontology
\\\`\\\`\\\`JSON
    [[(_${mls.actualProject}_/l1/${moduleName}/module.ts)]]
\\\`\\\`\\\`
`)
}

function generateShared(src: string, defsPath: string, moduleName: string) {
    return updateVariableText(src, 'sharedSpec', `
## Pages spec
\\\`\\\`\\\`JSON
    [[(${defsPath}).definition]]
\\\`\\\`\\\`

## Ontology
\\\`\\\`\\\`JSON
    [[(_${mls.actualProject}_/l1/${moduleName}/module.ts)]]
\\\`\\\`\\\`

`)
}

function generatePage(src: string, defsPath: string, moduleName: string, shortName: string) {
    return updateVariableText(src, 'desktopLayoutSpec', `
## Pages spec
\\\`\\\`\\\`JSON
    [[(${defsPath}).definition]]
\\\`\\\`\\\`

## Base Class
\\\`\\\`\\\`JSON
    [[(_${mls.actualProject}_/l2/${moduleName}/web/shared/${shortName}.ts)]]
\\\`\\\`\\\`
`)
}

function generatePipeLine(moduleName: string, shortName: string) {
    const dt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const pipe = [
        {
            "id": "contract",
            "specVar": "contractSpec",
            "outputPath": "/l1/" + moduleName + "/layer_2_controllers/" + shortName + ".ts",
            "skillPath": "_102020_/l2/agents/newModule/skills/genContract.ts",
            "agent": "agentMaterializeContract",
            "dependsOn": [],
            "specUpdatedAt": dt
        },
        {
            "id": "shared",
            "specVar": "sharedSpec",
            "outputPath": "/l2/" + moduleName + "/web/shared/" + shortName + ".ts",
            "skillPath": "_102020_/l2/agents/newModule/skills/genPageShared.ts",
            "agent": "agentMaterializeSharedPage",
            "dependsOn": ["contract"],
            "specUpdatedAt": dt
        },
        {
            "id": "desktop",
            "specVar": "desktopLayoutSpec",
            "outputPath": "/l2/" + moduleName + "/web/desktop/page11/" + shortName + ".ts",
            "skillPath": "_102020_/l2/agents/newModule/skills/genPageRender.ts",
            "agent": "agentMaterializePageLit",
            "dependsOn": ["contract", "shared"],
            "specUpdatedAt": dt,
        }
    ];

    return pipe;
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

async function getOntology(moduleName: string): Promise<string> {

    const key = mls.stor.getKeyToFile({ project: mls.actualProject || 0, level: 2, shortName: 'module', folder: moduleName, extension: '.defs.ts' });

    if (!mls.stor.files[key]) throw new Error("[agentTobePage] Not found ontology");

    const src = await mls.stor.files[key].getContent() as string;
    return src;
}

const system1 = `
<!-- modelType: codeinstruct -->
<!-- modelTypeList: geminiChat ?/10 , code (grok) ?/10, deepseekchat ?/10, codeflash (gemini) ?/10, deepseekreasoner ?/10, mini (4.1) ou nano (openai) ?/10, codeinstruct (4.1) ?/10, codereasoning(gpt5) ?/10, code2 (kimi 2.5) ?/10 -->

You are a senior Frontend Architect and Staff Software Engineer with 20+ years of experience building large-scale web applications.

You must read the page definitions from the user prompt and **enrich the input data with additional relevant information**, including all necessary details, best practices, and technical considerations to create a complete and high-quality implementation.

The module name is: {{moduleName}};

## Anthology
\`\`\`typescript

{{ontology}}

\`\`\`


## Rules

1 - Always respect the definition already provided in the anthology.
2 - Do not invent areas that are not in the anthology.
3 - It is of utmost importance that the anthology be respected.

## Output format
You must return the object strictly as JSON, no spaces, no indent, minified
[[OutputSection]]
`

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

    /** Page-level action states (loading, saving, error) */
    actionStates: ActionStateDef[];

    /** Page-level temporary states (filters, selections, toggles) */
    tempStates: TempStateDef[];
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

    /**
     * How this organism receives data from BFF.
     * Determines stateKey structure.
     */
    dataShape: DataShapeDef;

    /** Temporary states owned by this organism */
    tempStates: TempStateDef[];

    /** Computed fields derived from other data */
    computedFields: ComputedFieldDef[];

    /** Navigation actions triggered from this organism */
    navigationFields: NavigationFieldDef[];

    /** Events emitted by this organism */
    emits: EmitDef[];
}
export type DataShapeDef =
    | DataShapeFields      // flat fields — current model
    | DataShapeObject      // single object state
    | DataShapeCollection; // array of objects

/**
 * Flat fields — each field is an independent state.
 * Use when: simple entity display/edit with few fields.
 * stateKey per field: db.[entity].[field]
 */
export interface DataShapeFields {
    shape: 'fields';
    entityFields: EntityFieldRef[];
}
/**
 * Single object — the entire response is one state.
 * Use when: BFF returns a projected object, or entity has
 * nested sub-objects that must stay together.
 * stateKey: db.[entity] or db.[pageName].[routineAlias]
 */
export interface DataShapeObject {
    shape: 'object';
    stateKey: string;              // ex: 'db.catalogProducts.productDetail'
    sourceRoutine: string;         // ex: '{moduleName}.getProduct'
    fields: ObjectFieldRef[];      // declares what's inside for layout agent
    params: DataShapeParam[];
}
/**
 * Collection — array of objects, each with same structure.
 * Use when: lists, tables, grids, sub-entity arrays (addresses).
 * stateKey: db.[entity][] or db.[pageName].[alias][]
 */
export interface DataShapeCollection {
    shape: 'collection';
    stateKey: string;              // ex: 'db.product[]'
    sourceRoutine: string;         // ex: '{moduleName}.listProducts'
    itemFields: ObjectFieldRef[];  // fields per item
    /** Does the collection support inline editing? */
    params: DataShapeParam[];
    editable: boolean;
}
/**
 * Parameter needed to call the sourceRoutine.
 * Declares WHERE the value comes from at runtime.
 */
export interface DataShapeParam {
    /** Param name as expected by the BFF routine */
    paramName: string;
    /** Type of the param value */
    type: string;
    /** Where the value comes from at runtime */
    source: ParamSource;
}
export type ParamSource =
    | { from: 'route'; routeParam: string }          // /store/:storeInfoId
    | { from: 'state'; stateKey: string }             // picked in another organism
    | { from: 'context'; contextKey: string }           // user.storeId, user.companyId
    | { from: 'config'; configKey: string }            // module.defaultStoreId
    | { from: 'parent'; parentStateKey: string }       // parent organism selection
    | { from: 'fixed'; value: string | number | boolean };  // hardcoded

/**
 * A field inside an object or collection item.
 * No individual stateKey — accessed via parent.
 */
export interface ObjectFieldRef {
    entityField: string;
    entity: string;
    priority: FieldPriority;
    usage: 'display' | 'edit' | 'filter' | 'sort' | 'group';
    /** Marks array sub-fields: addresses[].street */
    isNested?: boolean;
    /** For nested sub-arrays within an item */
    nestedCollection?: {
        stateKeySuffix: string;    // ex: '.addresses[]'
        itemFields: ObjectFieldRef[];
    };
    priorityReason?: string;
}
export type FieldPriority = 'required' | 'recommended' | 'optional' | 'future';
export interface EntityFieldRef {
    entity: string;
    entityField: string;
    stateKey: string; // e.g. 'db.[entity].[entidyField]' or 'db.[entity].[entidyField][]'
    priority: FieldPriority;
    /** How this field is used in the organism */
    usage: 'display' | 'edit' | 'filter' | 'sort' | 'group';
    /** Brief note on why this priority was chosen */
    priorityReason?: string;
}
export interface ActionStateDef {
    stateKey: string; // e.g. 'ui.[page].cancel'
    description: string;
    /** Possible values — typically 'idle' | 'loading' | 'success' | 'error' */
    values: string[];
}
export interface TempStateDef {
    stateKey: string; // e.g. 'ui.[page].filter.name'
    type: string;
    description: string;
    priority: FieldPriority;
    /** Initial value expression */
    initialValue?: string;
}
export interface ComputedFieldDef {
    fieldId: string;
    derivedFrom: string[];
    description: string;
    priority: FieldPriority;
}
export interface NavigationFieldDef {
    fieldId: string;
    target: string;
    params: string[];
    priority: FieldPriority;
    /** 'internal' = route change, 'external' = new tab/whatsapp/etc */
    navigationType: 'internal' | 'external';
}
export interface EmitDef {
    event: string;
    payload: string;
    writesState?: string;
}

//#endregion

