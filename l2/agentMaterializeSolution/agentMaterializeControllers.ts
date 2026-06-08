/// <mls fileReference="_102020_/l2/agentMaterializeSolution/agentMaterializeControllers.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { createStorFile } from '/_102027_/l2/libStor.js';

interface ControllerStepArgs {
    pageId: string;
    pageDefsFileReference: string;
    moduleName: string;
    project: number;
}

interface RouterEntry {
    key: string;
    handlerName: string;
    importPath: string;
}

export function createAgent(): IAgentAsync {
    return {
        agentName: "agentMaterializeControllers",
        agentProject: 102020,
        agentFolder: "agentMaterializeSolution",
        agentDescription: "Generate layer_2_controllers from page .defs.ts BFF commands",
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

    const items = await getPageStepArgs(moduleName);
    if (items.length === 0) throw new Error(`No Page.defs.ts files found in l2/${moduleName} for module: ${moduleName}`);

    const inputs: mls.msg.IAMessageInputType[] = [
        { type: "system", content: systemPrompt }
    ];

    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: inputs,
            taskTitle: `Generate controllers for ${moduleName}`,
            threadId: context.message.threadId,
            userMessage: context.message.content,
            longTermMemory: {},
        },
        executionMode: {
            type: 'parallel',
            args: items.map((item) => JSON.stringify(item))
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
    const data: ControllerStepArgs = JSON.parse(args);
    console.info(`===process controller for page: ${data.pageId}`);

    const pageDefsContent = await readDefsFileContent(data.pageDefsFileReference);

    const usecaseRefs = extractUsecaseRefs(pageDefsContent);
    const usecaseContracts = await readUsecaseContracts(data.project, data.moduleName, usecaseRefs);

    const outputFileReference = `_${data.project}_/l1/${data.moduleName}/layer_2_controllers/${data.pageId}.ts`;
    const routerFileReference = `_${data.project}_/l1/${data.moduleName}/layer_2_controllers/router.ts`;
    const routerContent = await readTsFileContent(routerFileReference);

    const continueParallel: mls.msg.AgentIntentPromptReady = {
        type: "prompt_ready",
        args,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        hookSequential,
        parentStepId: parentStep.stepId,
        humanPrompt: `
Generate the TypeScript layer_2_controllers file for page: **${data.pageId}**

Module: ${data.moduleName} | Project: ${data.project}

## Page Definition (.defs.ts):
\`\`\`typescript
${pageDefsContent}
\`\`\`

## Usecase Implementation Contracts:
${usecaseContracts}

## Output controller file reference (echo exactly):
${outputFileReference}

## Current router.ts (null = does not exist yet):
${routerContent ?? 'null'}
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

    if (!agent || !context || !step) throw new Error(`[afterPromptStep] invalid params`);

    const payload = step.interaction?.payload?.[0];
    if (payload?.type !== 'flexible' || !payload.result) throw new Error(`[afterPromptStep] invalid payload: ${payload}`);

    const output: Output = payload;

    if (!context.isTest) {
        await saveFile(output.result.fileReference, output.result.fileContent);

        const fileInfo = mls.stor.convertFileReferenceToFile(output.result.fileReference);
        await updateRouterFile(
            fileInfo.project,
            output.result.moduleName,
            fileInfo.level,
            output.result.routerEntries
        );
    }

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

    return [updateStatus];
}

async function getPageStepArgs(moduleName: string): Promise<ControllerStepArgs[]> {
    const defsFiles = (Object.values(mls.stor.files) as mls.stor.IFileInfo[]).filter((f) =>
        f.level === 2 &&
        f.folder === moduleName &&
        f.extension === '.defs.ts' &&
        f.shortName.endsWith('Page') &&
        f.project === mls.actualProject
    );

    return defsFiles.map((f) => ({
        pageId: f.shortName,
        pageDefsFileReference: mls.stor.convertFileToFileReference(f),
        moduleName,
        project: f.project,
    }));
}

function extractUsecaseRefs(pageDefsSource: string): string[] {
    const refs = new Set<string>();
    const matches = pageDefsSource.matchAll(/"usecaseRefs"\s*:\s*\[([\s\S]*?)\]/g);
    for (const match of matches) {
        const names = match[1].match(/"([^"]+)"/g);
        if (names) names.forEach((n) => refs.add(n.replace(/"/g, '')));
    }
    return [...refs];
}

async function readUsecaseContracts(project: number, moduleName: string, usecaseRefs: string[]): Promise<string> {
    const usecaseFolder = `${moduleName}/layer_3_usecases`;
    const parts: string[] = [];

    for (const usecaseId of usecaseRefs) {
        const defsFile = (Object.values(mls.stor.files) as mls.stor.IFileInfo[]).find((f) =>
            f.project === project &&
            f.level === 1 &&
            f.folder === usecaseFolder &&
            f.extension === '.defs.ts' &&
            f.shortName === usecaseId
        );

        if (!defsFile) {
            parts.push(`### ${usecaseId}\n_Usecase defs not found_`);
            continue;
        }

        const content = await readDefsFileContent(mls.stor.convertFileToFileReference(defsFile));
        const tsFileRef = `_${project}_/l1/${moduleName}/layer_3_usecases/${usecaseId}.ts`;
        parts.push(`### ${usecaseId}\n**importPath**: \`/${tsFileRef.replace(/\.ts$/, '.js')}\`\n\`\`\`typescript\n${content}\n\`\`\``);
    }

    return parts.join('\n\n');
}

async function readDefsFileContent(fileReference: string): Promise<string> {
    const path = mls.stor.getPathToFile(fileReference);
    const files = await mls.stor.getFiles({ ...path, loadContent: false });
    if (!files.defs) throw new Error(`[readDefsFileContent] file not found: ${fileReference}`);
    const model = await files.defs.getOrCreateModel();
    if (!model) throw new Error(`[readDefsFileContent] could not load model: ${fileReference}`);
    return model.model.getValue();
}

async function readTsFileContent(fileReference: string): Promise<string | null> {
    const path = mls.stor.getPathToFile(fileReference);
    const files = await mls.stor.getFiles({ ...path, loadContent: false });
    if (!files.ts) return null;
    const model = await files.ts.getOrCreateModel();
    if (!model) return null;
    return model.model.getValue();
}

async function saveFile(fileReference: string, content: string): Promise<void> {
    const fileInfo = mls.stor.convertFileReferenceToFile(fileReference);
    if (!fileInfo || fileInfo.project < 1) throw new Error(`[saveFile] Invalid fileReference: ${fileReference}`);

    const path = mls.stor.getPathToFile(fileReference);
    const files = await mls.stor.getFiles({ ...path, loadContent: false });

    if (!files.ts) {
        await createStorFile({
            extension: '.ts',
            folder: fileInfo.folder,
            level: fileInfo.level,
            project: fileInfo.project,
            shortName: fileInfo.shortName,
            source: content,
            status: 'new'
        }, true, true, true);
    } else {
        const file = await mls.stor.addOrUpdateFile({ ...fileInfo, content, extension: '.ts', versionRef: new Date().toISOString() });
        if (!file) throw new Error(`[saveFile] addOrUpdateFile failed: ${fileReference}`);
        const model = await file.getOrCreateModel();
        model.model.setValue(content);
    }
}

async function updateRouterFile(
    project: number,
    moduleName: string,
    level: number,
    entries: RouterEntry[]
): Promise<void> {

    const routerRef = `_${project}_/l${level}/${moduleName}/layer_2_controllers/router.ts`;
    const existing = await readTsFileContent(routerRef);

    const updatedContent = existing
        ? applyRouterEntries(existing, entries)
        : buildRouterTemplate(project, level, moduleName, entries);

    const fileInfo = mls.stor.convertFileReferenceToFile(routerRef);
    const path = mls.stor.getPathToFile(routerRef);
    const files = await mls.stor.getFiles({ ...path, loadContent: false });

    if (!files.ts) {
        await createStorFile({
            extension: '.ts',
            folder: fileInfo.folder,
            level: fileInfo.level,
            project: fileInfo.project,
            shortName: fileInfo.shortName,
            source: updatedContent,
            status: 'new'
        }, true, true, true);
    } else {
        const file = await mls.stor.addOrUpdateFile({ ...fileInfo, content: updatedContent, extension: '.ts', versionRef: new Date().toISOString() });
        if (!file) throw new Error(`[updateRouterFile] addOrUpdateFile failed`);
        const model = await file.getOrCreateModel();
        model.model.setValue(updatedContent);
    }
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function buildRouterTemplate(project: number, level: number, moduleName: string, entries: RouterEntry[]): string {
    const routerFn = `create${capitalize(moduleName)}Router`;
    const importLines = entries.map((e) => `import { ${e.handlerName} } from '${e.importPath}';`).join('\n');
    const mapEntries = entries.map((e) => `    ['${e.key}', ${e.handlerName}],`).join('\n');

    return `/// <mls fileReference="_${project}_/l${level}/${moduleName}/layer_2_controllers/router.ts" enhancement="_blank" />
import type { BffHandler } from '/_102034_/l1/server/layer_2_controllers/contracts.js';
${importLines}

export function ${routerFn}(): Map<string, BffHandler> {
  return new Map<string, BffHandler>([
${mapEntries}
  ]);
}
`;
}

function applyRouterEntries(source: string, entries: RouterEntry[]): string {
    let result = source;

    for (const entry of entries) {
        if (result.includes(entry.handlerName)) continue;

        // Add import before the export function line
        result = result.replace(
            /^(export function create)/m,
            `import { ${entry.handlerName} } from '${entry.importPath}';\n$1`
        );

        // Add Map entry before the closing ]);
        result = result.replace(
            /(\s*\]\s*\)\s*;\s*\n?})/,
            `\n    ['${entry.key}', ${entry.handlerName}],$1`
        );
    }

    return result;
}

const systemPrompt = `
<!-- modelType: codeinstruct -->

You are a TypeScript expert specializing in Clean Architecture BFF controllers.

Your task is to generate a layer_2_controllers file for a page, based on its page definition and the usecase contracts.

## Architecture Rules:
- layer_2_controllers (BFF): Orchestrate requests, parse params, call layer_3_usecases, return BffResponse
- NEVER access tables directly — always call usecases
- One handler function per bffCommand
- Handler name pattern: [moduleName][CommandName]Handler (e.g. petShopStripeGetOrderHistoryHandler)

## Standard Imports:
\`\`\`typescript
import { ok, AppError, type BffHandler, type RequestContext } from '/_102034_/l1/server/layer_2_controllers/contracts.js';
\`\`\`

## Handler Pattern:
\`\`\`typescript
export const petShopStripeGetOrderHistoryHandler: BffHandler = async ({ request, ctx }) => {
    const input = request.params as GetOrderHistoryInput;
    // validate required fields
    if (!input.customerId) throw new AppError('VALIDATION_ERROR', 'customerId is required', 400);
    const result = await getOrderHistory(ctx, input);
    return ok(result);
};
\`\`\`


## Usecase Import:
- Use the importPath provided in the usecase contract section
- Use the functionName from implementation.functionName if present; otherwise derive from the usecaseId (strip "usecase" prefix, camelCase)

## Input/Output types:
- If the usecase defs has implementation.inputTypeName/outputTypeName, use those type names
- If not, derive from the bffCommand input/output spec using TypeScript interfaces
- ALL interfaces and types must be exported with \`export\`

## Router entries:
Return one entry per bffCommand with:
- key: "[moduleName].[pageId].[commandName]"
- handlerName: the exported handler const name
- importPath: the .js path of the generated controller file (from fileReference, .ts → .js)

## File generation rules:
1. First line: \`/// <mls fileReference="<outputFileReference>" enhancement="_blank" />\`
2. All exported type/interface declarations
3. All handlers exported as const

## Output format:
Return fileContent, fileReference (exact output path), moduleName, and routerEntries array.
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
    moduleName: string;
    routerEntries: RouterEntry[];
};
//#endregion
