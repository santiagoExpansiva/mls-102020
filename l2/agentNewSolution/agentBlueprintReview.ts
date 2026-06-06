/// <mls fileReference="_102020_/l2/agentNewSolution/agentBlueprintReview.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PlannerOutput,
  assertArray,
  assertRecord,
  assertString,
  createPlannerPromptReadyIntent,
  createPlannerUpdateStatusIntent,
  createPlannerVariableToolSchema,
  extractPlannerOutput,
  getPlannerOutput,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { saveNewSolutionAgentTracePayload } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { SolutionBlueprintOutput, getSolutionBlueprintOutput } from '/_102020_/l2/agentNewSolution/agentSolutionBlueprint.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentBlueprintReview',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Review the solution blueprint before specialized planners run',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const BLUEPRINT_REVIEW_TOOL_NAME = 'submitBlueprintReview';
export const BLUEPRINT_REVIEW_STEP_ID = '07-blueprint-review';
const BLUEPRINT_REVIEW_ALIASES = [BLUEPRINT_REVIEW_STEP_ID, 'plan-blueprint-review'];

export interface BlueprintReviewIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  path: string;
  evidence: string[];
}

export interface BlueprintReviewResult {
  issues: BlueprintReviewIssue[];
  recommendedFixes: unknown[];
}

export type BlueprintReviewOutput = PlannerOutput<BlueprintReviewResult>;

const blueprintReviewResultSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['issues', 'recommendedFixes'],
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'code', 'message', 'path', 'evidence'],
        properties: {
          severity: { enum: ['error', 'warning', 'info'] },
          code: { type: 'string' },
          message: { type: 'string' },
          path: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    recommendedFixes: { type: 'array', items: { type: 'string' } },
  },
};

const blueprintReviewToolSchema = createPlannerVariableToolSchema(
  BLUEPRINT_REVIEW_TOOL_NAME,
  'Submit a structural review of the newSolution blueprint.',
  blueprintReviewResultSchema
);

async function beforePromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
  args?: string,
): Promise<mls.msg.AgentIntent[]> {
  if (!agent || !step) throw new Error('[agentBlueprintReview](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const blueprint = getSolutionBlueprintOutput(context);
  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(BLUEPRINT_REVIEW_TOOL_NAME),
      buildHumanPrompt(args, blueprint),
      blueprintReviewToolSchema,
      BLUEPRINT_REVIEW_TOOL_NAME
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
  let status: mls.msg.AIStepStatus = 'completed';
  let traceMsg: string | undefined;

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    const output = extractBlueprintReviewOutput(payload);
    validateBlueprintReviewOutput(output);
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentBlueprintReview returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentBlueprintReview returned status needs_input; keeping review for finalize step.';
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);
  return [createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined)];
}

export function getBlueprintReviewOutput(context: mls.msg.ExecutionContext): BlueprintReviewOutput {
  return getPlannerOutput(context, 'agentBlueprintReview', blueprintReviewConfig, validateBlueprintReviewOutput);
}

function extractBlueprintReviewOutput(payload: unknown): BlueprintReviewOutput {
  return extractPlannerOutput(payload, blueprintReviewConfig);
}

const blueprintReviewConfig = {
  toolName: BLUEPRINT_REVIEW_TOOL_NAME,
  stepId: BLUEPRINT_REVIEW_STEP_ID,
  stepIdAliases: BLUEPRINT_REVIEW_ALIASES,
  normalizeResult: normalizeBlueprintReviewResult,
};

function normalizeBlueprintReviewResult(value: unknown): BlueprintReviewResult {
  const result = assertRecord(value, 'result');
  const issues = assertArray(result.issues, 'result.issues').map((item, index) => normalizeIssue(item, `result.issues[${index}]`));
  return {
    issues,
    recommendedFixes: assertArray(result.recommendedFixes, 'result.recommendedFixes')
      .map((item, index) => assertString(item, `result.recommendedFixes[${index}]`)),
  };
}

function normalizeIssue(value: unknown, path: string): BlueprintReviewIssue {
  const issue = assertRecord(value, path);
  const severity = issue.severity;
  if (severity !== 'error' && severity !== 'warning' && severity !== 'info') throw new Error(`${path}.severity must be error, warning, or info`);
  return {
    severity,
    code: assertString(issue.code, `${path}.code`),
    message: assertString(issue.message, `${path}.message`),
    path: assertString(issue.path, `${path}.path`),
    evidence: assertArray(issue.evidence, `${path}.evidence`).map((item, index) => assertString(item, `${path}.evidence[${index}]`)),
  };
}

function validateBlueprintReviewOutput(output: BlueprintReviewOutput): void {
  if (output.status === 'needs_input' && output.questions.length === 0) throw new Error('needs_input review must include questions');
}

function buildHumanPrompt(args: string, blueprint: SolutionBlueprintOutput): string {
  return `## Planned step args
${args}

## Solution blueprint to review
${JSON.stringify(blueprint, null, 2)}
`;
}

const systemPrompt = `
<!-- modelType: codeinstruct -->

You are agentBlueprintReview for the collab.codes "newSolution" flow.
Review the blueprint for gaps before specialized planners run.
Use the same language as the user for messages, recommended fixes, questions, and trace.

## Tool mode
Call the "{{toolName}}" tool with the review payload.
Do not return prose.

## Output contract
The tool arguments must contain only:
- status: "ok", "needs_input", or "failed".
- result.issues: array.
- result.recommendedFixes: array of strings.
- questions: array of strings.
- trace: array of strings.

Do not include type, runId, stepId, schemaVersion, toolName, or arguments. The harness fills those fields.
Use status "ok" when the review report was generated, even when issues were found.
Use status "needs_input" only when the review itself cannot be completed without another answer.

## Rules
- Detect missing selection or confirmation of the domain's core subject, resource, service, product, or person when a commitment depends on it.
- Detect missing relationships between commitment entities and selected subjects, resources, services, products, or people.
- Detect missing MDM.
- Detect missing metrics, table, or dashboard coverage when initial metrics/dashboard was accepted.
- Detect missing layer_3 usecase planning when the solution has BFF commands, writes, lifecycle changes, or metric updates.
- Detect any plan where layer_2 BFF appears to access layer_1 tables directly.
- Detect workflows disguised as static pages.
- Detect approved capabilities without artifact coverage.
- Detect entity status changes that contradict declared enums or duplicate another workflow's responsibility.
- Use severity "error" for blockers and "warning" for future/later items.
`;
