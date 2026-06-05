/// <mls fileReference="_102020_/l2/agentNewSolution/agentSolutionBlueprint.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PlannerOutput,
  assertArray,
  assertRecord,
  createPlannerPromptReadyIntent,
  createPlannerToolSchema,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  getPlannerOutput,
  getPlanningContextSnapshot,
  hasAcceptedNowArtifact,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';

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

const solutionBlueprintToolSchema = createPlannerToolSchema(
  SOLUTION_BLUEPRINT_TOOL_NAME,
  'Submit the detailed solution blueprint for the newSolution planner.',
  SOLUTION_BLUEPRINT_STEP_ID,
  {
    type: 'object',
    additionalProperties: false,
    required: ['module', 'actors', 'capabilities', 'ontology', 'rules', 'relationships', 'userActions', 'artifactPlan', 'coverage'],
    properties: {
      module: { type: 'object', additionalProperties: true },
      actors: { type: 'array', items: { type: 'object', additionalProperties: true } },
      capabilities: { type: 'array', items: { type: 'object', additionalProperties: true } },
      ontology: {
        type: 'object',
        additionalProperties: false,
        required: ['entities'],
        properties: {
          entities: { type: 'object', additionalProperties: true },
        },
      },
      rules: { type: 'array', items: { type: 'object', additionalProperties: true } },
      relationships: { type: 'array', items: { type: 'object', additionalProperties: true } },
      userActions: { type: 'array', items: { type: 'object', additionalProperties: true } },
      artifactPlan: {
        type: 'object',
        additionalProperties: false,
        required: ['pages', 'workflows', 'plugins', 'agents', 'horizontalModules', 'mdm', 'metricTables', 'metricDashboards', 'usecaseEntities'],
        properties: {
          pages: { type: 'array', items: { type: 'object', additionalProperties: true } },
          workflows: { type: 'array', items: { type: 'object', additionalProperties: true } },
          plugins: { type: 'array', items: { type: 'object', additionalProperties: true } },
          agents: { type: 'array', items: { type: 'object', additionalProperties: true } },
          horizontalModules: { type: 'array', items: { type: 'object', additionalProperties: true } },
          mdm: { type: 'array', items: { type: 'object', additionalProperties: true } },
          metricTables: { type: 'array', items: { type: 'object', additionalProperties: true } },
          metricDashboards: { type: 'array', items: { type: 'object', additionalProperties: true } },
          usecaseEntities: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
      coverage: { type: 'array', items: { type: 'object', additionalProperties: true } },
    },
  }
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
<!-- modelType: codepro -->

You are agentSolutionBlueprint for the collab.codes "newSolution" flow.
Create a detailed solution blueprint from the prompt, clarification, discovered scope, recommendations, and approved implementation decisions.
Use the same language as the user for labels, descriptions, questions, and trace.
Use English camelCase identifiers for ids and PascalCase for entity names.

## Tool mode
Call the "{{toolName}}" tool with the complete structured result.
Do not return prose.

## Result shape
In result, return:
- module with moduleName, purpose, businessDomain, languages, and visualStyle.
- actors.
- capabilities.
- ontology.entities.
- centralized rules.
- relationships.
- userActions.
- artifactPlan with pages, workflows, plugins, agents, horizontalModules, mdm, metricTables, metricDashboards, and usecaseEntities.
- coverage.

## Rules
- Do not use hard-coded entities, actions, pages, or workflows from a sample domain.
- Infer the core commitment of the requested domain, such as reservation, order, request, contract, subscription, appointment, approval, or lifecycle.
- Every core commitment must reference the selected subject, resource, service, product, or person that makes the commitment meaningful.
- Include explicit user actions for all required selections, confirmations, and lifecycle changes implied by the domain.
- Include MDM domains for stable master data such as customers, accounts, products, assets, suppliers, staff, locations, or reusable records.
- Include operational metric tables and an admin dashboard when initial metrics/dashboard was accepted.
- Include layer_3 usecase entities when the solution has BFF commands, writes, lifecycle changes, or metric updates.
- Backend layer rules must be respected: BFF is layer_2, use cases are layer_3, real tables are layer_1.
- Do not make payments, scheduling, adoption, or unrelated features part of the MVP when the prompt or decisions excluded them.
- Use rules with stable ruleId values. Do not leave rule text loose in pages.
- Use status "needs_input" only when a safe blueprint cannot be drafted without another client decision.

## Content Memory
actualDate: 2026-06-05
userName: Wagner
taskName: newModule
flowName: newSolution
`;
