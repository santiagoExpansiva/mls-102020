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
  createPlannerVariableToolSchema,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  getActorIdSet,
  getPlannerOutput,
  getPlanningContextSnapshot,
  hasAcceptedArtifact,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { saveNewSolutionAgentTracePayload, saveNewSolutionPlanArtifacts } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import type { FinalSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';

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

const planHorizontalsToolSchema = createPlannerVariableToolSchema(
  PLAN_HORIZONTALS_TOOL_NAME,
  'Submit horizontal module planning for the newSolution final plan.',
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
  let output: PlanHorizontalsOutput | undefined;

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    output = extractPlanHorizontalsOutput(payload);
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

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);
  // TODO-FINAL-015: persist horizontal modules (draft l5/{id}/module.defs.ts or manifest reference).
  if (status === 'completed' && output) {
    applyHorizontalsPostProcessing(output, context); // T-012
    await saveNewSolutionPlanArtifacts(context, agent.agentName, step, output);
  }
  return [createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined)];
}

export function getPlanHorizontalsOutput(context: mls.msg.ExecutionContext): PlanHorizontalsOutput {
  const output = getPlannerOutput(context, 'agentPlanHorizontals', planHorizontalsConfig, item => validatePlanHorizontalsOutput(item, context));
  applyHorizontalsPostProcessing(output, context); // T-012: readers see the same gap-filled plan that was saved
  return output;
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
  // Non-fatal (advisory) per the non-blocking direction (TODO-FINAL-023/024): an accepted
  // horizontalModule with an empty plan must NOT fail the whole task. This can legitimately
  // happen when the accepted decision maps to a horizontal that is not in the catalog
  // (finance/notifications/documents) — in that case the model cannot plan it and would fail
  // every run. Horizontals are deferred to their own creation task anyway (TODO-FINAL-015).
  if (output.status === 'ok' && hasAcceptedArtifact(snapshot.implementationDecisions, 'horizontalModule') && output.result.horizontalModules.length === 0) {
    console.warn('[agentPlanHorizontals] a horizontalModule was accepted, but the plan returned no horizontal modules (advisory, not blocking)');
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
    // T-012: platform horizontals — accepted decisions like horizontalAuthRoles/horizontalI18n
    // must produce an artifact (draft or reference), never disappear silently (E-009).
    {
      horizontalModuleId: 'authRoles',
      title: 'Autenticacao e papeis',
      priorityDefault: 'now',
      knownOntologyRefs: ['UserAccount', 'Role', 'Permission'],
      capabilities: ['authentication', 'authorization', 'roles'],
    },
    {
      horizontalModuleId: 'i18n',
      title: 'Internacionalizacao',
      priorityDefault: 'now',
      knownOntologyRefs: [],
      capabilities: ['translations', 'locales'],
    },
  ],
};

// T-012: accepted decisions may use aliased ids ('horizontalAuthRoles', 'horizontalI18n', ...).
// Normalize them to catalog ids; returns '' when the id does not map to any catalog horizontal.
export function normalizeHorizontalModuleId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const raw = value.trim();
  const allowed = new Set(horizontalCatalog.horizontals.map(item => item.horizontalModuleId));
  if (allowed.has(raw)) return raw;
  const stripped = raw.replace(/^horizontal/i, '');
  const candidate = stripped ? stripped.charAt(0).toLowerCase() + stripped.slice(1) : '';
  return candidate && allowed.has(candidate) ? candidate : '';
}

/**
 * T-012: deterministic post-processing (idempotent, applied after generation and on read):
 * 1. gap-fill — every approved horizontal artifact must produce a plan item (and therefore an
 *    artifact candidate), even when the LLM omitted it (E-009: authRoles/i18n);
 * 2. platform config — authRoles carries the final plan actor ids as roles; i18n carries the
 *    module languages, so the saved artifact declares concrete roles/locales.
 */
function applyHorizontalsPostProcessing(output: PlanHorizontalsOutput, context: mls.msg.ExecutionContext): void {
  if (output.status !== 'ok') return;
  try {
    const finalPlan = getFinalizeSolutionPlanOutput(context);

    const planned = new Set(output.result.horizontalModules.map(module => module.horizontalModuleId));
    finalPlan.result.approvedArtifacts.horizontalModules.forEach(approved => {
      if (!approved || typeof approved !== 'object') return;
      const record = approved as Record<string, unknown>;
      if (record.priority === 'never') return;
      const id = normalizeHorizontalModuleId(record.horizontalModuleId ?? record.artifactId ?? record.signal);
      if (!id || planned.has(id)) return;
      const priority: Priority = record.priority === 'soon' || record.priority === 'later' ? record.priority : 'now';
      output.result.horizontalModules.push({
        horizontalModuleId: id,
        priority,
        reason: `approved horizontal '${id}' added deterministically (missing from the LLM plan) — T-012`,
        reusedOntologyRefs: [],
        consumedByArtifacts: [],
      });
      planned.add(id);
    });

    for (const module of output.result.horizontalModules) {
      const extra = module as HorizontalModulePlan & { roles?: string[]; languages?: string[] };
      if (module.horizontalModuleId === 'authRoles' && !Array.isArray(extra.roles)) {
        extra.roles = [...getActorIdSet(finalPlan.result.actors)];
      }
      if (module.horizontalModuleId === 'i18n' && !Array.isArray(extra.languages)) {
        const languages = (finalPlan.result.module as Record<string, unknown>).languages;
        extra.languages = Array.isArray(languages) ? languages.filter((item): item is string => typeof item === 'string') : [];
      }
    }
  } catch (error) {
    console.warn('[agentPlanHorizontals] post-processing skipped (T-012):', error);
  }
}

const systemPrompt = `
<!-- modelType: codeinstruct -->
<!-- x-tool-strict: true -->

You are agentPlanHorizontals for the collab.codes "newSolution" flow.
Plan horizontal modules from the final solution plan and horizontal catalog.
Use the same language as the user for reasons, questions, and trace.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## Rules
- Use only horizontals from the provided horizontal catalog.
- Do not hard-code horizontal priorities from a sample domain.
- Finance should be planned only when the approved scope includes billing, payments, pricing, receivables, payables, accounting, invoices, refunds, or reconciliation.
- Notifications should be planned when approved workflows, agents, or rules require reminders, alerts, approvals, follow-ups, or external communication.
- Documents should be planned when the domain needs contracts, signatures, files, certificates, receipts, policies, or generated documents.
- AuthRoles must be planned when an accepted decision covers authentication/roles or when the solution declares actors that require role-based authorization (platform horizontal; usually a reference to existing infrastructure).
- I18n must be planned when an accepted decision covers internationalization or when the module declares more than one language.
- The priority must follow implementation decisions. If not explicitly decided, use the most conservative priority that keeps the MVP coherent.
- Return an empty array when no horizontal module is justified.
`;
