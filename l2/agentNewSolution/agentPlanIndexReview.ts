/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanIndexReview.ts" enhancement="_102027_/l2/enhancementAgent"/>

// 
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
import type { EntityCatalogMdmEntity, SavePlanArtifactsOptions } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { readExistingModuleTables } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import { getPlanMDMOutput } from '/_102020_/l2/agentNewSolution/agentPlanMDM.js';
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
  createUsecaseDefinitionParallelIntent,
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
  // single source of the actor contract (shared getActorIdSet).
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

// T-013: compare ids across casing conventions ('lead_id', 'leadId', 'Lead' -> 'leadid', 'lead').
function normalizeIdToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

// T-014: heuristic justification — a usecase writing a metric table should share at least one
// meaningful token (beyond generic verbs and the source entity names) with the table's measures
// or sourceWriteEvents. Purely descriptive edits (e.g. updateLeadNotes) share none.
const GENERIC_USECASE_VERBS = new Set(['update', 'create', 'set', 'add', 'register', 'edit', 'save', 'delete', 'remove', 'get', 'list', 'manage']);

function splitIdTokens(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean);
}

function metricWriteLooksJustified(
  usecaseId: string,
  table: { measures: unknown[]; sourceWriteEvents: string[]; sourceEntities: string[] },
): boolean {
  const entityTokens = new Set(table.sourceEntities.flatMap(splitIdTokens));
  const meaningful = splitIdTokens(usecaseId).filter(token => !GENERIC_USECASE_VERBS.has(token) && !entityTokens.has(token));
  if (meaningful.length === 0) return true; // nothing left to judge (e.g. 'updateLead')

  const targetTokens: string[] = [];
  for (const measure of table.measures) {
    if (!isRecord(measure)) continue;
    for (const key of ['measureId', 'column']) {
      const value = measure[key];
      if (typeof value === 'string') targetTokens.push(...splitIdTokens(value));
    }
  }
  for (const event of table.sourceWriteEvents) targetTokens.push(...splitIdTokens(event));
  return meaningful.some(token => targetTokens.some(target => target.includes(token) || token.includes(target)));
}

//#endregion

//#region per-index local checkpoints

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

  // T-005: every moduleOwned ontology entity (or entity without declared ownership) that is not
  // listed in excludedEntities must be covered by a table in this index (root/source/embedded).
  // Without this, transactional entities like Visit/Deal silently lose their .defs.ts (E-003).
  const excludedIds = new Set<string>();
  for (const item of output.result.persistenceScope.excludedEntities) {
    if (isRecord(item) && typeof item.entityId === 'string') excludedIds.add(item.entityId);
  }
  const coveredEntities = new Set<string>();
  for (const table of output.result.tables) {
    if (table.rootEntity) coveredEntities.add(table.rootEntity);
    for (const id of table.sourceEntities) coveredEntities.add(id);
    for (const id of table.embeddedEntities) coveredEntities.add(id);
  }
  for (const [entityId, value] of Object.entries(finalPlan?.result.ontology.entities || {})) {
    if (!isRecord(value)) continue;
    const ownership = typeof value.ownership === 'string' ? value.ownership : '';
    const moduleOwned = !ownership || ownership === 'moduleOwned';
    if (!moduleOwned || excludedIds.has(entityId) || coveredEntities.has(entityId)) continue;
    errors.push(finding('error', 'persistence.entity.uncovered', `ontology entity ${entityId} is moduleOwned but has no table in the persistence index and is not in excludedEntities`, 'tables'));
  }

  return { errors, warnings };
}

function checkpointMetricsIndex(context: mls.msg.ExecutionContext, output: PlanMetricsIndexOutput): PlanIndexLocalFindings {
  const errors: PlanIndexHealthFinding[] = [];
  const warnings: PlanIndexHealthFinding[] = [];
  const tableIds = getModuleTableIds(context);
  const actorIds = getActorIds(context);
  const metricIds = new Set(output.result.metricTables.map(table => table.metricTableId));
  const finalPlan = getFinalPlanSafe(context);

  const relationships = (finalPlan?.result.relationships || []).filter(isRecord);

  output.result.metricTables.forEach((table, index) => {
    const path = `metricTables[${index}]`;
    for (const source of table.sourceBaseTables) {
      if (tableIds.size > 0 && !tableIds.has(source)) {
        warnings.push(finding('warning', 'metrics.sourceBaseTable.unknown', `metric table ${table.metricTableId} sources unknown base table ${source}`, path));
      }
    }

    // T-013: dimensions must cover the FKs of the source entities' direct ontology relationships
    // (e.g. Deal —relDealLead→ Lead ⇒ deal metrics needs a lead dimension) (E-014).
    const sourceEntities = new Set(table.sourceEntities);
    if (sourceEntities.size === 0) return;
    const dimensionTokens: string[] = [];
    for (const dimension of table.dimensions) {
      if (!isRecord(dimension)) continue;
      for (const key of ['dimensionId', 'column']) {
        const value = dimension[key];
        if (typeof value === 'string' && value.trim()) dimensionTokens.push(normalizeIdToken(value));
      }
    }
    for (const rel of relationships) {
      const from = typeof rel.fromEntity === 'string' ? rel.fromEntity : '';
      const to = typeof rel.toEntity === 'string' ? rel.toEntity : '';
      if (!from || !to || !sourceEntities.has(from)) continue;
      const relatedToken = normalizeIdToken(to);
      if (!relatedToken || dimensionTokens.some(token => token.includes(relatedToken))) continue;
      errors.push(finding('error', 'metrics.dimensions.missingRelationship', `metric table ${table.metricTableId} sources entity ${from} but has no dimension for related entity ${to} (relationship ${String(rel.relationshipId || '')}); add the ${to} FK as a dimension`, path));
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
  const metricTableOnlyIds = getMetricTableIds(context);
  const metricIds = new Set([...metricTableOnlyIds, ...getMetricDashboardIds(context)]);

  output.result.workflows.forEach((workflow, index) => {
    const path = `workflows[${index}]`;
    for (const actor of workflow.actors) {
      if (actorIds.size > 0 && !actorIds.has(actor)) {
        errors.push(finding('error', 'workflow.actorUnknown', `workflow ${workflow.workflowId} actor ${actor} is not a final plan actorId`, path));
      }
    }
    // E2-001: persistenceRefs may contain metric table ids (T-009 superset contract) — validate
    // against module tables UNION metric tables, never against transactional tables only.
    for (const ref of workflow.persistenceRefs) {
      if (tableIds.size > 0 && !tableIds.has(ref) && !metricTableOnlyIds.has(ref)) {
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
    // T-009: a workflow that feeds metric tables must declare its persistence superset —
    // metricRefs with empty persistenceRefs is a blocking mismatch (E-011/E-012), not a report-only warning.
    const metricTableRefs = workflow.metricRefs.filter(ref => metricTableOnlyIds.has(ref));
    if (metricTableRefs.length > 0 && workflow.persistenceRefs.length === 0) {
      errors.push(finding('error', 'workflow.definition.index.mismatch', `workflow ${workflow.workflowId} has metricRefs (${metricTableRefs.join(', ')}) but empty persistenceRefs; persistenceRefs must include the metric tables it writes`, path));
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
    // T-007: usecase refs are a hard contract — a page that references a usecase missing from the
    // approved usecase plan can never materialize its BFF commands (E-005/E-006). Hard error so the
    // critic/repair loop fixes the gap before page definitions run.
    for (const hint of page.usecaseHints) {
      if (usecaseIds.size > 0 && !usecaseIds.has(hint)) {
        errors.push(finding('error', 'page.usecaseHint.missing', `page ${page.pageId} hints usecase ${hint}, which does not exist in the usecase plan`, path));
      }
    }
    page.bffCommandHints.forEach((hint, hintIndex) => {
      if (!isRecord(hint) || typeof hint.name !== 'string' || !hint.name) return;
      if (usecaseIds.size > 0 && !usecaseIds.has(hint.name)) {
        errors.push(finding('error', 'page.bffCommandHint.usecaseMissing', `page ${page.pageId} bffCommandHint ${hint.name} has no matching usecaseId in the usecase plan`, `${path}.bffCommandHints[${hintIndex}]`));
      }
    });
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
  const metricsIndex = safe(() => getPlanMetricsIndexOutput(context));
  const metricTableNames = new Set<string>();
  for (const table of metricsIndex?.result.metricTables || []) {
    metricTableNames.add(table.metricTableId);
    metricTableNames.add(table.tableName);
  }
  // T-005: accept both tableId (camelCase) and tableName (physical) when matching usecase refs.
  const persistenceIndex = safe(() => getPlanPersistenceIndexOutput(context));
  const baseTableNames = new Set<string>();
  for (const table of persistenceIndex?.result.tables || []) {
    baseTableNames.add(table.tableId);
    baseTableNames.add(table.tableName);
  }

  // Metric table index items keyed by metricTableId AND physical tableName (T-014).
  const metricTableByName = new Map<string, { measures: unknown[]; sourceWriteEvents: string[]; sourceEntities: string[]; metricTableId: string }>();
  for (const table of metricsIndex?.result.metricTables || []) {
    metricTableByName.set(table.metricTableId, table);
    metricTableByName.set(table.tableName, table);
  }

  // layer_4_entities coverage: tables owned by some usecaseEntity group (their sourceTables).
  // Every table a usecase touches should belong to a group — the group becomes the
  // layer_4_entities/{Entity}.defs.ts contract and feeds usecase.entityRefs (layer4.md §8).
  const entityCoveredTables = new Set<string>();
  for (const entityValue of output.result.usecaseEntities) {
    if (!isRecord(entityValue)) continue;
    const sourceTables = Array.isArray(entityValue.sourceTables) ? entityValue.sourceTables : [];
    for (const tableValue of sourceTables) {
      const name = typeof tableValue === 'string' ? tableValue : (isRecord(tableValue) && typeof tableValue.tableName === 'string' ? tableValue.tableName : '');
      if (name) entityCoveredTables.add(name);
    }
  }

  // Usecase table refs may be plain strings (legacy) or { tableName, ownership } objects.
  const toTableRef = (value: unknown): { name: string; ownership: string } | null => {
    if (typeof value === 'string' && value.trim()) return { name: value.trim(), ownership: '' };
    if (isRecord(value) && typeof value.tableName === 'string' && value.tableName.trim()) {
      return { name: value.tableName.trim(), ownership: typeof value.ownership === 'string' ? value.ownership : '' };
    }
    return null;
  };

  let writesMetricTable = false;
  output.result.usecases.forEach((usecase, index) => {
    if (!isRecord(usecase)) return;
    const path = `usecases[${index}]`;
    const usecaseId = typeof usecase.usecaseId === 'string' ? usecase.usecaseId : `#${index}`;
    const actor = typeof usecase.actor === 'string' ? usecase.actor : '';
    if (actorIds.size > 0 && actor && !actorIds.has(actor)) {
      warnings.push(finding('warning', 'usecase.actorUnknown', `usecase ${usecaseId} actor ${actor} is not a final plan actorId`, path));
    }
    const reads = (Array.isArray(usecase.readsTables) ? usecase.readsTables : []).map(toTableRef);
    const writes = (Array.isArray(usecase.writesTables) ? usecase.writesTables : []).map(toTableRef);

    for (const ref of [...reads, ...writes]) {
      if (!ref) continue;
      // layer_4_entities coverage: a usecase table with no owning usecaseEntity group means the
      // derived entityRefs/contract will miss it (warning so the critic/repair adds the coverage).
      if (entityCoveredTables.size > 0 && !entityCoveredTables.has(ref.name)) {
        warnings.push(finding('warning', 'usecase.entityCoverage.missing', `usecase ${usecaseId} touches table ${ref.name}, which is not in any usecaseEntity sourceTables (no layer_4 entity will own it)`, path));
      }
      const isWrite = writes.some(write => write && write.name === ref.name);
      const metricTable = metricTableByName.get(ref.name);
      if (metricTable) {
        if (!isWrite) continue;
        writesMetricTable = true;
        // T-014: a usecase may write a metric table only when the write maps to an existing
        // measure (E-015: updateLeadNotes -> lead_metrics had no matching measure).
        const measures = Array.isArray(metricTable.measures) ? metricTable.measures : [];
        if (measures.length === 0) {
          errors.push(finding('error', 'usecase.metricWrite.noMeasure', `usecase ${usecaseId} writes metric table ${metricTable.metricTableId}, which declares no measures; remove the write or add the measure to the metrics index`, path));
        } else if (!metricWriteLooksJustified(usecaseId, metricTable)) {
          warnings.push(finding('warning', 'usecase.metricWrite.unjustified', `usecase ${usecaseId} writes metric table ${metricTable.metricTableId} but does not map to any of its measures/sourceWriteEvents; remove the write or propose the missing measure in the metrics index`, path));
        }
        continue;
      }
      // Only module-owned refs (or refs without declared ownership) must exist in the
      // persistence index; MDM/horizontal/plugin tables live elsewhere by design.
      const moduleOwned = !ref.ownership || ref.ownership === 'moduleOwned';
      if (!moduleOwned) continue;
      if (baseTableNames.size > 0 && !baseTableNames.has(ref.name)) {
        // T-005: a WRITE to a table missing from the persistence index can never materialize a
        // .defs.ts (E-003) — hard error. Unknown reads stay warnings (may target MDM references).
        if (isWrite) {
          errors.push(finding('error', 'usecase.writesTable.missing', `usecase ${usecaseId} writes to table ${ref.name}, which has no table in the persistence index`, path));
        } else {
          warnings.push(finding('warning', 'usecase.tableRef.unknown', `usecase ${usecaseId} references unknown table ${ref.name}`, path));
        }
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
- storageEngine must be postgresTimescaleDB for every metric table.
- Every metric table must include as dimensions the FKs of its source entities' direct ontology relationships (e.g. Deal related to Lead ⇒ the deal metric table needs a lead dimension) (T-013).`,
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
- persistenceRefs is the persistence SUPERSET (T-009): module-owned table ids PLUS the metric table ids the workflow writes. A metric table a workflow feeds MUST appear in BOTH persistenceRefs and metricRefs — do NOT flag a metric table present in persistenceRefs as an error. Do not include MDM/horizontal/plugin tables in persistenceRefs. usecaseRefs when layer_3 executes transitions; metricRefs lists the metric tables fed.
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
- usecaseHints and bffCommandHints[].name must reference usecaseIds that exist in the approved usecase plan; a page referencing a missing usecase is an error (T-007, never approve it).
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
      // incremental plan artifacts now persist the approved (possibly repaired) plugin plan.
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
- A usecase may write a metric table only when the write maps to one of its measures/sourceWriteEvents; purely descriptive edits (notes, comments) must not write metric tables (T-014).
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
      // incremental plan artifacts now persist the approved (possibly repaired) usecase plan.
      // A1–A3 (layer4.md §8): the entity catalog lets the writer gap-fill and enrich the
      // layer_4_entities defs deterministically (fields, storage binding, naming).
      await saveNewSolutionPlanArtifacts(context, 'agentPlanUsecaseEntities', indexStep, output, await buildEntityCatalogOptions(context));
    },
    createChildrenIntents: (context, output) => createUsecaseDefinitionParallelIntent(context, output as PlanUsecaseEntitiesOutput),
  },
};

/**
 * A1–A3 (layer4.md §8): catalog consumed by the layer_4_entities writer — built from the frozen
 * plan outputs available at usecasePlan approval time (persistence + metrics indices, MDM plan,
 * final plan ontology). Best-effort: missing sources just shrink the catalog.
 */
async function buildEntityCatalogOptions(context: mls.msg.ExecutionContext): Promise<SavePlanArtifactsOptions> {
  const finalPlan = getFinalPlanSafe(context);
  const persistence = safe(() => getPlanPersistenceIndexOutput(context));
  const metrics = safe(() => getPlanMetricsIndexOutput(context));
  const mdm = safe(() => getPlanMDMOutput(context));
  const ontologyEntities = finalPlan?.result.ontology.entities || {};
  // A5: tables of OTHER existing modules (maintenance/extension runs).
  const moduleName = typeof finalPlan?.result.module.moduleName === 'string' ? finalPlan.result.module.moduleName as string : '';
  const existingTables = moduleName ? await readExistingModuleTables(moduleName).catch(() => []) : [];

  const mdmEntities: EntityCatalogMdmEntity[] = [];
  const seen = new Set<string>();
  for (const domain of mdm?.result.mdmDomains || []) {
    for (const value of domain.masterEntities) {
      const entity = typeof value === 'string' ? value : '';
      if (!entity || seen.has(entity)) continue;
      seen.add(entity);
      const ontologyEntity = ontologyEntities[entity];
      const fields = ontologyEntity && typeof ontologyEntity === 'object' && Array.isArray((ontologyEntity as Record<string, unknown>).fields)
        ? (ontologyEntity as Record<string, unknown>).fields as unknown[]
        : [];
      mdmEntities.push({ entity, fields });
    }
  }

  return {
    entityCatalog: {
      ontologyEntities,
      tables: (persistence?.result.tables || []).map(table => ({
        tableId: table.tableId,
        tableName: table.tableName,
        rootEntity: table.rootEntity,
      })),
      metricTables: (metrics?.result.metricTables || []).map(metric => ({
        metricTableId: metric.metricTableId,
        tableName: metric.tableName,
        sourceEntities: metric.sourceEntities,
        timeColumn: metric.timeColumn,
        dimensions: metric.dimensions,
        measures: metric.measures,
      })),
      mdmEntities,
      existingTables,
    },
  };
}

export function getPlanIndexReviewConfig(indexName: string): PlanIndexReviewConfig {
  const config = reviewConfigs[indexName as PlanIndexName];
  if (!config) throw new Error(`[getPlanIndexReviewConfig] unknown plan index: ${indexName}`);
  return config;
}

export function buildEmptyHealthReport(): PlanIndexHealthReport {
  return { localErrors: [], localWarnings: [], criticErrors: [], criticWarnings: [], attempts: 0, notes: [] };
}

// T-017: deterministic finding codes whose repair is mechanical (referential integrity /
// id normalization / formulaic additions). When ALL local errors are in this set, the
// critic grants extra repair attempts — mechanical rounds do not consume the semantic
// MAX_PLAN_INDEX_CRITIC_ATTEMPTS budget (supports T-005, T-007, T-008, T-009, T-013, T-014).
export const MECHANICAL_FINDING_CODES = new Set([
  'persistence.entity.uncovered',
  'workflow.persistenceRef.unknown',
  'workflow.definition.index.mismatch',
  'page.navigationRef.unknown',
  'page.usecaseHint.missing',
  'page.bffCommandHint.usecaseMissing',
  'usecase.writesTable.missing',
  'usecase.metricWrite.noMeasure',
  'metrics.dimensions.missingRelationship',
  'metrics.widget.sourceUnknown',
]);

export const MECHANICAL_REPAIR_EXTRA_ATTEMPTS = 2;

/** T-017: max critic/repair attempts for the given local errors (extended when all mechanical). */
export function maxAttemptsForLocalErrors(errors: PlanIndexHealthFinding[], baseLimit: number): number {
  if (errors.length === 0) return baseLimit;
  const mechanicalOnly = errors.every(item => MECHANICAL_FINDING_CODES.has(item.code));
  return mechanicalOnly ? baseLimit + MECHANICAL_REPAIR_EXTRA_ATTEMPTS : baseLimit;
}

//#endregion
