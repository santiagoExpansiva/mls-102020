/// <mls fileReference="_102020_/l2/agentMaterializeSolution/agentMaterializeTables.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { createStorFile } from '/_102027_/l2/libStor.js';

interface TableStepArgs {
    tableId: string;
    tableDefsFileReference: string;
    moduleName: string;
    project: number;
    level: number;
}

export function createAgent(): IAgentAsync {
    return {
        agentName: "agentMaterializeTables",
        agentProject: 102020,
        agentFolder: "agentMaterializeSolution",
        agentDescription: "Generate TableDefinition persistence files from .defs.ts table definitions",
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

    const items = await getTableStepArgs(moduleName);
    if (items.length === 0) throw new Error(`No .defs.ts files found in layer_1_external for module: ${moduleName}`);

    const inputs: mls.msg.IAMessageInputType[] = [
        { type: "system", content: systemPrompt }
    ];

    const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
        type: "add-message-ai",
        request: {
            action: 'addMessageAI',
            agentName: agent.agentName,
            inputAI: inputs,
            taskTitle: `Materialize tables for ${moduleName}`,
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
    const data: TableStepArgs = JSON.parse(args);
    console.info(`===process table: ${data.tableId}`);

    const tableDefsContent = await readDefsFileContent(data.tableDefsFileReference);
    const outputFileReference = data.tableDefsFileReference.replace(
        `${data.tableId}.defs.ts`,
        `${data.tableId}.ts`
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
Generate the TypeScript TableDefinition persistence file for table: **${data.tableId}**

Module: ${data.moduleName}
Project: ${data.project}, Level: ${data.level}

## Table Definition (.defs.ts):
\`\`\`typescript
${tableDefsContent}
\`\`\`

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

    const output: Output = payload;

    if (!context.isTest) {
        await saveFile(output.result.fileReference, output.result.fileContent);

        const fileInfo = mls.stor.convertFileReferenceToFile(output.result.fileReference);
        await updatePersistenceFile(
            context,
            fileInfo.project,
            fileInfo.level,
            output.result.moduleName,
            output.result.exportName,
            output.result.fileReference
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

async function getTableStepArgs(moduleName: string): Promise<TableStepArgs[]> {
    const tableFolder = `${moduleName}/layer_1_external`;

    const defsFiles = (Object.values(mls.stor.files) as mls.stor.IFileInfo[]).filter((f) =>
        f.folder === tableFolder &&
        f.extension === '.defs.ts' &&
        f.project === mls.actualProject
    );

    return defsFiles.map((f) => ({
        tableId: f.shortName,
        tableDefsFileReference: mls.stor.convertFileToFileReference(f),
        moduleName,
        project: f.project,
        level: f.level,
    }));
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

async function updatePersistenceFile(
    context: mls.msg.ExecutionContext,
    project: number,
    level: number,
    moduleName: string,
    exportName: string,
    tableFileReference: string
): Promise<void> {

    if (context.isTest) return;

    const persistenceRef = `_${project}_/l${level}/${moduleName}/layer_1_external/persistence.ts`;
    const existingContent = await readTsFileContent(persistenceRef);

    const importLine = `import { ${exportName} } from '/${tableFileReference.replace(/\.ts$/, '.js')}';`;

    let updatedContent: string;

    if (!existingContent) {
        updatedContent = buildPersistenceTemplate(project, level, moduleName, importLine, exportName);
    } else {
        updatedContent = addImportAndEntryToPersistence(existingContent, importLine, exportName);
    }

    const fileInfo = mls.stor.convertFileReferenceToFile(persistenceRef);
    const path = mls.stor.getPathToFile(persistenceRef);
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
        if (!file) throw new Error(`[updatePersistenceFile] addOrUpdateFile failed`);
        const model = await file.getOrCreateModel();
        model.model.setValue(updatedContent);
    }
}

function buildPersistenceTemplate(
    project: number,
    level: number,
    moduleName: string,
    importLine: string,
    exportName: string
): string {
    return `/// <mls fileReference="_${project}_/l${level}/${moduleName}/layer_1_external/persistence.ts" enhancement="_blank" />
import type { TableDefinition } from '/_102034_/l1/server/layer_1_external/persistence/contracts.js';
${importLine}
export const tableDefinitions: TableDefinition[] = [${exportName}];
`;
}

function addImportAndEntryToPersistence(source: string, importLine: string, exportName: string): string {
    let result = source;

    if (!result.includes(exportName)) {
        // Add import before the `export const tableDefinitions` line
        result = result.replace(
            /^(export const tableDefinitions)/m,
            `${importLine}\n$1`
        );

        // Add exportName to the tableDefinitions array
        result = result.replace(
            /\btableDefinitions:\s*TableDefinition\[\]\s*=\s*\[([^\]]*)\]/,
            (_, content) => {
                const trimmed = content.trim();
                const entries = trimmed ? `${trimmed}, ${exportName}` : exportName;
                return `tableDefinitions: TableDefinition[] = [${entries}]`;
            }
        );
    }

    return result;
}

const systemPrompt = `
<!-- modelType: codeinstruct -->

You are a TypeScript expert. Your task is to generate a persistence file that exports a \`TableDefinition\` object based on a table's .defs.ts file.

## Import:
\`\`\`typescript
import type { TableDefinition } from '/_102034_/l1/server/layer_1_external/persistence/contracts.js';
\`\`\`

## TableDefinition interface:
\`\`\`typescript
interface TableDefinition {
  moduleId: string;
  repositoryName?: string;        // camelCase: moduleId + PascalCase(tableName). e.g. petShopStripeCart
  tableName: string;
  purpose: 'mdm' | 'cadastro' | 'transacao' | 'controle' | 'fila' | 'cache';
  description: string;
  backupHot: boolean;
  storageProfile: 'postgres' | 'postgresHotBackup' | 'dynamoOnly' | 'dynamoWithPostgresIndex';
  writeMode: 'sync' | 'writeBehind';
  columns: Array<{ name: string; postgresType: string; nullable?: boolean; defaultSql?: string; description?: string }>;
  primaryKey: string[];
  indexes?: Array<{ name: string; columns: Array<string | { name: string; direction?: 'asc' | 'desc' }>; unique?: boolean }>;
  timescale?: { hypertable: { timeColumn: string; chunkTimeInterval?: string } };
  dynamo?: { tableName?: string; tableNameByEnv?: { development?: string; staging?: string; production?: string }; partitionKey: string; sortKey?: string };
  retentionDays?: number;
  version: number;
}
\`\`\`

## Mapping rules from .defs.ts to TableDefinition:
- \`tableDefinition.tableName\` → \`tableName\`
- \`tableDefinition.moduleId\` → \`moduleId\`
- \`tableDefinition.purpose\` → \`description\` (use the title/purpose text from the defs)
- \`tableDefinition.tableKind\`:
  - "transactional" → purpose: 'transacao', storageProfile: 'postgres', writeMode: 'sync', backupHot: false
  - "metricTimeseries" → purpose: 'controle', storageProfile: 'postgres', writeMode: 'sync', backupHot: false (add timescale if storageProfile is timescale)
  - "mdm" → purpose: 'mdm', storageProfile: 'postgresHotBackup', writeMode: 'writeBehind', backupHot: true
  - "cadastro" → purpose: 'cadastro', storageProfile: 'postgres', writeMode: 'sync', backupHot: false
- Column type mapping: uuid→UUID, text→TEXT, int/integer→INTEGER, decimal/numeric→NUMERIC, timestamptz→TIMESTAMPTZ, date→DATE, time→TIME, boolean→BOOLEAN, jsonb→JSONB
- Use \`nullable\` from the defs column
- Use \`defaultSql\` if the defs has a default value (e.g. "0"→"0", timestamps→"NOW()")
- \`repositoryName\`: moduleId + PascalCase(tableName) (e.g. petShopStripe + Cart = petShopStripeCart)
- \`version: 1\`
- Include \`dynamo\` block only if the storage profile requires it (postgresHotBackup, dynamoOnly, dynamoWithPostgresIndex)
  - \`tableNameByEnv\`: development: "\${tableName}_documents", staging: "\${tableName}_documents_test", production: "\${tableName}_documents"
  - \`partitionKey\`: the primary key column name

## File generation rules:
1. First line: \`/// <mls fileReference="<outputFileReference>" enhancement="_blank" />\`
2. Export the constant with name: camelCase(tableName) + "TableDef" (e.g. cartTableDef, orderTableDef)
3. The constant must be typed as \`TableDefinition\`

## Example output:
\`\`\`typescript
/// <mls fileReference="_102030_/l1/petShopStripe/layer_1_external/cart.ts" enhancement="_blank" />
import type { TableDefinition } from '/_102034_/l1/server/layer_1_external/persistence/contracts.js';

export const cartTableDef: TableDefinition = {
    moduleId: 'petShopStripe',
    repositoryName: 'petShopStripeCart',
    tableName: 'cart',
    purpose: 'transacao',
    description: 'Persistir o carrinho ativo do cliente para checkout.',
    backupHot: false,
    storageProfile: 'postgres',
    writeMode: 'sync',
    columns: [
        { name: 'cart_id', postgresType: 'UUID', nullable: false },
        { name: 'customer_id', postgresType: 'UUID', nullable: false },
        { name: 'status', postgresType: 'TEXT', nullable: false },
        { name: 'total_amount', postgresType: 'NUMERIC', nullable: false, defaultSql: '0' },
        { name: 'created_at', postgresType: 'TIMESTAMPTZ', nullable: false },
    ],
    primaryKey: ['cart_id'],
    indexes: [
        { name: 'idx_cart_customer_status', columns: ['customer_id', 'status'] },
    ],
    version: 1,
};
\`\`\`

## Output format:
Return fileContent (complete file), fileReference (exact output path), moduleName (the module name), and exportName (the exported const name).
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
    exportName: string;
};
//#endregion
