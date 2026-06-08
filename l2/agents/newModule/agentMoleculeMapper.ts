/// <mls fileReference="_102020_/l2/agents/newModule/agentMoleculeMapper.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { findPreviousAgentStep } from '/_102027_/l2/aiAgentHelper.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: "agentMoleculeMapper",
    agentProject: 102020,
    agentFolder: "agents/newModule",
    agentDescription: "Maps page UI elements to molecule groups and variants from mls-102040",
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

  const info = JSON.parse(userPrompt) as { path: string };

  const prompt = await buildPrompt(info.path);

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
      longTermMemory: { path: info.path, onlyStep: "true" }
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

  const info = JSON.parse(args) as { path: string };
  const prompt = await buildPrompt(info.path);

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

  if (!agent || !context || !step) throw new Error(`(${agent.agentName}) [afterPromptStep] invalid params, agent:${!!agent}, context:${!!context}, step:${!!step}`);

  const payload = step.interaction?.payload?.[0];
  if (payload?.type !== 'flexible' || !payload.result) throw new Error(`(${agent.agentName}) [afterPromptStep] invalid payload: ${JSON.stringify(payload)}`);

  const output = payload.result as Output['result'];
  const intents = await processOutput(context, output, parentStep);

  const updateStatus: mls.msg.AgentIntentUpdateStatus = {
    type: 'update-status',
    hookSequential,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    parentStepId: parentStep.stepId,
    stepId: step.stepId,
    //cleaner: 'input_output',
    status: 'completed'
  };

  return [...intents, updateStatus];
}

async function processOutput(
  context: mls.msg.ExecutionContext,
  output: Output['result'],
  parentStep: mls.msg.AIAgentStep
): Promise<mls.msg.AgentIntent[]> {

  const stepOri = context.task
    ? (findPreviousAgentStep(context.task, parentStep.stepId))?.stepId
    : parentStep.stepId;

  const newStep: mls.msg.AgentIntentAddStep = {
    type: "add-step",
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    parentStepId: stepOri || parentStep.stepId,
    step: {
      type: 'agent',
      stepId: 0,
      interaction: null,
      status: 'waiting_human_input',
      nextSteps: [],
      agentName: 'agentMoleculeRewriter',
      prompt: JSON.stringify({ path: output.path, map: output.map, usedGroups: output.usedGroups }),
      rags: [],
    }
  };

  return [];
}

async function buildPrompt(path: string): Promise<string> {

  const pathNorm = path.startsWith('/') ? path.slice(1) : path;

  const f = mls.stor.convertFileReferenceToFile(pathNorm);
  const key = mls.stor.getKeyToFile(f);
  const sf = mls.stor.files[key];
  if (!sf) throw new Error(`[agentMoleculeMapper] File not found: ${path}`);
  const pageSrc = await sf.getContent() as string;

  const catalog = buildCatalog(mls.stor.files as Record<string, any>);

  return `## Page source\n\`\`\`typescript\n${pageSrc}\n\`\`\`\n\n## Molecule catalog\n${catalog}`;
}

function buildCatalog(allFiles: Record<string, any>): string {

  const groups = new Map<string, Set<string>>();   // lowercase groupName → variants
  const camelCaseMap = new Map<string, string>();  // lowercase groupName → camelCase

  for (const sf of Object.values(allFiles)) {

    if (
      sf.project === 102040 &&
      sf.level === 2 &&
      typeof sf.folder === 'string' &&
      sf.folder.startsWith('molecules/') &&
      sf.extension === '.ts' &&
      sf.shortName !== 'index'
    ) {
      const groupLower = sf.folder.split('/')[1];
      if (!groupLower) continue;
      if (!groups.has(groupLower)) groups.set(groupLower, new Set());
      groups.get(groupLower)!.add(sf.shortName);
    }

    if (
      sf.project === 102020 &&
      sf.level === 2 &&
      typeof sf.folder === 'string' &&
      sf.folder.startsWith('skills/molecules/')
    ) {
      const groupCamel = sf.folder.split('/')[2];
      if (groupCamel) camelCaseMap.set(groupCamel.toLowerCase(), groupCamel);
    }
  }

  const lines: string[] = [
    '# Molecule Catalog — mls-102040',
    `${groups.size} groups`,
    '',
    'Tag convention: {group.toLowerCase()}--{variant}',
    'Import convention: /_102040_/l2/molecules/{group.toLowerCase()}/{variant}.js',
    '',
  ];

  for (const [groupLower, variantsSet] of groups.entries()) {
    const groupCamel = camelCaseMap.get(groupLower) || groupLower;
    const variants = [...variantsSet].sort().join(', ');
    lines.push(`- ${groupCamel}: ${variants}`);
  }

  return lines.join('\n');
}

const system1 = `
<!-- modelType: codereasoning -->
<!-- modelTypeList: geminiChat (2.5 pro), code (grok), deepseekchat, codeflash (gemini), deepseekreasoner, mini (4.1) ou nano (openai), codeinstruct (4.1), codereasoning(gpt5), code2 (kimi 2.5) -->

You must return ONLY a valid JSON object. No preamble, no explanation, no markdown
fences, no text before or after the JSON. Start your response with { and end with }

## Task
Analyze the provided Lit web component page and map each replaceable UI element
to the most appropriate molecule from the catalog.

## Rules
- Before adding any element to the map, ask yourself: "Does this element's PRIMARY purpose
  match what this group was designed for?" If the answer requires any rationalization or
  indirect reasoning, the answer is NO — omit the element.
- The match must be direct and obvious. A text input → groupentertext is obvious.
  A button mapped to groupselectone because it "relates to" a select is NOT a match — omit it.
- Do NOT map structural/layout elements: div, section, header, main, aside, form wrappers,
  grid containers, decorative spans.
- If no group in the catalog directly covers an element's purpose, OMIT the element entirely.
  A shorter accurate map beats a longer wrong one. Never use a group as a fallback.
- Group name must be exactly as listed in the catalog (all lowercase, no spaces).
- Variant must be exactly one of the variants listed for that group.
- usedGroups must contain only the distinct groups actually present in the map (no duplicates).

## Output format

[[OutputSection]]

`;

//#region OutputSection
export type Output = {
  type: "flexible";
  result: {
    path: string;
    map: Array<{
      elementDescription: string;
      group: string; // use CamelCase
      variant: string;
      reason: string;
    }>;
    usedGroups: string[];// use CamelCase
  }
}
//#endregion
