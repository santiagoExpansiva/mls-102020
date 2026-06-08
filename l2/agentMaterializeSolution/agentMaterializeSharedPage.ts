/// <mls fileReference="_102020_/l2/agentMaterializeSolution/agentMaterializeSharedPage.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js'
import { findPreviousAgentStep } from '/_102027_/l2/aiAgentHelper.js';
import { getMaterializeOrchestrator } from '/_102020_/l2/agentMaterializeSolution/materializeOrchestrator.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: "agentMaterializeSharedPage",
    agentProject: 102020,
    agentFolder: "agentMaterializeSolution",
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

  const info = JSON.parse(userPrompt) as { path: string, item: mls.defs.MaterializeEntry, project?: number, moduleName: string, device: string, type: string, id:string };
  const moduleName = info.moduleName || context.task?.iaCompressed?.longMemory['moduleName'] as string;
  const device = info.device || context.task?.iaCompressed?.longMemory['device'] as string || 'web';

  info.project = mls.actualProject || 0; 
  const orch = getMaterializeOrchestrator(info.path);
  info.item = await orch.getToExecuteOnlyMaterialize(info.id) as mls.defs.MaterializeEntry;

  const prompt = await getSkill(info, moduleName, device);

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
      longTermMemory: { moduleName: info.moduleName, device, onlyStep:"true" }
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

  console.info('--------agentMaterializeSharedPage--------')
  const info = JSON.parse(args) as { path: string, item: mls.defs.MaterializeEntry, project?: number };

  info.project = mls.actualProject || 0;
  const moduleName = context.task?.iaCompressed?.longMemory['moduleName'] as string;
  const device = context.task?.iaCompressed?.longMemory['device'] as string || 'web';
  const prompt = await getSkill(info, moduleName, device);

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

  const onlyThisStep = (context.task?.iaCompressed?.longMemory['onlyStep'] as string || 'false') === 'true';

  const orch = getMaterializeOrchestrator(output.path);
  const ref = output.outputPath.startsWith('/') ? output.outputPath.slice(1) : output.outputPath;
  await orch.createStorFile(ref, parseAISource(output.srcFile));

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

      if(!onlyThisStep) newSteps.push(newStep);

    })

  });

  return newSteps;
}

async function getSkill(info: { path: string, item: mls.defs.MaterializeEntry, project?: number }, moduleName: string, device: string): Promise<string> {

  const project = info.project || 0;
  const mod = await import(`/_${project}_/l2/${moduleName}/module.js`) as any;
  if (!mod || !mod.moduleGenome) throw new Error('[agentMaterializeSharedPage] Not found moduleGenome');

  const deviceSkills = mod.skills[device];
  if (!deviceSkills) throw new Error(`[agentMaterializeSharedPage] no skills config for device "${device}"`);

  const sharedPath = deviceSkills.sharedPath as string;
  const fileName = info.item.outputPath.startsWith('/') ? info.item.outputPath.slice(1) : info.item.outputPath;
  let sharedPathNorm = (sharedPath.startsWith('/') ? sharedPath.slice(1) : sharedPath);
  sharedPathNorm = sharedPathNorm.endsWith('/') ? sharedPathNorm.slice(0, -1) : sharedPathNorm;
  info.item.outputPath = `${sharedPathNorm}/${fileName}`;

  const orch = getMaterializeOrchestrator(info.path);
  const user = await orch.getVar(info.item.defsPath, 'skill');
  const skill = await orch.getSkill(deviceSkills.sharedSkill);
  const prompt = `##Skill\n${skill}\n\n##User data\n${user}\n\n##User info\n${JSON.stringify(info)}`;

  return prompt;
}

function parseAISource(raw: string): string {
  return raw;  decodeUnicodeEscapes(raw);
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

