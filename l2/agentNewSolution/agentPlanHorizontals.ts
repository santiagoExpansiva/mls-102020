/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanHorizontals.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PlannerOutput,
  Priority,
  assertArray,
  assertPriority,
  assertRecord,
  assertString,
  createPlannerPromptReadyIntent,
  createPlannerToolSchema,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  getPlannerOutput,
  getPlanningContextSnapshot,
  hasAcceptedArtifact,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { FinalSolutionPlanOutput, getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentPlanHorizontals',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Plan horizontal modules for the final solution',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const PLAN_HORIZONTALS_TOOL_NAME = 'submitHorizontalPlan';
export const PLAN_HORIZONTALS_STEP_ID = '10-plan-horizontals';
const PLAN_HORIZONTALS_ALIASES = [PLAN_HORIZONTALS_STEP_ID, 'plan-horizontals'];

export interface HorizontalModulePlan {
  horizontalModuleId: string;
  priority: Priority;
  reason: string;
  reusedOntologyRefs: string[];
  consumedByArtifacts: string[];
}

export interface PlanHorizontalsResult {
  horizontalModules: HorizontalModulePlan[];
}

export type PlanHorizontalsOutput = PlannerOutput<PlanHorizontalsResult>;

const planHorizontalsToolSchema = createPlannerToolSchema(
  PLAN_HORIZONTALS_TOOL_NAME,
  'Submit horizontal module planning for the newSolution final plan.',
  PLAN_HORIZONTALS_STEP_ID,
  {
    type: 'object',
    additionalProperties: false,
    required: ['horizontalModules'],
    properties: {
      horizontalModules: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['horizontalModuleId', 'priority', 'reason', 'reusedOntologyRefs', 'consumedByArtifacts'],
          properties: {
            horizontalModuleId: { type: 'string' },
            priority: { enum: ['now', 'soon', 'later', 'never'] },
            reason: { type: 'string' },
            reusedOntologyRefs: { type: 'array', items: { type: 'string' } },
            consumedByArtifacts: { type: 'array', items: { type: 'string' } },
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
  if (!agent || !step) throw new Error('[agentPlanHorizontals](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const finalPlan = getFinalizeSolutionPlanOutput(context);
  const snapshot = getPlanningContextSnapshot(context);
  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(PLAN_HORIZONTALS_TOOL_NAME),
      buildHumanPrompt(args, finalPlan, snapshot),
      planHorizontalsToolSchema,
      PLAN_HORIZONTALS_TOOL_NAME
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
    const output = extractPlanHorizontalsOutput(payload);
    validatePlanHorizontalsOutput(output, context);
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentPlanHorizontals returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentPlanHorizontals returned status needs_input; keeping horizontal plan draft.';
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  return [createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined)];
}

export function getPlanHorizontalsOutput(context: mls.msg.ExecutionContext): PlanHorizontalsOutput {
  return getPlannerOutput(context, 'agentPlanHorizontals', planHorizontalsConfig, output => validatePlanHorizontalsOutput(output, context));
}

function extractPlanHorizontalsOutput(payload: unknown): PlanHorizontalsOutput {
  return extractPlannerOutput(payload, planHorizontalsConfig);
}

const planHorizontalsConfig = {
  toolName: PLAN_HORIZONTALS_TOOL_NAME,
  stepId: PLAN_HORIZONTALS_STEP_ID,
  stepIdAliases: PLAN_HORIZONTALS_ALIASES,
  normalizeResult: normalizePlanHorizontalsResult,
};

function normalizePlanHorizontalsResult(value: unknown): PlanHorizontalsResult {
  const result = assertRecord(value, 'result');
  return {
    horizontalModules: assertArray(result.horizontalModules, 'result.horizontalModules').map((item, index) => normalizeHorizontalModule(item, `result.horizontalModules[${index}]`)),
  };
}

function normalizeHorizontalModule(value: unknown, path: string): HorizontalModulePlan {
  const item = assertRecord(value, path);
  return {
    horizontalModuleId: assertString(item.horizontalModuleId, `${path}.horizontalModuleId`),
    priority: assertPriority(item.priority, `${path}.priority`),
    reason: assertString(item.reason, `${path}.reason`),
    reusedOntologyRefs: assertArray(item.reusedOntologyRefs, `${path}.reusedOntologyRefs`).map((ref, index) => assertString(ref, `${path}.reusedOntologyRefs[${index}]`)),
    consumedByArtifacts: assertArray(item.consumedByArtifacts, `${path}.consumedByArtifacts`).map((ref, index) => assertString(ref, `${path}.consumedByArtifacts[${index}]`)),
  };
}

function validatePlanHorizontalsOutput(output: PlanHorizontalsOutput, context: mls.msg.ExecutionContext): void {
  const allowedIds = new Set(horizontalCatalog.horizontals.map(item => item.horizontalModuleId));
  for (const module of output.result.horizontalModules) {
    if (!allowedIds.has(module.horizontalModuleId)) throw new Error(`unknown horizontalModuleId: ${module.horizontalModuleId}`);
  }
  const snapshot = getPlanningContextSnapshot(context);
  if (output.status === 'ok' && hasAcceptedArtifact(snapshot.implementationDecisions, 'horizontalModule') && output.result.horizontalModules.length === 0) {
    throw new Error('horizontalModule was accepted, but horizontalModules output is empty');
  }
  if (output.status === 'needs_input' && output.questions.length === 0) throw new Error('needs_input horizontal plan must include questions');
}

function buildHumanPrompt(args: string, finalPlan: FinalSolutionPlanOutput, snapshot: ReturnType<typeof getPlanningContextSnapshot>): string {
  return `## Planned step args
${args}

## Final solution plan
${JSON.stringify(finalPlan, null, 2)}

## Accepted implementation decisions
${JSON.stringify(snapshot.implementationDecisions, null, 2)}

## Horizontal catalog
${JSON.stringify(horizontalCatalog, null, 2)}
`;
}

const horizontalCatalog = {
  schemaVersion: '2026-06-02',
  horizontals: [
    {
      horizontalModuleId: 'finance',
      title: 'Financeiro',
      priorityDefault: 'soon',
      knownOntologyRefs: ['FinanceAccount', 'Invoice', 'PaymentIntent', 'LedgerEntry'],
      capabilities: ['billing', 'payments', 'receivables', 'refunds'],
    },
    {
      horizontalModuleId: 'notifications',
      title: 'Notificacoes',
      priorityDefault: 'soon',
      knownOntologyRefs: ['NotificationTemplate', 'NotificationDelivery', 'NotificationPreference'],
      capabilities: ['email', 'whatsapp', 'reminders'],
    },
    {
      horizontalModuleId: 'documents',
      title: 'Documentos',
      priorityDefault: 'later',
      knownOntologyRefs: ['Document', 'SignatureRequest', 'Attachment'],
      capabilities: ['contracts', 'attachments', 'digitalSignature'],
    },
  ],
};

const systemPrompt = `
<!-- modelType: codepro -->

You are agentPlanHorizontals for the collab.codes "newSolution" flow.
Plan horizontal modules from the final solution plan and horizontal catalog.
Use the same language as the user for reasons, questions, and trace.

## Tool mode
Call the "{{toolName}}" tool with the complete structured result.
Do not return prose.

## Rules
- Use only horizontals from the provided horizontal catalog.
- Do not hard-code horizontal priorities from a sample domain.
- Finance should be planned only when the approved scope includes billing, payments, pricing, receivables, payables, accounting, invoices, refunds, or reconciliation.
- Notifications should be planned when approved workflows, agents, or rules require reminders, alerts, approvals, follow-ups, or external communication.
- Documents should be planned when the domain needs contracts, signatures, files, certificates, receipts, policies, or generated documents.
- The priority must follow implementation decisions. If not explicitly decided, use the most conservative priority that keeps the MVP coherent.
- Return an empty array when no horizontal module is justified.

## Content Memory
actualDate: 2026-06-05
userName: Wagner
taskName: newModule
flowName: newSolution
`;
