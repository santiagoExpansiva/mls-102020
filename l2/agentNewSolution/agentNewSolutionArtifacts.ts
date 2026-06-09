/// <mls fileReference="_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { createStorFile } from '/_102027_/l2/libStor.js';
import { getAgentStepByAgentName } from '/_102027_/l2/aiAgentHelper.js';
import {
  normalizeModuleFolderName,
  reserveModuleNameFromFolders,
} from '/_102020_/l2/agentNewSolution/agentNewSolutionPlan.js';

export { normalizeModuleFolderName };

const PLAN_ARTIFACT_SCHEMA_VERSION = '2026-06-06';

export interface NewSolutionInitialArtifactInfo {
  moduleName?: string;
  requestKind?: string;
  userLanguage?: string;
  userPrompt?: string;
}

export interface PlanArtifactReference {
  artifactType: string;
  artifactId: string;
  moduleName: string;
  filePath: string;
  project: number;
  level: number;
  folder: string;
  shortName: string;
  extension: string;
  checksum: string;
  schemaVersion: string;
  status: 'draft' | 'not-ready' | 'frozen' | 'report' | 'reference';
  agentName: string;
  stepId: number;
  planId: string;
  savedAt: string;
}

interface PlanArtifactCandidate {
  artifactType: string;
  artifactId: string;
  exportName: string;
  moduleName: string;
  data: unknown;
  status?: PlanArtifactReference['status'];
  // TODO-FINAL-015: when true, the target module already exists; record a manifest reference
  // entry but do NOT create/overwrite the file.
  referenceOnly?: boolean;
  // When true, write `data` directly as the exported value (no metadata envelope). Used by
  // usecases: `export const useCase = {...} as const` — same variable name in every usecase file.
  bareExport?: boolean;
}

export function reserveAvailableModuleName(requestedName: unknown, fallbackPrompt: string): string {
  return reserveModuleNameFromFolders(requestedName, fallbackPrompt, getExistingModuleFolders());
}

export async function reserveNewSolutionModuleArtifacts(initial: NewSolutionInitialArtifactInfo): Promise<void> {
  const moduleName = normalizeModuleFolderName(initial.moduleName, initial.userPrompt || 'module');
  const source = `export const initial = ${JSON.stringify({
    moduleName,
    requestKind: initial.requestKind || 'module_solution',
    userLanguage: initial.userLanguage || 'en',
    userPrompt: initial.userPrompt || '',
    createdAt: new Date().toISOString(),
  }, null, 2)} as const;\n`;

  await saveStorContent({
    project: mls.actualProject || 0,
    level: 2,
    folder: moduleName,
    shortName: 'module',
    extension: '.defs.ts',
  }, source, false);
}

// TODO-FINAL-018: trace policy. The first agent (agentNewSolution) seeds `_saveTrace` in the
// task's longMemory (the `_` prefix keeps it OUT of the LLM prompt — see collab-messages
// appendLongTermMemoryToInteraction). Every agent consults it before writing a trace file.
// Default true; change SAVE_TRACE_DEFAULT in source to disable, or set the memory key per task.
export const SAVE_TRACE_DEFAULT = true;
export const SAVE_TRACE_MEMORY_KEY = '_saveTrace';

export function saveTraceMemorySeed(): Record<string, string> {
  return { [SAVE_TRACE_MEMORY_KEY]: String(SAVE_TRACE_DEFAULT) };
}

export function shouldSaveTrace(context: mls.msg.ExecutionContext): boolean {
  try {
    const longMemory = (context.task?.iaCompressed as { longMemory?: Record<string, string> } | undefined)?.longMemory;
    const flag = longMemory?.[SAVE_TRACE_MEMORY_KEY];
    if (flag === 'true') return true;
    if (flag === 'false') return false;
    return SAVE_TRACE_DEFAULT;
  } catch {
    return SAVE_TRACE_DEFAULT;
  }
}

export async function saveNewSolutionAgentTracePayload(
  context: mls.msg.ExecutionContext,
  agentName: string,
  step: mls.msg.AIAgentStep,
  moduleNameOverride?: string,
): Promise<void> {
  try {
    // TODO-FINAL-018: skip trace persistence when disabled for this task (still log size telemetry).
    if (!shouldSaveTrace(context)) {
      logTaskSizeIfLarge(context, agentName);
      return;
    }
    const payload = step.interaction?.payload?.[0];
    if (!payload) return;

    const moduleName = normalizeModuleFolderName(moduleNameOverride || getPayloadModuleName(payload) || getInitialModuleName(context), 'module');
    const trace = {
      savedAt: new Date().toISOString(),
      agentName,
      stepId: step.stepId,
      planning: (step as any).planning || null,
      status: step.status,
      payload,
    };

    await saveStorContent({
      project: mls.actualProject || 0,
      level: 2,
      folder: `${moduleName}/trace`,
      shortName: getTraceShortName(agentName, step.stepId),
      extension: '.json',
    }, JSON.stringify(trace, null, 2), false);
  } catch (error) {
    console.warn(`[saveNewSolutionAgentTracePayload] failed for ${agentName}`, error);
  }

  // TODO-FINAL-030 (R7): size telemetry. Every agent calls this in afterPromptStep, so it is the
  // single place to watch the task growing toward the ~400KB ceiling (above which the task can
  // become unavailable). Logs only; no behavior change.
  logTaskSizeIfLarge(context, agentName);
}

const TASK_SIZE_WARN_BYTES = 300_000;
const TASK_SIZE_CRITICAL_BYTES = 400_000;

/** Approximate serialized size of the task's AI tree (chars ~= bytes for mostly-ASCII). */
export function estimateTaskBytes(context: mls.msg.ExecutionContext): number {
  try {
    const ia = context.task?.iaCompressed;
    return ia ? JSON.stringify(ia).length : 0;
  } catch {
    return 0;
  }
}

export function logTaskSizeIfLarge(context: mls.msg.ExecutionContext, label: string): void {
  const bytes = estimateTaskBytes(context);
  const kb = Math.round(bytes / 1024);
  if (bytes >= TASK_SIZE_CRITICAL_BYTES) {
    console.warn(`[taskSize] CRITICAL ~${kb}KB after ${label} (ceiling ~400KB) — task may become unavailable; needs early payload cleanup (TODO-FINAL-030 R3-R6)`);
  } else if (bytes >= TASK_SIZE_WARN_BYTES) {
    console.warn(`[taskSize] WARN ~${kb}KB after ${label} (approaching ~400KB ceiling)`);
  }
}

export interface SavePlanArtifactsOptions {
  // Ontology entities (PascalCase id -> entity with fields) from the final plan. Used to enrich
  // MDM l1 reference artifacts with the entity shape for mock/usecase materialization.
  ontologyEntities?: Record<string, unknown>;
}

export async function saveNewSolutionPlanArtifacts(
  context: mls.msg.ExecutionContext,
  agentName: string,
  step: mls.msg.AIAgentStep,
  output: unknown,
  options?: SavePlanArtifactsOptions,
): Promise<PlanArtifactReference[]> {
  try {
    if (!isRecord(output) || output.status !== 'ok') return [];

    const moduleName = normalizeModuleFolderName(getModuleNameFromPlannerOutput(output) || getInitialModuleName(context), 'module');
    const planId = readString((step as any).planning?.planId) || '';
    const candidates = buildPlanArtifactCandidates(agentName, moduleName, output, options);
    if (candidates.length === 0) return [];

    const saved: PlanArtifactReference[] = [];
    for (const candidate of candidates) {
      const fileInfo = resolvePlanArtifactFileInfo(candidate);
      const status = candidate.referenceOnly ? 'reference' : (candidate.status || 'draft');
      const artifact = {
        schemaVersion: PLAN_ARTIFACT_SCHEMA_VERSION,
        artifactType: candidate.artifactType,
        artifactId: candidate.artifactId,
        moduleName: candidate.moduleName,
        status,
        source: {
          agentName,
          stepId: step.stepId,
          planId,
        },
        data: candidate.data,
      };
      // `bareExport` candidates (e.g. usecases) write the artifact object DIRECTLY, with a fixed
      // export name and no metadata envelope: `export const useCase = {...} as const`.
      const fileValue = candidate.bareExport ? candidate.data : artifact;
      const source = fileInfo.extension === '.json'
        ? `${JSON.stringify(fileValue, null, 2)}\n`
        : buildPlanDefsSource(candidate.exportName, fileValue, fileInfo);
      const checksum = checksumString(stableStringify(fileValue));

      // TODO-FINAL-015: reference-only candidates (the target module already exists) are recorded
      // in the manifest but never written, so we don't overwrite an existing module.
      if (!candidate.referenceOnly) {
        if (candidate.artifactType === 'project' && isRecord(candidate.data)) {
          // l5/project.json is the shared project configuration (orgName, designSystems, etc.).
          // Do a merge instead of overwrite: preserve all existing fields and only add/replace
          // the modules entry for this moduleName.
          await mergeAndSaveProjectJson(fileInfo, candidate.data);
        } else {
          await saveStorContent(fileInfo, source, false);
        }
      }

      saved.push({
        artifactType: candidate.artifactType,
        artifactId: candidate.artifactId,
        moduleName: candidate.moduleName,
        filePath: toPlanArtifactPath(fileInfo),
        project: fileInfo.project,
        level: fileInfo.level,
        folder: fileInfo.folder,
        shortName: fileInfo.shortName,
        extension: fileInfo.extension,
        checksum,
        schemaVersion: PLAN_ARTIFACT_SCHEMA_VERSION,
        status,
        agentName,
        stepId: step.stepId,
        planId,
        savedAt: new Date().toISOString(),
      });
    }

    await updatePlanArtifactsManifest(moduleName, saved);
    return saved;
  } catch (error) {
    console.warn(`[saveNewSolutionPlanArtifacts] failed for ${agentName}`, error);
    return [];
  }
}

export interface PlanIndexHealthFinding {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  path?: string;
}

export interface PlanIndexHealthReport {
  localErrors: PlanIndexHealthFinding[];
  localWarnings: PlanIndexHealthFinding[];
  criticErrors: PlanIndexHealthFinding[];
  criticWarnings: PlanIndexHealthFinding[];
  attempts: number;
  notes: string[];
}

/**
 * TODO-FINAL-023: freeze an approved plan index as a checkpoint file plus manifest entry.
 * The frozen file is the persisted source for getters that no longer want to rely on
 * the task payload (file-based fallback for future payload cleanup).
 */
export async function saveNewSolutionIndexCheckpoint(
  context: mls.msg.ExecutionContext,
  indexName: string,
  sourceAgentName: string,
  indexStep: mls.msg.AIAgentStep,
  output: unknown,
  healthReport: PlanIndexHealthReport,
): Promise<void> {
  try {
    const moduleName = normalizeModuleFolderName(getInitialModuleName(context), 'module');
    const planId = readString((indexStep as any).planning?.planId) || '';
    const checkpoint = {
      schemaVersion: PLAN_ARTIFACT_SCHEMA_VERSION,
      artifactType: 'indexCheckpoint',
      indexName,
      moduleName,
      status: 'frozen',
      approvedAt: new Date().toISOString(),
      source: {
        agentName: sourceAgentName,
        stepId: indexStep.stepId,
        planId,
      },
      healthReport,
      index: output,
    };

    const fileInfo = {
      project: mls.actualProject || 0,
      level: 2,
      folder: `${moduleName}/trace`,
      shortName: `checkpoint-${toSafeShortName(indexName)}`,
      extension: '.json',
    };
    const source = `${JSON.stringify(checkpoint, null, 2)}\n`;
    await saveStorContent(fileInfo, source, false);

    await updatePlanArtifactsManifest(moduleName, [{
      artifactType: 'indexCheckpoint',
      artifactId: indexName,
      moduleName,
      filePath: toPlanArtifactPath(fileInfo),
      project: fileInfo.project,
      level: fileInfo.level,
      folder: fileInfo.folder,
      shortName: fileInfo.shortName,
      extension: fileInfo.extension,
      checksum: checksumString(stableStringify(checkpoint)),
      schemaVersion: PLAN_ARTIFACT_SCHEMA_VERSION,
      status: 'frozen',
      agentName: sourceAgentName,
      stepId: indexStep.stepId,
      planId,
      savedAt: new Date().toISOString(),
    }]);
  } catch (error) {
    console.warn(`[saveNewSolutionIndexCheckpoint] failed for ${indexName}`, error);
  }
}

/**
 * TODO-FINAL-023: file-based reader for a frozen index checkpoint.
 * Allows getters/consumers to read approved indices from disk instead of task payloads
 * once the payload cleanup is enabled.
 */
export async function readNewSolutionIndexCheckpoint(moduleName: string, indexName: string): Promise<Record<string, unknown> | null> {
  try {
    const fileInfo = {
      project: mls.actualProject || 0,
      level: 2,
      folder: `${normalizeModuleFolderName(moduleName, 'module')}/trace`,
      shortName: `checkpoint-${toSafeShortName(indexName)}`,
      extension: '.json',
    };
    const key = mls.stor.getKeyToFile(fileInfo);
    const file = mls.stor.files[key];
    if (!file) return null;
    const content = parseMaybeJson(await file.getContent());
    return isRecord(content) ? content : null;
  } catch (error) {
    console.warn(`[readNewSolutionIndexCheckpoint] failed for ${indexName}`, error);
    return null;
  }
}

/**
 * TODO-FINAL-023/024: persist the final coverage validation as a non-blocking technical report.
 * The report lives in trace plus manifest; it must not block the end user at the end of the flow.
 */
export async function saveNewSolutionPlanHealthReport(
  context: mls.msg.ExecutionContext,
  agentName: string,
  step: mls.msg.AIAgentStep,
  report: Record<string, unknown>,
): Promise<void> {
  try {
    const moduleName = normalizeModuleFolderName(getInitialModuleName(context), 'module');
    const planId = readString((step as any).planning?.planId) || '';
    const document = {
      schemaVersion: PLAN_ARTIFACT_SCHEMA_VERSION,
      artifactType: 'planHealthReport',
      moduleName,
      savedAt: new Date().toISOString(),
      source: { agentName, stepId: step.stepId, planId },
      report,
    };
    const fileInfo = {
      project: mls.actualProject || 0,
      level: 2,
      folder: `${moduleName}/trace`,
      shortName: 'plan-health-report',
      extension: '.json',
    };
    await saveStorContent(fileInfo, `${JSON.stringify(document, null, 2)}\n`, false);

    await updatePlanArtifactsManifest(moduleName, [{
      artifactType: 'planHealthReport',
      artifactId: 'plan-health-report',
      moduleName,
      filePath: toPlanArtifactPath(fileInfo),
      project: fileInfo.project,
      level: fileInfo.level,
      folder: fileInfo.folder,
      shortName: fileInfo.shortName,
      extension: fileInfo.extension,
      checksum: checksumString(stableStringify(document)),
      schemaVersion: PLAN_ARTIFACT_SCHEMA_VERSION,
      status: 'report',
      agentName,
      stepId: step.stepId,
      planId,
      savedAt: new Date().toISOString(),
    }]);
  } catch (error) {
    console.warn(`[saveNewSolutionPlanHealthReport] failed`, error);
  }
}

function getInitialModuleName(context: mls.msg.ExecutionContext): string {
  if (!context.task) return 'module';
  const agentStep = getAgentStepByAgentName(context.task, 'agentNewSolution') as mls.msg.AIAgentStep | null;
  const payload = agentStep?.interaction?.payload?.[0] as mls.msg.AIFlexibleResultStep | undefined;
  const result = payload?.type === 'flexible' && payload.result && typeof payload.result === 'object'
    ? payload.result as NewSolutionInitialArtifactInfo
    : undefined;

  return result?.moduleName || normalizeModuleFolderName(undefined, result?.userPrompt || 'module');
}

function getPayloadModuleName(payload: unknown): string | undefined {
  const value = parseMaybeJson(payload);
  const direct = getModuleNameFromPlannerResult(value);
  if (direct) return direct;
  if (!isRecord(value)) return undefined;

  const flexibleResult = parseMaybeJson(value.result);
  const flexibleModule = getModuleNameFromPlannerResult(flexibleResult);
  if (flexibleModule) return flexibleModule;
  if (!isRecord(flexibleResult)) return undefined;

  const toolArguments = parseMaybeJson(flexibleResult.arguments);
  const toolModule = getModuleNameFromPlannerResult(toolArguments);
  if (toolModule) return toolModule;
  if (!isRecord(toolArguments)) return undefined;

  const plannerEnvelope = parseMaybeJson(toolArguments.result);
  const envelopeModule = getModuleNameFromPlannerResult(plannerEnvelope);
  if (envelopeModule) return envelopeModule;
  if (!isRecord(plannerEnvelope)) return undefined;

  return getModuleNameFromPlannerResult(plannerEnvelope.result);
}

function getModuleNameFromPlannerResult(value: unknown): string | undefined {
  const record = parseMaybeJson(value);
  if (!isRecord(record)) return undefined;

  return readString(record.moduleName)
    || readString(getRecord(record.module)?.moduleName)
    || readString(getRecord(record.persistenceScope)?.moduleId)
    || readString(getRecord(record.tableDefinition)?.moduleId)
    || readString(getRecord(record.metricTableDefinition)?.moduleId)
    || readString(getRecord(record.defsPlan)?.moduleId);
}

function getModuleNameFromPlannerOutput(output: Record<string, unknown>): string | undefined {
  const result = getRecord(output.result);
  return getModuleNameFromPlannerResult(result) || getModuleNameFromPlannerResult(output);
}

function buildPlanArtifactCandidates(agentName: string, moduleName: string, output: Record<string, unknown>, options?: SavePlanArtifactsOptions): PlanArtifactCandidate[] {
  const result = getRecord(output.result);
  if (!result) return [];

  if (agentName === 'agentFinalizeSolutionPlan') {
    const candidates: PlanArtifactCandidate[] = [
      {
        artifactType: 'module',
        artifactId: moduleName,
        exportName: 'modulePlan',
        moduleName,
        data: result,
      },
      {
        artifactType: 'project',
        artifactId: 'project',
        exportName: 'projectPlan',
        moduleName,
        data: buildProjectPlanData(moduleName, result),
      },
    ];

    const rules = Array.isArray(result.rules) ? result.rules : [];
    if (rules.length > 0) {
      candidates.push({
        artifactType: 'rules',
        artifactId: `${moduleName}Rules`,
        exportName: 'rulesPlan',
        moduleName,
        data: { moduleName, rules },
      });
    }
    return candidates;
  }

  if (agentName === 'agentPlanTableDefinition') {
    const table = getRecord(result.tableDefinition);
    const id = readString(table?.tableId);
    if (!table || !id) return [];
    return [{
      artifactType: 'table',
      artifactId: id,
      exportName: readString(getRecord(result.defsPlan)?.exportName) || `${toExportIdentifier(id)}TablePlan`,
      moduleName: normalizeModuleFolderName(readString(table.moduleId) || moduleName, moduleName),
      data: { tableDefinition: table, defsPlan: result.defsPlan },
    }];
  }

  if (agentName === 'agentPlanMetricTableDefinition') {
    const table = getRecord(result.metricTableDefinition);
    const id = readString(table?.metricTableId);
    if (!table || !id) return [];
    return [{
      artifactType: 'metricTable',
      artifactId: id,
      exportName: readString(getRecord(result.defsPlan)?.exportName) || `${toExportIdentifier(id)}MetricTablePlan`,
      moduleName: normalizeModuleFolderName(readString(table.moduleId) || moduleName, moduleName),
      data: { metricTableDefinition: table, defsPlan: result.defsPlan },
    }];
  }

  if (agentName === 'agentPlanUsecaseEntities') {
    const usecases = Array.isArray(result.usecases) ? result.usecases : [];
    return usecases.flatMap((value): PlanArtifactCandidate[] => {
      const usecase = getRecord(value);
      const id = readString(usecase?.usecaseId);
      if (!usecase || !id) return [];
      // The usecase .defs.ts exports the usecase object directly under a fixed name `useCase`
      // (every usecase file uses the same variable). No metadata envelope, and no global
      // backendArchitecture/controllerRules — those are not needed per usecase.
      return [{
        artifactType: 'usecase',
        artifactId: id,
        exportName: 'useCase',
        moduleName,
        bareExport: true,
        data: usecase,
      }];
    });
  }

  if (agentName === 'agentPlanWorkflowDefinition') {
    const workflow = getRecord(result.workflowDefinition);
    const id = readString(workflow?.workflowId);
    if (!workflow || !id) return [];
    return [{
      artifactType: 'workflow',
      artifactId: id,
      exportName: readString(getRecord(result.defsPlan)?.exportName) || `${toExportIdentifier(id)}WorkflowPlan`,
      moduleName,
      data: { workflowDefinition: workflow, defsPlan: result.defsPlan },
    }];
  }

  if (agentName === 'agentPlanPageDefinition') {
    const page = getRecord(result.pageDefinition);
    const id = readString(page?.pageId);
    if (!page || !id) return [];
    return [{
      artifactType: 'page',
      artifactId: id,
      exportName: `${toExportIdentifier(id)}PagePlan`,
      moduleName,
      data: { pageDefinition: page, bffCommands: result.bffCommands },
    }];
  }

  // TODO-FINAL-015: horizontal modules (finance, notifications, ...). Reference the module when
  // it already exists; otherwise create a draft l5/{id}/module.defs.ts with the intended shape.
  // Each horizontal module gets its own creation task later; the origin module references it.
  if (agentName === 'agentPlanHorizontals') {
    const modules = Array.isArray(result.horizontalModules) ? result.horizontalModules : [];
    const existingFolders = getExistingModuleFolders();
    return modules.flatMap((value): PlanArtifactCandidate[] => {
      const module = getRecord(value);
      const id = readString(module?.horizontalModuleId);
      if (!module || !id) return [];
      const folder = normalizeModuleFolderName(id, id);
      const referenceOnly = existingFolders.has(folder);
      return [{
        artifactType: 'horizontalModule',
        artifactId: id,
        exportName: `${toExportIdentifier(id)}ModulePlan`,
        moduleName: folder,
        referenceOnly,
        data: {
          kind: 'horizontal',
          moduleId: folder,
          horizontalModuleId: id,
          plannedByModule: moduleName,
          referencesExisting: referenceOnly,
          module,
        },
      }];
    });
  }

  // TODO-FINAL-015: MDM domains. Same create-if-missing / reference-if-exists rule as horizontals
  // (decision: MDM also gets a draft l5/{domainId}/module.defs.ts when no module exists yet).
  if (agentName === 'agentPlanMDM') {
    const domains = Array.isArray(result.mdmDomains) ? result.mdmDomains : [];
    const existingFolders = getExistingModuleFolders();
    const ontologyEntities = isRecord(options?.ontologyEntities) ? options!.ontologyEntities! : {};
    return domains.flatMap((value): PlanArtifactCandidate[] => {
      const domain = getRecord(value);
      const id = readString(domain?.domainId);
      if (!domain || !id) return [];
      const folder = normalizeModuleFolderName(id, id);
      const referenceOnly = existingFolders.has(folder);
      const candidates: PlanArtifactCandidate[] = [{
        artifactType: 'mdmDomain',
        artifactId: id,
        exportName: `${toExportIdentifier(id)}MdmModulePlan`,
        moduleName: folder,
        referenceOnly,
        data: {
          kind: 'mdm',
          moduleId: folder,
          domainId: id,
          plannedByModule: moduleName,
          referencesExisting: referenceOnly,
          domain,
        },
      }];

      // Per-masterEntity l1 reference in the CONSUMING module's layer_1_external. Flagged as MDM
      // and generateTable:false so it is NOT materialized as a physical table, but the entity
      // shape (from the ontology) is available for usecase materialization and l1 mock generation.
      const masterEntities = Array.isArray(domain.masterEntities) ? domain.masterEntities : [];
      const governanceRules = Array.isArray(domain.governanceRules) ? domain.governanceRules : [];
      for (const entityValue of masterEntities) {
        const entityName = readString(entityValue);
        if (!entityName) continue;
        const ontologyEntity = getRecord(ontologyEntities[entityName]);
        candidates.push({
          artifactType: 'mdmEntity',
          artifactId: entityName,
          exportName: `${toExportIdentifier(entityName)}Mdm`,
          moduleName,
          data: {
            kind: 'mdmEntity',
            entity: entityName,
            ownership: 'mdmOwned',
            generateTable: false,
            moduleId: moduleName,
            domainId: id,
            domainTitle: readString(domain.title),
            sourceOfTruth: readString(domain.sourceOfTruth),
            governanceRules,
            title: readString(ontologyEntity?.title) || entityName,
            description: readString(ontologyEntity?.description),
            fields: Array.isArray(ontologyEntity?.fields) ? ontologyEntity!.fields : [],
          },
        });
      }

      return candidates;
    });
  }

  if (agentName === 'agentPlanPlugins') {
    const plugins = Array.isArray(result.plugins) ? result.plugins : [];
    return plugins.flatMap((value): PlanArtifactCandidate[] => {
      const plugin = getRecord(value);
      const id = readString(plugin?.pluginId);
      if (!plugin || !id) return [];
      const candidates: PlanArtifactCandidate[] = [{
        artifactType: 'pluginConnection',
        artifactId: id,
        exportName: `${toExportIdentifier(id)}PluginConnectionPlan`,
        moduleName,
        data: { plugin },
      }];
      if (plugin.resolution === 'create_draft') {
        candidates.push({
          artifactType: 'pluginDraft',
          artifactId: id,
          exportName: `${toExportIdentifier(id)}PluginPlan`,
          moduleName,
          data: { plugin },
        });
      }
      return candidates;
    });
  }

  return [];
}

function buildProjectPlanData(moduleName: string, finalPlan: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: PLAN_ARTIFACT_SCHEMA_VERSION,
    modules: [{
      moduleName,
      module: finalPlan.module || null,
    }],
  };
}

function resolvePlanArtifactFileInfo(candidate: PlanArtifactCandidate): Pick<mls.stor.IFileInfo, 'project' | 'level' | 'folder' | 'shortName' | 'extension'> {
  const project = mls.actualProject || 0;
  const shortName = toSafeShortName(candidate.artifactId);

  if (candidate.artifactType === 'project') {
    return { project, level: 5, folder: '', shortName: 'project', extension: '.json' };
  }
  if (candidate.artifactType === 'module') {
    return { project, level: 5, folder: candidate.moduleName, shortName: 'module', extension: '.defs.ts' };
  }
  if (candidate.artifactType === 'rules') {
    return { project, level: 5, folder: candidate.moduleName, shortName: 'rules', extension: '.defs.ts' };
  }
  // TODO-FINAL-015: horizontal/MDM modules registered as l5/{moduleId}/module.defs.ts (drafts when
  // missing). Reference-only candidates resolve to the same canonical path without being written.
  if (candidate.artifactType === 'horizontalModule' || candidate.artifactType === 'mdmDomain') {
    return { project, level: 5, folder: candidate.moduleName, shortName: 'module', extension: '.defs.ts' };
  }
  if (candidate.artifactType === 'table' || candidate.artifactType === 'metricTable') {
    return { project, level: 1, folder: `${candidate.moduleName}/layer_1_external`, shortName, extension: '.defs.ts' };
  }
  // MDM entity reference lives in the consuming module's layer_1_external (generateTable:false).
  if (candidate.artifactType === 'mdmEntity') {
    return { project, level: 1, folder: `${candidate.moduleName}/layer_1_external`, shortName, extension: '.defs.ts' };
  }
  if (candidate.artifactType === 'usecase') {
    return { project, level: 1, folder: `${candidate.moduleName}/layer_3_usecases`, shortName, extension: '.defs.ts' };
  }
  if (candidate.artifactType === 'workflow') {
    return { project, level: 4, folder: 'workflows', shortName, extension: '.defs.ts' };
  }
  if (candidate.artifactType === 'page') {
    return { project, level: 2, folder: candidate.moduleName, shortName, extension: '.defs.ts' };
  }
  if (candidate.artifactType === 'pluginConnection') {
    return { project, level: 2, folder: `${candidate.moduleName}/plugins`, shortName, extension: '.defs.ts' };
  }
  if (candidate.artifactType === 'pluginDraft') {
    return { project, level: 2, folder: `plugins/${shortName}`, shortName: 'plugin', extension: '.defs.ts' };
  }

  return { project, level: 2, folder: `${candidate.moduleName}/trace`, shortName, extension: '.defs.ts' };
}

function planArtifactsManifestFileInfo(moduleName: string): Pick<mls.stor.IFileInfo, 'project' | 'level' | 'folder' | 'shortName' | 'extension'> {
  return {
    project: mls.actualProject || 0,
    level: 2,
    folder: `${moduleName}/trace`,
    shortName: 'plan-artifacts',
    extension: '.json',
  };
}

/**
 * TODO-FINAL-010/023: file-based reader for saved plan artifacts of a given type.
 * Lets getters reconstruct outputs from the saved .defs.ts when the task payload was cleared
 * with cleaner="input_output". Reads the manifest, then each referenced artifact file, and
 * returns the inner `data` object of each artifact (idempotent, best-effort, never throws).
 */
export async function readSavedPlanArtifactDataList(
  context: mls.msg.ExecutionContext,
  artifactType: string,
): Promise<Record<string, unknown>[]> {
  try {
    const moduleName = normalizeModuleFolderName(getInitialModuleName(context), 'module');
    const manifestFile = mls.stor.files[mls.stor.getKeyToFile(planArtifactsManifestFileInfo(moduleName))];
    if (!manifestFile) return [];
    const manifest = parseMaybeJson(await manifestFile.getContent());
    const references = isRecord(manifest) && Array.isArray(manifest.artifacts) ? manifest.artifacts.filter(isRecord) : [];

    const out: Record<string, unknown>[] = [];
    for (const reference of references) {
      if (readString(reference.artifactType) !== artifactType) continue;
      const data = await readPlanArtifactData(reference);
      if (data) out.push(data);
    }
    return out;
  } catch (error) {
    console.warn(`[readSavedPlanArtifactDataList] failed for ${artifactType}`, error);
    return [];
  }
}

async function readPlanArtifactData(reference: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const project = typeof reference.project === 'number' ? reference.project : (mls.actualProject || 0);
  const level = typeof reference.level === 'number' ? reference.level : 2;
  const folder = readString(reference.folder) ?? '';
  const shortName = readString(reference.shortName);
  const extension = readString(reference.extension) || '.defs.ts';
  if (!shortName) return null;

  const file = mls.stor.files[mls.stor.getKeyToFile({ project, level, folder, shortName, extension })];
  if (!file) return null;

  const raw = await file.getContent();
  if (typeof raw !== 'string') return null;
  const artifact = parsePlanArtifactSource(raw, extension);
  if (!isRecord(artifact)) return null;
  return isRecord(artifact.data) ? artifact.data : artifact;
}

/** Extracts the artifact object from a saved file: raw JSON for .json, or the object literal
 * inside `export const X = {...} as const;` for .defs.ts. */
function parsePlanArtifactSource(content: string, extension: string): unknown {
  if (extension === '.json') return parseMaybeJson(content);
  const start = content.indexOf('= ');
  const end = content.lastIndexOf(' as const;');
  if (start === -1 || end === -1 || end <= start) return null;
  return parseMaybeJson(content.slice(start + 2, end));
}

async function updatePlanArtifactsManifest(moduleName: string, references: PlanArtifactReference[]): Promise<void> {
  if (references.length === 0) return;

  const fileInfo = planArtifactsManifestFileInfo(moduleName);
  const key = mls.stor.getKeyToFile(fileInfo);
  const existingFile = mls.stor.files[key];
  const existing = existingFile ? parseMaybeJson(await existingFile.getContent()) : undefined;
  const manifest = isRecord(existing) ? existing : {};
  const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts.filter(isRecord) : [];
  const byKey = new Map<string, Record<string, unknown>>();

  for (const artifact of artifacts) {
    const key = `${readString(artifact.artifactType) || ''}:${readString(artifact.artifactId) || ''}:${readString(artifact.filePath) || ''}`;
    if (key !== '::') byKey.set(key, artifact);
  }
  for (const reference of references) {
    byKey.set(`${reference.artifactType}:${reference.artifactId}:${reference.filePath}`, reference as unknown as Record<string, unknown>);
  }

  const nextManifest = {
    schemaVersion: PLAN_ARTIFACT_SCHEMA_VERSION,
    moduleName,
    updatedAt: new Date().toISOString(),
    artifacts: [...byKey.values()].sort((a, b) => String(a.filePath || '').localeCompare(String(b.filePath || ''))),
  };

  await saveStorContent(fileInfo, JSON.stringify(nextManifest, null, 2), false);
}

function buildPlanDefsSource(
  exportName: string,
  artifact: unknown,
  fileInfo: Pick<mls.stor.IFileInfo, 'project' | 'level' | 'folder' | 'shortName' | 'extension'>,
): string {
  const safeExportName = toExportIdentifier(exportName || 'planArtifact');
  const serialized = JSON.stringify(artifact, null, 2);
  // Every .defs.ts must start with the mls file-reference triple-slash. createStorFile only
  // injects it for level-2 files (and hardcodes l2 in the path), so l1/l4/l5 artifacts would
  // otherwise be saved without it. Emit it here with the artifact's real level/folder.
  const header = buildDefsTripleSlash(fileInfo);
  return `${header}export const ${safeExportName} = ${serialized} as const;\n\nexport default ${safeExportName};\n`;
}

function buildDefsTripleSlash(
  fileInfo: Pick<mls.stor.IFileInfo, 'project' | 'level' | 'folder' | 'shortName' | 'extension'>,
): string {
  const folder = fileInfo.folder ? `${fileInfo.folder}/` : '';
  const reference = `_${fileInfo.project}_/l${fileInfo.level}/${folder}${fileInfo.shortName}${fileInfo.extension}`;
  return `/// <mls fileReference="${reference}" enhancement="_blank"/>\n\n`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function checksumString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function toPlanArtifactPath(fileInfo: Pick<mls.stor.IFileInfo, 'level' | 'folder' | 'shortName' | 'extension'>): string {
  const folder = fileInfo.folder ? `${fileInfo.folder}/` : '';
  return `l${fileInfo.level}/${folder}${fileInfo.shortName}${fileInfo.extension}`;
}

function toSafeShortName(value: string): string {
  const safe = value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return safe || 'artifact';
}

function toExportIdentifier(value: string): string {
  const words = value.trim().split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const joined = words.length > 0
    ? words.map((word, index) => index === 0 ? word : `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`).join('')
    : 'planArtifact';
  const clean = joined.replace(/[^a-zA-Z0-9_$]/g, '');
  const prefixed = /^[a-zA-Z_$]/.test(clean) ? clean : `_${clean}`;
  return prefixed || 'planArtifact';
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getExistingModuleFolders(): Set<string> {
  const actualProject = mls.actualProject || 0;
  const topLevel = new Set<string>();

  for (const f of Object.values(mls.stor.files)) {
    if (f.project !== actualProject || f.level === 3 || !f.folder) continue;
    const firstPart = f.folder.split('/')[0];
    if (firstPart) topLevel.add(firstPart);
  }

  return topLevel;
}

function getTraceShortName(agentName: string, stepId: number): string {
  const safeAgentName = agentName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${String(stepId).padStart(3, '0')}-${safeAgentName || 'agent'}`;
}

/**
 * Merge-save for l5/project.json: reads the existing file, preserves all top-level
 * fields (orgName, designSystems, languages, etc.) and only adds/replaces the
 * modules entry for the incoming moduleName. Never overwrites unrelated modules.
 */
async function mergeAndSaveProjectJson(
  fileInfo: Pick<mls.stor.IFileInfo, 'project' | 'level' | 'folder' | 'shortName' | 'extension'>,
  newData: Record<string, unknown>,
): Promise<void> {
  const key = mls.stor.getKeyToFile(fileInfo);
  const existingFile = mls.stor.files[key];
  const existingRaw = existingFile ? await existingFile.getContent() : undefined;
  const existing = typeof existingRaw === 'string' ? parseMaybeJson(existingRaw) : undefined;
  const base: Record<string, unknown> = isRecord(existing) ? { ...existing } : {};

  // Build a map of existing modules keyed by moduleName, then overlay incoming modules.
  const existingModules = Array.isArray(base.modules) ? base.modules.filter(isRecord) : [];
  const incomingModules = Array.isArray(newData.modules) ? newData.modules.filter(isRecord) : [];

  const moduleMap = new Map<string, Record<string, unknown>>();
  for (const m of existingModules) {
    const name = readString(m.moduleName);
    if (name) moduleMap.set(name, m);
  }
  for (const m of incomingModules) {
    const name = readString(m.moduleName);
    if (name) moduleMap.set(name, m); // add or replace
  }

  const merged = { ...base, modules: [...moduleMap.values()] };
  await saveStorContent(fileInfo, `${JSON.stringify(merged, null, 2)}\n`, false);
}

async function saveStorContent(
  fileInfo: Pick<mls.stor.IFileInfo, 'project' | 'level' | 'folder' | 'shortName' | 'extension'>,
  source: string,
  needCreateModel: boolean,
): Promise<void> {
  const key = mls.stor.getKeyToFile(fileInfo);
  let storFile = mls.stor.files[key];

  if (!storFile) {
    storFile = await createStorFile({ ...fileInfo, source }, needCreateModel, needCreateModel, false);
  } else if (needCreateModel) {
    const model = await storFile.getOrCreateModel();
    if (model?.model) model.model.setValue(source);
  }

  await mls.stor.localStor.setContent(storFile, { contentType: 'string', content: source });
}
