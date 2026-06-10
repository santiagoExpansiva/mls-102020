/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanMDM.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PlannerOutput,
  assertArray,
  assertRecord,
  assertString,
  createPlannerPromptReadyIntent,
  createPlannerVariableToolSchema,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  getPlannerOutput,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { saveNewSolutionAgentTracePayload, saveNewSolutionPlanArtifacts } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import type { FinalSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';

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

// T-003: shared MDM infrastructure project (mls-102034, l1/mdm). When available, MDM domains are
// planned as references to it instead of new l5/{domainId}/module.defs.ts drafts (E-002, E-018).
export const MDM_INFRASTRUCTURE_PROJECT = 102034;

// Logical shared tables provided by 102034 (see mls-102034/l1/mdm/tableNames.ts; env suffix omitted).
const MDM_SHARED_TABLES = [
  'mdm_documents',
  'mdm_documents_entities_index',
  'mdm_documents_prospects_index',
  'mdm_kv',
  'mdm_relationship',
  'mdm_prospect_relationship',
  'mdm_audit_log',
  'mdm_tag',
  'mdm_comment',
  'mdm_attachment',
  'mdm_number_sequence',
  'mdm_outbox',
  'mdm_replication_failures',
  'mdm_monitoring_write',
  'mdm_error_log',
  'mdm_status_history',
];

export interface MdmInventory {
  available: boolean;
  infrastructureProject: number;
  moduleRef: string; // '102034' when available, '' otherwise
  sharedTables: string[];
  notes: string[];
}

// T-003: analogous to the pluginInventory of agentPlanPlugins — tells the agent (and the
// artifact builder) whether the platform's shared MDM infrastructure is available.
export function buildMdmInventory(): MdmInventory {
  const actualProject = mls.actualProject || 0;
  const dependencies = mls.l5.getProjectDependencies(actualProject, false) || [];
  const inDependencies = dependencies.includes(MDM_INFRASTRUCTURE_PROJECT);
  const hasFiles = Object.values(mls.stor.files).some(file =>
    file.project === MDM_INFRASTRUCTURE_PROJECT
    && file.status !== 'deleted'
    && (file.folder === 'mdm' || file.folder.startsWith('mdm/')));
  const available = inDependencies || hasFiles;
  return {
    available,
    infrastructureProject: MDM_INFRASTRUCTURE_PROJECT,
    moduleRef: available ? String(MDM_INFRASTRUCTURE_PROJECT) : '',
    sharedTables: available ? [...MDM_SHARED_TABLES] : [],
    notes: available
      ? [`Shared MDM infrastructure exists (project ${MDM_INFRASTRUCTURE_PROJECT}, l1/mdm): master data lives in the generic shared tables; MDM domains are recorded as references to it, never as new persistence modules.`]
      : ['No shared MDM infrastructure found; MDM domains may be planned as new module drafts.'],
  };
}

const planMdmToolSchema = createPlannerVariableToolSchema(
  PLAN_MDM_TOOL_NAME,
  'Submit mandatory MDM planning for the newSolution final plan.',
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
            masterEntities: { type: 'array', items: { type: 'string' } },
            sourceOfTruth: { type: 'string' },
            consumers: { type: 'array', items: { type: 'string' } },
            governanceRules: { type: 'array', items: { type: 'string' } },
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
  const mdmInventory = buildMdmInventory(); // T-003
  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(PLAN_MDM_TOOL_NAME),
      buildHumanPrompt(args, finalPlan, mdmInventory),
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
  let output: PlanMDMOutput | undefined;

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    output = extractPlanMDMOutput(payload);
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

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);
  // TODO-FINAL-015: persist MDM domains (draft l5/{domainId}/module.defs.ts or manifest reference)
  // + per-masterEntity l1 reference (generateTable:false) enriched with the ontology entity shape,
  // so usecase materialization and l1 mock generation can use the MDM entities.
  if (status === 'completed' && output) {
    const ontologyEntities = getFinalizeSolutionPlanOutput(context).result.ontology.entities;
    // T-002: hard gate — an mdmEntity candidate with fields: [] would materialize an empty
    // {Entity}.defs.ts (E-001). Fail the step instead of saving silently.
    const missing = output.status === 'ok' ? findMasterEntitiesWithoutFields(output.result.mdmDomains, ontologyEntities) : [];
    if (missing.length > 0) {
      status = 'failed';
      traceMsg = `agentPlanMDM: master entities without ontology fields (cannot materialize .defs.ts): ${missing.join(', ')}`;
      console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
    } else {
      // T-003: when the shared MDM infrastructure exists, domain candidates are saved as
      // references to it (moduleRef) instead of new l5/{domainId}/module.defs.ts drafts.
      const mdmInventory = buildMdmInventory();
      await saveNewSolutionPlanArtifacts(context, agent.agentName, step, output, {
        ontologyEntities,
        mdmInfrastructureModuleRef: mdmInventory.available ? mdmInventory.moduleRef : undefined,
      });
    }
  }
  return [createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined)];
}

// T-002: every masterEntity must resolve to an ontology entity with at least one field,
// since the mdmEntity candidate copies its shape from ontologyEntity.fields.
function findMasterEntitiesWithoutFields(domains: MdmDomainPlan[], ontologyEntities: Record<string, unknown>): string[] {
  const missing: string[] = [];
  for (const domain of domains) {
    for (const entityValue of domain.masterEntities) {
      const entityName = typeof entityValue === 'string' ? entityValue : '';
      if (!entityName) continue;
      const entity = ontologyEntities[entityName];
      const fields = entity && typeof entity === 'object' ? (entity as Record<string, unknown>).fields : undefined;
      if (!Array.isArray(fields) || fields.length === 0) missing.push(`${domain.domainId}.${entityName}`);
    }
  }
  return missing;
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
    masterEntities: assertArray(domain.masterEntities, `${path}.masterEntities`).map((item, index) => assertString(item, `${path}.masterEntities[${index}]`)),
    sourceOfTruth: assertString(domain.sourceOfTruth, `${path}.sourceOfTruth`),
    consumers: assertArray(domain.consumers, `${path}.consumers`).map((item, index) => assertString(item, `${path}.consumers[${index}]`)),
    governanceRules: assertArray(domain.governanceRules, `${path}.governanceRules`).map((item, index) => assertString(item, `${path}.governanceRules[${index}]`)),
  };
}

function validatePlanMDMOutput(output: PlanMDMOutput): void {
  if (output.status === 'ok' && output.result.mdmDomains.length === 0) throw new Error('MDM is mandatory and mdmDomains must not be empty');
  if (output.status === 'needs_input' && output.questions.length === 0) throw new Error('needs_input MDM plan must include questions');
}

function buildHumanPrompt(args: string, finalPlan: FinalSolutionPlanOutput, mdmInventory: MdmInventory): string {
  return `## Planned step args
${args}

## Final solution plan
${JSON.stringify(finalPlan, null, 2)}

## MDM policy
${JSON.stringify(mdmPolicy, null, 2)}

## Platform MDM inventory
${JSON.stringify(mdmInventory, null, 2)}
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
<!-- x-tool-strict: true -->

You are agentPlanMDM for the collab.codes "newSolution" flow.
Plan mandatory MDM for the final solution plan.
Use the same language as the user for titles, reasons, questions, and trace.
Use English camelCase identifiers for domainId.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## Rules
- Include customer, account, person, supplier, tenant, subscriber, buyer, patient, or similar party MDM when the solution has external parties.
- Include product, asset, service, location, staff, category, store, or organization MDM when those records are stable master data in the requested domain.
- MDM is mandatory, but its domains must be inferred from the ontology and final plan.
- Do not hard-code sample fixture entities.
- Declare sourceOfTruth and consumers.
- Reference pages, workflows, plugins, agents, usecases, and metric tables that consume the master data when known.
- When the platform MDM inventory marks shared MDM infrastructure as available, plan domains assuming master data is stored in that shared infrastructure; set sourceOfTruth to the shared MDM platform (project in the inventory) and never propose a new MDM persistence module.
`;
