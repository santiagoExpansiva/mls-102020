/// <mls fileReference="_102020_/l2/agents/newModule/agentCreatePersistence.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { createStorFile, IReqCreateStorFile } from '/_102027_/l2/libStor.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: "agentCreatePersistence",
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

  const info = JSON.parse(userPrompt);
  const ontology = await getOntology(info.moduleName);

  const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
    type: "add-message-ai",
    request: {
      action: 'addMessageAI',
      agentName: agent.agentName,
      inputAI: [{
        type: "system",
        content: system1.replace('{{ontology}}', ontology).replace('{{projectId}}', (mls.actualProject || 0).toString()).replace('{{moduleName}}', info.moduleName),
      }, {
        type: "human",
        content: 'create persistence file'
      }],
      taskTitle: `Test 1`,
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

  let moduleName = context.task?.iaCompressed?.longMemory['moduleName'];
  if (!moduleName) throw new Error('[agentCreatePersistence]: Not found moduleName');

  const ontology = await getOntology(moduleName);

  const continueIntent: mls.msg.AgentIntentPromptReady = {
    type: "prompt_ready",
    args,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    hookSequential,
    parentStepId: parentStep.stepId,
    humanPrompt: 'create persistence file',
    systemPrompt: system1.replace('{{ontology}}', ontology).replace('{{projectId}}', (mls.actualProject || 0).toString()).replace('{{moduleName}}', moduleName)
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
    status
  };

  return [...intents, updateStatus];

}

async function processOutput(context: mls.msg.ExecutionContext, output: any): Promise<mls.msg.AgentIntent[]> {

  if (!output.srcFile) throw new Error('[agentCreatePersistence] not found srcFile');

  let moduleName = context.task?.iaCompressed?.longMemory['moduleName'];
  if (!moduleName) throw new Error('[agentCreatePersistence]: Not found moduleName');

  await saveFile(`_${mls.actualProject}_/l1/${moduleName}/layer_1_external/persistence.ts`, output.srcFile)

  return [];
}

async function saveFile(ref: string, src: string, needCreateModel: boolean = true) {

  const info = mls.stor.convertFileReferenceToFile(ref);
  const k = mls.stor.getKeyToFile(info);
  let sf = mls.stor.files[k];

  if (!sf) {
    const param: IReqCreateStorFile = {
      ...info,
      source: src
    }

    sf = await createStorFile(param, needCreateModel, needCreateModel, needCreateModel);

  } else {

    const m = await sf.getOrCreateModel();
    if (m && m.model) m.model.setValue(src);

  }

  await mls.stor.localStor.setContent(sf, { contentType: 'string', content: src });
}

async function getOntology(moduleName: string): Promise<string> {

  const key = mls.stor.getKeyToFile({ project: mls.actualProject || 0, level: 2, shortName: 'module', folder: moduleName, extension: '.defs.ts' });

  if (!mls.stor.files[key]) throw new Error("[agentCreatePersistence] Not found ontology");

  const src = await mls.stor.files[key].getContent() as string;
  return src;
}


const system1 = `
<!-- modelType: codeinstruct -->
<!-- modelTypeList: geminiChat (2.5 pro), code (grok), deepseekchat, codeflash (gemini), deepseekreasoner, mini (4.1) ou nano (openai), codeinstruct (4.1), codereasoning(gpt5), code2 (kimi 2.5) -->

#Base Info
projectId = {{projectId}};
moduleName = {{moduleName}};

Your task is to generate the content of \`l1/{moduleName}/persistence.ts\`
for project \`{projectId}\`, one \`TableDefinition\` entry per entity found in \`ontology.entities\`.

---

## Architecture of the file to generate

### 1. MLS file header
\`\`\`
/// <mls fileReference="_{projectId}_/l1/{moduleName}/persistence.ts" enhancement="_blank" />
\`\`\`

### 2. Import
\`\`\`typescript
import type { TableDefinition } from '/_102034_/l1/server/layer_1_external/persistence/contracts.js';
\`\`\`

### 3. Export
\`\`\`typescript
export const tableDefinitions: TableDefinition[] = [
  // one entry per entity
];
\`\`\`

---

## How to derive each TableDefinition from an entity

Given entity name \`{EntityName}\` (e.g. \`ItemCardapio\`) and module \`{moduleName}\`:

### repositoryName
camelCase: \`{moduleName}\` + \`{EntityName}\` with first letter uppercased.
Examples:
- \`{moduleName}\` + \`Cliente\` → \`{moduleName}Cliente\`
- \`{moduleName}\` + \`ItemCardapio\` → \`{moduleName}ItemCardapio\`

### tableName
**Exactly the entity key as it appears in \`ontology.entities\`** — no module prefix, no case conversion.
Examples:
- entity key \`Cliente\` → tableName \`'Cliente'\`
- entity key \`ItemCardapio\` → tableName \`'ItemCardapio'\`
- entity key \`Pedido\` → tableName \`'Pedido'\`

### moduleId
Always \`'{moduleName}'\`.

### purpose
Always \`'cadastro'\`.

### description
Use the entity's \`description\` field from the ontology verbatim.

### backupHot
Always \`true\`.

### storageProfile
Always \`'postgresHotBackup'\`.

### writeMode
Always \`'writeBehind'\`.

### version
Always \`1\`.

---

## columns — type mapping

Generate one column entry per entity field, in the same order as they appear in the ontology.

| ontology type | postgresType   |
|---------------|----------------|
| \`"string"\`  | \`'TEXT'\`     |
| \`"number"\`  | \`'INTEGER'\`  |
| \`"boolean"\` | \`'BOOLEAN'\`  |
| \`"date"\`    | \`'TIMESTAMPTZ'\` |
| field has \`values\` (enum) | \`'TEXT'\` |

Column entry shape: \`{ name: '{fieldName}', postgresType: '{TYPE}' }\`

---

## primaryKey

Array containing the name of the **first field** of the entity.
Example: entity first field is \`id\` → \`primaryKey: ['id']\`

---

## indexes

Generate indexes automatically according to these rules (evaluate each field independently):

1. **Enum/status fields** — field has a \`values\` array AND is NOT the primary key:
   \`{ name: 'idx_{tableName}_{fieldName}', columns: ['{fieldName}'] }\`

2. **Foreign key fields** — field name ends with \`Id\` AND is NOT the primary key:
   \`{ name: 'idx_{tableName}_{fieldName}', columns: ['{fieldName}'] }\`

3. **Numeric fields** — field type is \`"number"\` AND is NOT the primary key:
   \`{ name: 'idx_{tableName}_{fieldName}', columns: [{ name: '{fieldName}', direction: 'desc' }] }\`

4. **Date/timestamp fields** — field name contains \`data\`, \`date\`, \`hora\`, \`time\`, \`At\`, \`Em\`, \`updatedAt\`, \`createdAt\` AND is NOT the primary key:
   \`{ name: 'idx_{tableName}_{fieldName}', columns: [{ name: '{fieldName}', direction: 'desc' }] }\`

If an entity has no fields matching rules 1–4 (other than the primary key), the \`indexes\` array is empty: \`[]\`.

---

## dynamo

\`\`\`typescript
dynamo: {
  tableNameByEnv: {
    development: '{tableName}_documents',
    staging: '{tableName}_documents_test',
    production: '{tableName}_documents',
  },
  partitionKey: '{firstFieldName}',  // same as primaryKey[0]
},
\`\`\`

---

## Complete example

Entity \`ItemCardapio\` with moduleName \`pizzaria\`:

\`\`\`typescript
{
  moduleId: 'pizzaria',
  repositoryName: 'pizzariaItemCardapio',
  tableName: 'pizzaria_item_cardapio',
  purpose: 'cadastro',
  description: 'Item do cardápio digital.',
  backupHot: true,
  storageProfile: 'postgresHotBackup',
  writeMode: 'writeBehind',
  columns: [
    { name: 'id',            postgresType: 'TEXT'    },
    { name: 'nome',          postgresType: 'TEXT'    },
    { name: 'categoria',     postgresType: 'TEXT'    },
    { name: 'preco',         postgresType: 'INTEGER' },
    { name: 'tamanhos',      postgresType: 'TEXT'    },
    { name: 'sabores',       postgresType: 'TEXT'    },
    { name: 'adicionais',    postgresType: 'TEXT'    },
    { name: 'disponibilidade', postgresType: 'TEXT'  },
  ],
  primaryKey: ['id'],
  indexes: [
    { name: 'idx_pizzaria_item_cardapio_categoria',     columns: ['categoria'] },
    { name: 'idx_pizzaria_item_cardapio_disponibilidade', columns: ['disponibilidade'] },
    { name: 'idx_pizzaria_item_cardapio_preco',         columns: [{ name: 'preco', direction: 'desc' }] },
  ],
  dynamo: {
    tableNameByEnv: {
      development: 'pizzaria_item_cardapio_documents',
      staging:     'pizzaria_item_cardapio_documents_test',
      production:  'pizzaria_item_cardapio_documents',
    },
    partitionKey: 'id',
  },
  version: 1,
},
\`\`\`

---

## Ontology Base Info

\`\`\`typescript

{{ontology}}

\`\`\`


---
You must return ONLY a valid JSON object. No preamble, no explanation, no markdown
fences, no text before or after the JSON. Start your response with { and end with }

## Output format
The srcFile value must be a single-line JSON string.
Escape ALL special characters inside it:
  - newlines     → \n
  - tabs         → \t
  - double quotes → \"
  - backslashes  → \\
Never embed raw multiline code blocks inside a JSON string value.

Return strictly this structure:

[[OutputSection]]

`

//#region OutputSection
export type Output =
  {
    type: "flexible";
    result: {
      srcFile: string
    }
  }
//#endregion 


