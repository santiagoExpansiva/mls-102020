/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanIndexReview.ts" enhancement="_102027_/l2/enhancementAgent"/>

// TODO-FINAL-023 / TODO-FINAL-024
// Per-index review configuration used by agentCriticPlanIndex and agentRepairPlanIndex.
// Each plan index has its own contract, schema, deterministic checkpoint, minimal context
// and continuation (fan-out) logic. One critic LLM call and one repair LLM call per index,
// each with focused, index-specific context.

import {
  PlannerExtractConfig,
  PlannerOutput,
  assertArray,
  assertRecord,
  assertString,
  createPlannerVariableToolSchema,
  getActorIdSet,
  getPlanningContextSnapshot,
  isRecord,
  normalizeStringList,
  repairPlanIndexToolName,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import {
  PlanIndexHealthFinding,
  PlanIndexHealthReport,
  saveNewSolutionIndexCheckpoint,
  saveNewSolutionPlanArtifacts,
} from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import type { FinalSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import {
  PLAN_PERSISTENCE_INDEX_RESULT_SCHEMA,
  createTableDefinitionParallelIntent,
  getPlanPersistenceIndexOutput,
  planPersistenceIndexConfig,
  validatePlanPersistenceIndexOutput,
} from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import type { PlanPersistenceIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPersistenceIndex.js';
import {
  PLAN_METRICS_INDEX_RESULT_SCHEMA,
  createMetricTableDefinitionParallelIntent,
  getPlanMetricsIndexOutput,
  planMetricsIndexConfig,
  validatePlanMetricsIndexOutput,
} from '/_102020_/l2/agentNewSolution/agentPlanMetricsIndex.js';
import type { PlanMetricsIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanMetricsIndex.js';
import {
  PLAN_WORKFLOW_INDEX_RESULT_SCHEMA,
  createWorkflowDefinitionParallelIntent,
  getPlanWorkflowIndexOutput,
  planWorkflowIndexConfig,
  validatePlanWorkflowIndexOutput,
} from '/_102020_/l2/agentNewSolution/agentPlanWorkflowIndex.js';
import type { PlanWorkflowIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanWorkflowIndex.js';
import {
  PLAN_PAGE_INDEX_RESULT_SCHEMA,
  createPageDefinitionParallelIntent,
  getPlanPageIndexOutput,
  planPageIndexConfig,
  validatePlanPageIndexOutput,
} from '/_102020_/l2/agentNewSolution/agentPlanPageIndex.js';
import type { PlanPageIndexOutput } from '/_102020_/l2/agentNewSolution/agentPlanPageIndex.js';
import {
  PLAN_PLUGINS_RESULT_SCHEMA,
  getPlanPluginsOutput,
  planPluginsConfig,
  validatePlanPluginsOutput,
} from '/_102020_/l2/agentNewSolution/agentPlanPlugins.js';
import type { PlanPluginsOutput } from '/_102020_/l2/agentNewSolution/agentPlanPlugins.js';
import {
  PLAN_USECASE_ENTITIES_RESULT_SCHEMA,
  getPlanUsecaseEntitiesOutput,
  planUsecaseEntitiesConfig,
  validatePlanUsecaseEntitiesOutput,
} from '/_102020_/l2/agentNewSolution/agentPlanUsecaseEntities.js';
import type { PlanUsecaseEntitiesOutput } from '/_102020_/l2/agentNewSolution/agentPlanUsecaseEntities.js';

export const PLAN_INDEX_NAMES = [
  'persistenceIndex',
  'metricsIndex',
  'workflowIndex',
  'pageIndex',
  'pluginPlan',
  'usecasePlan',
] as const;

export type PlanIndexName = typeof PLAN_INDEX_NAMES[number];

export interface PlanIndexLocalFindings {
  errors: PlanIndexHealthFinding[];
  warnings: PlanIndexHealthFinding[];
}

export interface PlanIndexReviewConfig {
  indexName: PlanIndexName;
  sourceAgentName: string;
  description: string;
  contractFocus: string;
  resultSchema: Record<string, unknown>;
  getCurrentOutput: (context: mls.msg.ExecutionContext) => PlannerOutput<unknown>;
  buildRepairExtractConfig: () => PlannerExtractConfig<unknown>;
  validateRepairedOutput: (context: mls.msg.ExecutionContext, output: PlannerOutput<unknown>) => void;
  runLocalCheckpoint: (context: mls.msg.ExecutionContext, output: PlannerOutput<unknown>) => PlanIndexLocalFindings;
  buildReviewContext: (context: mls.msg.ExecutionContext) => Record<string, unknown>;
  skipCriticWhen?: (output: PlannerOutput<unknown>) => boolean;
  onApproved: (
    context: mls.msg.ExecutionContext,
    indexStep: mls.msg.AIAgentStep,
    output: PlannerOutput<unknown>,
    healthReport: PlanIndexHealthReport,
  ) => Promise<void>;
  createChildrenIntents: (context: mls.msg.ExecutionContext, output: PlannerOutput<unknown>) => mls.msg.AgentIntent[];
}

//#region critique tool (shared by all indices; payload is always per index)

export const PLAN_INDEX_CRITIQUE_TOOL_NAME = 'submitPlanIndexCritique';

export interface PlanIndexCritiqueFinding {
  code: string;
  message: string;
  path?: string;
}

export interface PlanIndexCritiqueResult {
  approved: boolean;
  errors: PlanIndexCritiqueFinding[];
  warnings: PlanIndexCritiqueFinding[];
  notes: string[];
}

export type PlanIndexCritiqueOutput = PlannerOutput<PlanIndexCritiqueResult>;

const critiqueFindingSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['code', 'message'],
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    path: { type: 'string' },
  },
};

export const PLAN_INDEX_CRITIQUE_RESULT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['approved', 'errors', 'warnings'],
  properties: {
    approved: { type: 'boolean' },
    errors: { type: 'array', items: critiqueFindingSchema },
    warnings: { type: 'array', items: critiqueFindingSchema },
    notes: { type: 'array', items: { type: 'string' } },
  },
};

export const planIndexCritiqueToolSchema = createPlannerVariableToolSchema(
  PLAN_INDEX_CRITIQUE_TOOL_NAME,
  'Submit the critique for one plan index: approved flag, errors and warnings.',
  PLAN_INDEX_CRITIQUE_RESULT_SCHEMA
);

export const planIndexCritiqueExtractConfig: PlannerExtractConfig<PlanIndexCritiqueResult> = {
  toolName: PLAN_INDEX_CRITIQUE_TOOL_NAME,
  stepId: 'plan-index-critique',
  stepIdAliases: ['plan-index-critique'],
  normalizeResult: normalizePlanIndexCritiqueResult,
};

function normalizePlanIndexCritiqueResult(value: unknown): PlanIndexCritiqueResult {
  const result = assertRecord(value, 'result');
  if (typeof result.approved !== 'boolean') throw new Error('result.approved must be a boolean');
  return {
    approved: result.approved,
    errors: assertArray(result.errors, 'result.errors').map((item, index) => normalizeCritiqueFinding(item, `result.errors[${index}]`)),
    warnings: assertArray(result.warnings, 'result.warnings').map((item, index) => normalizeCritiqueFinding(item, `result.warnings[${index}]`)),
    notes: normalizeStringList(result.notes, 'result.notes'),
  };
}

function normalizeCritiqueFinding(value: unknown, path: string): PlanIndexCritiqueFinding {
  const finding = assertRecord(value, path);
  return {
    code: assertString(finding.code, `${path}.code`),
    message: assertString(finding.message, `${path}.message`),
    path: typeof finding.path === 'string' && finding.path.trim() ? finding.path.trim() : undefined,
  };
}

export function critiqueFindingsToHealth(findings: PlanIndexCritiqueFinding[], severity: 'error' | 'warning'): PlanIndexHealthFinding[] {
  return findings.map(finding => ({ severity, code: finding.code, message: finding.message, path: finding.path }));
}

//#endregion

//#region repair tool schemas (per index, registered at module init)

const repairToolSchemaByIndex: Partial<Record<PlanIndexName, mls.msg.LLMTool>> = {};

function registerRepairTool(indexName: PlanIndexName, resultSchema: Record<string, unknown>): void {
  repairToolSchemaByIndex[indexName] = createPlannerVariableToolSchema(
    repairPlanIndexToolName(indexName),
    `Submit the full corrected ${indexName} in the same schema as the original index.`,
    resultSchema
  );
}

registerRepairTool('persistenceIndex', PLAN_PERSISTENCE_INDEX_RESULT_SCHEMA);
registerRepairTool('metricsIndex', PLAN_METRICS_INDEX_RESULT_SCHEMA);
registerRepairTool('workflowIndex', PLAN_WORKFLOW_INDEX_RESULT_SCHEMA);
registerRepairTool('pageIndex', PLAN_PAGE_INDEX_RESULT_SCHEMA);
registerRepairTool('pluginPlan', PLAN_PLUGINS_RESULT_SCHEMA);
registerRepairTool('usecasePlan', PLAN_USECASE_ENTITIES_RESULT_SCHEMA);

export function getRepairToolSchema(indexName: PlanIndexName): mls.msg.LLMTool {
  const tool = repairToolSchemaByIndex[indexName];
  if (!tool) throw new Error(`[getRepairToolSchema] no repair tool registered for ${indexName}`);
  return tool;
}

function buildRepairExtractConfigFrom(indexName: PlanIndexName, source: { stepId: string; stepIdAliases?: string[]; normalizeResult: (value: unknown) => unknown }): PlannerExtractConfig<unknown> {
  return {
    toolName: repairPlanIndexToolName(indexName),
    stepId: `repair:${indexName}`,
    stepIdAliases: [source.stepId, ...(source.stepIdAliases || []), `repair:${indexName}`],
    normalizeResult: source.normalizeResult,
  };
}

//#endregion

//#region shared id helpers (safe: never throw, checkpoints must be best-effort)

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function getFinalPlanSafe(context: mls.msg.ExecutionContext): FinalSolutionPlanOutput | undefined {
  return safe(() => getFinalizeSolutionPlanOutput(context));
}

function getActorIds(context: mls.msg.ExecutionContext): Set<string> {
  // TODO-FINAL-019: single source of the actor contract (shared getActorIdSet).
  return getActorIdSet(getFinalPlanSafe(context)?.result.actors);
}

function getModuleTableIds(context: mls.msg.ExecutionContext): Set<string> {
  const index = safe(() => getPlanPersistenceIndexOutput(context));
  return new Set((index?.result.tables || []).map(table => table.tableId));
}

function getMetricTableIds(context: mls.msg.ExecutionContext): Set<string> {
  const index = safe(() => getPlanMetricsIndexOutput(context));
  return new Set((index?.result.metricTables || []).map(table => table.metricTableId));
}

function getMetricDashboardIds(context: mls.msg.ExecutionContext): Set<string> {
  const index = safe(() => getPlanMetricsIndexOutput(context));
  const ids = new Set<string>();
  for (const page of index?.result.dashboardPages || []) {
    if (isRecord(page) && typeof page.metricDashboardId === 'string') ids.add(page.metricDashboardId);
  }
  return ids;
}

function getUsecaseIds(context: mls.msg.ExecutionContext): Set<string> {
  const plan = safe(() => getPlanUsecaseEntitiesOutput(context));
  const ids = new Set<string>();
  for (const usecase of plan?.result.usecases || []) {
    if (isRecord(usecase) && typeof usecase.usecaseId === 'string') ids.add(usecase.usecaseId);
  }
  return ids;
}

function getPluginIds(context: mls.msg.ExecutionContext): Set<string> {
  const plan = safe(() => getPlanPluginsOutput(context));
  return new Set((plan?.result.plugins || []).map(plugin => plugin.pluginId));
}

const SUMMARY_KEYS = [
  'actorId', 'capabilityId', 'ruleId', 'pluginId', 'workflowId', 'pageId', 'agentId',
  'horizontalModuleId', 'metricTableId', 'metricDashboardId', 'usecaseEntityId', 'usecaseId',
  'artifactId', 'entityId', 'actionId', 'title', 'name', 'priority', 'actor', 'description',
];

function summarizeItems(items: unknown[] | undefined): unknown[] {
  return (items || []).map(item => {
    if (!isRecord(item)) return item;
    const summary: Record<string, unknown> = {};
    for (const key of SUMMARY_KEYS) {
      if (item[key] !== undefined) summary[key] = item[key];
    }
    return Object.keys(summary).length > 0 ? summary : item;
  });
}

function compactFinalPlan(context: mls.msg.ExecutionContext): Record<string, unknown> {
  const finalPlan = getFinalPlanSafe(context);
  if (!finalPlan) return { missing: 'final solution plan not available' };
  const result = finalPlan.result;
  return {
    module: result.module,
    actors: summarizeItems(result.actors),
    capabilities: summarizeItems(result.capabilities),
    ontologyEntityIds: Object.keys(result.ontology.entities),
    rules: summarizeItems(result.rules),
    userActions: summarizeItems(result.userActions),
    approvedArtifacts: {
      pages: summarizeItems(result.approvedArtifacts.pages),
      workflows: summarizeItems(result.approvedArtifacts.workflows),
      plugins: summarizeItems(result.approvedArtifacts.plugins),
      agents: summarizeItems(result.approvedArtifacts.agents),
      horizontalModules: summarizeItems(result.approvedArtifacts.horizontalModules),
      mdm: summarizeItems(result.approvedArtifacts.mdm),
      metricTables: summarizeItems(result.approvedArtifacts.metricTables),
      metricDashboards: summarizeItems(result.approvedArtifacts.metricDashboards),
      usecaseEntities: summarizeItems(result.approvedArtifacts.usecaseEntities),
    },
  };
}

function finding(severity: 'error' | 'warning', code: string, message: string, path?: string): PlanIndexHealthFinding {
  return { severity, code, message, path };
}

//#endregion

//#region per-index local checkpoints (TODO-FINAL-023 deterministic validations)

function checkpointPersistenceIndex(context: mls.msg.ExecutionContext, output: PlanPersistenceIndexOutput): PlanIndexLocalFindings {
  const errors: PlanIndexHealthFinding[] = [];
  const warnings: PlanIndexHealthFinding[] = [];
  const finalPlan = getFinalPlanSafe(context);
  const entityIds = new Set(Object.keys(finalPlan?.result.ontology.entities || {}));

  output.result.tables.forEach((table, index) => {
    const path = `tables[${index}]`;
    if (entityIds.size > 0 && !entityIds.has(table.rootEntity)) {
      warnings.push(finding('warning', 'persistence.rootEntity.unknown', `table ${table.tableId} rootEntity ${table.rootEntity} is not in the final plan ontology`, path));
    }
    if (table.writesByArtifacts.length === 0) {
      warnings.push(finding('warning', 'persistence.noWriter', `table ${table.tableId} has no writesByArtifacts declared`, path));
    }
    if (table.rulesApplied.length === 0) {
      warnings.push(finding('warning', 'persistence.noRules', `table ${table.tableId} has no rulesApplied`, path));
    }
  });

  return { errors, warnings };
}

function checkpointMetricsIndex(context: mls.msg.ExecutionContext, output: PlanMetricsIndexOutput): PlanIndexLocalFindings {
  const errors: PlanIndexHealthFinding[] = [];
  const warnings: PlanIndexHealthFinding[] = [];
  const tableIds = getModuleTableIds(context);
  const actorIds = getActorIds(context);
  const metricIds = new Set(output.result.metricTables.map(table => table.metricTableId));
  const finalPlan = getFinalPlanSafe(context);

  output.result.metricTables.forEach((table, index) => {
    const path = `metricTables[${index}]`;
    for (const source of table.sourceBaseTables) {
      if (tableIds.size > 0 && !tableIds.has(source)) {
        warnings.push(finding('warning', 'metrics.sourceBaseTable.unknown', `metric table ${table.metricTableId} sources unknown base table ${source}`, path));
      }
    }
  });

  output.result.dashboardPages.forEach((page, index) => {
    const path = `dashboardPages[${index}]`;
    if (!isRecord(page)) return;
    const actor = typeof page.actor === 'string' ? page.actor : '';
    if (actorIds.size > 0 && actor && !actorIds.has(actor)) {
      errors.push(finding('error', 'metrics.dashboard.actorUnknown', `dashboard ${page.metricDashboardId} actor ${actor} is not a final plan actorId`, path));
    }
    const widgets = Array.isArray(page.widgets) ? page.widgets : [];
    widgets.forEach((widget, widgetIndex) => {
      if (isRecord(widget) && typeof widget.sourceMetricTable === 'string' && !metricIds.has(widget.sourceMetricTable)) {
        errors.push(finding('error', 'metrics.widget.sourceUnknown', `dashboard ${page.metricDashboardId} widget references unknown metric table ${widget.sourceMetricTable}`, `${path}.widgets[${widgetIndex}]`));
      }
    });
  });

  const approvedMetricTables = finalPlan?.result.approvedArtifacts.metricTables.length || 0;
  if (approvedMetricTables > 0 && output.result.metricTables.length < approvedMetricTables) {
    warnings.push(finding('warning', 'metrics.count.belowApproved', `metrics index plans ${output.result.metricTables.length} metric tables, but the final plan approved ${approvedMetricTables}`));
  }

  return { errors, warnings };
}

function checkpointWorkflowIndex(context: mls.msg.ExecutionContext, output: PlanWorkflowIndexOutput): PlanIndexLocalFindings {
  const errors: PlanIndexHealthFinding[] = [];
  const warnings: PlanIndexHealthFinding[] = [];
  const actorIds = getActorIds(context);
  const tableIds = getModuleTableIds(context);
  const usecaseIds = getUsecaseIds(context);
  const metricIds = new Set([...getMetricTableIds(context), ...getMetricDashboardIds(context)]);

  output.result.workflows.forEach((workflow, index) => {
    const path = `workflows[${index}]`;
    for (const actor of workflow.actors) {
      if (actorIds.size > 0 && !actorIds.has(actor)) {
        errors.push(finding('error', 'workflow.actorUnknown', `workflow ${workflow.workflowId} actor ${actor} is not a final plan actorId`, path));
      }
    }
    for (const ref of workflow.persistenceRefs) {
      if (tableIds.size > 0 && !tableIds.has(ref)) {
        errors.push(finding('error', 'workflow.persistenceRef.unknown', `workflow ${workflow.workflowId} references unknown module table ${ref}`, path));
      }
    }
    for (const ref of workflow.usecaseRefs) {
      if (usecaseIds.size > 0 && !usecaseIds.has(ref)) {
        warnings.push(finding('warning', 'workflow.usecaseRef.unknown', `workflow ${workflow.workflowId} references unknown usecase ${ref}`, path));
      }
    }
    for (const ref of workflow.metricRefs) {
      if (metricIds.size > 0 && !metricIds.has(ref)) {
        warnings.push(finding('warning', 'workflow.metricRef.unknown', `workflow ${workflow.workflowId} references unknown metric ${ref}`, path));
      }
    }
  });

  return { errors, warnings };
}

function checkpointPageIndex(context: mls.msg.ExecutionContext, output: PlanPageIndexOutput): PlanIndexLocalFindings {
  const errors: PlanIndexHealthFinding[] = [];
  const warnings: PlanIndexHealthFinding[] = [];
  const tableIds = getModuleTableIds(context);
  const usecaseIds = getUsecaseIds(context);
  const pluginIds = getPluginIds(context);
  const metricIds = new Set([...getMetricTableIds(context), ...getMetricDashboardIds(context)]);
  const pageIds = new Set(output.result.pages.map(page => page.pageId));

  output.result.pages.forEach((page, index) => {
    const path = `pages[${index}]`;
    page.navigationRefs.forEach((ref, refIndex) => {
      if (isRecord(ref) && typeof ref.pageId === 'string' && !pageIds.has(ref.pageId)) {
        errors.push(finding('error', 'page.navigationRef.unknown', `page ${page.pageId} navigates to unknown page ${ref.pageId}`, `${path}.navigationRefs[${refIndex}]`));
      }
    });
    for (const hint of page.persistenceHints) {
      if (tableIds.size > 0 && !tableIds.has(hint)) {
        warnings.push(finding('warning', 'page.persistenceHint.unknown', `page ${page.pageId} hints unknown module table ${hint}`, path));
      }
    }
    for (const hint of page.usecaseHints) {
      if (usecaseIds.size > 0 && !usecaseIds.has(hint)) {
        warnings.push(finding('warning', 'page.usecaseHint.unknown', `page ${page.pageId} hints unknown usecase ${hint}`, path));
      }
    }
    for (const ref of page.metricRefs) {
      if (metricIds.size > 0 && !metricIds.has(ref)) {
        warnings.push(finding('warning', 'page.metricRef.unknown', `page ${page.pageId} references unknown metric ${ref}`, path));
      }
    }
    for (const ref of page.pluginRefs) {
      if (pluginIds.size > 0 && !pluginIds.has(ref)) {
        warnings.push(finding('warning', 'page.pluginRef.unknown', `page ${page.pageId} references unknown plugin ${ref}`, path));
      }
    }
  });

  return { errors, warnings };
}

function checkpointPluginPlan(context: mls.msg.ExecutionContext, output: PlanPluginsOutput): PlanIndexLocalFindings {
  const errors: PlanIndexHealthFinding[] = [];
  const warnings: PlanIndexHealthFinding[] = [];
  const byProvider = new Map<string, string[]>();

  output.result.plugins.forEach(plugin => {
    const provider = plugin.provider.toLowerCase().replace(/[^a-z0-9]/g, '');
    const list = byProvider.get(provider) || [];
    list.push(plugin.pluginId);
    byProvider.set(provider, list);
  });

  for (const [provider, pluginIds] of byProvider) {
    if (pluginIds.length > 1) {
      warnings.push(finding('warning', 'plugin.provider.duplicated', `provider ${provider} appears in more than one plugin: ${pluginIds.join(', ')} (possible duplicate integration)`));
    }
  }

  return { errors, warnings };
}

function checkpointUsecasePlan(context: mls.msg.ExecutionContext, output: PlanUsecaseEntitiesOutput): PlanIndexLocalFindings {
  const errors: PlanIndexHealthFinding[] = [];
  const warnings: PlanIndexHealthFinding[] = [];
  const actorIds = getActorIds(context);
  const tableIds = getModuleTableIds(context);
  const metricsIndex = safe(() => getPlanMetricsIndexOutput(context));
  const metricTableNames = new Set<string>();
  for (const table of metricsIndex?.result.metricTables || []) {
    metricTableNames.add(table.metricTableId);
    metricTableNames.add(table.tableName);
  }

  let writesMetricTable = false;
  output.result.usecases.forEach((usecase, index) => {
    if (!isRecord(usecase)) return;
    const path = `usecases[${index}]`;
    const usecaseId = typeof usecase.usecaseId === 'string' ? usecase.usecaseId : `#${index}`;
    const actor = typeof usecase.actor === 'string' ? usecase.actor : '';
    if (actorIds.size > 0 && actor && !actorIds.has(actor)) {
      warnings.push(finding('warning', 'usecase.actorUnknown', `usecase ${usecaseId} actor ${actor} is not a final plan actorId`, path));
    }
    const reads = Array.isArray(usecase.readsTables) ? usecase.readsTables : [];
    const writes = Array.isArray(usecase.writesTables) ? usecase.writesTables : [];
    for (const ref of [...reads, ...writes]) {
      if (typeof ref !== 'string') continue;
      if (metricTableNames.has(ref)) {
        writesMetricTable = writesMetricTable || writes.includes(ref);
        continue;
      }
      if (tableIds.size > 0 && !tableIds.has(ref)) {
        warnings.push(finding('warning', 'usecase.tableRef.unknown', `usecase ${usecaseId} references unknown table ${ref}`, path));
      }
    }
  });

  if (metricTableNames.size > 0 && !writesMetricTable) {
    warnings.push(finding('warning', 'usecase.metrics.noWriter', 'metric tables exist, but no usecase declares writes to any metric table'));
  }

  return { errors, warnings };
}

//#endregion

//#region per-index review configs

const reviewConfigs: Record<PlanIndexName, PlanIndexReviewConfig> = {
  persistenceIndex: {
    indexName: 'persistenceIndex',
    sourceAgentName: 'agentPlanPersistenceIndex',
    description: 'Module-owned persistence table index',
    contractFocus: `
- Ownership must be moduleOwned only; MDM, horizontal and plugin-owned entities belong in excludedEntities, never in tables.
- tableKind must be transactional; metric tables are planned in the metrics index, not here.
- Every table must be really necessary: derived from final plan approvedArtifacts, ontology, workflows or usecase signals. No invented feature tables.
- Tables that nobody reads or writes are suspicious; check readsByArtifacts/writesByArtifacts.
- Embedded entities should use the details column pattern only when read together with the root and without independent lifecycle.`,
    resultSchema: PLAN_PERSISTENCE_INDEX_RESULT_SCHEMA,
    getCurrentOutput: context => getPlanPersistenceIndexOutput(context),
    buildRepairExtractConfig: () => buildRepairExtractConfigFrom('persistenceIndex', planPersistenceIndexConfig),
    validateRepairedOutput: (context, output) => validatePlanPersistenceIndexOutput(output as PlanPersistenceIndexOutput, getPlanningContextSnapshot(context).initialMetricsRequested),
    runLocalCheckpoint: (context, output) => checkpointPersistenceIndex(context, output as PlanPersistenceIndexOutput),
    buildReviewContext: context => ({
      finalPlan: compactFinalPlan(context),
      initialMetricsRequested: safe(() => getPlanningContextSnapshot(context).initialMetricsRequested) ?? false,
    }),
    skipCriticWhen: output => (output as PlanPersistenceIndexOutput).result.tables.length === 0,
    onApproved: async (context, indexStep, output, healthReport) => {
      await saveNewSolutionIndexCheckpoint(context, 'persistenceIndex', 'agentPlanPersistenceIndex', indexStep, output, healthReport);
    },
    createChildrenIntents: (context, output) => createTableDefinitionParallelIntent(context, output as PlanPersistenceIndexOutput),
  },

  metricsIndex: {
    indexName: 'metricsIndex',
    sourceAgentName: 'agentPlanMetricsIndex',
    description: 'Operational metrics index (TimescaleDB metric tables and dashboards)',
    contractFocus: `
- The amount of metric tables must answer the approved business questions; neither inflated nor missing approved metrics.
- Every metric table must have a clear business purpose, a dashboard or consumer, and a concrete source (base table updates, lifecycle transitions or operational risks).
- Dashboards must target a final plan actorId (usually admin/operations) and reference only metric tables from this index.
- Metrics are updated only by layer_3_usecases, never by pages.
- storageEngine must be postgresTimescaleDB for every metric table.`,
    resultSchema: PLAN_METRICS_INDEX_RESULT_SCHEMA,
    getCurrentOutput: context => getPlanMetricsIndexOutput(context),
    buildRepairExtractConfig: () => buildRepairExtractConfigFrom('metricsIndex', planMetricsIndexConfig),
    validateRepairedOutput: (context, output) => validatePlanMetricsIndexOutput(output as PlanMetricsIndexOutput, getPlanningContextSnapshot(context).initialMetricsRequested),
    runLocalCheckpoint: (context, output) => checkpointMetricsIndex(context, output as PlanMetricsIndexOutput),
    buildReviewContext: context => ({
      finalPlan: compactFinalPlan(context),
      initialMetricsRequested: safe(() => getPlanningContextSnapshot(context).initialMetricsRequested) ?? false,
      moduleTableIds: [...getModuleTableIds(context)],
    }),
    skipCriticWhen: output => {
      const metrics = output as PlanMetricsIndexOutput;
      return !metrics.result.metricsPlan.enabled && metrics.result.metricTables.length === 0 && metrics.result.dashboardPages.length === 0;
    },
    onApproved: async (context, indexStep, output, healthReport) => {
      await saveNewSolutionIndexCheckpoint(context, 'metricsIndex', 'agentPlanMetricsIndex', indexStep, output, healthReport);
    },
    createChildrenIntents: (context, output) => createMetricTableDefinitionParallelIntent(context, output as PlanMetricsIndexOutput),
  },

  workflowIndex: {
    indexName: 'workflowIndex',
    sourceAgentName: 'agentPlanWorkflowIndex',
    description: 'Workflow index',
    contractFocus: `
- executionMode must reflect reality: documentationOnly, uiState, entityLifecycle, taskWorkflow or automation.
- createsTask must be true only for workflows that create or coordinate tasks for staff/managers/agents.
- actors must come from final plan actorIds, never invented or translated names.
- persistenceRefs only for module-owned tables; usecaseRefs when layer_3 executes transitions; metricRefs when transitions feed metrics.
- No unnecessary workflows: each workflow must map to multi-step state, coordination, approval, fulfillment, reminders, integration or scheduled automation.`,
    resultSchema: PLAN_WORKFLOW_INDEX_RESULT_SCHEMA,
    getCurrentOutput: context => getPlanWorkflowIndexOutput(context),
    buildRepairExtractConfig: () => buildRepairExtractConfigFrom('workflowIndex', planWorkflowIndexConfig),
    validateRepairedOutput: (_context, output) => validatePlanWorkflowIndexOutput(output as PlanWorkflowIndexOutput),
    runLocalCheckpoint: (context, output) => checkpointWorkflowIndex(context, output as PlanWorkflowIndexOutput),
    buildReviewContext: context => ({
      finalPlan: compactFinalPlan(context),
      moduleTableIds: [...getModuleTableIds(context)],
      usecaseIds: [...getUsecaseIds(context)],
      metricTableIds: [...getMetricTableIds(context)],
    }),
    skipCriticWhen: output => (output as PlanWorkflowIndexOutput).result.workflows.length === 0,
    onApproved: async (context, indexStep, output, healthReport) => {
      await saveNewSolutionIndexCheckpoint(context, 'workflowIndex', 'agentPlanWorkflowIndex', indexStep, output, healthReport);
    },
    createChildrenIntents: (context, output) => createWorkflowDefinitionParallelIntent(context, output as PlanWorkflowIndexOutput),
  },

  pageIndex: {
    indexName: 'pageIndex',
    sourceAgentName: 'agentPlanPageIndex',
    description: 'Page index',
    contractFocus: `
- Pages must cover every now capability that needs user interaction; no missing core page, no invented page.
- Every page actor must be a final plan actorId; no language hard-code or actor translation.
- Metric dashboard pages must exist when initial metrics were requested, restricted to the declared dashboard actor.
- flowRefs must reference existing workflows in the bucket matching their executionMode.
- A page input may be an object that contains the identifier internally; that is an acceptable modeling choice (warning at most), not an error.`,
    resultSchema: PLAN_PAGE_INDEX_RESULT_SCHEMA,
    getCurrentOutput: context => getPlanPageIndexOutput(context),
    buildRepairExtractConfig: () => buildRepairExtractConfigFrom('pageIndex', planPageIndexConfig),
    validateRepairedOutput: (context, output) => validatePlanPageIndexOutput(
      output as PlanPageIndexOutput,
      getPlanningContextSnapshot(context).initialMetricsRequested,
      getFinalizeSolutionPlanOutput(context),
      getPlanWorkflowIndexOutput(context)
    ),
    runLocalCheckpoint: (context, output) => checkpointPageIndex(context, output as PlanPageIndexOutput),
    buildReviewContext: context => ({
      finalPlan: compactFinalPlan(context),
      initialMetricsRequested: safe(() => getPlanningContextSnapshot(context).initialMetricsRequested) ?? false,
      workflows: summarizeItems(safe(() => getPlanWorkflowIndexOutput(context))?.result.workflows as unknown[] | undefined),
      moduleTableIds: [...getModuleTableIds(context)],
      usecaseIds: [...getUsecaseIds(context)],
      metricTableIds: [...getMetricTableIds(context)],
      pluginIds: [...getPluginIds(context)],
    }),
    onApproved: async (context, indexStep, output, healthReport) => {
      await saveNewSolutionIndexCheckpoint(context, 'pageIndex', 'agentPlanPageIndex', indexStep, output, healthReport);
    },
    createChildrenIntents: (context, output) => createPageDefinitionParallelIntent(context, output as PlanPageIndexOutput),
  },

  pluginPlan: {
    indexName: 'pluginPlan',
    sourceAgentName: 'agentPlanPlugins',
    description: 'External plugin plan',
    contractFocus: `
- Only plugins accepted by implementation decisions or approved artifacts may be planned; no invented plugin.
- resolution must be valid: existing when a reusable plugin already exists, create_draft only when nothing close exists.
- Two plugins for the same provider/integration usually indicate a duplicate; prefer reuse over a new draft.
- Priorities must respect MVP decisions: now only when the approved MVP depends on the integration.`,
    resultSchema: PLAN_PLUGINS_RESULT_SCHEMA,
    getCurrentOutput: context => getPlanPluginsOutput(context),
    buildRepairExtractConfig: () => buildRepairExtractConfigFrom('pluginPlan', planPluginsConfig),
    validateRepairedOutput: (context, output) => validatePlanPluginsOutput(output as PlanPluginsOutput, context),
    runLocalCheckpoint: (context, output) => checkpointPluginPlan(context, output as PlanPluginsOutput),
    buildReviewContext: context => ({
      finalPlan: compactFinalPlan(context),
    }),
    skipCriticWhen: output => (output as PlanPluginsOutput).result.plugins.length === 0,
    onApproved: async (context, indexStep, output, healthReport) => {
      await saveNewSolutionIndexCheckpoint(context, 'pluginPlan', 'agentPlanPlugins', indexStep, output, healthReport);
      // TODO-FINAL-011: incremental plan artifacts now persist the approved (possibly repaired) plugin plan.
      await saveNewSolutionPlanArtifacts(context, 'agentPlanPlugins', indexStep, output);
    },
    createChildrenIntents: () => [],
  },

  usecasePlan: {
    indexName: 'usecasePlan',
    sourceAgentName: 'agentPlanUsecaseEntities',
    description: 'Layer_3 usecase entities and usecases plan',
    contractFocus: `
- Every module-owned table write (from pages/BFF, workflows, agents) must be covered by a usecase.
- Lifecycle transitions must be executed by usecases; check coverage of entity lifecycles.
- BFF commands must be able to reference these usecases by usecaseId; missing obvious read/write usecases is an error.
- Usecases that write base transactional tables must also update the related metric tables.
- Only layer_3_usecases accesses layer_1_external tables.`,
    resultSchema: PLAN_USECASE_ENTITIES_RESULT_SCHEMA,
    getCurrentOutput: context => getPlanUsecaseEntitiesOutput(context),
    buildRepairExtractConfig: () => buildRepairExtractConfigFrom('usecasePlan', planUsecaseEntitiesConfig),
    validateRepairedOutput: (context, output) => validatePlanUsecaseEntitiesOutput(
      output as PlanUsecaseEntitiesOutput,
      getPlanPersistenceIndexOutput(context).result.tables.length > 0
    ),
    runLocalCheckpoint: (context, output) => checkpointUsecasePlan(context, output as PlanUsecaseEntitiesOutput),
    buildReviewContext: context => ({
      finalPlan: compactFinalPlan(context),
      moduleTableIds: [...getModuleTableIds(context)],
      metricTableIds: [...getMetricTableIds(context)],
    }),
    skipCriticWhen: output => {
      const plan = output as PlanUsecaseEntitiesOutput;
      return plan.result.usecases.length === 0 && plan.result.usecaseEntities.length === 0;
    },
    onApproved: async (context, indexStep, output, healthReport) => {
      await saveNewSolutionIndexCheckpoint(context, 'usecasePlan', 'agentPlanUsecaseEntities', indexStep, output, healthReport);
      // TODO-FINAL-011: incremental plan artifacts now persist the approved (possibly repaired) usecase plan.
      await saveNewSolutionPlanArtifacts(context, 'agentPlanUsecaseEntities', indexStep, output);
    },
    createChildrenIntents: () => [],
  },
};

export function getPlanIndexReviewConfig(indexName: string): PlanIndexReviewConfig {
  const config = reviewConfigs[indexName as PlanIndexName];
  if (!config) throw new Error(`[getPlanIndexReviewConfig] unknown plan index: ${indexName}`);
  return config;
}

export function buildEmptyHealthReport(): PlanIndexHealthReport {
  return { localErrors: [], localWarnings: [], criticErrors: [], criticWarnings: [], attempts: 0, notes: [] };
}

//#endregion
