/// <mls fileReference="_102020_/l2/agentNewSolution/agentSolutionBlueprint.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PlannerOutput,
  assertArray,
  assertOntologyEntityFields,
  assertRecord,
  createPlannerPromptReadyIntent,
  createPlannerVariableToolSchema,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  getPlannerOutput,
  getPlanningContextSnapshot,
  hasAcceptedNowArtifact,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { saveNewSolutionAgentTracePayload } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { solutionBlueprintResultSchema } from '/_102020_/l2/agentNewSolution/agentSolutionPlanSchemas.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentSolutionBlueprint',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Create a detailed blueprint for the new solution',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const SOLUTION_BLUEPRINT_TOOL_NAME = 'submitSolutionBlueprint';
export const SOLUTION_BLUEPRINT_STEP_ID = '06-solution-blueprint';
const SOLUTION_BLUEPRINT_ALIASES = [SOLUTION_BLUEPRINT_STEP_ID, 'plan-solution-blueprint'];

export interface SolutionBlueprintResult {
  module: Record<string, unknown>;
  actors: unknown[];
  capabilities: unknown[];
  ontology: {
    entities: Record<string, unknown>;
  };
  rules: unknown[];
  relationships: unknown[];
  userActions: unknown[];
  artifactPlan: {
    pages: unknown[];
    workflows: unknown[];
    plugins: unknown[];
    agents: unknown[];
    horizontalModules: unknown[];
    mdm: unknown[];
    metricTables: unknown[];
    metricDashboards: unknown[];
    usecaseEntities: unknown[];
  };
  coverage: unknown[];
}

export type SolutionBlueprintOutput = PlannerOutput<SolutionBlueprintResult>;

const solutionBlueprintToolSchema = createPlannerVariableToolSchema(
  SOLUTION_BLUEPRINT_TOOL_NAME,
  'Submit the detailed solution blueprint for the newSolution planner.',
  solutionBlueprintResultSchema
);

async function beforePromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
  args?: string,
): Promise<mls.msg.AgentIntent[]> {
  if (!agent || !step) throw new Error('[agentSolutionBlueprint](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const snapshot = getPlanningContextSnapshot(context);
  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(SOLUTION_BLUEPRINT_TOOL_NAME),
      buildHumanPrompt(args, snapshot),
      solutionBlueprintToolSchema,
      SOLUTION_BLUEPRINT_TOOL_NAME
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
    const output = extractSolutionBlueprintOutput(payload);
    validateSolutionBlueprintOutput(output, context);
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentSolutionBlueprint returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentSolutionBlueprint returned status needs_input; keeping validated draft for downstream planning.';
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);
  return [createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined)];
}

export function getSolutionBlueprintOutput(context: mls.msg.ExecutionContext): SolutionBlueprintOutput {
  return getPlannerOutput(context, 'agentSolutionBlueprint', solutionBlueprintConfig, output => validateSolutionBlueprintOutput(output, context));
}

function extractSolutionBlueprintOutput(payload: unknown): SolutionBlueprintOutput {
  return extractPlannerOutput(payload, solutionBlueprintConfig);
}

const solutionBlueprintConfig = {
  toolName: SOLUTION_BLUEPRINT_TOOL_NAME,
  stepId: SOLUTION_BLUEPRINT_STEP_ID,
  stepIdAliases: SOLUTION_BLUEPRINT_ALIASES,
  normalizeResult: normalizeSolutionBlueprintResult,
};

function normalizeSolutionBlueprintResult(value: unknown): SolutionBlueprintResult {
  const result = assertRecord(value, 'result');
  const ontology = assertRecord(result.ontology, 'result.ontology');
  const artifactPlan = assertRecord(result.artifactPlan, 'result.artifactPlan');

  return {
    module: assertRecord(result.module, 'result.module'),
    actors: assertArray(result.actors, 'result.actors'),
    capabilities: assertArray(result.capabilities, 'result.capabilities'),
    ontology: {
      entities: assertRecord(ontology.entities, 'result.ontology.entities'),
    },
    rules: assertArray(result.rules, 'result.rules'),
    relationships: assertArray(result.relationships, 'result.relationships'),
    userActions: assertArray(result.userActions, 'result.userActions'),
    artifactPlan: {
      pages: assertArray(artifactPlan.pages, 'result.artifactPlan.pages'),
      workflows: assertArray(artifactPlan.workflows, 'result.artifactPlan.workflows'),
      plugins: assertArray(artifactPlan.plugins, 'result.artifactPlan.plugins'),
      agents: assertArray(artifactPlan.agents, 'result.artifactPlan.agents'),
      horizontalModules: assertArray(artifactPlan.horizontalModules, 'result.artifactPlan.horizontalModules'),
      mdm: assertArray(artifactPlan.mdm, 'result.artifactPlan.mdm'),
      metricTables: assertArray(artifactPlan.metricTables, 'result.artifactPlan.metricTables'),
      metricDashboards: assertArray(artifactPlan.metricDashboards, 'result.artifactPlan.metricDashboards'),
      usecaseEntities: assertArray(artifactPlan.usecaseEntities, 'result.artifactPlan.usecaseEntities'),
    },
    coverage: assertArray(result.coverage, 'result.coverage'),
  };
}

function validateSolutionBlueprintOutput(output: SolutionBlueprintOutput, context: mls.msg.ExecutionContext): void {
  if (output.status === 'ok' && output.result.artifactPlan.mdm.length === 0) throw new Error('solution blueprint must include MDM artifact plan');
  if (output.status === 'ok') assertOntologyEntityFields(output.result.ontology.entities, 'solution blueprint'); // T-001
  const snapshot = getPlanningContextSnapshot(context);
  if (output.status === 'ok' && snapshot.initialMetricsRequested) {
    if (output.result.artifactPlan.metricTables.length === 0) throw new Error('initial metrics requested, but blueprint has no metricTables');
    if (output.result.artifactPlan.metricDashboards.length === 0) throw new Error('initial metrics requested, but blueprint has no metricDashboards');
  }
  if (output.status === 'ok' && hasAcceptedNowArtifact(snapshot.implementationDecisions, 'usecaseEntity') && output.result.artifactPlan.usecaseEntities.length === 0) {
    throw new Error('accepted usecaseEntity planning, but blueprint has no usecaseEntities');
  }
}

function buildHumanPrompt(args: string, snapshot: ReturnType<typeof getPlanningContextSnapshot>): string {
  return `## Planned step args
${args}

## Initial user prompt
${snapshot.initialPlan.userPrompt}

## Initial plan
${JSON.stringify(snapshot.initialPlan, null, 2)}

## Clarification answer
${JSON.stringify(snapshot.clarificationAnswer, null, 2)}

## Discovered scope
${JSON.stringify(snapshot.discoveredScope, null, 2)}

## Implementation recommendations
${JSON.stringify(snapshot.recommendations, null, 2)}

## Accepted implementation decisions
${JSON.stringify(snapshot.implementationDecisions, null, 2)}

## Initial metrics/dashboard requested
${snapshot.initialMetricsRequested}
`;
}

const systemPrompt = `
<!-- modelType: codeinstruct -->

You are agentSolutionBlueprint for the collab.codes "newSolution" flow.
Create a detailed solution blueprint from the prompt, clarification, discovered scope, recommendations, and approved implementation decisions.
Use the same language as the user for labels, descriptions, questions, and trace.
Use English camelCase identifiers for ids and PascalCase for entity names.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## Result shape
In result, return:
- module with moduleName, purpose, businessDomain, languages, and visualStyle.
- actors.
- capabilities.
- ontology.entities as an object map keyed by PascalCase entity id. Each value must include title, description, and fields. fields must list every known attribute of the entity, each with fieldId (camelCase), type, required, and description — never return an empty fields array. Include entityId, kind, ownership, statusEnum, lifecycleStates, and rulesApplied only when they are known.
- centralized rules.
- relationships.
- userActions.
- artifactPlan with pages, workflows, plugins, agents, horizontalModules, mdm, metricTables, metricDashboards, and usecaseEntities.
- coverage.

## Rules
- Do not use hard-coded entities, actions, pages, or workflows from a sample domain.
- Infer the core commitment of the requested domain (e.g. booking, order, request, contract, subscription, approval, service request, or similar lifecycle/relationship).
- Every core commitment must reference the selected subject, resource, service, product, or person that makes the commitment meaningful. Derive names from the prompt and ontology.
- Include explicit user actions for all required selections, confirmations, and lifecycle changes implied by the domain.
- Include MDM domains for stable master data such as customers, accounts, products, assets, suppliers, staff, locations, or reusable records.
- Every entity owned by the solution (ownership moduleOwned or mdmOwned) must declare its full field list: fieldId, type, required, and description for each field. An entity without fields cannot be materialized and is invalid.
- Include operational metric tables and an admin dashboard when initial metrics/dashboard was accepted.
- Include layer_3 usecase entities when the solution has BFF commands, writes, lifecycle changes, or metric updates.
- Backend layer rules must be respected: BFF is layer_2, use cases are layer_3, real tables are layer_1.
- Do not make payments, scheduling, adoption, or unrelated features part of the MVP when the prompt or decisions excluded them.
- Use rules with stable ruleId values. Do not leave rule text loose in pages.
- Use status "needs_input" only when a safe blueprint cannot be drafted without another client decision.
`;
