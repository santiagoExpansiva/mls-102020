/// <mls shortName="agentScaffoldToOrganismMock" project="102020" enhancement="_blank" folder="agents" />

/*
 Ordem dos agentes:
  Executar agentScaffoldToOrganismMock para cada organismo em devFidelity: scaffold -> organismMock
  Executar agentUpdateTemporaryEndpoints -> vai passar em todos organismo em devFidelity: organismMock e fazer a normalização de endpoints
  Executar agentUpdateTemporaryEndpoints2 -> vai passar em todas as paginas  em devFidelity: scaffold fazer a normalização de endpoints
  Executar agentUpdateMocks -> vai analisar o defs do modulo, e executar todos os actions necessários em organismos ou pages e alterar devFidelity para moduleMock
*/

import { IAgent, svg_agent } from '/_100554_/l2/aiAgentBase.js';
import { getPromptByHtml } from '/_100554_/l2/aiPrompts.js';
import { createAllModels } from '/_100554_/l2/collabLibModel.js';
import { getProjectConfig } from '/_100554_/l2/libCommom.js';
import { getState } from '/_100554_/l2/collabState.js';
import { ServiceSource100554 } from '/_100554_/l2/serviceSource.js';

import {
  getNextPendingStepByAgentName,
  getNextInProgressStepByAgentName,
  getNextFlexiblePendingStep,
  updateTaskTitle,
  notifyTaskChange,
  updateStepStatus,
} from "/_100554_/l2/aiAgentHelper.js";

import {
  startNewInteractionInAiTask,
  startNewAiTask,
  executeNextStep,
} from "/_100554_/l2/aiAgentOrchestration.js";

const agentName = "agentScaffoldToOrganismMock";
const project = 102020;

export function createAgent(): IAgent {
  return {
    agentName,
    avatar_url: svg_agent,
    agentDescription: "Prototype-level organism update agent to mockup organism.",
    visibility: "public",
    scope: ["l2_preview"],
    async beforePrompt(context: mls.msg.ExecutionContext): Promise<void> {
      return _beforePrompt(context);
    },
    async afterPrompt(context: mls.msg.ExecutionContext): Promise<void> {
      return _afterPrompt(context);
    },
  };
}

const _beforePrompt = async (context: mls.msg.ExecutionContext): Promise<void> => {

  if (!context || !context.message) throw new Error(`[${agentName}](_beforePrompt) Invalid context`);

  if (!context.task) {

    let messageReplace = context.message.content
      .replace(`@@ ${agentName}`, '')
      .replace(`@@${agentName}`, '').trim()
      .replace(`@@ScaffoldToOrganismMock`, '');
    let data: IDataMessage | undefined;
    data = mls.common.safeParseArgs(messageReplace) as IDataMessage;

    if (!('page' in data)) throw new Error(`[${agentName}] beforePrompt: Invalid prompt structure missing page and prompt`);

    try {

      const infoOrganism = mls.l2.getPath(data.page);
      if (!infoOrganism) throw new Error(`[${agentName}] beforePrompt: Invalid organism file info`);
      const { folder, project, shortName } = infoOrganism;
      const inputs = await getPrompts(context, data, infoOrganism);
      const title = `Scaffold to Mock ${infoOrganism.shortName}`
      await startNewAiTask(
        agentName,
        title,
        context.message.content,
        context.message.threadId,
        context.message.senderId,
        inputs,
        context,
        _afterPrompt,
        { 'shortName': `${shortName}`, 'project': `${project}`, 'folder': `${folder}` }
      ).catch((err) => {
        throw new Error(err.message)
      });
    } catch (err: any) {
      throw new Error(err.message)
    }
    return;
  }

}

const _afterPrompt = async (context: mls.msg.ExecutionContext): Promise<void> => {
  if (!context || !context.message || !context.task) throw new Error("Invalid context");
  const step: mls.msg.AIAgentStep | null = getNextInProgressStepByAgentName(context.task, agentName);
  if (!step) throw new Error(`[${agentName}] afterPrompt: No in progress interaction found.`);
  context = await updateFile(context);
  context = await updateStepStatus(context, step.stepId, "completed");
  if (!context.task) throw new Error("Invalid context task");
  context.task = await updateTaskTitle(context.task, "Organism mocked");
  notifyTaskChange(context);
  await executeNextStep(context);
}

async function getPrompts(context: mls.msg.ExecutionContext, data: IDataMessage, info: mls.cbe.IPath): Promise<mls.msg.IAMessageInputType[]> {

  if (context.modeSingleStep) {
    const dataForReplace = {
      typescript: tsTest,
      defs: defsTest,
      moduleName: 'petshop',
      organismName: 'organismServiceHighlights'
    }
    const prompts = await getPromptByHtml({ project, shortName: agentName, folder: 'agents', data: dataForReplace })
    return prompts;
  }

  const typescript = await getContentByExtension(info, 'ts');
  const defs = await getContentByExtension(info, 'defs');

  const moduleInfo = await getProjectConfig(info.project);
  if (!moduleInfo) throw new Error(`[${agentName}] getPrompts: No module configured.`);

  const actualModule = moduleInfo.modules.find((item) => item.path === info.folder);
  if (!actualModule) throw new Error(`[${agentName}] getPrompts: This organism is in invalid moduçe`);

  const dataForReplace = {
    typescript,
    defs,
    moduleName: actualModule.name,
    organismName: info.shortName
  }

  const prompts = await getPromptByHtml({ project, shortName: agentName, folder: '', data: dataForReplace })
  return prompts;
}


async function getContentByExtension(info: mls.cbe.IPath, modelType: 'html' | 'ts' | 'style' | 'defs') {

  try {
    let models = getModel(info);

    if (!models) {
      const keyToStorFile = mls.stor.getKeyToFiles(info.project, 2, info.shortName, info.folder, '.ts');
      const stotFile = mls.stor.files[keyToStorFile];
      if (!stotFile) throw new Error(`[${agentName}][getContentByExtension]: Invalid storFile`);
      models = await createAllModels(stotFile);
    }

    if (!models) throw new Error(`[${agentName}][getContentByExtension]:Not found models for file:` + info.shortName);
    if (!models[modelType]) return '';
    return models[modelType]?.model.getValue();
  } catch (e: any) {
    throw new Error(`[${agentName}][getContentByExtension]: ${e.message}`);
  }
}

function getModel(info: { project: number, shortName: string, folder: string }): mls.editor.IModels | undefined {
  const key = mls.editor.getKeyModel(info.project, info.shortName, info.folder, 2);
  return mls.editor.models[key];
}

async function updateFile(context: mls.msg.ExecutionContext) {

  if (!context || !context.task) throw new Error(`[${agentName}] updateFile: Not found context`);
  const step = getNextFlexiblePendingStep(context.task);

  if (!step || step.type !== 'flexible') throw new Error(`[${agentName}] updateFile: Invalid step in updateFile`);
  const result: IDataResult = step.result;

  if (!result) throw new Error(`[${agentName}] updateFile: Not found "result"`);

  if (context.modeSingleStep) {
    return context;
  }

  const shortNameMemory = context.task?.iaCompressed?.longMemory['shortName'];
  const projectMemory = context.task?.iaCompressed?.longMemory['project'];
  const folderMemory = context.task?.iaCompressed?.longMemory['folder'];
  if (!shortNameMemory || !projectMemory) throw new Error(`[${agentName}] updateFile: Invalid task memory arguments`);

  const models = getModel({ folder: folderMemory || '', project: +projectMemory, shortName: shortNameMemory });
  if (!models) throw new Error(`[${agentName}] updateFile: Not found models`);

  const serviceSource: ServiceSource100554 = getState(`serviceSource.left.service`);
  if (!serviceSource) throw new Error('Not found service source instance');

  let contentTS = result.typescript ? result.typescript : undefined;
  let contentDefs = await getDefsUpdated(+projectMemory, shortNameMemory, folderMemory || "")

  if (contentTS && models.ts) {
    serviceSource.setValueInModeKeepingUndo(models.ts.model, contentTS.trim(), false);
  }

  if (contentDefs && models.defs) {
    serviceSource.setValueInModeKeepingUndo(models.defs.model, contentDefs.trim(), false);
  }

  context = await updateStepStatus(context, step.stepId, "completed");
  return context;

}

async function getDefsUpdated(projectMemory: number, shortNameMemory: string, folderMemory: string) {
  const module = await import(`/_${projectMemory}_${folderMemory ? folderMemory + '/' : ''}${shortNameMemory}.defs.js`);
  if (!module || !module.defs) return;
  module.defs.meta.devFidelity = 'organismMock';
  return `/// <mls shortName="${shortNameMemory}" project="${projectMemory}" folder="${folderMemory}" enhancement="_blank" />

export const defs = ${JSON.stringify(module.defs, null, 2)}`;

}

interface IDataResult {
  typescript: string,
  logs: string[],
}



const defsTest = `
/// <mls shortName="organismServiceHighlights" project="102017" folder="petshop" groupName="petshop" enhancement="_blank" />

// Do not change – automatically generated code.

export const defs: mls.l4.BaseDefs = {
  "meta": {
    "projectId": 102017,
    "folder": "petshop",
    "shortName": "organismServiceHighlights",
    "type": "organism",
    "devFidelity": "scaffold",
    "group": "petshop",
    "tags": [
      "lit",
      "organism"
    ]
  },
  "references": {
    "widgets": [],
    "plugins": [],
    "statesRO": [],
    "statesRW": [],
    "statesWO": [],
    "imports": []
  },
  "planning": {
    "generalDescription": "Destaques de serviços na home.",
    "goal": "Mostrar serviços como banho e tosa com descrições.",
    "userStories": [
      {
        "story": "Como dono de pet, quero ver serviços disponíveis para agendar.",
        "derivedRequirements": [
          {
            "description": "Incluir botão de agendamento.",
            "comment": "Direcionar para página de agendamento."
          }
        ]
      }
    ],
    "userRequestsEnhancements": [],
    "constraints": []
  }
}

`

const tsTest = `
/// <mls shortName="organismServiceHighlights" project="102017" folder="petshop" enhancement="_100554_enhancementLit" groupName="petshop" />

import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { IcaOrganismBase } from '_100554_icaOrganismBase';

@customElement('petshop--organism-service-highlights-102017')
export class organismServiceHighlights extends IcaOrganismBase {
    render(){
        return html\`<div class="services-container" id="petshop--service-highlights-102017-1">
    <h2 class="services-title" id="petshop--service-highlights-102017-2">Destaques de Serviços</h2>
    <div class="services-grid" id="petshop--service-highlights-102017-3">
      <div class="service-item" id="petshop--service-highlights-102017-4">
        <img src="https://images.unsplash.com/photo-1647002380358-fc70ed2f04e0?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w2NDU4NjB8MHwxfHNlYXJjaHwxfHxkb2clMjBnZXR0aW5nJTIwYSUyMGJhdGglMjBhbmQlMjBncm9vbWluZ3xlbnwwfHx8fDE3NjI3OTUwMzF8MA&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=1080" alt="Banho e tosa para pets" class="service-image" id="petshop--service-highlights-102017-5">
        <h3 class="service-name" id="petshop--service-highlights-102017-6">Banho e Tosa</h3>
        <p class="service-description" id="petshop--service-highlights-102017-7">Deixe seu pet limpo e estiloso com nossos serviços profissionais.</p>
        <a href="#" class="service-cta" id="petshop--service-highlights-102017-8">Agendar Agora</a>
      </div>
      <div class="service-item" id="petshop--service-highlights-102017-9">
        <img src="https://images.unsplash.com/photo-1733783489145-f3d3ee7a9ccf?crop=entropy&amp;cs=tinysrgb&amp;fit=max&amp;fm=jpg&amp;ixid=M3w2NDU4NjB8MHwxfHNlYXJjaHwxfHx2ZXRlcmluYXJpYW4lMjBleGFtaW5pbmclMjBhJTIwcGV0fGVufDB8fHx8MTc2Mjc5NTAzMXww&amp;ixlib=rb-4.1.0&amp;q=80&amp;w=1080" alt="Consulta veterinária" class="service-image" id="petshop--service-highlights-102017-10">
        <h3 class="service-name" id="petshop--service-highlights-102017-11">Consulta Veterinária</h3>
        <p class="service-description" id="petshop--service-highlights-102017-12">Cuidado completo com veterinários parceiros.</p>
        <a href="#" class="service-cta" id="petshop--service-highlights-102017-13">Agendar Agora</a>
      </div>
    </div>
  </div>
\`
    }
}

`

interface IDataMessage {
  page: string,
  prompt: string,
  position: 'left' | 'right',
}