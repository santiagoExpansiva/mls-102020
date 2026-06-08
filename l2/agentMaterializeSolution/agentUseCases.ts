/// <mls fileReference="_102020_/l2/agentMaterializeSolution/agentUseCases.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { waitModelIdle } from '/_102027_/l2/libModel.js';
import { createStorFile } from '/_102027_/l2/libStor.js';

interface UsecaseStepArgs {
    usecaseId: string;
    usecaseDefsFileReference: string;
    moduleName: string;
    project: number;
    level: number;
}

export function createAgent(): IAgentAsync {
    return {
        agentName: "agentUseCases",
        agentProject: 102020,
        agentFolder: "agentMaterializeSolution",
        agentDescription: "Generate usecase implementations from .defs.ts definitions",
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

    const data = JSON.parse(userPrompt) as { moduleName: string };
    const { moduleName } = data;

    const items = await getUsecaseStepArgs(moduleName);
    if (items.length === 0) throw new Error(`No .defs.ts files found in layer_3_usecases for module: ${moduleName}`);

    const inputs: mls.msg.IAMessageInputType[] = [
        { type: "system", content: systemPrompt }
    ];

    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: inputs,
            taskTitle: `Generate usecases for ${moduleName}`,
            threadId: context.message.threadId,
            userMessage: context.message.content,
            longTermMemory: {},
        },
        executionMode: {
            type: 'parallel',
            args: items.slice(0, 1).map((item) => JSON.stringify(item))
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

    if (!args) throw new Error(`[beforePromptStep] args invalid`);
    const data: UsecaseStepArgs = JSON.parse(args);
    console.info(`===process usecase: ${data.usecaseId}`);

    const usecaseDefs = await readFileContent(data.usecaseDefsFileReference);
    const tableNames = extractTableNames(usecaseDefs);
    const tableDefsContent = await readTableDefs(data.project, data.level, data.moduleName, tableNames);
    const outputFileReference = data.usecaseDefsFileReference.replace(
        `${data.usecaseId}.defs.ts`,
        `${data.usecaseId}.ts`
    );

    const continueParallel: mls.msg.AgentIntentPromptReady = {
        type: "prompt_ready",
        args,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        hookSequential,
        parentStepId: parentStep.stepId,
        humanPrompt: `
Generate the TypeScript implementation for usecase: **${data.usecaseId}**

## Usecase Definition (.defs.ts):
\`\`\`typescript
${usecaseDefs}
\`\`\`

## Table Definitions (layer_1_external):
${tableDefsContent}

## Output file reference (echo this exactly in your response):
${outputFileReference}
        `
    };
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

    const payload = step.interaction?.payload?.[0];
    if (payload?.type !== 'flexible' || !payload.result) throw new Error(`[afterPromptStep] invalid payload: ${payload}`);
    debugger;
    const output: Output = payload;
    const intents = await processOutput(context, output.result.fileContent, output.result.fileReference);

    const defsFileReference = output.result.fileReference.replace(/\.ts$/, '.defs.ts');
    await updateDefsWithImplementation(context, defsFileReference, output.result.implementation);

    const updateStatus: mls.msg.AgentIntentUpdateStatus = {
        type: 'update-status',
        hookSequential,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: parentStep.stepId,
        stepId: step.stepId,
        status: 'completed'
    };

    return [...intents, updateStatus];
}

async function getUsecaseStepArgs(moduleName: string): Promise<UsecaseStepArgs[]> {
    const usecaseFolder = `${moduleName}/layer_3_usecases`;

    const defsFiles = (Object.values(mls.stor.files) as mls.stor.IFileInfo[]).filter((f) =>
        f.folder === usecaseFolder &&
        f.extension === '.defs.ts' &&
        f.project === mls.actualProject
    );

    return defsFiles.map((f) => ({
        usecaseId: f.shortName.replace(/\.defs$/, ''),
        usecaseDefsFileReference: mls.stor.convertFileToFileReference(f),
        moduleName,
        project: f.project,
        level: f.level,
    }));
}

function extractTableNames(defsSource: string): string[] {
    const allTables = new Set<string>();

    const patterns = [
        /"readsTables"\s*:\s*\[([\s\S]*?)\]/,
        /"writesTables"\s*:\s*\[([\s\S]*?)\]/,
    ];

    for (const pattern of patterns) {
        const match = defsSource.match(pattern);
        if (match?.[1]) {
            const names = match[1].match(/"([^"]+)"/g);
            if (names) {
                names.forEach((n) => allTables.add(n.replace(/"/g, '')));
            }
        }
    }

    return [...allTables];
}

async function readFileContent(fileReference: string): Promise<string> {
    const path = mls.stor.getPathToFile(fileReference);
    const files = await mls.stor.getFiles({ ...path, loadContent: false });
    if (!files.defs) throw new Error(`[readFileContent] file not found: ${fileReference}`);
    const model = await files.defs.getOrCreateModel();
    if (!model) throw new Error(`[readFileContent] could not load model: ${fileReference}`);
    return model.model.getValue();
}

async function readTableDefs(
    project: number,
    level: number,
    moduleName: string,
    tableNames: string[]
): Promise<string> {
    const tableFolder = `${moduleName}/layer_1_external`;
    const parts: string[] = [];

    for (const tableName of tableNames) {
        const tableFile = (Object.values(mls.stor.files) as mls.stor.IFileInfo[]).find((f) =>
            f.project === project &&
            f.level === level &&
            f.folder === tableFolder &&
            f.extension === '.defs.ts' &&
            f.shortName === tableName
        );

        if (!tableFile) {
            parts.push(`### Table: ${tableName}\n_Definition not found_`);
            continue;
        }

        const content = await readFileContent(mls.stor.convertFileToFileReference(tableFile));
        parts.push(`### Table: ${tableName}\n\`\`\`typescript\n${content}\n\`\`\``);
    }

    return parts.join('\n\n');
}

async function processOutput(
    context: mls.msg.ExecutionContext,
    fileContent: string,
    fileReference: string
): Promise<mls.msg.AgentIntent[]> {

    if (context.isTest) return [];
    if (!fileReference || !fileContent) throw new Error('[processOutput] Invalid output data');

    const fileInfo = mls.stor.convertFileReferenceToFile(fileReference);
    if (!fileInfo || fileInfo.project < 1) throw new Error(`[processOutput] Invalid fileReference: ${fileReference}`);

    const paramsTs = {
        ...fileInfo,
        content: fileContent,
        versionRef: new Date().toISOString(),
        fileReference,
        extension: '.ts'
    };
    await updateFiles(paramsTs);
    return [];
}

async function updateFiles(result: {
    content: string;
    versionRef: string;
    extension: string;
    project: number;
    level: number;
    shortName: string;
    folder: string;
    fileReference: string;
}) {


    const fileInfo = { ...result };
    const files = await mls.stor.getFiles({ ...fileInfo, loadContent: false });

    if (!files.ts) {
        await createStorFile({
            extension: '.ts',
            folder: fileInfo.folder,
            level: fileInfo.level,
            project: fileInfo.project,
            shortName: fileInfo.shortName,
            source: fileInfo.content,
            status: 'new'
        }, true, true, true);

    } else {
        await updateStorFile(fileInfo);
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


async function updateDefsWithImplementation(
    context: mls.msg.ExecutionContext,
    defsFileReference: string,
    implementation: ImplementationContract
): Promise<void> {

    if (context.isTest) return;

    const currentContent = await readFileContent(defsFileReference);
    const updatedContent = injectImplementationIntoDefs(currentContent, implementation);

    const fileInfo = mls.stor.convertFileReferenceToFile(defsFileReference);
    await updateStorFile({
        ...fileInfo,
        content: updatedContent,
        versionRef: new Date().toISOString(),
        extension: '.defs.ts'
    });
}

function injectImplementationIntoDefs(defsSource: string, implementation: ImplementationContract): string {
    const implJson = JSON.stringify(implementation, null, 2)
        .split('\n')
        .map((line, i) => (i === 0 ? line : '  ' + line))
        .join('\n');

    const hasImpl = /"implementation"\s*:/.test(defsSource);

    if (hasImpl) {
        return defsSource.replace(
            /"implementation"\s*:\s*\{[\s\S]*?\}(?=\s*[\n,}])/,
            `"implementation": ${implJson}`
        );
    }

    const marker = '} as const;';
    const idx = defsSource.lastIndexOf(marker);
    if (idx === -1) throw new Error('[injectImplementationIntoDefs] Cannot find "} as const;" in defs file');

    const before = defsSource.slice(0, idx).trimEnd();
    const after = defsSource.slice(idx);
    const separator = before.endsWith(',') ? '' : ',';

    return `${before}${separator}\n  "implementation": ${implJson}\n${after}`;
}

const systemPrompt = `
<!-- modelType: codeinstruct -->

You are a TypeScript expert specializing in Clean Architecture implementations.

Your task is to generate a TypeScript usecase implementation file based on a usecase definition (.defs.ts) and the table definitions it depends on.

## Architecture Rules:
- Layer 3 (layer_3_usecases): Executes business rules, reads/writes layer_1_external tables
- Layer 2 (layer_2_controllers/BFF): Orchestrates requests, calls usecases — never accesses tables directly
- Layer 1 (layer_1_external): Persistence — tables only accessible from layer_3_usecases

## Standard Imports:
\`\`\`typescript
import { AppError, type RequestContext } from '/_102034_/l1/server/layer_2_controllers/contracts.js';
\`\`\`

## Table Access Pattern:
getTable is ASYNC — always use await:
\`\`\`typescript
async function getCartRepository(ctx: RequestContext) {
    return await ctx.data.moduleData.getTable<CartRecord>('cart');
}
\`\`\`

## ITableRepository<TRecord> operations:
\`\`\`typescript
findOne(input: { where: Partial<TRecord> }): Promise<TRecord | null>
findMany(input?: IFindManyInput<TRecord>): Promise<TRecord[]>
findManyByValues<TKey extends keyof TRecord>(input: { field: TKey; values: Array<NonNullable<TRecord[TKey]>>; limit?: number }): Promise<TRecord[]>
insert(input: { record: TRecord }): Promise<void>
upsert(input: { record: TRecord }): Promise<void>
update(input: { where: Partial<TRecord>; patch: Partial<TRecord> }): Promise<void>
delete(input: { where: Partial<TRecord> }): Promise<void>
\`\`\`

## IFindManyInput — orderBy format:
\`\`\`typescript
// CORRECT:
const rows = await repo.findMany({
    where: { customerId: input.customerId },
    orderBy: { field: 'createdAt', direction: 'desc' },
    limit: 50,
});

// WRONG — never use this format:
// orderBy: { createdAt: 'desc' }       ← incorrect
// orderBy: { field: 'createdAt: desc' } ← incorrect
\`\`\`

## Transactions (required when writing multiple tables):
\`\`\`typescript
await ctx.data.moduleData.runInTransaction(async (txRuntime) => {
    const cartRepo = await txRuntime.getTable<CartRecord>('cart');
    const orderRepo = await txRuntime.getTable<OrderRecord>('order');
    // ... operations
});
\`\`\`

## AppError:
\`\`\`typescript
throw new AppError('VALIDATION_ERROR', 'Field is required', 400, { field: 'cartId' });
throw new AppError('NOT_FOUND', 'Cart not found', 404, { cartId });
throw new AppError('CONFLICT', 'Business rule violated', 409, { reason });
\`\`\`

## File generation rules:
1. First line must be: \`/// <mls fileReference="<outputFileReference>" enhancement="_blank" />\`
2. Derive TypeScript types and interfaces from the table column definitions — ALL must be exported:
   \`\`\`typescript
   export type CartStatus = 'ativo' | 'convertido' | 'abandonado' | 'expirado';
   export interface CartRecord { cart_id: string; status: CartStatus; ... }
   export interface AddToCartInput { cartId: string; productId: string; ... }
   export interface CartAggregate { ... }
   \`\`\`
3. Export one async function per command listed in the usecase defs
4. Each function signature: (ctx: RequestContext, input: SpecificInputType) => Promise<SpecificOutputType>
5. Apply rules from rulesApplied as explicit guard conditions with descriptive AppError messages
6. Use runInTransaction when the usecase writes to multiple tables
7. Use ctx.clock.nowIso() for timestamps, ctx.idGenerator.newId() for new IDs
8. Never use unexported types — every \`interface\`, \`type\`, and \`enum\` declared in the file must have \`export\`

## Output format:
Return the complete TypeScript file content, the exact fileReference string, and the implementation contract with:
- **functionName**: the main exported function name (from the usecase command)
- **inputTypeName**: the TypeScript input type name (e.g. "AddToCartInput")
- **outputTypeName**: the TypeScript output/return type name (e.g. "CartAggregate")
- **inputTypeDefinition**: the complete TypeScript interface/type definition for the input (exported, full source including "export interface ...")
- **outputTypeDefinition**: the complete TypeScript interface/type definition for the output (exported, full source including "export interface ...")

You must return the object strictly as JSON
[[OutputSection]]
`;

//#region OutputSection
export type Output = {
    type: "flexible";
    result: Result;
};

export type Result = {
    fileContent: string;
    fileReference: string;
    implementation: ImplementationContract;
};

export interface ImplementationContract {
    functionName: string;
    inputTypeName: string;
    outputTypeName: string;
    inputTypeDefinition: string;
    outputTypeDefinition: string;
}
//#endregion
