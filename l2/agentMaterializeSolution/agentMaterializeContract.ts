/// <mls fileReference="_102020_/l2/agentMaterializeSolution/agentMaterializeContract.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { findPreviousAgentStep } from '/_102027_/l2/aiAgentHelper.js';
import { getMaterializeOrchestrator } from '/_102020_/l2/agentMaterializeSolution/materializeOrchestrator.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: "agentMaterializeContract",
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
  const type = info.type || context.task?.iaCompressed?.longMemory['type'] as string || 'page11';

  info.project = mls.actualProject || 0; 
  const orch = getMaterializeOrchestrator(info.path);
  info.item = await orch.getToExecuteOnlyMaterialize(info.id) as mls.defs.MaterializeEntry;  

  const prompt = await getSkill(info, moduleName, device);
  console.info(prompt);
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
      longTermMemory: { moduleName, device, type, onlyStep:"true" }
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

  console.info('--------agentMaterializeContract--------')
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

async function updateRouterFile(
  orch: ReturnType<typeof getMaterializeOrchestrator>,
  outputPath: string,
  routers: { router: string; funcName: string }[]
): Promise<void> {
  if (!routers || routers.length === 0) return;

  const routerRef = outputPath.replace(/\/[^/]+\.ts$/, '/router.ts');

  const sfInfo = mls.stor.convertFileReferenceToFile(routerRef);
  if (!sfInfo) return;
  const key = mls.stor.getKeyToFile(sfInfo);
  const sf = (mls.stor.files as any)[key];
  if (!sf) return;

  let content = await sf.getContent() as string;

  const importPath = '/' + outputPath.replace('.ts', '.js');
  const escapedPath = importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const funcNames = routers.map((r: { router: string; funcName: string }) => `  ${r.funcName}`).join(',\n');
  const newImportBlock = `import {\n${funcNames}\n} from '${importPath}';`;
  const importRegex = new RegExp(`import \\{[^}]*\\} from '${escapedPath}';`);

  if (importRegex.test(content)) {
    content = content.replace(importRegex, newImportBlock);
  } else {
    content = content.replace(/^export function /m, newImportBlock + '\n\nexport function ');
  }

  for (const r of routers) {
    const escapedRouter = r.router.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const routeEntry = `    ['${r.router}', ${r.funcName}],`;
    const existingEntryRegex = new RegExp(`    \\['${escapedRouter}',.*?\\],`);
    if (existingEntryRegex.test(content)) {
      content = content.replace(existingEntryRegex, routeEntry);
    } else {
      content = content.replace(/(\s+\]\);)/, `\n${routeEntry}$1`);
    }
  }

  await orch.createStorFile(routerRef, content);
}

async function processOutput(context: mls.msg.ExecutionContext, output: any, agent: IAgentMeta, parentStep: mls.msg.AIAgentStep): Promise<mls.msg.AgentIntent[]> {

  const onlyThisStep = (context.task?.iaCompressed?.longMemory['onlyStep'] as string || 'false') === 'true';

  const outputPath = output.outputPath.startsWith('/') ? output.outputPath.slice(1) : output.outputPath;
  const interfaceOutputPath = output.interfaceOutputPath.startsWith('/') ? output.interfaceOutputPath.slice(1) : output.interfaceOutputPath;

  const orch = getMaterializeOrchestrator(output.path);
  await orch.createStorFile(outputPath, parseAISource(output.srcFile));
  await orch.createStorFile(interfaceOutputPath, parseAISource(output.interfaceFile));
  await updateRouterFile(orch, outputPath, output.routers || []);

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


async function getSkill(info: { path: string, item: mls.defs.MaterializeEntry, project?: number, [k: string]: unknown }, moduleName: string, device: string): Promise<string> {

  const project = info.project || 0;
  const fileName = info.item.outputPath.split('/').pop() || '';
  const pageName = fileName.endsWith('.ts') ? fileName.slice(0, -3) : fileName;
  info.interfaceOutputPath = `/_${project}_/l2/${moduleName}/${device}/contracts/${pageName}.ts`;

  const orch = getMaterializeOrchestrator(info.path);
  const user = orch.getVar(info.item.defsPath, 'skill')
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
<!-- modelType:  codeinstruct  -->
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
      path: string;            // same value by "User info"
      id: string;              // same value by "User info"
      outputPath: string;      // same value by "User info"
      interfaceOutputPath: string; // same value by "User info"
      srcFile: string;
      interfaceFile: string;
      routers: { router: string; funcName: string }[]; // one entry per BffHandler constant in srcFile
    }
  }

//#endregion

