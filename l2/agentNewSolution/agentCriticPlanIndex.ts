/// <mls fileReference="_102020_/l2/agentNewSolution/agentCriticPlanIndex.ts" enhancement="_102027_/l2/enhancementAgent"/>

// TODO-FINAL-023 / TODO-FINAL-024
// Generic critic agent for plan indices. One critic run per index, parameterized by the
// index name in the step args. Flow per index:
// 1. The index agent holds its step in_progress and adds this critic as a child step.
// 2. beforePromptStep runs the deterministic local checkpoint (TODO-FINAL-023):
//    - local errors  -> skip the LLM, send the index straight to repair (synthetic critique);
//    - skip condition (empty index) -> approve directly without LLM;
//    - otherwise -> focused critic LLM call for this single index.
// 3. afterPromptStep applies the critique: approve (freeze checkpoint + release children),
//    repair (add agentRepairPlanIndex child), or fail after the attempt limit.
// Step layout: critic/repair steps are direct children of the index step. The index step
// must keep at least one non-terminal child until resolution, because the orchestrator
// auto-completes a parent whose children are all terminal. Intent order below preserves that.

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  MAX_PLAN_INDEX_CRITIC_ATTEMPTS,
  PlannerOutput,
  REPAIR_PLAN_INDEX_AGENT_NAME,
  createPlanIndexReviewStepIntent,
  createPlannerPromptReadyIntent,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  findParentStepOfStep,
  parsePlanIndexReviewArgs,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import {
  PLAN_INDEX_CRITIQUE_TOOL_NAME,
  PlanIndexCritiqueOutput,
  PlanIndexLocalFindings,
  PlanIndexReviewConfig,
  buildEmptyHealthReport,
  critiqueFindingsToHealth,
  getPlanIndexReviewConfig,
  planIndexCritiqueExtractConfig,
  planIndexCritiqueToolSchema,
} from '/_102020_/l2/agentNewSolution/agentPlanIndexReview.js';
import {
  PlanIndexHealthReport,
  saveNewSolutionAgentTracePayload,
} from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentCriticPlanIndex',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Criticize one plan index before releasing its dependent definition steps',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

async function beforePromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
  args?: string,
): Promise<mls.msg.AgentIntent[]> {
  if (!agent || !step) throw new Error('[agentCriticPlanIndex](beforePromptStep) invalid params');
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const reviewArgs = parsePlanIndexReviewArgs(args || step.prompt);
  const config = getPlanIndexReviewConfig(reviewArgs.indexName);
  const indexStep = parentStep; // critic steps are direct children of the index step

  let output: PlannerOutput<unknown>;
  let localFindings: PlanIndexLocalFindings;
  try {
    output = config.getCurrentOutput(context);
    localFindings = config.runLocalCheckpoint(context, output);
  } catch (error) {
    // The index payload became unreadable between generation and review: fail early and clearly.
    const message = error instanceof Error ? error.message : String(error);
    return failIndexIntents(context, indexStep, step, hookSequential, `critic could not read ${reviewArgs.indexName}: ${message}`);
  }

  // Empty/disabled index: nothing to criticize, approve without spending an LLM call.
  if (config.skipCriticWhen?.(output)) {
    const healthReport = buildEmptyHealthReport();
    healthReport.attempts = reviewArgs.attempt;
    healthReport.localWarnings = localFindings.warnings;
    healthReport.notes.push('critic skipped: empty or disabled index');
    return approveIndexIntents(context, config, indexStep, step, hookSequential, output, healthReport);
  }

  // TODO-FINAL-023: deterministic local errors go straight to repair, no critic LLM needed.
  if (localFindings.errors.length > 0) {
    if (reviewArgs.attempt >= MAX_PLAN_INDEX_CRITIC_ATTEMPTS) {
      const summary = localFindings.errors.map(item => item.message).join('; ');
      return failIndexIntents(context, indexStep, step, hookSequential, `local checkpoint still failing after ${reviewArgs.attempt} attempts: ${summary}`);
    }
    return [
      createPlanIndexReviewStepIntent(
        context,
        indexStep,
        REPAIR_PLAN_INDEX_AGENT_NAME,
        reviewArgs.indexName,
        reviewArgs.attempt,
        `Repair ${reviewArgs.indexName} (attempt ${reviewArgs.attempt})`,
      ),
      createPlannerUpdateStatusIntent(
        context,
        indexStep,
        step,
        hookSequential,
        'completed',
        `local checkpoint found ${localFindings.errors.length} error(s); skipping critic LLM and requesting repair`,
      ),
    ];
  }

  return [
    createPlannerPromptReadyIntent(
      context,
      indexStep,
      hookSequential,
      args || step.prompt || '',
      systemPrompt.split('{{toolName}}').join(PLAN_INDEX_CRITIQUE_TOOL_NAME),
      buildCriticHumanPrompt(context, config, output, localFindings, reviewArgs.attempt),
      planIndexCritiqueToolSchema,
      PLAN_INDEX_CRITIQUE_TOOL_NAME
    ),
  ];
}

async function afterPromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
): Promise<mls.msg.AgentIntent[]> {
  if (!context.task) throw new Error(`[${agent.agentName}](afterPromptStep) task invalid`);

  const reviewArgs = parsePlanIndexReviewArgs(step.prompt);
  const config = getPlanIndexReviewConfig(reviewArgs.indexName);
  const indexStep = parentStep;

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);

  let output: PlannerOutput<unknown>;
  let localFindings: PlanIndexLocalFindings;
  try {
    output = config.getCurrentOutput(context);
    localFindings = config.runLocalCheckpoint(context, output);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failIndexIntents(context, indexStep, step, hookSequential, `critic could not read ${reviewArgs.indexName}: ${message}`);
  }

  let critique: PlanIndexCritiqueOutput | undefined;
  let criticFallbackNote: string | undefined;
  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing critic payload');
    critique = extractPlannerOutput(payload, planIndexCritiqueExtractConfig);
    if (critique.status !== 'ok') throw new Error(`critic returned status ${critique.status}`);
  } catch (error) {
    // The critic is a quality gate, not a new blocker: when the gate itself fails,
    // fall back to the pre-critic behavior (approve with a warning note in the checkpoint).
    criticFallbackNote = `critic LLM failed, approved by fallback: ${error instanceof Error ? error.message : String(error)}`;
    critique = undefined;
  }

  const healthReport = buildEmptyHealthReport();
  healthReport.attempts = reviewArgs.attempt;
  healthReport.localErrors = localFindings.errors;
  healthReport.localWarnings = localFindings.warnings;
  if (critique) {
    healthReport.criticErrors = critiqueFindingsToHealth(critique.result.errors, 'error');
    healthReport.criticWarnings = critiqueFindingsToHealth(critique.result.warnings, 'warning');
    healthReport.notes.push(...critique.result.notes);
  }
  if (criticFallbackNote) healthReport.notes.push(criticFallbackNote);

  const hasErrors = !!critique && (!critique.result.approved || critique.result.errors.length > 0);

  if (!hasErrors) {
    return approveIndexIntents(context, config, indexStep, step, hookSequential, output, healthReport);
  }

  if (reviewArgs.attempt >= MAX_PLAN_INDEX_CRITIC_ATTEMPTS) {
    const summary = critique!.result.errors.map(item => `${item.code}: ${item.message}`).join('; ');
    return failIndexIntents(context, indexStep, step, hookSequential, `critic rejected ${reviewArgs.indexName} after ${reviewArgs.attempt} attempts: ${summary}`);
  }

  // Add the repair step BEFORE completing this critic step, so the index step always keeps
  // a non-terminal child and is not auto-completed by the orchestrator.
  return [
    createPlanIndexReviewStepIntent(
      context,
      indexStep,
      REPAIR_PLAN_INDEX_AGENT_NAME,
      reviewArgs.indexName,
      reviewArgs.attempt,
      `Repair ${reviewArgs.indexName} (attempt ${reviewArgs.attempt})`,
    ),
    createPlannerUpdateStatusIntent(
      context,
      indexStep,
      step,
      hookSequential,
      'completed',
      `critic found ${critique!.result.errors.length} error(s) on ${reviewArgs.indexName}; requesting repair`,
      'input',
    ),
  ];
}

async function approveIndexIntents(
  context: mls.msg.ExecutionContext,
  config: PlanIndexReviewConfig,
  indexStep: mls.msg.AIAgentStep,
  criticStep: mls.msg.AIAgentStep,
  hookSequential: number,
  output: PlannerOutput<unknown>,
  healthReport: PlanIndexHealthReport,
): Promise<mls.msg.AgentIntent[]> {
  // TODO-FINAL-023: freeze the approved index in the manifest/checkpoint before releasing children.
  await config.onApproved(context, indexStep, output, healthReport);

  const indexParent = findParentStepOfStep(context, indexStep.stepId);
  const intents: mls.msg.AgentIntent[] = [
    createPlannerUpdateStatusIntent(
      context,
      indexStep,
      criticStep,
      hookSequential,
      'completed',
      `${config.indexName} approved (attempt ${healthReport.attempts}); checkpoint frozen`,
      // TODO-FINAL-030: the critique payload is dead after approval (healthReport already frozen in
      // the checkpoint, no further getLatestCritiqueJson read) — clear it fully to keep the task light.
      'input_output',
    ),
    createPlannerUpdateStatusIntent(
      context,
      (indexParent && indexParent.type === 'agent' ? indexParent : indexStep) as mls.msg.AIAgentStep,
      indexStep,
      hookSequential,
      'completed',
      `${config.indexName} frozen after critic approval (TODO-FINAL-023/024)`,
      'input',
    ),
  ];

  intents.push(...config.createChildrenIntents(context, output));
  return intents;
}

function failIndexIntents(
  context: mls.msg.ExecutionContext,
  indexStep: mls.msg.AIAgentStep,
  criticStep: mls.msg.AIAgentStep,
  hookSequential: number,
  traceMsg: string,
): mls.msg.AgentIntent[] {
  const intents: mls.msg.AgentIntent[] = [
    createPlannerUpdateStatusIntent(context, indexStep, criticStep, hookSequential, 'failed', traceMsg),
  ];
  // Only fail the index step when its parent is resolvable as an agent step. Reaching up to a
  // grandparent whose id no longer resolves (e.g. after a manual restart) makes the backend
  // throw "Parent step not found", which breaks the restart. Skipping is safe: the critic/repair
  // step is already failed, surfacing the reason.
  const indexParent = findParentStepOfStep(context, indexStep.stepId);
  if (indexParent && indexParent.type === 'agent') {
    intents.push(createPlannerUpdateStatusIntent(context, indexParent as mls.msg.AIAgentStep, indexStep, hookSequential, 'failed', traceMsg));
  }
  return intents;
}

function buildCriticHumanPrompt(
  context: mls.msg.ExecutionContext,
  config: PlanIndexReviewConfig,
  output: PlannerOutput<unknown>,
  localFindings: PlanIndexLocalFindings,
  attempt: number,
): string {
  return `## Index under review
${config.indexName} (${config.description}), critic attempt ${attempt}.

## Contract focus for this index
${config.contractFocus}

## Current index (result only)
${JSON.stringify(output.result, null, 2)}

## Deterministic local findings (already computed by code)
${JSON.stringify(localFindings, null, 2)}

## Minimal planning context
${JSON.stringify(config.buildReviewContext(context), null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codepro -->
<!-- x-tool-strict: true -->

You are agentCriticPlanIndex for the collab.codes "newSolution" flow.
Criticize ONLY the single plan index provided. Do not review other indices or artifacts.
Use the same language as the user for messages and notes.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## How to classify findings
- "errors": contract violations, broken references, scope decisions that child definition agents cannot fix later (wrong ownership, missing approved artifact, invented item, wrong actor, wrong executionMode, wrong resolution).
- "warnings": acceptable modeling choices, style issues, or improvements that must NOT block the flow. Example: a page input modeled as an object that contains the identifier internally is acceptable when its contract is clear.
- approved must be true only when errors is empty.
- Do not invent new scope; judge the index against the provided contract focus and minimal context only.
- Repeat the deterministic local findings only if you confirm them; never contradict deterministic reference checks.
- Keep findings short, each with a stable code, a clear message, and a path inside the index when possible.
`;
