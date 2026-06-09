/// <mls fileReference="_102020_/l2/agentNewSolution/agentValidateSolutionCoverage.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { getAgentStepByAgentName, getAllSteps } from '/_102027_/l2/aiAgentHelper.js';
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
  summarizeRecords,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import type { FinalSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import {
  saveNewSolutionAgentTracePayload,
  saveNewSolutionPlanHealthReport,
  saveNewSolutionProcessRun,
  getExistingModuleFolders,
} from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import type { NewSolutionProcessNextStep, NewSolutionProcessRun } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { normalizeModuleFolderName } from '/_102020_/l2/agentNewSolution/agentNewSolutionPlan.js';
import { getPlanAgentsOutput } from '/_102020_/l2/agentNewSolution/agentPlanAgents.js';
import type { PlanAgentsOutput } from '/_102020_/l2/agentNewSolution/agentPlanAgents.js';
import { getPlanHorizontalsOutput } from '/_102020_/l2/agentNewSolution/agentPlanHorizontals.js';
import type { PlanHorizontalsOutput } from '/_102020_/l2/agentNewSolution/agentPlanHorizontals.js';
import { getPlanMDMOutput } from '/_102020_/l2/agentNewSolution/agentPlanMDM.js';
import type { PlanMDMOutput } from '/_102020_/l2/agentNewSolution/agentPlanMDM.js';
import { getPlanMetricTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanMetricTableDefinition.js';
import type { PlanMetricTableDefinitionOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricTableDefinition.js';
import { getPlanMetricsIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricsIndex.js';
import type { PlanMetricsIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricsIndex.js';
import { getPlanPageDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanPageDefinition.js';
import type { PlanPageDefinitionOutput } from '/_102020_/l2/agentNewSolution/agentPlanPageDefinition.js';
import { getPlanPageIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPageIndex.js';
import type { PlanPageIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPageIndex.js';
import { getPlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import type { PlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import { getPlanPluginsOutput } from '/_102020_/l2/agentNewSolution/agentPlanPlugins.js';
import type { PlanPluginsOutput } from '/_102020_/l2/agentNewSolution/agentPlanPlugins.js';
import { getPlanTableDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';
import type { PlanTableDefinitionOutput } from '/_102020_/l2/agentNewSolution/agentPlanTableDefinition.js';
import { getPlanUsecaseEntitiesOutput } from '/_102020_/l2/agentNewSolution/agentPlanUsecaseEntities.js';
import type { PlanUsecaseEntitiesOutput } from '/_102020_/l2/agentNewSolution/agentPlanUsecaseEntities.js';
import { getPlanWorkflowDefinitionOutputs } from '/_102020_/l2/agentNewSolution/agentPlanWorkflowDefinition.js';
import type { PlanWorkflowDefinitionOutput } from '/_102020_/l2/agentNewSolution/agentPlanWorkflowDefinition.js';
import { getPlanWorkflowIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanWorkflowIndex.js';
import type { PlanWorkflowIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanWorkflowIndex.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentValidateSolutionCoverage',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Validate full solution coverage and readiness to save .defs before materialization',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const VALIDATE_SOLUTION_COVERAGE_TOOL_NAME = 'submitSolutionCoverageValidation';
export const VALIDATE_SOLUTION_COVERAGE_STEP_ID = 'plan-validate-solution-coverage';
const VALIDATE_SOLUTION_COVERAGE_ALIASES = [VALIDATE_SOLUTION_COVERAGE_STEP_ID, 'validate-solution-coverage', 'plan-validate-solution-coverage'];

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  path: string;
  evidence: string[];
}

export interface ValidationSummary {
  passed: boolean;
  errorCount: number;
  warningCount: number;
}

export interface ChecklistCheckResult {
  passed: boolean;
  evidence: string;
}

export interface ValidateSolutionCoverageResult {
  summary: ValidationSummary;
  issues: ValidationIssue[];
  checklistResults?: Record<string, ChecklistCheckResult>;
  readyToSaveDefs: boolean;
}

export type ValidateSolutionCoverageOutput = PlannerOutput<ValidateSolutionCoverageResult>;

const issueSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['severity', 'code', 'message', 'path', 'evidence'],
  properties: {
    severity: { enum: ['error', 'warning'] },
    code: { type: 'string' },
    message: { type: 'string' },
    path: { type: 'string' },
    evidence: { type: 'array', items: { type: 'string' } },
  },
};

const checklistResultSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['passed', 'evidence'],
  properties: {
    passed: { type: 'boolean' },
    evidence: { type: 'string' },
  },
};

const validateSolutionCoverageToolSchema = createPlannerVariableToolSchema(
  VALIDATE_SOLUTION_COVERAGE_TOOL_NAME,
  'Submit final solution coverage validation result with summary, issues, optional checklistResults and readyToSaveDefs flag.',
  {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'issues', 'readyToSaveDefs'],
    properties: {
      summary: {
        type: 'object',
        additionalProperties: false,
        required: ['passed', 'errorCount', 'warningCount'],
        properties: {
          passed: { type: 'boolean' },
          errorCount: { type: 'number' },
          warningCount: { type: 'number' },
        },
      },
      issues: { type: 'array', items: issueSchema },
      checklistResults: {
        type: 'object',
        additionalProperties: true,
        properties: {
          // dynamic keys like "MDM_REQUIRED"
        },
      },
      readyToSaveDefs: { type: 'boolean' },
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
  if (!agent || !step) throw new Error('[agentValidateSolutionCoverage](beforePromptStep) invalid params');
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const finalPlan = getFinalizeSolutionPlanOutput(context);
  const mdm = getPlanMDMOutput(context);
  const horizontals = getPlanHorizontalsOutput(context);
  const plugins = getPlanPluginsOutput(context);
  const persistenceIndex = getPlanPersistenceIndexOutput(context);
  const tableDefinitions = await getPlanTableDefinitionOutputs(context);
  const metricsIndex = getPlanMetricsIndexOutput(context);
  const metricTableDefinitions = await getPlanMetricTableDefinitionOutputs(context);
  const usecasePlan = getPlanUsecaseEntitiesOutput(context);
  const workflowIndex = getPlanWorkflowIndexOutput(context);
  const workflowDefinitions = await getPlanWorkflowDefinitionOutputs(context);
  const agentsPlan = getPlanAgentsOutput(context);
  const pageIndex = getPlanPageIndexOutput(context);
  const pageDefinitions = await getPlanPageDefinitionOutputs(context);

  // The acceptance checklist is fixture-specific (run01/expected/...). For real runs it may be absent.
  // We include prior artifacts; the system prompt + skills instruct generic + fixture rules.
  const checklistNote = 'Acceptance checklist (fixture-specific) may be provided by harness as final inputFile. Apply hard criteria from it only when domain matches the checklist case; otherwise rely on skills/validation-rules.md, backend-layer-design.md, persistence-table-design.md and output-contracts.md.';

  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args || 'plan-validate-solution-coverage',
      systemPrompt.split('{{toolName}}').join(VALIDATE_SOLUTION_COVERAGE_TOOL_NAME),
      buildHumanPrompt(
        finalPlan,
        mdm,
        horizontals,
        plugins,
        persistenceIndex,
        tableDefinitions,
        metricsIndex,
        metricTableDefinitions,
        usecasePlan,
        workflowIndex,
        workflowDefinitions,
        agentsPlan,
        pageIndex,
        pageDefinitions,
        checklistNote
      ),
      validateSolutionCoverageToolSchema,
      VALIDATE_SOLUTION_COVERAGE_TOOL_NAME
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
  let output: ValidateSolutionCoverageOutput | undefined;

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    output = extractValidateSolutionCoverageOutput(payload);
    validateValidateSolutionCoverageOutput(output);
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentValidateSolutionCoverage returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentValidateSolutionCoverage returned status needs_input; keeping validation draft.';
    } else {
      // TODO-FINAL-023/024: coverage is no longer a late blocking gate for the end user.
      // Errors are caught early by per-index checkpoints and critic/repair; here the result
      // becomes a non-blocking technical report (planHealthReport) in trace/manifest.
      const readinessError = getCoverageReadinessError(output);
      if (readinessError) {
        traceMsg = `coverage not ready (non-blocking, recorded in planHealthReport): ${readinessError}`;
      }
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);
  if (status === 'completed' && output && output.status === 'ok') {
    const healthReport = {
      summary: output.result.summary,
      issues: output.result.issues,
      checklistResults: output.result.checklistResults || null,
      readyToSaveDefs: output.result.readyToSaveDefs,
    };
    await saveNewSolutionPlanHealthReport(context, agent.agentName, step, healthReport);
    // Persist the permanent newSolution run (l5/{module}/process.defs.ts). It feeds the
    // "Dados finais" resume screen and survives "clear traces".
    await saveProcessRun(context, healthReport);
  }

  const updateIntents: mls.msg.AgentIntent[] = [
    createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined),
  ];

  if (status === 'completed') {
    // TODO-FINAL-001: close root planning agent for plan-only mode.
    // Evidence from final.md diagnosis (run30): root step stays waiting_after_prompt,
    // org-materialization waiting_dependency, orphan frontend hook on completed pageIndex.
    // Action: upon validate completion, explicitly complete the root `agentNewSolution` step
    // so the task does not remain `in progress`. Materialization remains 'manual_later'.
    const rootStep = getAgentStepByAgentName(context.task, 'agentNewSolution');
    if (rootStep && rootStep.type === 'agent' && rootStep.status !== 'completed') {
      // Find the actual parent step that owns this root agent step (the one that added it as nextStep).
      // This is the correct parentStepId to use when updating the root's status.
      const allSteps = getAllSteps(context.task.iaCompressed?.nextSteps || []);
      let parentStepIdForRoot: number | undefined;
      for (const s of allSteps) {
        const nextSteps = (s as any).nextSteps || [];
        if (nextSteps.some((ns: any) => ns && ns.stepId === rootStep.stepId)) {
          parentStepIdForRoot = (s as any).stepId;
          break;
        }
      }
      // Fallback: the root agentNewSolution is a top-level step, so no other step lists it as a
      // child. intentUpdateStatus requires an agent parent — the root itself is an agent step, so
      // self-parent (rootStep.stepId), exactly like agentNewSolution's own update-status. Never 0
      // (parentStepId 0 does not resolve to a step -> "Parent step not found in intentUpdateStatus").
      if (parentStepIdForRoot === undefined || parentStepIdForRoot === 0) {
        parentStepIdForRoot = rootStep.stepId;
      }

      updateIntents.push({
        type: 'update-status',
        hookSequential,
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: parentStepIdForRoot ?? parentStep.stepId,
        stepId: rootStep.stepId,
        status: 'completed',
        traceMsg: 'plan-only: root agentNewSolution closed after plan-validate-solution-coverage. Materialization left pending for next task. Orphan hooks for planning steps (e.g. agentPlanPageIndex) should be cleaned by system.',
      });
    }
  }

  return updateIntents;
}

interface RootInitialPlan {
  userPrompt: string;
  userLanguage: string;
  openDetails: { title: string; description: string }[];
}

function readRootInitialPlan(context: mls.msg.ExecutionContext): RootInitialPlan {
  const empty: RootInitialPlan = { userPrompt: '', userLanguage: '', openDetails: [] };
  if (!context.task) return empty;
  const rootStep = getAgentStepByAgentName(context.task, 'agentNewSolution') as mls.msg.AIAgentStep | null;
  const payload = rootStep?.interaction?.payload?.[0] as mls.msg.AIFlexibleResultStep | undefined;
  const result = payload?.type === 'flexible' && payload.result && typeof payload.result === 'object'
    ? (payload.result as Record<string, unknown>)
    : undefined;
  if (!result) return empty;
  const openDetails = Array.isArray(result.openDetails)
    ? (result.openDetails as Record<string, unknown>[]).map(d => ({
        title: typeof d?.title === 'string' ? d.title : '',
        description: typeof d?.description === 'string' ? d.description : '',
      }))
    : [];
  return {
    userPrompt: typeof result.userPrompt === 'string' ? result.userPrompt : '',
    userLanguage: typeof result.userLanguage === 'string' ? result.userLanguage : '',
    openDetails,
  };
}

function buildNextSteps(context: mls.msg.ExecutionContext): NewSolutionProcessNextStep[] {
  const steps: NewSolutionProcessNextStep[] = [];
  const existingFolders = getExistingModuleFolders();

  try {
    const horizontals = getPlanHorizontalsOutput(context);
    for (const module of horizontals.result.horizontalModules) {
      const folder = normalizeModuleFolderName(module.horizontalModuleId, module.horizontalModuleId);
      // referenceOnly modules already exist — nothing to create, so they are not a "next step".
      if (existingFolders.has(folder)) continue;
      steps.push({
        id: `horizontalModule:${module.horizontalModuleId}`,
        kind: 'horizontalModule',
        title: module.horizontalModuleId,
        description: module.reason || '',
        moduleId: folder,
        status: 'pending',
      });
    }
  } catch (error) {
    console.warn('[agentValidateSolutionCoverage](buildNextSteps) horizontals unavailable', error);
  }

  try {
    const plugins = getPlanPluginsOutput(context);
    for (const plugin of plugins.result.plugins) {
      if (plugin.resolution !== 'create_draft') continue;
      steps.push({
        id: `plugin:${plugin.pluginId}`,
        kind: 'plugin',
        title: plugin.pluginId,
        description: plugin.reason || '',
        pluginId: plugin.pluginId,
        status: 'pending',
      });
    }
  } catch (error) {
    console.warn('[agentValidateSolutionCoverage](buildNextSteps) plugins unavailable', error);
  }

  return steps;
}

async function saveProcessRun(context: mls.msg.ExecutionContext, healthReport: unknown): Promise<void> {
  try {
    const initial = readRootInitialPlan(context);
    let decisions: unknown[] = [];
    let deferredItems: unknown[] = [];
    try {
      const finalize = getFinalizeSolutionPlanOutput(context);
      decisions = finalize.result.decisions || [];
      deferredItems = finalize.result.deferredItems || [];
    } catch (error) {
      console.warn('[agentValidateSolutionCoverage](saveProcessRun) finalize output unavailable', error);
    }

    const run: NewSolutionProcessRun = {
      runId: 'newSolution',
      kind: 'newSolution',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      initialPrompt: initial.userPrompt,
      userLanguage: initial.userLanguage,
      decisions,
      deferredItems,
      openDetails: initial.openDetails,
      healthReport,
      nextSteps: buildNextSteps(context),
    };

    await saveNewSolutionProcessRun(context, run);
  } catch (error) {
    console.warn('[agentValidateSolutionCoverage](saveProcessRun) failed', error);
  }
}

export function getValidateSolutionCoverageOutput(context: mls.msg.ExecutionContext): ValidateSolutionCoverageOutput {
  return getPlannerOutput(context, 'agentValidateSolutionCoverage', validateSolutionCoverageConfig, validateValidateSolutionCoverageOutput);
}

function extractValidateSolutionCoverageOutput(payload: unknown): ValidateSolutionCoverageOutput {
  return extractPlannerOutput(payload, validateSolutionCoverageConfig);
}

const validateSolutionCoverageConfig = {
  toolName: VALIDATE_SOLUTION_COVERAGE_TOOL_NAME,
  stepId: VALIDATE_SOLUTION_COVERAGE_STEP_ID,
  stepIdAliases: VALIDATE_SOLUTION_COVERAGE_ALIASES,
  normalizeResult: normalizeValidateSolutionCoverageResult,
};

function normalizeValidateSolutionCoverageResult(value: unknown): ValidateSolutionCoverageResult {
  const result = assertRecord(value, 'result');
  const summary = assertRecord(result.summary, 'result.summary');
  const issues = assertArray(result.issues || [], 'result.issues');
  const ready = typeof result.readyToSaveDefs === 'boolean' ? result.readyToSaveDefs : false;

  const normalized: ValidateSolutionCoverageResult = {
    summary: {
      passed: !!summary.passed,
      errorCount: typeof summary.errorCount === 'number' ? summary.errorCount : 0,
      warningCount: typeof summary.warningCount === 'number' ? summary.warningCount : 0,
    },
    issues: issues.map((iss, i) => normalizeIssue(iss, `result.issues[${i}]`)),
    readyToSaveDefs: ready,
  };

  if (result.checklistResults && typeof result.checklistResults === 'object') {
    normalized.checklistResults = result.checklistResults as Record<string, ChecklistCheckResult>;
  }
  return normalized;
}

function normalizeIssue(value: unknown, path: string): ValidationIssue {
  const iss = assertRecord(value, path);
  return {
    severity: (assertString(iss.severity, `${path}.severity`) as 'error' | 'warning'),
    code: assertString(iss.code, `${path}.code`),
    message: assertString(iss.message, `${path}.message`),
    path: assertString(iss.path, `${path}.path`),
    evidence: assertArray(iss.evidence || [], `${path}.evidence`).map((e, i) => assertString(e, `${path}.evidence[${i}]`)),
  };
}

function validateValidateSolutionCoverageOutput(output: ValidateSolutionCoverageOutput): void {
  const s = output.result.summary;
  if (typeof s.passed !== 'boolean') throw new Error('summary.passed must be boolean');
  if (typeof s.errorCount !== 'number' || s.errorCount < 0) throw new Error('summary.errorCount must be non-negative number');
  if (typeof s.warningCount !== 'number' || s.warningCount < 0) throw new Error('summary.warningCount must be non-negative number');
  if (output.status === 'needs_input' && output.questions.length === 0) {
    throw new Error('needs_input validation must include questions');
  }
  // readyToSaveDefs can only be true when no errors
  if (output.result.readyToSaveDefs && s.errorCount > 0) {
    throw new Error('readyToSaveDefs cannot be true when errorCount > 0');
  }
}

function getCoverageReadinessError(output: ValidateSolutionCoverageOutput): string | undefined {
  if (output.status !== 'ok') return undefined;
  const summary = output.result.summary;
  const errorIssues = output.result.issues.filter(issue => issue.severity === 'error');
  if (output.result.readyToSaveDefs && summary.passed && summary.errorCount === 0 && errorIssues.length === 0) return undefined;

  return [
    'solution coverage is not ready to save defs',
    `passed=${summary.passed}`,
    `errorCount=${summary.errorCount}`,
    `errorIssues=${errorIssues.length}`,
    `readyToSaveDefs=${output.result.readyToSaveDefs}`,
  ].join(', ');
}

function buildHumanPrompt(
  finalPlan: FinalSolutionPlanOutput,
  mdm: PlanMDMOutput,
  horizontals: PlanHorizontalsOutput,
  plugins: PlanPluginsOutput,
  persistenceIndex: PlanPersistenceIndexOutput,
  tableDefinitions: PlanTableDefinitionOutput[],
  metricsIndex: PlanMetricsIndexOutput,
  metricTableDefinitions: PlanMetricTableDefinitionOutput[],
  usecasePlan: PlanUsecaseEntitiesOutput,
  workflowIndex: PlanWorkflowIndexOutput,
  workflowDefinitions: PlanWorkflowDefinitionOutput[],
  agentsPlan: PlanAgentsOutput,
  pageIndex: PlanPageIndexOutput,
  pageDefinitions: PlanPageDefinitionOutput[],
  checklistNote: string,
): string {
  // TODO-FINAL-008: send a compact coverage snapshot (ids, counts, cross-ref matrix and
  // deterministic pre-computed issues) instead of every full artifact. Coverage is now a
  // non-blocking technical report (TODO-FINAL-023/024); the heavy per-artifact checks already
  // ran in the per-index checkpoints and critic/repair.
  const snapshot = buildCoverageSnapshot(
    finalPlan, mdm, horizontals, plugins, persistenceIndex, tableDefinitions, metricsIndex,
    metricTableDefinitions, usecasePlan, workflowIndex, workflowDefinitions, agentsPlan, pageIndex, pageDefinitions,
  );

  return `## Coverage snapshot (compact: ids, counts, cross-refs)
${JSON.stringify(snapshot.snapshot, null, 2)}

## Deterministic issues precomputed by code (confirm and extend; do not contradict)
${JSON.stringify(snapshot.deterministicIssues, null, 2)}

## Checklist / validation guidance
${checklistNote}

Use skills/validation-rules.md, skills/backend-layer-design.md, skills/persistence-table-design.md, skills/metrics-timescaledb.md and skills/output-contracts.md as the primary contract.
`;
}

function buildCoverageSnapshot(
  finalPlan: FinalSolutionPlanOutput,
  mdm: PlanMDMOutput,
  horizontals: PlanHorizontalsOutput,
  plugins: PlanPluginsOutput,
  persistenceIndex: PlanPersistenceIndexOutput,
  tableDefinitions: PlanTableDefinitionOutput[],
  metricsIndex: PlanMetricsIndexOutput,
  metricTableDefinitions: PlanMetricTableDefinitionOutput[],
  usecasePlan: PlanUsecaseEntitiesOutput,
  workflowIndex: PlanWorkflowIndexOutput,
  workflowDefinitions: PlanWorkflowDefinitionOutput[],
  agentsPlan: PlanAgentsOutput,
  pageIndex: PlanPageIndexOutput,
  pageDefinitions: PlanPageDefinitionOutput[],
): { snapshot: Record<string, unknown>; deterministicIssues: ValidationIssue[] } {
  const fp = finalPlan.result;

  const pages = pageDefinitions.map(p => p.result.pageDefinition);
  const workflows = workflowDefinitions.map(w => w.result.workflowDefinition);
  const usecases = (usecasePlan.result.usecases as Record<string, unknown>[]).filter(u => u && typeof u === 'object');
  const tables = tableDefinitions.map(t => t.result.tableDefinition);
  const metricTables = metricTableDefinitions.map(m => m.result.metricTableDefinition);

  const actorIds = new Set(fp.actors.map(a => (a as Record<string, unknown>).actorId as string).filter(Boolean));
  const tableIds = new Set<string>([...persistenceIndex.result.tables.map(t => t.tableId), ...tables.map(t => t.tableId as string)].filter(Boolean));
  const metricIds = new Set<string>([...metricsIndex.result.metricTables.map(t => t.metricTableId), ...metricTables.map(t => t.metricTableId as string)].filter(Boolean));
  const dashboardIds = new Set(metricsIndex.result.dashboardPages.map(d => (d as Record<string, unknown>).metricDashboardId as string).filter(Boolean));
  const usecaseIds = new Set(usecases.map(u => u.usecaseId as string).filter(Boolean));
  const workflowIds = new Set(workflowIndex.result.workflows.map(w => w.workflowId).filter(Boolean));
  const pageIds = new Set(pageIndex.result.pages.map(p => p.pageId).filter(Boolean));

  const issues: ValidationIssue[] = [];
  const addIssue = (severity: 'error' | 'warning', code: string, message: string, path: string) =>
    issues.push({ severity, code, message, path, evidence: [] });

  // Page index vs page definitions consistency.
  for (const page of pageIndex.result.pages) {
    if (!pageDefinitions.some(d => d.result.pageDefinition.pageId === page.pageId)) {
      addIssue('warning', 'page.def.missing', `page ${page.pageId} is in the index but has no definition`, `pageIndex.${page.pageId}`);
    }
  }
  for (const page of pages) {
    const pid = page.pageId as string;
    if (pid && !pageIds.has(pid)) addIssue('warning', 'page.index.missing', `page definition ${pid} is not in the page index`, `pageDefinition.${pid}`);
    if (typeof page.actor === 'string' && actorIds.size > 0 && !actorIds.has(page.actor)) {
      addIssue('error', 'page.actor.unknown', `page ${pid} actor ${page.actor} is not a final plan actorId`, `pageDefinition.${pid}.actor`);
    }
  }

  // Workflow definition refs.
  for (const wf of workflows) {
    const wid = wf.workflowId as string;
    for (const ref of asStrings(wf.persistenceRefs)) {
      if (tableIds.size > 0 && !tableIds.has(ref)) addIssue('error', 'workflow.persistenceRef.unknown', `workflow ${wid} references unknown table ${ref}`, `workflow.${wid}`);
    }
    for (const ref of asStrings(wf.usecaseRefs)) {
      if (usecaseIds.size > 0 && !usecaseIds.has(ref)) addIssue('warning', 'workflow.usecaseRef.unknown', `workflow ${wid} references unknown usecase ${ref}`, `workflow.${wid}`);
    }
    for (const ref of asStrings(wf.metricRefs)) {
      if (metricIds.size > 0 && !metricIds.has(ref)) addIssue('warning', 'workflow.metricRef.unknown', `workflow ${wid} references unknown metric ${ref}`, `workflow.${wid}`);
    }
  }

  // Dashboard actors.
  metricsIndex.result.dashboardPages.forEach((d, i) => {
    const rec = d as Record<string, unknown>;
    if (typeof rec.actor === 'string' && actorIds.size > 0 && !actorIds.has(rec.actor)) {
      addIssue('error', 'dashboard.actor.unknown', `dashboard ${rec.metricDashboardId} actor ${rec.actor} is not a final plan actorId`, `dashboard[${i}]`);
    }
  });

  const snapshot = {
    module: fp.module,
    counts: {
      actors: actorIds.size, capabilities: fp.capabilities.length, rules: fp.rules.length,
      tables: tableIds.size, metricTables: metricIds.size, dashboards: dashboardIds.size,
      usecases: usecaseIds.size, workflows: workflowIds.size, pages: pageIds.size,
      pageDefinitions: pages.length, workflowDefinitions: workflows.length,
      plugins: plugins.result.plugins.length, mdmDomains: mdm.result.mdmDomains.length,
      horizontalModules: horizontals.result.horizontalModules.length,
    },
    ids: {
      actors: [...actorIds], tables: [...tableIds], metricTables: [...metricIds],
      dashboards: [...dashboardIds], usecases: [...usecaseIds], workflows: [...workflowIds], pages: [...pageIds],
    },
    actors: summarizeRecords(fp.actors, ['actorId', 'title']),
    rules: summarizeRecords(fp.rules, ['ruleId', 'title']),
    controllerRules: usecasePlan.result.controllerRules,
    pages: pages.map(p => ({
      pageId: p.pageId, actor: p.actor,
      capabilities: p.capabilities, flowRefs: p.flowRefs,
      pageInputs: summarizeRecords(asArray(p.pageInputs), ['name', 'required']),
      bffCommands: summarizeRecords(asArray((p as unknown as Record<string, unknown>).bffCommands), ['commandName', 'usecaseRefs', 'writesTables', 'readsTables']),
    })),
    workflows: workflows.map(w => ({
      workflowId: w.workflowId, executionMode: w.executionMode, createsTask: w.createsTask,
      workflowScope: (w as Record<string, unknown>).workflowScope, moduleRefs: (w as Record<string, unknown>).moduleRefs,
      persistenceRefs: w.persistenceRefs, usecaseRefs: w.usecaseRefs, metricRefs: w.metricRefs,
    })),
    usecases: summarizeRecords(usecases, ['usecaseId', 'actor', 'readsTables', 'writesTables']),
    tables: summarizeRecords(tables, ['tableId', 'ownership', 'tableKind']),
    metricTables: summarizeRecords(metricTables, ['metricTableId', 'storageEngine']),
    dashboards: summarizeRecords(metricsIndex.result.dashboardPages, ['metricDashboardId', 'actor']),
    plugins: summarizeRecords(plugins.result.plugins, ['pluginId', 'resolution']),
    mdmDomains: summarizeRecords(mdm.result.mdmDomains, ['domainId']),
    agents: summarizeRecords((agentsPlan.result as unknown as Record<string, unknown>).agents as unknown[] | undefined, ['agentId', 'id']),
  };

  return { snapshot, deterministicIssues: issues };
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

const systemPrompt = `
<!-- modelType: codeinstruct -->

You are agentValidateSolutionCoverage for the collab.codes "newSolution" flow.
Perform a final cross-plan validation of the entire solution before any .defs materialization.
Use the same language as the user for messages, questions, and trace.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## Rules (generic, from validation-rules.md + layer contracts)
- MDM must be present and complete.
- Only moduleOwned entities from the final plan may produce new module tables; MDM/horizontal/plugin entities must be excluded from persistence index tables.
- Each transactional table and each metric table must be emitted as a separate definition with defsPlan.saveAsDefs=true and stable fileName/exportName.
- details/JSONB columns are allowed only for embedded aggregates that are always read together; frequent filter/lifecycle/status/ref fields must be physical columns.
- Metric tables must use postgresTimescaleDB, declare timeColumn/hypertable, dimensions, measures, updatePolicy (updatedByLayer: layer_3_usecases), and must not be updated by pages or layer_2.
- layer_2_controllers (BFF) must always call layer_3_usecases and must never access layer_1_external tables directly (directTableAccessForbidden must be true).
- Every BFF command must declare usecaseRefs. If a BFF declares readsTables/writesTables for module-owned tables, the corresponding usecaseRefs must be present.
- Workflows that read/write module-owned data must declare persistenceRefs (table ids).
- Agents that mutate module-owned data should reference usecases when usecase definitions exist.
- Page index and every page definition must be consistent (same pageIds, actors from final plan actors).
- Every page must declare pageInputs (array, possibly empty) and navigationRefs (array, possibly empty).
- Detail/status/edit/checkout/confirmation pages must declare required external identifiers (the id of the main subject, commitment or resource record) in pageInputs with appropriate sources (routeParam, previousStepResult, ...). The names must be taken from the ontology and page index, never from any sample domain.
- navigationRefs must be references only; they must not embed inputMapping.
- Metric dashboard pages must exist for the actor declared in approvedArtifacts.metricDashboards (often an admin or operations role) when initial metrics were requested, and must be restricted to that actor.
- BFF commands on metric dashboard pages read metric data through usecaseRefs.
- flowRefs on pages must correctly point at existing workflows and use the right category bucket (entityLifecycles vs taskWorkflows etc.).
- Rules must be referenced by ruleId (from ruleCatalog); loose rule text is a warning or error depending on impact.
- Every workflow definition must match its index entry for workflowId/executionMode/createsTask.
- Workflows with createsTask=true must have populated taskConfig.
- Ontology enums must be respected: no writes of undeclared enum values.
- readyToSaveDefs must be true ONLY when there are zero errors (errorCount === 0). Warnings do not block.

## Fixture checklist (when provided)
When an acceptance-checklist.json is supplied for the current fixture (harness only), treat its requiredChecks as hard criteria for that specific test case. Produce checklistResults entries with code, passed, and concise evidence. For real user runs (no checklist), apply only the generic rules from the skills files. Issues must reference the originating artifact path.

## Output shape
Return:
- summary: { passed: boolean, errorCount, warningCount }
- issues: array of { severity, code, message, path, evidence[] }
- checklistResults?: object map of code -> { passed, evidence }
- readyToSaveDefs: boolean (true only if no errors)

If critical information is missing, use status "needs_input" with questions. On unrecoverable structural problems use "failed".
`;
