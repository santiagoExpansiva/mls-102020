# createNewAgentSkill - newSolution client agent guide

Use this guide when creating a new client-side agent for:

- `/Volumes/WagnerSSD1/collab/mls-base/mls-102020/l2/agentNewSolution/`

The goal is to create agents that follow the working `run01` flow without hard-coding fixture names from the test harness.

## Core Rules

- Code owns canonical `planId`, `agentName`, dependencies, execution mode, and selectors.
- The LLM owns analysis text, localized labels, descriptions, recommendations, questions, and trace.
- Do not hard-code fixture domain names such as rental, vehicle, fleet, reservation, table ids, workflow ids, or page ids.
- Use `run01/flow.json` and `run01/prompts/*.md` as behavior references, not as literal data to embed.
- Prefer real provider tool/function calling for all new planner agents.
- Keep `createAgent()` immediately after imports.
- Keep comments rare and only for non-obvious code.
- Use `mls.isTraceAgent` for temporary diagnostics.

## File Pattern

Each agent file should be named after the agent:

```text
agentNewSolution/<agentName>.ts
```

Each file should use this top-level shape:

```ts
import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: '<agentName>',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: '<short description>',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}
```

Add `beforeClarificationStep` only for client clarification steps that render UI.

## Runtime Status Contract

Understand the backend state machine before choosing a status:

- `waiting_dependency`: visible planned step, not executable yet.
- `waiting_human_input`: frontend must run `beforePromptStep` and send `prompt_ready`.
- `pending`: LLM interaction is ready and scheduler may execute it.
- `completed` / `failed`: terminal status.

Never create a step that needs `beforePromptStep` as `pending` with `interaction:null`.

For a step needing frontend prompt preparation:

1. The step must be `waiting_human_input`.
2. Backend queues `beforePromptStep`.
3. Frontend agent returns a `prompt_ready` intent.
4. Backend fills `interaction` and moves the step to `pending`.
5. LLM scheduler runs the step.

## beforePromptStep

`beforePromptStep` should:

- Validate `args` and `context.task`.
- Read prior task outputs from `context.task`, never from fixture files.
- Build a deterministic system prompt.
- Build a human prompt from prior outputs.
- Return exactly one `AgentIntentPromptReady` unless there is a clear reason not to.
- Include `tools` and `toolChoice` for planner agents that should use provider tool/function calling.

Example return shape:

```ts
const continueIntent: mls.msg.AgentIntentPromptReady = {
  type: 'prompt_ready',
  args,
  messageId: context.message.orderAt,
  threadId: context.message.threadId,
  taskId: context.task.PK,
  hookSequential,
  parentStepId: parentStep.stepId,
  systemPrompt: buildSystemPrompt(),
  humanPrompt: buildHumanPrompt(args, priorOutput),
  tools: [myToolSchema],
  toolChoice: {
    type: 'function',
    function: { name: MY_TOOL_NAME },
  },
};

return [continueIntent];
```

## Real Tool Calling

Use a per-agent tool name and schema:

```ts
export const TOOL_NAME = 'submitSomething';
export const SCHEMA_VERSION = '2026-06-02';
export const STEP_ID = '<run01-step-id>';
```

Pass the schema through `AgentIntentPromptReady.tools`. Force the expected tool with `toolChoice` when the step has exactly one valid output tool.

The provider returns `message.tool_calls`. `collab-messages` converts that provider response to this internal payload shape before `afterPromptStep` runs:

```json
{
  "type": "flexible",
  "result": {
    "toolName": "submitSomething",
    "arguments": {
      "type": "flexible",
      "result": {
        "runId": "runtime",
        "stepId": "<run01-step-id>",
        "schemaVersion": "2026-06-02",
        "status": "ok",
        "result": {},
        "questions": [],
        "trace": []
      }
    }
  }
}
```

The TypeScript `Output` type should accept:

- Direct flexible result.
- Tool call object.
- Tool arguments object.
- Actual provider `tool_calls`, if a lower layer passes them through directly later.
- Error result `{ type: 'result', result: string }`.

`afterPromptStep` should unwrap all accepted shapes, normalize data, validate it, and then return an `update-status` intent.

Use `status: 'failed'` only when output is invalid or explicitly failed.

Use `cleaner: 'input'` on successful large planner steps when the prompt can be removed after validation.

## Data Access

Use task helpers and small local readers:

- `getAgentStepByAgentName(context.task, '<agentName>')`
- `getAllSteps(context.task.iaCompressed?.nextSteps)`
- `planning.planId` to find planned/result steps.

Do not rely on numeric `stepId` values. They are runtime generated.

Do not rely on array indexes in `nextSteps` unless the code owns that exact structure.

## Dynamic Steps

For dynamic parallel steps:

- The source agent returns generic ids, such as `tableId`, `metricTableId`, `workflowId`, or `pageId`.
- The fan-out creates one child step per generated id.
- The child prompt receives that id through hook `args`.
- No fixture selector names are allowed in code.

## Validation Checklist

Before finishing a new agent:

- `createAgent()` returns the exact `agentName` used by `agentNewSolution.ts`.
- The file is in `agentFolder: 'agentNewSolution'`.
- `beforePromptStep` returns `prompt_ready`.
- The planned step starts as `waiting_dependency`, or `waiting_human_input` if it is immediately executable.
- `afterPromptStep` validates the converted tool-call payload.
- Invalid output marks the step failed instead of silently continuing.
- No fixture hard-code was added.
- `pnpm build` passes in `/Volumes/WagnerSSD1/collab/mls-base`.

## Next Agent Pattern

For `agentRecommendImplementations`:

- Source flow step: `04-recommend-implementations`.
- Input: validated output from `agentDiscoverSolutionScope`.
- Output: prioritized implementation recommendations.
- It should include MDM as `now`.
- It should include metrics/dashboard when clarification requested initial metrics.
- It should not choose payment plugins unless payment is materially relevant.
- It should prepare the next client decision step, but the decision step itself is human/client-side.
