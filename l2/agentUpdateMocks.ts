/// <mls shortName="agentUpdateMocks" project="102020" enhancement="_blank" />

import { IAgent, svg_agent } from '/_100554_/l2/aiAgentBase.js';
import { getPromptByHtml } from '/_100554_/l2/aiPrompts.js';
import { createAllModels } from '/_100554_/l2/collabLibModel.js';
import { collabImport } from '/_100554_/l2/collabImport.js';
import { getState } from '/_100554_/l2/collabState.js';
import { ServiceSource100554 } from '/_100554_/l2/serviceSource.js';

import {
  appendLongTermMemory,
  getNextPendingStepByAgentName,
  getNextInProgressStepByAgentName,
  getNextFlexiblePendingStep,
  updateTaskTitle,
  notifyTaskChange,
  updateStepStatus,
  getNextPendentStep
} from "/_100554_/l2/aiAgentHelper.js";

import {
  startNewInteractionInAiTask,
  startNewAiTask,
  executeNextStep,
  addNewStep
} from "/_100554_/l2/aiAgentOrchestration.js";

const agentName = "agentUpdateMocks";
const projectAgent = 102020;

export function createAgent(): IAgent {
  return {
    agentName,
    avatar_url: svg_agent,
    agentDescription: "Prototype-level organism update agent to mockup organism.",
    visibility: "public",
    scope: [],
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
  const data = getParamsFromPrompt(context);
  if (!context.task) {
    await initTask(data, context)
    return;
  }
  await continueTask(context);

}

const _afterPrompt = async (context: mls.msg.ExecutionContext): Promise<void> => {

  if (!context || !context.message || !context.task) throw new Error("Invalid context");
  const step: mls.msg.AIAgentStep | null = getNextInProgressStepByAgentName(context.task, agentName);
  if (!step) throw new Error(`[${agentName}] afterPrompt: No in progress interaction found.`);

  context = await updateStepStatus(context, step.stepId, "completed");
  context = await updateFile(context);
  notifyTaskChange(context);

  if (!context.task) throw new Error("Invalid context task");

  const organismRemaing: mls.cbe.IPath[] = JSON.parse(context.task?.iaCompressed?.longMemory['actions_remaing'] || '[]');
  if (!organismRemaing || organismRemaing.length === 0) {
    const projectMemory = context.task?.iaCompressed?.longMemory['project'];
    const folderMemory = context.task?.iaCompressed?.longMemory['module_path'];
    if (!folderMemory || !projectMemory) throw new Error(`[${agentName}] updateFile: Invalid task memory arguments`);
    await updateAllOrganismsAndPageInStatusMockup(+projectMemory, folderMemory);
    context.task = await updateTaskTitle(context.task, "Ok, all actions executed created, see result");
    await executeNextStep(context);
    return;
  }

  const stepPendent = getNextPendentStep(context.task);
  if (!stepPendent) throw new Error(`[${agentName}](afterPrompt) Invalid next stepPendent`);

  const newStep: mls.msg.AIPayload = {
    agentName: 'agentUpdateMocks',
    prompt: '',
    status: 'pending',
    stepId: stepPendent.stepId + 1,
    interaction: null,
    nextSteps: null,
    rags: null,
    type: 'agent'
  }
  await addNewStep(context, stepPendent.stepId, [newStep]);

}

async function getPrompts(context: mls.msg.ExecutionContext, action: ITemporaryEndPointsAction, moduleProject: string | undefined, modulePath: string | undefined): Promise<mls.msg.IAMessageInputType[]> {

  const iPath: mls.cbe.IPath = mls.l2.getPath(`_${moduleProject}_${modulePath}/${action.pageOrOrganismName}`);
  const organismData = await getOrganismsContents(iPath);
  const moduleDefs = await getModuleDefs(context, moduleProject, modulePath);
  const dataForReplace = {
    typescript: organismData.ts,
    moduleEndPoints: moduleDefs,
    action: JSON.stringify(action)
  }

  const prompts = await getPromptByHtml({ project: projectAgent, shortName: agentName, folder: '', data: dataForReplace })
  return prompts;

}

async function getOrganismsContents(file: mls.cbe.IPath) {

  const contentTs = await getContentByExtension(file, 'ts');
  const contentDefs = await getContentByExtension(file, 'defs');
  return {
    ts: typeof contentTs === 'string' ? contentTs : '',
    defs: typeof contentDefs === 'string' ? contentDefs : '',
  }
}

async function getModuleDefs(context: mls.msg.ExecutionContext, moduleProject: string | undefined, modulePath: string | undefined,): Promise<string> {
  if (!moduleProject || !modulePath) throw new Error(`[${agentName}] getModuleDefs: Invalid module file.`);
  const content = await getContentByExtension({ folder: modulePath, project: +moduleProject, shortName: 'module' }, 'defs');
  if (typeof content !== 'string') throw new Error(`[${agentName}] getModuleDefs: Invalid typeof module file, must be string.`);
  return content;
}

async function continueTask(context: mls.msg.ExecutionContext) {

  if (!context.task) throw new Error(`[${agentName}](continueTask) No task found for this agent.`);
  const step: mls.msg.AIAgentStep | null = getNextPendingStepByAgentName(context.task, agentName);
  if (!step) throw new Error(`[${agentName}](beforePrompt) No pending step found for this agent.`);
  const actionsRemaing: ITemporaryEndPointsAction[] = JSON.parse(context.task?.iaCompressed?.longMemory['actions_remaing'] || '[]');
  const project = context.task?.iaCompressed?.longMemory['project'];
  const modulePath = context.task?.iaCompressed?.longMemory['module_path'];

  const actualAction = actionsRemaing?.pop();
  if (!actualAction) return;

  await appendLongTermMemory(context, { "actions_remaing": JSON.stringify(actionsRemaing), "file_name": actualAction.pageOrOrganismName });

  const inputs = await getPrompts(context, actualAction, project, modulePath);
  const taskTitle = `Executing actions`;
  await startNewInteractionInAiTask(agentName, taskTitle, inputs, context, _afterPrompt, step.stepId);

}


async function initTask(data: IDataMessage, context: mls.msg.ExecutionContext) {

  try {
    const allActions = await getAllActions(+data.project, data.modulePath);
    if (!allActions || allActions.length === 0) {
      return;
    }

    const actualAction = allActions?.pop();
    if (!actualAction) return;
    const inputs = await getPrompts(context, actualAction, data.project, data.modulePath);
    const title = `Executing actions`;
    await startNewAiTask(
      agentName,
      title,
      context.message.content,
      context.message.threadId,
      context.message.senderId,
      inputs,
      context,
      _afterPrompt,
      {
        'module_path': `${data.modulePath}`,
        'project': `${data.project}`,
        "file_name": actualAction.pageOrOrganismName,
        'actions_remaing': `${JSON.stringify(allActions)}`
      }
    ).catch((err) => {
      throw new Error(err.message)
    });
  } catch (err: any) {
    throw new Error(err.message)
  }
}

function getParamsFromPrompt(context: mls.msg.ExecutionContext): IDataMessage {
  let messageReplace = context.message.content
    .replace(`@@ ${agentName}`, '')
    .replace(`@@${agentName}`, '').trim()
    .replace(`@@UpdateMocks`, '');
  let data: IDataMessage;
  data = mls.common.safeParseArgs(messageReplace) as IDataMessage;
  if (!('modulePath' in data) || !('project' in data)) throw new Error(`[${agentName}] beforePrompt: Invalid prompt structure missing modulePath or project`);

  return data;
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

  // console.info(result.logs)
  // console.info(result.moduleEndPoints);
  // console.info(result.typescript);

  if (context.modeSingleStep) {
    return context;
  }

  const projectMemory = context.task?.iaCompressed?.longMemory['project'];
  const folderMemory = context.task?.iaCompressed?.longMemory['module_path'];
  const fileNameMemory = context.task?.iaCompressed?.longMemory['file_name'];

  if (!folderMemory || !projectMemory || !fileNameMemory) throw new Error(`[${agentName}] updateFile: Invalid task memory arguments`);

  const models = getModel({ folder: folderMemory || '', project: +projectMemory, shortName: 'module' });
  if (!models || !models.defs) throw new Error(`[${agentName}] updateFile: Not found models`);
  models.defs.model?.setValue(result.moduleEndPoints);

  const modelsTs = getModel({ folder: folderMemory || '', project: +projectMemory, shortName: fileNameMemory });
  if (!modelsTs || !modelsTs.ts) throw new Error(`[${agentName}] updateFile: Not found models typescript`);
  modelsTs.ts.model?.setValue(result.typescript);


  return context;

}

async function getAllActions(project: number, modulePath: string) {

  const moduleDefs = await collabImport({ folder: modulePath, project, shortName: 'module', extension: '.defs.ts' });
  if (!moduleDefs || !moduleDefs.temporaryEndpoints) throw new Error(`[${agentName}] getAllActions: Not found module endpoints`);
  const temporaryEndpoints: ITemporaryEndPoints[] = moduleDefs.temporaryEndpoints;
  const allActions = temporaryEndpoints.map((endPoint) => {
    return endPoint.actions.map((action) => {
      const refEndPoint = endPoint.endpoints.find((end) => end.name === action.endPoint)
      const rc = {
        ...action,
        refEndPoint
      }
      return rc

    })
  }).flat();

  //const rc = allActions.filter((item) => item.pageOrOrganismName === 'loyaltyDashboard');

  return allActions;

}

async function updateAllOrganismsAndPageInStatusMockup(project: number, modulePath: string) {

  const allDefs: mls.cbe.IPath[] = [];

  for (let key of Object.keys(mls.stor.files)) {
    const storFile = mls.stor.files[key];

    if (storFile.extension !== '.defs.ts' || storFile.project !== project || storFile.folder !== modulePath) continue;

    const keyToImport = storFile.folder ? `_${storFile.project}_${storFile.folder}_${storFile.shortName}` : `./_${storFile.project}_${storFile.shortName}`

    try {
      const module = await import(`./${keyToImport}.defs.js`);
      if (!module) continue;
      const defs = module?.defs;
      if (!defs || (defs.meta.type !== 'organism' && defs.meta.type !== 'page') || defs.meta.devFidelity !== 'organismMock') continue;
      module.defs.meta.devFidelity = 'moduleMock';
      const newDefs = `/// <mls shortName="${storFile.shortName}" project="${storFile.project}" folder="${storFile.folder}" enhancement="_blank" />

export const defs = ${JSON.stringify(module.defs, null, 2)}`;

      let models = getModel({ folder: storFile.folder || '', project: storFile.project, shortName: storFile.shortName });
      if (!models) {
        models = await createAllModels(storFile)
      }

      const serviceSource: ServiceSource100554 = getState(`serviceSource.left.service`);

      if (newDefs && models?.defs && serviceSource) {
        serviceSource.setValueInModeKeepingUndo(models.defs.model, newDefs.trim(), false);
      }


    } catch (err) {
      console.error('Error on get defs from file:' + keyToImport)
      continue;
    }

  }

  return allDefs;
}

async function getDefsUpdated(projectMemory: number, shortNameMemory: string, folderMemory: string) {
  const module = await import(`/_${projectMemory}_${folderMemory ? folderMemory + '/' : ''}${shortNameMemory}.defs.js`);
  if (!module || !module.defs) return;
  module.defs.meta.devFidelity = 'moduleMock';
  return `/// <mls shortName="${shortNameMemory}" project="${projectMemory}" folder="${folderMemory}" enhancement="_blank" />

export const defs = ${JSON.stringify(module.defs, null, 2)}`;

}

interface IDataResult {
  typescript: string,
  defs: string
  moduleEndPoints: string,
  logs: string[]
}

interface IDataMessage {
  project: string,
  modulePath: string
}

interface ITemporaryEndPoints {

  name: string,
  pages: string[],
  updatedAt: string,
  endpoints: [
    {
      name: string,
      intent: string,
      responseInterfaces: string,
      requestInterfaces: string,
      organism: string[]
    }
  ],
  actions: ITemporaryEndPointsAction[]
}

interface ITemporaryEndPointsAction {
  action: string,
  pageOrOrganismName: string,
  endPoint?: string,
}

