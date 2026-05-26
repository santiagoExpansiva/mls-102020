/// <mls fileReference="_102020_/l2/agents/newModule/agentInterfaceOntology.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { createStorFile, IReqCreateStorFile } from '/_102027_/l2/libStor.js';
import {  findPreviousAgentStep } from '/_102027_/l2/aiAgentHelper.js';

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
  intents = await processOutput(context, output, parentStep);

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

async function processOutput(context: mls.msg.ExecutionContext, output: any, parentStep: mls.msg.AIAgentStep): Promise<mls.msg.AgentIntent[]> {

  if (!output.outputPath || !output.srcFile) throw new Error('[agentInterfaceOntology] Incomplet information');

  let moduleName = context.task?.iaCompressed?.longMemory['moduleName'];
  if (!moduleName) throw new Error('[ToBePages]: Not found moduleName');

  //Module interface
  await saveFile(output.outputPath, output.srcFile);

  //Config.json
  await generateConfig(moduleName);

  //Html
  await generateHtml(moduleName);

  //Info Module
  await generateInfoModule(moduleName);

  //Router
  await generateRouter(moduleName);

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
      agentName: 'agentCreatePersistence',
      prompt: 'Create a persistence file',
      rags: [],
    }
  };

  return [newStep];
}

async function generateConfig(moduleName: string) {


  const src = `{
  "defaultProjectId": "${mls.actualProject}",
  "shellTemplates": {
    "spa": "./_102033_/l2/shared/spa/index.html",
    "pwa": "./_102033_/l2/shared/pwa/index.html"
  },
  "publication": {
    "defaultTarget": "local",
    "targets": {
      "local": {
        "assetBaseUrl": "",
        "serveStaticFromServer": true,
        "minify": false,
        "sourcemap": true
      },
      "cdncloudflare": {
        "assetBaseUrl": "https://cdn.example.com",
        "serveStaticFromServer": false,
        "minify": true,
        "sourcemap": false
      }
    }
  },
  "workspaceDependencies": {
    "102029": {
      "repo": "https://github.com/expansiva/mls-102029.git",
      "commit": "df672f8fefc28293a9beab9a320604ecd841b5a6"
    },
    "102033": {
      "repo": "https://github.com/expansiva/mls-102033.git",
      "commit": "33134618aeff3c5d26be74d448d8fdffd083436e"
    },
    "102034": {
      "repo": "https://github.com/expansiva/mls-102034.git",
      "commit": "752302fa5a64619d73b4492356f57682736d0820"
    },
    "102020": {
      "repo": "https://github.com/expansiva/mls-102020.git",
      "commit": "721b2375c1a06ebc6e076e4a9c376176e8104779"
    },
    "102027": {
      "repo": "https://github.com/expansiva/mls-102027.git",
      "commit": "d6b164152882a57ea0b35b8db09ded3edec373fd"
    }
  },
  "projects": {
    "${mls.actualProject}": {
      "root": ".",
      "type": "client",
      "persistenceModules": [
        {
          "moduleId": "${moduleName}",
          "persistenceEntrypoint": "./_102035_/l1/${moduleName}/layer_1_external/persistence.js"
        }
      ],
      "modules": [
        {
          "moduleId": "${moduleName}",
          "basePath": "/${moduleName}",
          "shellMode": "spa",
          "backendRouter": "./_102035_/l1/${moduleName}/layer_2_controllers/router.js"
        }
      ]
    },
    "102033": {
      "root": "./_102033_",
      "type": "master frontend"
    },
    "102034": {
      "root": "./_102034_",
      "type": "master backend",
      "modules": [
        {
          "moduleId": "mdm",
          "basePath": "/mdm",
          "shellMode": "spa",
          "backendRouter": "./_102034_/l1/mdm/layer_2_controllers/router.js"
        },
        {
          "moduleId": "monitor",
          "basePath": "/monitor",
          "shellMode": "spa",
          "backendRouter": "./_102034_/l1/monitor/layer_2_controllers/router.js"
        },
        {
          "moduleId": "audit",
          "basePath": "/audit",
          "shellMode": "spa",
          "backendRouter": "./_102034_/l1/audit/layer_2_controllers/router.js"
        }
      ],
      "persistenceModules": [
        {
          "moduleId": "platform",
          "persistenceEntrypoint": "./_102034_/l1/server/persistence.js"
        },
        {
          "moduleId": "mdm",
          "persistenceEntrypoint": "./_102034_/l1/mdm/persistence.js"
        },
        {
          "moduleId": "monitor",
          "persistenceEntrypoint": "./_102034_/l1/monitor/persistence.js"
        }
      ]
    },
    "102029": {
      "root": "./_102029_",
      "type": "lib"
    },
    "102020": {
      "root": "./_102020_",
      "type": "enhancement"
    },
    "102027": {
      "root": "./_102027_",
      "type": "enhancement"
    }
  }
}
`
  await saveFile(`_${mls.actualProject}_/l0/config.json`, src, false);

}

async function generateHtml(moduleName: string) {


  const srcHtml = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Collab Test ${moduleName}</title>
    <link rel="manifest" href="/${moduleName}/assets/manifest.json" />
  </head>
  <body>
    <collab-app-shell></collab-app-shell>
    <script type="module" src="/_${mls.actualProject}_/l2/${moduleName}/index.js"></script>
  </body>
</html>
`

  const srcTS = `/// <mls fileReference="_${mls.actualProject}_/l2/${moduleName}/index.ts" enhancement="_blank" />
import { bootstrapCollabApp } from '/_102033_/l2/core/bootstrap.js';

void bootstrapCollabApp({
  projectId: '${mls.actualProject}',
  appId: '${moduleName}',
  title: 'Collab Test · ${moduleName}',
  shellMode: 'spa',
  navigation: [
    { label: 'Monitor', href: '/monitor' },
  ],
  pages: [],
});
`
  await saveFile(`_${mls.actualProject}_/l2/${moduleName}/index.html`, srcHtml, false);
  await saveFile(`_${mls.actualProject}_/l2/${moduleName}/index.ts`, srcTS);

}

async function generateInfoModule(moduleName: string) {


  const src = `/// <mls fileReference="_${mls.actualProject}_/l2/${moduleName}/module.ts" enhancement="_blank" />
import type { AuraModuleFrontendDefinition, IPaths, IGenomeConfig } from '/_102029_/l2/contracts/bootstrap.js';

export const moduleGenome: Record<string, IGenomeConfig> = {
  'web/desktop/page11': {
    designSystem: 'default',
    designSystemSkill:  '_102020_/l2/agents/newModule/skills/defaultDs.js',
    device: 'desktop',
    layout: 'standart',
    layoutSkill: '_102020_/l2/agents/newModule/skills/genPageRender.ts',
  }
} as const;

export const skills: IPaths = {
  "web": {
    sharedPath: 'web/shared',
    sharedSkill: '/_102020_/l2/agents/newModule/skills/genPageShared.ts'
  }
}

export const moduleStates = {
} as const;

export const moduleShellPreferences = {
  layout: {
    asideMode: {
      desktop: 'inline',
      mobile: 'fullscreen',
    },
  },
} as const;

export const moduleFrontendDefinition: AuraModuleFrontendDefinition = {
  pageTitle: '${moduleName}',
  device: 'desktop',
  navigation: [
  ],
  routes: [
  ],
};
`

  await saveFile(`_${mls.actualProject}_/l2/${moduleName}/module.ts`, src);

}

async function generateRouter(moduleName: string) {


  const src = `/// <mls fileReference="_${mls.actualProject}_/l1/${moduleName}/layer_2_controllers/router.ts" enhancement="_blank" />
import type { BffHandler } from '/_102034_/l1/server/layer_2_controllers/contracts.js';


export function createPizzariaRouter(): Map<string, BffHandler> {
  return new Map<string, BffHandler>([]);
}
`

  await saveFile(`_${mls.actualProject}_/l1/${moduleName}/layer_2_controllers/router.ts`, src);

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


