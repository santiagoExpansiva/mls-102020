/// <mls fileReference="_102020_/l2/agents/newModule/agentInitializeModule.ts" enhancement="_102027_/l2/enhancementAgent"/>


import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { getAgentStepByAgentName } from "/_102027_/l2/aiAgentHelper.js";
import { prepareClarificationElement } from "/_102027_/l2/aiAgentOrchestration.js";

export function createAgent(): IAgentAsync {
  return {
    agentName: "agentInitializeModule",
    agentProject: 102020,
    agentFolder: "agents/newModule",
    agentDescription: "Create New Module on current project",
    visibility: "public",
    beforePromptImplicit,
    afterPromptStep,
    beforeClarificationStep
  };
}

async function beforePromptImplicit(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  userPrompt: string,
): Promise<mls.msg.AgentIntent[]> {

  if (!userPrompt || userPrompt.length < 5) throw new Error('invalid prompt');

  const folders = Array.from(new Set(
    Object.values(mls.stor.files)
      .filter(f => f.project === mls.actualProject && f.level !== 3 && f.folder)
      .map(f => f.folder)
  ));

  const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
    type: "add-message-ai",
    request: {
      action: 'addMessageAI',
      agentName: agent.agentName,
      inputAI: [{
        type: "system",
        content: system1.replace("{{folders}}", folders.join(", "))
      }, {
        type: "human",
        content: userPrompt
        }],
      taskTitle: `New module`,
      threadId: context.message.threadId,
      userMessage: context.message.content,
      longTermMemory: {},
    }
  };
  return [addMessageAI];

}

async function afterPromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
): Promise<mls.msg.AgentIntent[]> {
  if (!agent || !context || !step) throw new Error(`[afterPromptStep] invalid params, agent:${!!agent}, context:${!!context}, step:${!!step}`);

  const payload = (step.interaction?.payload?.[0]) as Output1 || undefined;
  if (payload?.type === "result") {
    throw new Error(payload?.result);
  }
  if (payload?.type !== 'clarification' || !payload.json) throw new Error(`[afterPromptStep] invalid payload: ${payload}`)
  console.log("afterPrompt", payload.json);
  return [];

}

async function beforeClarificationStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIClarificationStep,
  hookSequential: number,
  json: any
): Promise<HTMLElement> {

  if (!context.task) throw new Error(`[beforeClarificationStep] invalid task: undefined`)

  let status: mls.msg.AIStepStatus = 'completed';

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

  const newStep: mls.msg.AgentIntentAddStep = {
    type: "add-step",
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    parentStepId: 1,
    step:
    {
      type: 'agent',
      stepId: 0,
      interaction: null,
      stepTitle: 'Teste step title 2',
      status: 'waiting_human_input',
      nextSteps: [],
      agentName: "agentToBeConceptual",
      prompt: "{{clarification}}",
      rags: null,
    }
  };

  const intentsToClarification: mls.msg.AgentIntent[] = [newStep, updateStatus];
  const div = await prepareClarificationElement(agent, context, step.stepId, parentStep.stepId, intentsToClarification, json);
  return div;

}

const system1 = `
<!-- modelType: codeinstruct -->
<!-- modelTypeList: geminiChat 9/10 , code (grok) 7/10, deepseekchat 2/10, codeflash (gemini) 8/10, deepseekreasoner 3/10, mini (4.1) ou nano (openai) 4/10, codeinstruct (4.1) 4/10, codereasoning(gpt5) 3/10, code2 (kimi 2.5) -->

You are an assistant responsible for helping create a new module in the current project for collab.codes. Your task is to analyze the user's request and return a JSON object in the format specified under 'Output format'. Use the same language as the user in the prompt.

Analyze the user's request:
- If invalid or not about creating a new system/module → return error
- If valid → return a clarification

## Already existing modules
{{folders}}

## Output format
Return only valid JSON in the following structure:
[[OutputSection1]]
`;

//#region OutputSection1
export type Output1 =
  {
    type: "clarification";
    json: Clarification1
  } | {
    type: "result"; // for errors or invalid user prompt
    result: string;
  };

export interface Clarification1 {
  userLanguage: string; // language detected in prompt, iso, ex: 'en'
  title: "Clarification 1/2";
  userPrompt: string; // put the userPrompt here, no syntax error
  questions: {
    roles: Question; // roles - e.g. 'admin', 'public', 'client', 'operator', 'financial'
    publicTarget: Question; // publicTarget
    tone: Question; // tone - e.g. Friendly, professional, and concise. Always aim to clarify without assuming.
    languages: Question; // languages - use default language from prompt, default is only one languages
    moduleName: Question; // moduleName - suggest a module name , search in "Already existing modules"
    openQuestion1: Question; // open question to clarify features,
    openQuestion2: Question; // open question to clarify features,
    openQuestion3: Question; // open question to clarify features,
  },
  legends: [ // translate
    "This is the first clarification ",
    "before creating somethings"
  ];
}

export interface Question {
  type: "open";
  question: string;
  answer: string; // AI-suggested default answer. This answer simulates how a real user would respond. Write in first person and with a natural tone.
}

//#endregion

export function getPayload1(agent: IAgentMeta, context: mls.msg.ExecutionContext): Clarification1 {
  if (!agent || !context || !context.task) throw new Error(`[${agent.agentName}](getPayload1) Invalid context or agent`);
  const agentStep = getAgentStepByAgentName(context.task, agent.agentName); // Only one agent execution must exist in this task
  if (!agentStep) throw new Error(`[${agent.agentName}](getPayload1) no agent found`);

  // get result
  const resultStep = agentStep.interaction?.payload?.[1]; // [0]-> original clarification, [1]->final clarification
  if (!resultStep || resultStep.type !== "clarification" || !resultStep.json) throw new Error(`[${agent.agentName}] [getPayload] No step clarification found for this agent.`);
  let payload1: Clarification1 = (resultStep as any).json;
  if (!payload1 || (typeof payload1 === "string") || !payload1.legends) throw new Error(`[${agent.agentName}] (getPayload1) Invalid clarification response`);

  // get userPrompt
  // payload1.userPrompt = agentStep?.interaction?.input.find((input) => input.type === 'human')?.content || '';

  return payload1;
}
