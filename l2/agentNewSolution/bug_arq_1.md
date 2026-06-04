# bug_arq_1 - clarification result should not call orchestration directly

Status: open

## Context

`agentNewSolutionRequirements.beforeClarificationStep` has a custom clarification UI. When the user finishes the clarification, `applyClarificationResult` currently calls `mls.api.msgApplyIntents` directly.

This works for the current flow only because the agent then checks `queueFrontEnd` and calls `continuePoolingTask(context)` when a frontend hook exists.

## Current Workaround

File:

- `/Volumes/WagnerSSD1/collab/mls-base/mls-102020/l2/agentNewSolution/agentNewSolutionRequirements.ts`

Current behavior:

- Create the clarification answer result step.
- Mark the clarification step as completed or failed.
- Mark the planned `req-clarification-answer` result step as completed when applicable.
- Call `mls.api.msgApplyIntents` directly.
- Notify task change.
- If the returned task has a non-pooling frontend hook, dynamically import `continuePoolingTask` and continue orchestration.

## Why This Should Be Fixed

The agent file now knows too much about orchestration.

Problems:

- It bypasses the normal `processIntents` / `_processIntentsStream` path.
- It duplicates "apply intents then continue hooks" behavior outside `aiAgentOrchestration`.
- It makes streaming/yield behavior harder to reason about.
- It can hide future bugs where a custom clarification applies intents but forgets to continue frontend hooks.

## Target Fix

Create one shared orchestration entry point for custom clarification results.

The final shape should be one of these:

- Export a small helper from `aiAgentOrchestration.ts` that applies intents and continues pending frontend hooks.
- Or make `finishClarification` flexible enough to accept custom result intents without requiring an artificial add-step continuation.
- Or move the custom clarification result application into the common clarification path.

The agent should not call `mls.api.msgApplyIntents` directly.

The agent should not dynamically import `continuePoolingTask`.

## Required Contract

After a clarification answer is applied:

- The backend receives all required intents in one apply operation.
- The returned task is written to the local context.
- The UI is notified.
- If `queueFrontEnd` has `beforePromptStep` or `beforeTool`, orchestration continues automatically.
- If only `pooling` remains, normal pooling behavior is preserved.

## Acceptance

- No direct `mls.api.msgApplyIntents` call remains in `agentNewSolutionRequirements.ts`.
- No dynamic import of `aiAgentOrchestration.js` remains in `agentNewSolutionRequirements.ts`.
- Answering the first clarification unlocks and executes `agentDiscoverSolutionScope`.
- The flow still reaches `agentRecommendImplementations` as the next missing agent.
- `pnpm build` passes in `/Volumes/WagnerSSD1/collab/mls-base`.

