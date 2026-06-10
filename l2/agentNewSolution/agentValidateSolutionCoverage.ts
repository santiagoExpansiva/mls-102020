/// <mls fileReference="_102020_/l2/agentNewSolution/agentValidateSolutionCoverage.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { getAgentStepByAgentName } from '/_102027_/l2/aiAgentHelper.js';
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
  readSavedPlanArtifactDataList,
  saveNewSolutionAgentTracePayload,
  saveNewSolutionPlanArtifacts,
  saveNewSolutionPlanHealthReport,
  saveNewSolutionProcessRun,
  getExistingModuleFolders,
} from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import type { NewSolutionProcessNextStep, NewSolutionProcessRun } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { normalizeModuleFolderName } from '/_102020_/l2/agentNewSolution/agentNewSolutionPlan.js';
import { getPlanAgentsOutput } from '/_102020_/l2/agentNewSolution/agentPlanAgents.js';
import type { PlanAgentsOutput } from '/_102020_/l2/agentNewSolution/agentPlanAgents.js';
import { getPlanHorizontalsOutput, normalizeHorizontalModuleId } from '/_102020_/l2/agentNewSolution/agentPlanHorizontals.js';
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

  // T-010: workflows are defined BEFORE pages, so relatedPages cannot be filled at generation
  // time (E-013). Deterministic backfill (no LLM) now that all page definitions exist; the
  // updated workflows are re-saved to l4/workflows/*.defs.ts and feed the coverage snapshot below.
  await backfillWorkflowRelatedPages(context, step, workflowDefinitions, pageDefinitions);

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
      // /024: coverage is no longer a late blocking gate for the end user.
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

  // NOTE: the root agentNewSolution is intentionally NOT closed here anymore. The flow now continues
  // to the final "Revendo plano"/"Resumo final do planejamento" step (org-materialization is
  // sequential), and the root is closed by the resume screen's "Encerrar" action
  // (widgetNewSolutionResume). Closing the root here would mark the task done before that screen.

  return updateIntents;
}

/**
 * T-016: deterministic re-validation at the end of the flow (no LLM call). The original coverage
 * step may have run before all fan-outs landed their definitions (E-017: health report frozen at
 * an early step while workflow/page definitions arrived later), leaving a stale report on the
 * final screen. Called by agentNewSolutionFinal (org-materialization) to recompute the
 * deterministic issues over the FINAL artifacts and re-save plan-health-report.json with an
 * up-to-date readyToSaveDefs flag.
 */
export async function refreshSolutionHealthReport(
  context: mls.msg.ExecutionContext,
  step: mls.msg.AIAgentStep,
): Promise<void> {
  try {
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

    const snapshot = buildCoverageSnapshot(
      finalPlan, mdm, horizontals, plugins, persistenceIndex, tableDefinitions, metricsIndex,
      metricTableDefinitions, usecasePlan, workflowIndex, workflowDefinitions, agentsPlan, pageIndex, pageDefinitions,
    );
    const issues = snapshot.deterministicIssues;
    const errorCount = issues.filter(issue => issue.severity === 'error').length;
    const warningCount = issues.filter(issue => issue.severity === 'warning').length;

    const healthReport = {
      summary: { passed: errorCount === 0, errorCount, warningCount },
      issues,
      checklistResults: null,
      readyToSaveDefs: errorCount === 0,
      deterministicOnly: true,
      refreshedAt: new Date().toISOString(),
      refreshedBy: 'agentNewSolutionFinal (T-016 deterministic re-validation)',
    };
    await saveNewSolutionPlanHealthReport(context, 'agentValidateSolutionCoverage', step, healthReport);
    // E2-005: informative only (the resume screen already shows the report) — keep out of warn/error.
    console.log(`[refreshSolutionHealthReport] plan-health-report refreshed: ${errorCount} error(s), ${warningCount} warning(s)`);
  } catch (error) {
    console.warn('[refreshSolutionHealthReport] skipped:', error);
  }
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

async function buildNextSteps(context: mls.msg.ExecutionContext): Promise<NewSolutionProcessNextStep[]> {
  const steps: NewSolutionProcessNextStep[] = [];
  const existingFolders = getExistingModuleFolders();

  try {
    // E2-004: decide by the saved artifact's referencesExisting flag, not by folder existence —
    // the draft l5/{id}/module.defs.ts written during THIS run creates the folder and would hide
    // the "create module" next step. referencesExisting === false ⇒ draft created now ⇒ next step.
    const referencesExistingById = new Map<string, boolean>();
    for (const data of await readSavedPlanArtifactDataList(context, 'horizontalModule')) {
      const id = typeof data.horizontalModuleId === 'string' ? data.horizontalModuleId : '';
      if (id && typeof data.referencesExisting === 'boolean') referencesExistingById.set(id, data.referencesExisting);
    }

    const horizontals = getPlanHorizontalsOutput(context);
    for (const module of horizontals.result.horizontalModules) {
      const folder = normalizeModuleFolderName(module.horizontalModuleId, module.horizontalModuleId);
      const referencesExisting = referencesExistingById.get(module.horizontalModuleId);
      // reference modules already exist — nothing to create, so they are not a "next step".
      if (referencesExisting === true) continue;
      // no saved artifact flag: fall back to the previous folder heuristic.
      if (referencesExisting === undefined && existingFolders.has(folder)) continue;
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

/**
 * T-011: when a specialized agent refined the scope of an accepted decision, record the revision
 * on the decision itself (revisedBy/revisedAt/revisedScope) instead of persisting the stale text
 * (E-004 — the finalize decision included transactional entities in MDM, agentPlanMDM refined it).
 * Today the only deterministic refinement source is agentPlanMDM (authoritative MDM scope).
 */
function applyDecisionRevisions(context: mls.msg.ExecutionContext, decisions: unknown[]): unknown[] {
  try {
    const mdm = getPlanMDMOutput(context);
    if (mdm.status !== 'ok' || mdm.result.mdmDomains.length === 0) return decisions;
    const revisedScope = {
      mdmDomains: mdm.result.mdmDomains.map(domain => ({
        domainId: domain.domainId,
        masterEntities: domain.masterEntities,
      })),
    };
    return decisions.map(decision => {
      if (!decision || typeof decision !== 'object') return decision;
      const record = decision as Record<string, unknown>;
      const affected = Array.isArray(record.affectedArtifacts) ? record.affectedArtifacts.join(' ') : '';
      const text = `${record.decisionId || ''} ${record.title || ''} ${record.decision || ''} ${affected}`.toLowerCase();
      if (!text.includes('mdm')) return decision;
      return {
        ...record,
        revisedBy: 'agentPlanMDM',
        revisedAt: new Date().toISOString(),
        revisedScope,
      };
    });
  } catch (error) {
    console.warn('[agentValidateSolutionCoverage](applyDecisionRevisions) skipped', error);
    return decisions;
  }
}

async function saveProcessRun(context: mls.msg.ExecutionContext, healthReport: unknown): Promise<void> {
  try {
    const initial = readRootInitialPlan(context);
    let decisions: unknown[] = [];
    let deferredItems: unknown[] = [];
    try {
      const finalize = getFinalizeSolutionPlanOutput(context);
      // T-011: annotate decisions whose scope was refined by specialized agents (E-004).
      decisions = applyDecisionRevisions(context, finalize.result.decisions || []);
      deferredItems = finalize.result.deferredItems || [];
    } catch (error) {
      console.warn('[agentValidateSolutionCoverage](saveProcessRun) finalize output unavailable', error);
    }

    const run: NewSolutionProcessRun = {
      runId: 'newSolution',
      kind: 'newSolution',
      startedAt: new Date().toISOString(),
      // finishedAt is set ONLY by the resume screen's "Encerrar" (_onFinish). Setting it here put
      // the widget in view/maintenance mode straight away (no "Encerrar" button) and the final
      // clarification step never completed (erros.md rodada 2, item 3).
      initialPrompt: initial.userPrompt,
      userLanguage: initial.userLanguage,
      decisions,
      deferredItems,
      openDetails: initial.openDetails,
      healthReport,
      nextSteps: await buildNextSteps(context),
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
  // send a compact coverage snapshot (ids, counts, cross-ref matrix and
  // deterministic pre-computed issues) instead of every full artifact. Coverage is now a
  // non-blocking technical report; the heavy per-artifact checks already
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
  // E2-001: persistenceRefs is the superset of what the workflow writes (T-009), so it may
  // legitimately contain metric table ids — validate against tableIds UNION metricIds.
  const persistenceRefIds = new Set<string>([...tableIds, ...metricIds]);
  for (const wf of workflows) {
    const wid = wf.workflowId as string;
    for (const ref of asStrings(wf.persistenceRefs)) {
      if (persistenceRefIds.size > 0 && !persistenceRefIds.has(ref)) addIssue('error', 'workflow.persistenceRef.unknown', `workflow ${wid} references unknown table ${ref}`, `workflow.${wid}`);
    }
    for (const ref of asStrings(wf.usecaseRefs)) {
      if (usecaseIds.size > 0 && !usecaseIds.has(ref)) addIssue('warning', 'workflow.usecaseRef.unknown', `workflow ${wid} references unknown usecase ${ref}`, `workflow.${wid}`);
    }
    for (const ref of asStrings(wf.metricRefs)) {
      if (metricIds.size > 0 && !metricIds.has(ref)) addIssue('warning', 'workflow.metricRef.unknown', `workflow ${wid} references unknown metric ${ref}`, `workflow.${wid}`);
    }
  }

  // T-015: every exposed usecase must have a consumer — a page BFF command, a workflow or an
  // agent (E-008/E-016). Usecases that declare BFF commands but no page consumer are errors;
  // the rest are warnings (they may be internal workflow/agent helpers).
  const usecaseConsumers = new Map<string, string[]>();
  const addUsecaseConsumer = (usecaseId: unknown, consumer: string) => {
    if (typeof usecaseId !== 'string' || !usecaseId) return;
    const list = usecaseConsumers.get(usecaseId) || [];
    list.push(consumer);
    usecaseConsumers.set(usecaseId, list);
  };
  for (const pd of pageDefinitions) {
    for (const cmd of pd.result.bffCommands) {
      for (const ref of cmd.usecaseRefs) addUsecaseConsumer(ref, `page:${pd.result.pageDefinition.pageId}`);
    }
  }
  for (const wf of workflows) {
    for (const ref of asStrings(wf.usecaseRefs)) addUsecaseConsumer(ref, `workflow:${wf.workflowId}`);
  }
  for (const agentPlan of agentsPlan.result.agents) {
    for (const ref of agentPlan.usecaseRefs) addUsecaseConsumer(ref, `agent:${agentPlan.agentId}`);
  }
  for (const usecase of usecases) {
    const uid = usecase.usecaseId as string;
    if (!uid || usecaseConsumers.has(uid)) continue;
    const declaresBffCommands = Array.isArray(usecase.commands) && usecase.commands.length > 0;
    addIssue(
      declaresBffCommands ? 'error' : 'warning',
      'usecase.consumer.missing',
      `usecase ${uid} has no consumer (no page BFF command, workflow or agent references it)${declaresBffCommands ? '; it declares BFF commands, so a page should expose it as an action' : ''}`,
      `usecase.${uid}`,
    );
  }

  // T-012: every approved horizontal artifact must have produced a plan item (draft or reference).
  const plannedHorizontalIds = new Set(horizontals.result.horizontalModules.map(m => m.horizontalModuleId));
  fp.approvedArtifacts.horizontalModules.forEach((approved, i) => {
    if (!approved || typeof approved !== 'object') return;
    const record = approved as Record<string, unknown>;
    if (record.priority === 'never') return;
    const rawId = record.horizontalModuleId ?? record.artifactId ?? record.signal;
    const id = normalizeHorizontalModuleId(rawId);
    if (!id || !plannedHorizontalIds.has(id)) {
      addIssue('error', 'horizontal.artifact.missing', `approved horizontal module ${String(rawId || `#${i}`)} produced no plan item/artifact`, `approvedArtifacts.horizontalModules[${i}]`);
    }
  });

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

/**
 * T-010: deterministic backfill of workflow.relatedPages (no LLM call). Derives page → workflow
 * relations from pageDefinition.flowRefs (direct workflow refs) and from bffCommands.usecaseRefs
 * intersecting workflow.usecaseRefs, updates the in-memory outputs and re-saves only the changed
 * l4/workflows/*.defs.ts artifacts. Best-effort: never throws.
 */
async function backfillWorkflowRelatedPages(
  context: mls.msg.ExecutionContext,
  step: mls.msg.AIAgentStep,
  workflowDefinitions: PlanWorkflowDefinitionOutput[],
  pageDefinitions: PlanPageDefinitionOutput[],
): Promise<void> {
  try {
    if (pageDefinitions.length === 0) return;
    // E2-003: relatedPages is a DERIVED field — rebuild it from scratch and only keep ids that
    // exist as real pages. Never union with the LLM-generated list (it predates the page index
    // and contains invented page ids).
    const validPageIds = new Set(pageDefinitions.map(pd => pd.result.pageDefinition.pageId).filter(Boolean));

    for (const workflowOutput of workflowDefinitions) {
      const workflow = workflowOutput.result.workflowDefinition;
      const workflowId = workflow.workflowId;
      if (!workflowId) continue;
      const workflowUsecases = new Set(asStrings(workflow.usecaseRefs));
      const related = new Set<string>();

      for (const pageOutput of pageDefinitions) {
        const page = pageOutput.result.pageDefinition;
        if (!page.pageId || !validPageIds.has(page.pageId)) continue;
        const flowRefs = [
          ...asStrings(page.flowRefs?.experienceFlows),
          ...asStrings(page.flowRefs?.entityLifecycles),
          ...asStrings(page.flowRefs?.taskWorkflows),
          ...asStrings(page.flowRefs?.automations),
        ];
        const direct = flowRefs.includes(workflowId);
        const viaUsecase = !direct && workflowUsecases.size > 0
          && pageOutput.result.bffCommands.some(cmd => cmd.usecaseRefs.some(ref => workflowUsecases.has(ref)));
        if (direct || viaUsecase) related.add(page.pageId);
      }

      const relatedPages = [...related].sort();
      const current = asStrings(workflow.relatedPages).slice().sort();
      if (JSON.stringify(relatedPages) === JSON.stringify(current)) continue;
      workflow.relatedPages = relatedPages;
      console.log(`[agentValidateSolutionCoverage] backfilled relatedPages for workflow ${workflowId}: ${relatedPages.join(', ')} (T-010)`);
      await saveNewSolutionPlanArtifacts(context, 'agentPlanWorkflowDefinition', step, workflowOutput);
    }
  } catch (error) {
    console.warn('[agentValidateSolutionCoverage] relatedPages backfill skipped:', error);
  }
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
