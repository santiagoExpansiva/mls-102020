/// <mls fileReference="_102020_/l2/agents/newModule/agentMaterializePageLit.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { findPreviousAgentStep } from '/_102027_/l2/aiAgentHelper.js';
import { createStorFile, IReqCreateStorFile } from '/_102027_/l2/libStor.js';
import { convertFileNameToTag, convertTagToFileName } from '/_102027_/l2/utils.js';
import { getMaterializeOrchestrator } from '/_102027_/l2/agents/materialize/materializeOrchestrator.js';
import { addModuleNav, addModuleRoute } from '/_102020_/l2/newModule/astModuleFront.js';
import { addNav, addPage } from '/_102020_/l2/newModule/astIndex.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: "agentMaterializePageLit",
    agentProject: 102020,
    agentFolder: "agents/newModule",
    agentDescription: "new agent",
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


  const info = JSON.parse(userPrompt) as { path: string, item: mls.defs.MaterializeEntry, project?: number, moduleName: string };

  info.project = mls.actualProject || 0;
  const prompt = await getSkill(info);

  const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
    type: "add-message-ai",
    request: {
      action: 'addMessageAI',
      agentName: agent.agentName,
      inputAI: [
        { type: 'system', content: system1 },
        { type: 'human', content: prompt }
      ],
      taskTitle: agent.agentDescription,
      threadId: context.message.threadId,
      userMessage: info.path,
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

  console.info('--------agentMaterializePageLit--------')
  const info = JSON.parse(args) as { path: string, item: mls.defs.MaterializeEntry, project?: number };

  info.project = mls.actualProject || 0;
  const prompt = await getSkill(info);

  const continueParallel: mls.msg.AgentIntentPromptReady = {
    type: "prompt_ready",
    args,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    hookSequential,
    parentStepId: parentStep.stepId,
    humanPrompt: prompt,
    systemPrompt: system1
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

  if (!agent || !context || !step) throw new Error(`(${agent.agentName}) [afterPromptStep] invalid params, agent:${!!agent}, context:${!!context}, step:${!!step}`);

  const payload = (step.interaction?.payload?.[0]);
  if (payload?.type !== 'flexible' || !payload.result) throw new Error(`(${agent.agentName}) [afterPromptStep] invalid payload: ${payload}`)

  let status: mls.msg.AIStepStatus = 'completed';
  let intents: mls.msg.AgentIntent[] = [];

  const output = payload.result;
  intents = await processOutput(context, output, agent, parentStep);

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

async function processOutput(context: mls.msg.ExecutionContext, output: any, agent: IAgentMeta, parentStep: mls.msg.AIAgentStep): Promise<mls.msg.AgentIntent[]> {

  const orch = getMaterializeOrchestrator(output.path);
  await orch.createStorFile(output.outputPath, parseAISource(output.srcFile));

  const info = mls.stor.convertFileReferenceToFile(output.outputPath);
  if (info.project === 0) info.project = mls.actualProject || 0;
  const tag = convertFileNameToTag(info);
  const srcHtml = `<${tag}></${tag}>`;
  await orch.createStorFile(output.outputPath.replace('.ts', '.html'), srcHtml);
  await addModuleRoutes(context, info.shortName, tag);
  await addIndexPage(context, info.shortName, tag);

  const stepOri = context.task ? (findPreviousAgentStep(context.task, parentStep.stepId))?.stepId : parentStep.stepId;

  const group = await orch.processGroup(output.id);
  const newSteps: mls.msg.AgentIntentAddStep[] = [];

  Object.keys(group).forEach((g) => {

    const info = group[g];

    info.forEach((i: any) => {

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
          agentName: g,
          prompt: JSON.stringify({ path: output.path, item: i }),
          rags: [],
        }
      };

      newSteps.push(newStep);

    })

  });

  return newSteps;
}

async function addModuleRoutes(context: mls.msg.ExecutionContext, shortName: string, tag: string) {

  let moduleName = context.task?.iaCompressed?.longMemory['moduleName'];
  if (!moduleName) throw new Error('Not found moduleName 2: agentMaterializePageLit');

  const key = mls.stor.getKeyToFile({ project: mls.actualProject || 0, level: 2, folder: `${moduleName}`, shortName: "module", extension: ".ts" });
  if (!mls.stor.files[key]) throw new Error('[agentMaterializePageLit]Not found module file');

  const info = convertTagToFileName(tag) as any;
  info.extension = '.js';
  info.level = 2;
  let fileReference = mls.stor.convertFileToFileReference(info);
  fileReference = fileReference.startsWith('/') ? fileReference : '/' + fileReference;

  const sf = mls.stor.files[key];

  let src = await sf.getContent() as string;

  src = addModuleNav(src, { id: shortName, label: shortName, href: `/${moduleName}/${shortName}`, description: shortName });

  src = addModuleRoute(src, {
    path: `/${moduleName}/${shortName}`,
    aliases: [],
    entrypoint: fileReference.replace('.ts', '.js'),
    tag,
    title: shortName,
  });

  await saveFile(mls.stor.convertFileToFileReference(sf), src);

}

async function addIndexPage(context: mls.msg.ExecutionContext, shortName: string, tag: string) {

  let moduleName = context.task?.iaCompressed?.longMemory['moduleName'];
  if (!moduleName) throw new Error('Not found moduleName 3: agentMaterializePageLit');

  const key = mls.stor.getKeyToFile({ project: mls.actualProject || 0, level: 2, folder: `${moduleName}`, shortName: "index", extension: ".ts" });
  if (!mls.stor.files[key]) throw new Error('[agentMaterializePageLit]Not found index file');

  const info = convertTagToFileName(tag) as any;
  info.extension = '.js';
  info.level = 2
  let fileReference = mls.stor.convertFileToFileReference(info);
  fileReference = fileReference.startsWith('/') ? fileReference : '/' + fileReference;

  const sf = mls.stor.files[key];

  let src = await sf.getContent() as string;

  src = addNav(src, { label: shortName, href: `/${moduleName}/${shortName}` });

  src = addPage(src, {
    path: `/${moduleName}/${shortName}`,
    title: shortName,
    tagName: tag,
    loader: fileReference,
  });

  await saveFile(mls.stor.convertFileToFileReference(sf), src);

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

async function getSkill(info: { path: string, item: mls.defs.MaterializeEntry, project?: number }): Promise<string> {

  const orch = getMaterializeOrchestrator(info.path);
  const user = await orch.getVar(info.path, info.item.specVar);
  const skill = await orch.getSkill(info.item.skillPath);
  const prompt = `##Skill\n${skill}\n\n##User data\n${user}\n\n##User info\n${JSON.stringify(info)}`;

  return prompt;
}

function parseAISource(raw: string): string {
  return raw; decodeUnicodeEscapes(raw);
}

function decodeUnicodeEscapes(src: string): string {
  return src.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

const system1 = `
<!-- modelType: codereasoning -->
<!-- modelTypeList: geminiChat (2.5 pro), code (grok), deepseekchat, codeflash (gemini), deepseekreasoner, mini (4.1) ou nano (openai), codeinstruct (4.1), codereasoning(gpt5), code2 (kimi 2.5) -->

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
      path: string; // same value by "User info";
      id: string; // same value by "User info";
      outputPath: string, // same value by "User info";
      srcFile: string
    }
  }

//#endregion 