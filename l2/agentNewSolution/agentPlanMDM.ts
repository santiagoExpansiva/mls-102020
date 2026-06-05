/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanMDM.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PlannerOutput,
  assertArray,
  assertRecord,
  assertString,
  createPlannerPromptReadyIntent,
  createPlannerToolSchema,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  getPlannerOutput,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { FinalSolutionPlanOutput, getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentPlanMDM',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Plan mandatory MDM domains for the final solution',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const PLAN_MDM_TOOL_NAME = 'submitMdmPlan';
export const PLAN_MDM_STEP_ID = '09-plan-mdm';
const PLAN_MDM_ALIASES = [PLAN_MDM_STEP_ID, 'plan-mdm'];

export interface MdmDomainPlan {
  domainId: string;
  title: string;
  masterEntities: unknown[];
  sourceOfTruth: string;
  consumers: unknown[];
  governanceRules: unknown[];
}

export interface PlanMDMResult {
  mdmDomains: MdmDomainPlan[];
}

export type PlanMDMOutput = PlannerOutput<PlanMDMResult>;

const planMdmToolSchema = createPlannerToolSchema(
  PLAN_MDM_TOOL_NAME,
  'Submit mandatory MDM planning for the newSolution final plan.',
  PLAN_MDM_STEP_ID,
  {
    type: 'object',
    additionalProperties: false,
    required: ['mdmDomains'],
    properties: {
      mdmDomains: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['domainId', 'title', 'masterEntities', 'sourceOfTruth', 'consumers', 'governanceRules'],
          properties: {
            domainId: { type: 'string' },
            title: { type: 'string' },
            masterEntities: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }] } },
            sourceOfTruth: { type: 'string' },
            consumers: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }] } },
            governanceRules: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }] } },
          },
        },
      },
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
  if (!agent || !step) throw new Error('[agentPlanMDM](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const finalPlan = getFinalizeSolutionPlanOutput(context);
  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(PLAN_MDM_TOOL_NAME),
      buildHumanPrompt(args, finalPlan),
      planMdmToolSchema,
      PLAN_MDM_TOOL_NAME
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
    const output = extractPlanMDMOutput(payload);
    validatePlanMDMOutput(output);
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentPlanMDM returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentPlanMDM returned status needs_input; keeping MDM draft.';
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  return [createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined)];
}

export function getPlanMDMOutput(context: mls.msg.ExecutionContext): PlanMDMOutput {
  return getPlannerOutput(context, 'agentPlanMDM', planMDMConfig, validatePlanMDMOutput);
}

function extractPlanMDMOutput(payload: unknown): PlanMDMOutput {
  return extractPlannerOutput(payload, planMDMConfig);
}

const planMDMConfig = {
  toolName: PLAN_MDM_TOOL_NAME,
  stepId: PLAN_MDM_STEP_ID,
  stepIdAliases: PLAN_MDM_ALIASES,
  normalizeResult: normalizePlanMDMResult,
};

function normalizePlanMDMResult(value: unknown): PlanMDMResult {
  const result = assertRecord(value, 'result');
  return {
    mdmDomains: assertArray(result.mdmDomains, 'result.mdmDomains').map((item, index) => normalizeMdmDomain(item, `result.mdmDomains[${index}]`)),
  };
}

function normalizeMdmDomain(value: unknown, path: string): MdmDomainPlan {
  const domain = assertRecord(value, path);
  return {
    domainId: assertString(domain.domainId, `${path}.domainId`),
    title: assertString(domain.title, `${path}.title`),
    masterEntities: assertArray(domain.masterEntities, `${path}.masterEntities`),
    sourceOfTruth: assertString(domain.sourceOfTruth, `${path}.sourceOfTruth`),
    consumers: assertArray(domain.consumers, `${path}.consumers`),
    governanceRules: assertArray(domain.governanceRules, `${path}.governanceRules`),
  };
}

function validatePlanMDMOutput(output: PlanMDMOutput): void {
  if (output.status === 'ok' && output.result.mdmDomains.length === 0) throw new Error('MDM is mandatory and mdmDomains must not be empty');
  if (output.status === 'needs_input' && output.questions.length === 0) throw new Error('needs_input MDM plan must include questions');
}

function buildHumanPrompt(args: string, finalPlan: FinalSolutionPlanOutput): string {
  return `## Planned step args
${args}

## Final solution plan
${JSON.stringify(finalPlan, null, 2)}

## MDM policy
${JSON.stringify(mdmPolicy, null, 2)}
`;
}

const mdmPolicy = {
  schemaVersion: '2026-06-02',
  required: true,
  rules: [
    'Every solution must define at least one master data domain.',
    'Every master data entity must declare sourceOfTruth.',
    'Every consumer artifact must reference the master data entity instead of duplicating it.',
    'Customer-like and asset-like entities are strong MDM candidates.',
  ],
  defaultDomains: ['customer', 'asset', 'productOrService', 'organization'],
};

const systemPrompt = `
<!-- modelType: codepro -->

You are agentPlanMDM for the collab.codes "newSolution" flow.
Plan mandatory MDM for the final solution plan.
Use the same language as the user for titles, reasons, questions, and trace.
Use English camelCase identifiers for domainId.

## Tool mode
Call the "{{toolName}}" tool with the complete structured result.
Do not return prose.

## Rules
- Include customer, account, person, supplier, tenant, subscriber, buyer, patient, or similar party MDM when the solution has external parties.
- Include product, asset, service, location, staff, category, store, or organization MDM when those records are stable master data in the requested domain.
- MDM is mandatory, but its domains must be inferred from the ontology and final plan.
- Do not hard-code sample fixture entities.
- Declare sourceOfTruth and consumers.
- Reference pages, workflows, plugins, agents, usecases, and metric tables that consume the master data when known.

## Content Memory
actualDate: 2026-06-05
userName: Wagner
taskName: newModule
flowName: newSolution
`;
