/// <mls fileReference="_102020_/l2/agents/newModule/agentMoleculeRewriter.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { getMaterializeOrchestrator } from '/_102020_/l2/agents/newModule/materializeOrchestrator.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: "agentMoleculeRewriter",
    agentProject: 102020,
    agentFolder: "agents/newModule",
    agentDescription: "Rewrites a page replacing mapped elements with molecules from mls-102040",
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

  const info = JSON.parse(userPrompt) as InputInfo;

  const prompt = await buildPrompt(info);

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

  const info = JSON.parse(args) as InputInfo;
  const prompt = await buildPrompt(info);

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

  const pathNorm = output.path.startsWith('/') ? output.path.slice(1) : output.path;
  const orch = getMaterializeOrchestrator(pathNorm);
  await orch.createStorFile(output.path, output.srcFile);

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

  return [updateStatus];
}

async function buildPrompt(info: InputInfo): Promise<string> {

  const pathNorm = info.path.startsWith('/') ? info.path.slice(1) : info.path;

  const f = mls.stor.convertFileReferenceToFile(pathNorm);
  const key = mls.stor.getKeyToFile(f);
  const sf = mls.stor.files[key];
  if (!sf) throw new Error(`[agentMoleculeRewriter] File not found: ${info.path}`);
  const pageSrc = await sf.getContent() as string;

  const orch = getMaterializeOrchestrator(pathNorm);
  const usageSections: string[] = [];
  for (const group of info.usedGroups) {
    const usage = await orch.getSkill(`_102020_/l2/skills/molecules/${group}/usage.ts`); // camelCase — matches 102020 folder names
    if (usage) usageSections.push(`### ${group}\n${usage}`);
  }

  const parts = [
    `## Original page source\n\`\`\`typescript\n${pageSrc}\n\`\`\``,
    `## Substitution map\n\`\`\`json\n${JSON.stringify(info.map, null, 2)}\n\`\`\``,
    `## Molecule API reference\n${usageSections.join('\n\n')}`,
    `## Output path\n${info.path}`,
  ];

  return parts.join('\n\n');
}

const system1 = `
<!-- modelType: codereasoning -->
<!-- modelTypeList: geminiChat (2.5 pro), code (grok), deepseekchat, codeflash (gemini), deepseekreasoner, mini (4.1) ou nano (openai), codeinstruct (4.1), codereasoning(gpt5), code2 (kimi 2.5) -->

You must return ONLY a valid JSON object. No preamble, no explanation, no markdown
fences, no text before or after the JSON. Start your response with { and end with }

## Output format
The srcFile value must be a single-line JSON string.
Escape ALL special characters inside it:
  - newlines     → \\n
  - tabs         → \\t
  - double quotes → \\"
  - backslashes  → \\\\
Never embed raw multiline code blocks inside a JSON string value.

## Task
Rewrite the provided Lit web component page by replacing each element listed in the
substitution map with the corresponding molecule from mls-102040.

## Replacement rules

### Tags and imports
- Group names in the map use camelCase (e.g. groupEnterText). When building tags and imports
  for mls-102040, convert the group name to all lowercase.
- Replace each mapped element with its molecule custom element using this exact tag format:
  {group.toLowerCase()}--{variant}  (example: groupentertext--ml-floating-text-input)
- Add one import per unique variant at the top of the file, grouped after the existing imports:
  import '/_102040_/l2/molecules/{group.toLowerCase()}/{variant}.js';
- Do NOT import the same variant twice.

### API mapping (use the molecule API reference for each group)
- Map the original element's bound value to the molecule's \`value\` property
- Map the original label text to a \`<Label>\` slot child inside the molecule element
- Map the original helper/hint text to a \`<Helper>\` slot child if present
- Map the original error binding to the molecule's \`error\` property
- Map the original change/input event handlers to the molecule's events as documented
- Map the original \`disabled\` state to the molecule's \`?disabled\` property
- All variants within a group share the same API — only the tag name changes

### Preservation rules
- Keep the first-line \`/// <mls fileReference=...\` comment exactly unchanged
- Keep ALL class structure, state properties, computed variables, and non-template methods exactly as-is
- Keep ALL elements NOT listed in the substitution map exactly as-is
- Do not restructure, reformat, or optimize any code outside the replaced elements

## Output format

[[OutputSection]]

`;

//#region OutputSection
export type Output = {
  type: "flexible";
  result: {
    path: string;
    srcFile: string;
  }
}
//#endregion

type InputInfo = {
  path: string;
  map: Array<{
    elementDescription: string;
    group: string;
    variant: string;
    reason: string;
  }>;
  usedGroups: string[];
};
