/// <mls fileReference="_102020_/l2/agentNewSolution/agentRepairPlanIndex.ts" enhancement="_102027_/l2/enhancementAgent"/>

// TODO-FINAL-024
// Generic repair agent for plan indices. One repair run per index, parameterized by the
// index name in the step args. It receives the current index, the critique report (LLM
// critique payload or the deterministic local findings), the index contract/schema and a
// minimal context, and must return the FULL corrected index (not partial patches).
// On success it adds the next critic attempt; the index getters then prefer this repaired
// payload (see getPlannerOutputWithRepair). On invalid output the repair and the index fail.

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  CRITIC_PLAN_INDEX_AGENT_NAME,
  PlannerOutput,
  createPlanIndexReviewStepIntent,
  createPlannerPromptReadyIntent,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  findLatestPlanIndexReviewStep,
  findParentStepOfStep,
  parsePlanIndexReviewArgs,
  repairPlanIndexToolName,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import {
  PlanIndexLocalFindings,
  PlanIndexReviewConfig,
  getPlanIndexReviewConfig,
  getRepairToolSchema,
  planIndexCritiqueExtractConfig,
} from '/_102020_/l2/agentNewSolution/agentPlanIndexReview.js';
import { saveNewSolutionAgentTracePayload } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentRepairPlanIndex',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Repair one plan index using the critique report, returning the full corrected index',
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
  if (!agent || !step) throw new Error('[agentRepairPlanIndex](beforePromptStep) invalid params');
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const reviewArgs = parsePlanIndexReviewArgs(args || step.prompt);
  const config = getPlanIndexReviewConfig(reviewArgs.indexName);
  const indexStep = parentStep; // repair steps are direct children of the index step

  const output = config.getCurrentOutput(context);
  const localFindings = config.runLocalCheckpoint(context, output);
  const critiqueJson = getLatestCritiqueJson(context, reviewArgs.indexName);
  const toolName = repairPlanIndexToolName(reviewArgs.indexName);

  return [
    createPlannerPromptReadyIntent(
      context,
      indexStep,
      hookSequential,
      args || step.prompt || '',
      systemPrompt.split('{{toolName}}').join(toolName),
      buildRepairHumanPrompt(context, config, output, localFindings, critiqueJson, reviewArgs.attempt),
      getRepairToolSchema(config.indexName),
      toolName
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

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing repair payload');
    const repaired = extractPlannerOutput(payload, config.buildRepairExtractConfig()) as PlannerOutput<unknown>;
    if (repaired.status !== 'ok') throw new Error(`repair returned status ${repaired.status}${repaired.questions.length ? `; questions: ${repaired.questions.join(' | ')}` : ''}`);
    config.validateRepairedOutput(context, repaired);
  } catch (error) {
    // Invalid repaired index: keep the payload for debug and fail early with a clear reason.
    const traceMsg = `repair of ${reviewArgs.indexName} produced an invalid index: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
    const intents: mls.msg.AgentIntent[] = [
      createPlannerUpdateStatusIntent(context, indexStep, step, hookSequential, 'failed', traceMsg),
    ];
    // Only fail the index step when its parent resolves as an agent step; reaching up to a
    // grandparent id that no longer resolves (e.g. after a manual restart) makes the backend
    // throw "Parent step not found" and breaks restart.
    const indexParent = findParentStepOfStep(context, indexStep.stepId);
    if (indexParent && indexParent.type === 'agent') {
      intents.push(createPlannerUpdateStatusIntent(context, indexParent as mls.msg.AIAgentStep, indexStep, hookSequential, 'failed', traceMsg));
    }
    return intents;
  }

  // Valid repaired index: run the critic again (next attempt) before releasing children.
  // Add the next critic step BEFORE completing this repair step, so the index step always
  // keeps a non-terminal child and is not auto-completed by the orchestrator.
  const nextAttempt = reviewArgs.attempt + 1;
  return [
    createPlanIndexReviewStepIntent(
      context,
      indexStep,
      CRITIC_PLAN_INDEX_AGENT_NAME,
      reviewArgs.indexName,
      nextAttempt,
      `Review ${reviewArgs.indexName} (critic ${nextAttempt})`,
    ),
    createPlannerUpdateStatusIntent(
      context,
      indexStep,
      step,
      hookSequential,
      'completed',
      `repaired ${reviewArgs.indexName}; scheduling critic attempt ${nextAttempt}`,
      'input',
    ),
  ];
}

function getLatestCritiqueJson(context: mls.msg.ExecutionContext, indexName: string): string | null {
  const criticStep = findLatestPlanIndexReviewStep(context, CRITIC_PLAN_INDEX_AGENT_NAME, indexName, true);
  const payload = criticStep?.interaction?.payload?.[0];
  if (!payload) return null;
  try {
    const critique = extractPlannerOutput(payload, planIndexCritiqueExtractConfig);
    return JSON.stringify(critique.result, null, 2);
  } catch {
    return null;
  }
}

function buildRepairHumanPrompt(
  context: mls.msg.ExecutionContext,
  config: PlanIndexReviewConfig,
  output: PlannerOutput<unknown>,
  localFindings: PlanIndexLocalFindings,
  critiqueJson: string | null,
  attempt: number,
): string {
  return `## Index to repair
${config.indexName} (${config.description}), repair attempt ${attempt}.

## Contract focus for this index
${config.contractFocus}

## Index result JSON schema (the corrected index must satisfy it)
${JSON.stringify(config.resultSchema, null, 2)}

## Current index (result only)
${JSON.stringify(output.result, null, 2)}

## Critique report
${critiqueJson || 'No LLM critique available; fix the deterministic local findings below.'}

## Deterministic local findings (must all be fixed when severity is error)
${JSON.stringify(localFindings, null, 2)}

## Minimal planning context
${JSON.stringify(config.buildReviewContext(context), null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codeinstruct -->
<!-- x-tool-strict: true -->

You are agentRepairPlanIndex for the collab.codes "newSolution" flow.
Repair ONLY the single plan index provided, using the critique report and the deterministic findings.
Use the same language as the user for titles, purposes, reasons, and trace.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## Rules
- Return the FULL corrected index in result, in the same schema as the original index. Never return partial patches.
- Fix every finding classified as error. Apply warnings only when the fix is safe and local.
- Do not change parts of the index that have no related finding.
- Keep existing identifiers stable unless an error explicitly requires renaming or removing an item.
- Do not invent new scope: no new tables, metrics, workflows, pages, plugins, or usecases beyond what the findings and the minimal context justify.
- If a finding cannot be fixed with the available context, return status "needs_input" with concrete questions.
`;
