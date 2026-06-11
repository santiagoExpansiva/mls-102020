/// <mls fileReference="_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { createStorFile, deleteFile } from '/_102027_/l2/libStor.js';
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
  // when true, the target module already exists; record a manifest reference
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

// trace policy. The first agent (agentNewSolution) seeds `_saveTrace` in the
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
    // skip trace persistence when disabled for this task (still log size telemetry).
    if (!shouldSaveTrace(context)) {
      logTaskSizeIfLarge(context, agentName);
      return;
    }
    const payload = step.interaction?.payload?.[0];
    if (!payload) return;

    // Do not write trace before the user approved the final module name in the clarification.
    // Until then there is no real folder to write into, and using a tentative/payload-derived name
    // creates duplicate module folders (e.g. propertyFlowCrm vs propertyflowCrm). Always use the
    // single authoritative approved name.
    const moduleName = moduleNameOverride
      ? normalizeModuleFolderName(moduleNameOverride, 'module')
      : getApprovedModuleName(context);
    if (!moduleName) {
      logTaskSizeIfLarge(context, agentName);
      return;
    }
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

  // size telemetry. Every agent calls this in afterPromptStep, so it is the
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
    console.warn(`[taskSize] CRITICAL ~${kb}KB after ${label} (ceiling ~400KB) — task may become unavailable; needs early payload cleanup (see strategic4Clean.md)`);
  } else if (bytes >= TASK_SIZE_WARN_BYTES) {
    console.warn(`[taskSize] WARN ~${kb}KB after ${label} (approaching ~400KB ceiling)`);
  }
}

// layer_4_entities catalog (layer4.md §8 / adjustments A1–A3): everything the writer needs to
// gap-fill and enrich entity defs deterministically — built from the frozen plan outputs.
export interface EntityCatalogTable { tableId: string; tableName: string; rootEntity: string }
export interface EntityCatalogMetricTable {
  metricTableId: string;
  tableName: string;
  sourceEntities: string[];
  timeColumn?: string;
  dimensions?: unknown[];
  measures?: unknown[];
}
export interface EntityCatalogMdmEntity { entity: string; fields: unknown[] }
export interface EntityCatalog {
  ontologyEntities: Record<string, unknown>;
  tables: EntityCatalogTable[];
  metricTables: EntityCatalogMetricTable[];
  mdmEntities: EntityCatalogMdmEntity[];
  // A5: tables persisted by OTHER existing modules (maintenance/extension runs) — entities over
  // them get a storage binding { kind: 'existingModule', moduleRef, ... } instead of mdm/local.
  existingTables?: ExistingModuleTable[];
}

export interface SavePlanArtifactsOptions {
  // Ontology entities (PascalCase id -> entity with fields) from the final plan. Used to enrich
  // MDM l1 reference artifacts with the entity shape for mock/usecase materialization.
  ontologyEntities?: Record<string, unknown>;
  // T-003: project id of the shared MDM infrastructure (e.g. '102034') when it is available.
  // When set, mdmDomain candidates become reference-only with moduleRef instead of module drafts.
  mdmInfrastructureModuleRef?: string;
  // A1–A3: catalog used by the layer_4 entity generation (gap-fill + fields + storage binding).
  entityCatalog?: EntityCatalog;
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

    // Single authoritative folder for the run (approved name). Do NOT re-derive from the step's own
    // LLM payload — that caused divergent module folders when agents disagreed on casing.
    const moduleName = runModuleName(context);
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

      // reference-only candidates (the target module already exists) are recorded
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
 * freeze an approved plan index as a checkpoint file plus manifest entry.
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
    const moduleName = runModuleName(context);
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
 * file-based reader for a frozen index checkpoint.
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
 * persist the final coverage validation as a non-blocking technical report.
 * The report lives in trace plus manifest; it must not block the end user at the end of the flow.
 */
export async function saveNewSolutionPlanHealthReport(
  context: mls.msg.ExecutionContext,
  agentName: string,
  step: mls.msg.AIAgentStep,
  report: Record<string, unknown>,
): Promise<void> {
  try {
    const moduleName = runModuleName(context);
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

// ─── Process file (l5/{module}/process.defs.ts) ────────────────────────────────
// Permanent, append-friendly record of the planning RUNS for a module. It lives in l5 (next to
// module.defs.ts) so it survives "clear traces" (which only wipes l2/{module}/trace/*). The
// newSolution run is written here at the end of the flow; future maintenance runs append.

export const PROCESS_SCHEMA_VERSION = '2026-06-08';

export type NewSolutionProcessNextStepKind = 'horizontalModule' | 'plugin' | 'materialize';
export type NewSolutionProcessNextStepStatus = 'pending' | 'taskOpened' | 'dismissed';

export interface NewSolutionProcessNextStep {
  id: string;
  kind: NewSolutionProcessNextStepKind;
  title: string;
  description: string;
  moduleId?: string;
  pluginId?: string;
  status: NewSolutionProcessNextStepStatus;
  taskId?: string;
}

export interface NewSolutionProcessRun {
  runId: string;
  kind: 'newSolution' | 'maintenance';
  startedAt: string;
  finishedAt?: string;
  initialPrompt: string;
  userLanguage: string;
  decisions: unknown[];
  deferredItems: unknown[];
  openDetails: { title: string; description: string }[];
  healthReport: unknown;
  nextSteps: NewSolutionProcessNextStep[];
}

export interface NewSolutionProcess {
  schemaVersion: string;
  moduleName: string;
  runs: NewSolutionProcessRun[];
}

function processFileInfo(moduleName: string): Pick<mls.stor.IFileInfo, 'project' | 'level' | 'folder' | 'shortName' | 'extension'> {
  return {
    project: mls.actualProject || 0,
    level: 5,
    folder: normalizeModuleFolderName(moduleName, 'module'),
    shortName: 'process',
    extension: '.defs.ts',
  };
}

/** Reads and parses l5/{module}/process.defs.ts, or null when it does not exist yet. */
export async function readNewSolutionProcess(moduleName: string): Promise<NewSolutionProcess | null> {
  try {
    const fileInfo = processFileInfo(moduleName);
    const file = mls.stor.files[mls.stor.getKeyToFile(fileInfo)];
    if (!file) return null;
    const raw = await file.getContent();
    if (typeof raw !== 'string') return null;
    const parsed = parsePlanArtifactSource(raw, '.defs.ts');
    if (!isRecord(parsed)) return null;
    const runs = Array.isArray(parsed.runs) ? (parsed.runs as NewSolutionProcessRun[]) : [];
    return {
      schemaVersion: readString(parsed.schemaVersion) || PROCESS_SCHEMA_VERSION,
      moduleName: readString(parsed.moduleName) || normalizeModuleFolderName(moduleName, 'module'),
      runs,
    };
  } catch (error) {
    console.warn(`[readNewSolutionProcess] failed for ${moduleName}`, error);
    return null;
  }
}

/**
 * Append-friendly writer for l5/{module}/process.defs.ts. Reads the existing file (if any),
 * replaces the run with the same runId or appends it, and rewrites the file. Idempotent per runId.
 */
export async function saveNewSolutionProcessRun(
  context: mls.msg.ExecutionContext,
  run: NewSolutionProcessRun,
): Promise<void> {
  const moduleName = normalizeModuleFolderName(getInitialModuleName(context), 'module');
  await writeNewSolutionProcessRun(moduleName, run);
}

/** Same as saveNewSolutionProcessRun but keyed by an explicit moduleName (no ExecutionContext).
 * Used by the front-end resume web component when finalizing the run. */
export async function writeNewSolutionProcessRun(
  moduleNameInput: string,
  run: NewSolutionProcessRun,
): Promise<void> {
  try {
    const moduleName = normalizeModuleFolderName(moduleNameInput, 'module');
    const existing = await readNewSolutionProcess(moduleName);
    const runs = existing?.runs ? [...existing.runs] : [];
    const index = runs.findIndex(r => r && r.runId === run.runId);
    if (index >= 0) runs[index] = run;
    else runs.push(run);

    const process: NewSolutionProcess = {
      schemaVersion: PROCESS_SCHEMA_VERSION,
      moduleName,
      runs,
    };

    const fileInfo = processFileInfo(moduleName);
    const source = buildPlanDefsSource(`${toExportIdentifier(moduleName)}Process`, process, fileInfo);
    await saveStorContent(fileInfo, source, false);

    await updatePlanArtifactsManifest(moduleName, [{
      artifactType: 'process',
      artifactId: 'process',
      moduleName,
      filePath: toPlanArtifactPath(fileInfo),
      project: fileInfo.project,
      level: fileInfo.level,
      folder: fileInfo.folder,
      shortName: fileInfo.shortName,
      extension: fileInfo.extension,
      checksum: checksumString(stableStringify(process)),
      schemaVersion: PROCESS_SCHEMA_VERSION,
      status: 'report',
      agentName: 'agentValidateSolutionCoverage',
      stepId: 0,
      planId: 'final-resume',
      savedAt: new Date().toISOString(),
    }]);
  } catch (error) {
    console.warn(`[saveNewSolutionProcessRun] failed`, error);
  }
}

/**
 * Deletes every file under l2/{module}/trace (the "clear traces" action). The permanent l5
 * artifacts (module/rules/process.defs.ts) are untouched. Uses libStor.deleteFile, so on
 * collab.codes the files are marked deleted until the PR (and hard-deleted when still 'new').
 * Returns the number of trace files removed.
 */
export async function deleteNewSolutionTraceFolder(moduleName: string): Promise<number> {
  const project = mls.actualProject || 0;
  const folder = `${normalizeModuleFolderName(moduleName, 'module')}/trace`;
  let removed = 0;
  for (const file of Object.values(mls.stor.files)) {
    if (file.project !== project || file.level !== 2 || file.folder !== folder) continue;
    try {
      await deleteFile(file);
      removed += 1;
    } catch (error) {
      console.warn(`[deleteNewSolutionTraceFolder] failed to delete ${file.shortName}`, error);
    }
  }
  return removed;
}

// The TENTATIVE module name picked by the root agentNewSolution LLM. It is only a suggestion /
// prompt default — NOT the final folder name. The final name is approved by the user in the
// requirements clarification (see getApprovedModuleName).
export function getInitialModuleName(context: mls.msg.ExecutionContext): string {
  if (!context.task) return 'module';
  const agentStep = getAgentStepByAgentName(context.task, 'agentNewSolution') as mls.msg.AIAgentStep | null;
  const payload = agentStep?.interaction?.payload?.[0] as mls.msg.AIFlexibleResultStep | undefined;
  const result = payload?.type === 'flexible' && payload.result && typeof payload.result === 'object'
    ? payload.result as NewSolutionInitialArtifactInfo
    : undefined;

  return result?.moduleName || normalizeModuleFolderName(undefined, result?.userPrompt || 'module');
}

/**
 * The module name APPROVED by the user in the requirements clarification (req-clarification-answer).
 * Returns null until that clarification is answered — before that point the run has no final module
 * name, so nothing must be written to disk (no trace, no reservation). When the clarification answer
 * omits a module name, it falls back to the root's tentative name (LLM suggestion / prompt default).
 * This is the single authoritative source for the run's folder, eliminating the divergence caused by
 * each step re-deriving the name from its own LLM payload.
 */
export function getApprovedModuleName(context: mls.msg.ExecutionContext): string | null {
  if (!context.task) return null;
  const reqStep = getAgentStepByAgentName(context.task, 'agentNewSolutionRequirements') as mls.msg.AIAgentStep | null;
  const answerStep = (reqStep?.nextSteps || []).find(s =>
    s.type === 'result' && (s as { planning?: { planId?: string } }).planning?.planId === 'req-clarification-answer'
  ) as mls.msg.AIResultStep | undefined;
  if (!answerStep?.result) return null;

  let chosen: string | undefined;
  try {
    const parsed = parseMaybeJson(answerStep.result);
    if (isRecord(parsed) && isRecord(parsed.answers)) chosen = readString(parsed.answers.moduleName);
  } catch {
    chosen = undefined;
  }
  return normalizeModuleFolderName(chosen || getInitialModuleName(context), 'module');
}

/** Authoritative module folder for the current run: the approved name once the clarification is
 * answered, otherwise the root's tentative name (for writers that only run post-clarification). */
function runModuleName(context: mls.msg.ExecutionContext): string {
  return getApprovedModuleName(context) || normalizeModuleFolderName(getInitialModuleName(context), 'module');
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
    // module.defs.ts keeps only module-level definition data. These are persisted elsewhere
    // and kept here would be redundant and hard to maintain after edits:
    //  - rules            -> rules.defs.ts (separate artifact pushed below)
    //  - userActions      -> captured by the page index / page definitions
    //  - approvedArtifacts -> each entry (pages, workflows, usecaseEntities, plugins, agents,
    //                         horizontalModules, mdm, metricTables, metricDashboards) is saved
    //                         as its own .defs.ts and/or frozen index checkpoint.
    // decisions/deferredItems also leave module.defs.ts: they describe the planning RUN, not the
    // module structure, and now live in l5/{module}/process.defs.ts (see saveNewSolutionProcessRun).
    // What remains is the purely structural module backbone: module, actors, capabilities,
    // ontology, relationships.
    const {
      rules: _rules,
      userActions: _userActions,
      approvedArtifacts: _approvedArtifacts,
      decisions: _decisions,
      deferredItems: _deferredItems,
      ...moduleData
    } = result;

    // A6 (layer4.md §8): module.defs.ts keeps the domain MAP only — entity id/title/description/
    // ownership/kind + relationships. Per-entity shapes (fields/statusEnum/lifecycleStates) are
    // canonical in l1/{module}/layer_4_entities/{entity}.defs.ts; keeping them here too caused
    // redundancy and drift on maintenance edits.
    const moduleDataSlim = { ...moduleData, ontology: slimOntologyForModuleDefs(moduleData.ontology) };

    const candidates: PlanArtifactCandidate[] = [
      {
        artifactType: 'module',
        artifactId: moduleName,
        exportName: 'modulePlan',
        moduleName,
        data: moduleDataSlim,
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
      // Use the authoritative run module name (module-owned table). Ignoring table.moduleId avoids
      // the LLM's casing drift creating a second module folder.
      moduleName,
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
      // Authoritative run module name (module-owned metric table); ignore metricTable.moduleId casing.
      moduleName,
      data: { metricTableDefinition: table, defsPlan: result.defsPlan },
    }];
  }

  if (agentName === 'agentPlanUsecaseDefinition') {
    // Per-usecase command signatures (input/output), produced by the parallel usecase-definition
    // fan-out. Persisted for the future materialization step; not consumed by the planning flow.
    const def = getRecord(result.usecaseDefinition);
    const id = readString(def?.usecaseId);
    if (!def || !id) return [];
    return [{
      artifactType: 'usecaseCommands',
      artifactId: id,
      exportName: `${toExportIdentifier(id)}Commands`,
      moduleName,
      data: { usecaseDefinition: def },
    }];
  }

  if (agentName === 'agentPlanUsecaseEntities') {
    const usecases = Array.isArray(result.usecases) ? result.usecases : [];
    const usecaseEntities = Array.isArray(result.usecaseEntities) ? result.usecaseEntities : [];

    // layer_4_entities (layer4.md §8, adjustments A1–A4/A6): each entity defs is the CANONICAL
    // domain shape (fields/types live here, not in l5/module.defs.ts) plus the storage binding
    // (local table in layer_1 or shared MDM 102034). Groups planned by the LLM are enriched;
    // every catalog table/metric/MDM entity not covered by a group is gap-filled
    // deterministically — the layer_4 is always complete, with zero extra LLM calls.
    const catalog = options?.entityCatalog;
    const ontologyEntities = isRecord(catalog?.ontologyEntities) ? catalog!.ontologyEntities : {};
    const project = mls.actualProject || 0;
    const usecaseRecords = usecases
      .map(item => getRecord(item))
      .filter((item): item is Record<string, unknown> => !!item);

    const tableByName = new Map<string, EntityCatalogTable>();
    for (const table of catalog?.tables || []) {
      tableByName.set(table.tableName, table);
      tableByName.set(table.tableId, table);
    }
    const metricByName = new Map<string, EntityCatalogMetricTable>();
    for (const metric of catalog?.metricTables || []) {
      metricByName.set(metric.tableName, metric);
      metricByName.set(metric.metricTableId, metric);
    }
    const mdmByKey = new Map<string, EntityCatalogMdmEntity>();
    const mdmNameVariants = (entity: string): string[] => {
      const snake = entity.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
      return [...new Set([entity, entity.toLowerCase(), snake])];
    };
    for (const mdmEntity of catalog?.mdmEntities || []) {
      for (const key of mdmNameVariants(mdmEntity.entity)) mdmByKey.set(key, mdmEntity);
    }
    // A5: tables of OTHER existing modules, matched by tableName/tableId/rootEntity variants.
    const existingByKey = new Map<string, ExistingModuleTable>();
    for (const existing of catalog?.existingTables || []) {
      const keys = new Set([existing.tableName, existing.tableId, ...(existing.rootEntity ? mdmNameVariants(existing.rootEntity) : [])]);
      for (const key of keys) if (key && !existingByKey.has(key)) existingByKey.set(key, existing);
    }

    const layer1FileRef = (shortName: string) => `_${project}_/l1/${moduleName}/layer_1_external/${toSafeShortName(shortName)}.defs.ts`;

    const resolveStorage = (tableName: string, ownership: string): Record<string, unknown> => {
      const table = tableByName.get(tableName);
      if (table) return { kind: 'moduleTable', tableId: table.tableId, tableName: table.tableName, fileRef: layer1FileRef(table.tableId) };
      const metric = metricByName.get(tableName);
      if (metric) return { kind: 'metricTable', metricTableId: metric.metricTableId, tableName: metric.tableName, fileRef: layer1FileRef(metric.metricTableId) };
      // A5: tables of another existing module take precedence over the MDM fallback when the
      // ownership says so (or when only the existing inventory resolves the name).
      const existing = existingByKey.get(tableName) || existingByKey.get(tableName.toLowerCase());
      if (existing && (ownership === 'existingModuleOwned' || !mdmByKey.has(tableName.toLowerCase()))) {
        return { kind: 'existingModule', moduleRef: existing.moduleId, tableId: existing.tableId, tableName: existing.tableName, fileRef: existing.fileRef };
      }
      const mdmEntity = mdmByKey.get(tableName) || mdmByKey.get(tableName.toLowerCase());
      if (mdmEntity) return { kind: 'mdm', moduleRef: '102034', entity: mdmEntity.entity, fileRef: layer1FileRef(mdmEntity.entity) };
      console.warn(`[buildPlanArtifactCandidates] layer_4 storage not resolved for table '${tableName}' (ownership: ${ownership || '?'})`);
      return { kind: 'unknown', tableName, ownership };
    };

    // A4: unified naming — defs file is {entityId}.defs.ts; class/contract are {Entity}Entity/I{Entity}Entity.
    const entityNaming = (entityId: string) => {
      const pascal = entityId.charAt(0).toUpperCase() + entityId.slice(1);
      const className = pascal.endsWith('Entity') ? pascal : `${pascal}Entity`;
      return { fileName: `layer_4_entities/${className}.ts`, className, contractName: `I${className}` };
    };

    // A2/A6: per-entity shape copied from the final plan ontology (canonical here from now on).
    const shapeFromOntology = (ontologyId: string | undefined): Record<string, unknown> => {
      const entity = ontologyId ? getRecord(ontologyEntities[ontologyId]) : undefined;
      if (!entity) return {};
      const shape: Record<string, unknown> = {};
      if (Array.isArray(entity.fields)) shape.fields = entity.fields;
      if (Array.isArray(entity.statusEnum)) shape.statusEnum = entity.statusEnum;
      if (Array.isArray(entity.lifecycleStates)) shape.lifecycleStates = entity.lifecycleStates;
      return shape;
    };

    const usecaseIdsTouching = (names: Set<string>): string[] => usecaseRecords
      .filter(usecase => [...usecaseTableNames(usecase)].some(name => names.has(name)))
      .map(usecase => readString(usecase.usecaseId) || '')
      .filter(Boolean);

    const someUsecaseWrites = (names: Set<string>): boolean => usecaseRecords
      .some(usecase => [...usecaseWriteTableNames(usecase)].some(name => names.has(name)));

    const entityIdsByTable = new Map<string, string[]>();
    const registerEntityTables = (entityId: string, names: Iterable<string>) => {
      for (const name of names) {
        const list = entityIdsByTable.get(name) || [];
        if (!list.includes(entityId)) list.push(entityId);
        entityIdsByTable.set(name, list);
      }
    };

    const entityCandidates: PlanArtifactCandidate[] = [];
    const coveredTables = new Set<string>();
    const usedEntityIds = new Set<string>();

    const pushEntity = (entityId: string, data: Record<string, unknown>) => {
      if (usedEntityIds.has(entityId)) return;
      usedEntityIds.add(entityId);
      entityCandidates.push({
        artifactType: 'entity',
        artifactId: entityId,
        exportName: 'entity',
        moduleName,
        bareExport: true,
        data: { ...data, materialization: entityNaming(entityId) },
      });
    };

    // ---- 1. groups planned by the LLM (enriched with shape + storage) ----------------------
    for (const value of usecaseEntities) {
      const entity = getRecord(value);
      const entityId = readString(entity?.usecaseEntityId);
      if (!entity || !entityId) continue;
      const sourceTables = Array.isArray(entity.sourceTables) ? entity.sourceTables : [];
      const tableNames: string[] = [];
      const storage: Record<string, unknown>[] = [];
      for (const tableValue of sourceTables) {
        const tableName = readString(getRecord(tableValue)?.tableName) || (typeof tableValue === 'string' ? tableValue : '');
        if (!tableName) continue;
        tableNames.push(tableName);
        const binding = resolveStorage(tableName, readString(getRecord(tableValue)?.ownership) || '');
        storage.push(binding);
        // mark BOTH spellings (physical name and canonical id) as covered, so the gap-fill
        // below does not duplicate this entity under another id.
        coveredTables.add(tableName);
        for (const key of ['tableId', 'metricTableId', 'tableName', 'entity']) {
          const alias = readString(binding[key]);
          if (alias) coveredTables.add(alias);
        }
      }
      registerEntityTables(entityId, tableNames);
      // shape only when the group maps to ONE ontology entity (single table); multi-table groups
      // keep storage refs only (each table defs carries its own physical shape).
      const single = storage.length === 1 ? storage[0] : undefined;
      const ontologyId = single?.kind === 'moduleTable'
        ? tableByName.get(tableNames[0])?.rootEntity
        : single?.kind === 'mdm' ? readString(single.entity) : undefined;
      const usecaseRefs = usecases
        .map(item => getRecord(item))
        .filter((usecase): usecase is Record<string, unknown> => !!usecase && usecaseTouchesEntityTables(usecase, sourceTables))
        .map(usecase => readString(usecase.usecaseId) || '')
        .filter(Boolean);
      pushEntity(entityId, {
        entityId,
        title: readString(entity.title) || entityId,
        purpose: readString(entity.purpose) || '',
        layer: 'layer_4_entities',
        ...shapeFromOntology(ontologyId),
        sourceTables,
        storage,
        allowedOperations: Array.isArray(entity.allowedOperations) ? entity.allowedOperations : [],
        rulesApplied: Array.isArray(entity.rulesApplied) ? entity.rulesApplied : [],
        usecaseRefs,
      });
    }

    // ---- 2. deterministic gap-fill (A1): one entity per uncovered table/metric/MDM ---------
    const lowerFirst = (value: string) => value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
    if (catalog) {
      for (const table of catalog.tables) {
        if (coveredTables.has(table.tableName) || coveredTables.has(table.tableId)) continue;
        const entityId = lowerFirst(table.rootEntity) || table.tableId;
        const names = new Set([table.tableName, table.tableId]);
        const ontologyEntity = getRecord(ontologyEntities[table.rootEntity]);
        registerEntityTables(entityId, names);
        pushEntity(entityId, {
          entityId,
          title: readString(ontologyEntity?.title) || table.rootEntity || table.tableId,
          purpose: `Operates table ${table.tableName} (gap-filled deterministically: no usecaseEntity group covered it)`,
          layer: 'layer_4_entities',
          ...shapeFromOntology(table.rootEntity),
          sourceTables: [{ tableName: table.tableName, ownership: 'moduleOwned' }],
          storage: [resolveStorage(table.tableName, 'moduleOwned')],
          allowedOperations: someUsecaseWrites(names) ? ['create', 'read', 'update', 'list'] : ['read', 'list'],
          rulesApplied: [],
          usecaseRefs: usecaseIdsTouching(names),
        });
      }
      for (const metric of catalog.metricTables) {
        if (coveredTables.has(metric.tableName) || coveredTables.has(metric.metricTableId)) continue;
        const entityId = metric.metricTableId;
        const names = new Set([metric.tableName, metric.metricTableId]);
        registerEntityTables(entityId, names);
        pushEntity(entityId, {
          entityId,
          title: metric.metricTableId,
          purpose: `Appends rows to metric table ${metric.tableName} (gap-filled deterministically)`,
          layer: 'layer_4_entities',
          metricShape: { timeColumn: metric.timeColumn, dimensions: metric.dimensions || [], measures: metric.measures || [] },
          sourceTables: [{ tableName: metric.tableName, ownership: 'moduleOwned' }],
          storage: [resolveStorage(metric.tableName, 'moduleOwned')],
          allowedOperations: ['record', 'list'],
          rulesApplied: [],
          usecaseRefs: usecaseIdsTouching(names),
        });
      }
      // A5: entities over tables of ANOTHER existing module — only when some usecase touches
      // them (the base module may have many tables this run never uses).
      for (const existing of catalog.existingTables || []) {
        const names = new Set([existing.tableName, existing.tableId, ...(existing.rootEntity ? mdmNameVariants(existing.rootEntity) : [])]);
        if ([...names].some(name => coveredTables.has(name))) continue;
        const usecaseRefs = usecaseIdsTouching(names);
        if (usecaseRefs.length === 0) continue;
        const entityId = existing.rootEntity ? lowerFirst(existing.rootEntity) : existing.tableId;
        for (const name of names) coveredTables.add(name);
        registerEntityTables(entityId, names);
        pushEntity(entityId, {
          entityId,
          title: existing.rootEntity || existing.tableId,
          purpose: `Operates table ${existing.tableName} of existing module ${existing.moduleId} (gap-filled deterministically)`,
          layer: 'layer_4_entities',
          ...shapeFromOntology(existing.rootEntity || undefined),
          sourceTables: [{ tableName: existing.tableName, ownership: 'existingModuleOwned' }],
          storage: [{ kind: 'existingModule', moduleRef: existing.moduleId, tableId: existing.tableId, tableName: existing.tableName, fileRef: existing.fileRef }],
          allowedOperations: someUsecaseWrites(names) ? ['create', 'read', 'update', 'list'] : ['read', 'list'],
          rulesApplied: [],
          usecaseRefs,
        });
      }
      for (const mdmEntity of catalog.mdmEntities) {
        const variants = mdmNameVariants(mdmEntity.entity);
        if (variants.some(name => coveredTables.has(name))) continue;
        const entityId = lowerFirst(mdmEntity.entity);
        const names = new Set(variants);
        registerEntityTables(entityId, names);
        pushEntity(entityId, {
          entityId,
          title: readString(getRecord(ontologyEntities[mdmEntity.entity])?.title) || mdmEntity.entity,
          purpose: `MDM-backed entity for ${mdmEntity.entity} (data lives in the shared MDM infrastructure, project 102034)`,
          layer: 'layer_4_entities',
          ...shapeFromOntology(mdmEntity.entity),
          sourceTables: [{ tableName: mdmEntity.entity, ownership: 'mdmOwned' }],
          storage: [{ kind: 'mdm', moduleRef: '102034', entity: mdmEntity.entity, fileRef: layer1FileRef(mdmEntity.entity) }],
          allowedOperations: someUsecaseWrites(names) ? ['read', 'list', 'update'] : ['read', 'list'],
          rulesApplied: [],
          usecaseRefs: usecaseIdsTouching(names),
        });
      }
    }

    // ---- 3. usecases with derived entityRefs ------------------------------------------------
    const usecaseCandidates = usecases.flatMap((value): PlanArtifactCandidate[] => {
      const usecase = getRecord(value);
      const id = readString(usecase?.usecaseId);
      if (!usecase || !id) return [];
      // Derived layer_4 references: entities whose tables intersect this usecase's
      // reads/writesTables. The L3 materializer imports the entity contracts from these refs.
      const entityRefs = collectUsecaseEntityRefs(usecase, entityIdsByTable);
      // The usecase .defs.ts exports the usecase object directly under a fixed name `useCase`
      // (every usecase file uses the same variable). No metadata envelope, and no global
      // backendArchitecture/controllerRules — those are not needed per usecase.
      return [{
        artifactType: 'usecase',
        artifactId: id,
        exportName: 'useCase',
        moduleName,
        bareExport: true,
        data: entityRefs.length > 0 ? { ...usecase, entityRefs } : usecase,
      }];
    });

    return [...entityCandidates, ...usecaseCandidates];
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

  // horizontal modules (finance, notifications, ...). Reference the module when
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

  // MDM domains. Same create-if-missing / reference-if-exists rule as horizontals
  // (decision: MDM also gets a draft l5/{domainId}/module.defs.ts when no module exists yet).
  // T-003: when the shared MDM infrastructure exists (options.mdmInfrastructureModuleRef, e.g.
  // '102034'), every domain is a reference to it — no l5/{domainId}/module.defs.ts draft (E-002/E-018).
  if (agentName === 'agentPlanMDM') {
    const domains = Array.isArray(result.mdmDomains) ? result.mdmDomains : [];
    const existingFolders = getExistingModuleFolders();
    const ontologyEntities = isRecord(options?.ontologyEntities) ? options!.ontologyEntities! : {};
    const infraModuleRef = readString(options?.mdmInfrastructureModuleRef) || '';
    const mdmCandidates = domains.flatMap((value): PlanArtifactCandidate[] => {
      const domain = getRecord(value);
      const id = readString(domain?.domainId);
      if (!domain || !id) return [];
      const folder = normalizeModuleFolderName(id, id);
      const referenceOnly = !!infraModuleRef || existingFolders.has(folder);
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
          ...(infraModuleRef ? { moduleRef: infraModuleRef } : {}),
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
            ...(infraModuleRef ? { infrastructureModuleRef: infraModuleRef } : {}), // T-003
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

    // T-004: when MDM domains resolve to the shared infrastructure, declare it as a project
    // dependency in l5/project.json (merged, never overwritten).
    if (infraModuleRef && mdmCandidates.length > 0) {
      mdmCandidates.push({
        artifactType: 'project',
        artifactId: 'project',
        exportName: 'projectPlan',
        moduleName,
        data: { dependencies: [{ projectId: infraModuleRef, kind: 'mdm-infrastructure' }] },
      });
    }
    return mdmCandidates;
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

// layer_4_entities helpers: usecase table refs may be strings (legacy) or { tableName, ownership }.
function usecaseTableNames(usecase: Record<string, unknown>): Set<string> {
  const names = new Set<string>();
  for (const key of ['readsTables', 'writesTables']) {
    const refs = Array.isArray(usecase[key]) ? usecase[key] as unknown[] : [];
    for (const ref of refs) {
      const name = typeof ref === 'string' ? ref : readString(getRecord(ref)?.tableName);
      if (name) names.add(name);
    }
  }
  return names;
}

// Same as usecaseTableNames, but writesTables only (used to derive allowedOperations in gap-fill).
function usecaseWriteTableNames(usecase: Record<string, unknown>): Set<string> {
  const names = new Set<string>();
  const refs = Array.isArray(usecase.writesTables) ? usecase.writesTables as unknown[] : [];
  for (const ref of refs) {
    const name = typeof ref === 'string' ? ref : readString(getRecord(ref)?.tableName);
    if (name) names.add(name);
  }
  return names;
}

function usecaseTouchesEntityTables(usecase: Record<string, unknown>, sourceTables: unknown[]): boolean {
  const names = usecaseTableNames(usecase);
  if (names.size === 0) return false;
  return sourceTables.some(tableValue => {
    const tableName = readString(getRecord(tableValue)?.tableName);
    return !!tableName && names.has(tableName);
  });
}

function collectUsecaseEntityRefs(usecase: Record<string, unknown>, entityIdsByTable: Map<string, string[]>): string[] {
  const refs: string[] = [];
  for (const tableName of usecaseTableNames(usecase)) {
    for (const entityId of entityIdsByTable.get(tableName) || []) {
      if (!refs.includes(entityId)) refs.push(entityId);
    }
  }
  return refs.sort();
}

// A6: ontology entities saved in l5/module.defs.ts keep only the map-level keys; shapes live in
// layer_4_entities defs. The in-task final plan payload is NOT affected (planning checks use it).
function slimOntologyForModuleDefs(value: unknown): unknown {
  const ontology = getRecord(value);
  const entities = getRecord(ontology?.entities);
  if (!ontology || !entities) return value;
  const slim: Record<string, unknown> = {};
  for (const [id, entityValue] of Object.entries(entities)) {
    const entity = getRecord(entityValue);
    if (!entity) {
      slim[id] = entityValue;
      continue;
    }
    const item: Record<string, unknown> = {};
    for (const key of ['entityId', 'title', 'description', 'ownership', 'kind']) {
      if (entity[key] !== undefined) item[key] = entity[key];
    }
    slim[id] = item;
  }
  return { ...ontology, entities: slim };
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
  // horizontal/MDM modules registered as l5/{moduleId}/module.defs.ts (drafts when
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
  if (candidate.artifactType === 'usecaseCommands') {
    return { project, level: 1, folder: `${candidate.moduleName}/layer_3_usecases`, shortName: `${shortName}-commands`, extension: '.defs.ts' };
  }
  // layer_4_entities contract defs (see mls-102045/layer4.md §8): one per usecaseEntity group.
  if (candidate.artifactType === 'entity') {
    return { project, level: 1, folder: `${candidate.moduleName}/layer_4_entities`, shortName, extension: '.defs.ts' };
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
 * file-based reader for saved plan artifacts of a given type.
 * Lets getters reconstruct outputs from the saved .defs.ts when the task payload was cleared
 * with cleaner="input_output". Reads the manifest, then each referenced artifact file, and
 * returns the inner `data` object of each artifact (idempotent, best-effort, never throws).
 */
export async function readSavedPlanArtifactDataList(
  context: mls.msg.ExecutionContext,
  artifactType: string,
): Promise<Record<string, unknown>[]> {
  try {
    const moduleName = runModuleName(context);
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

// A5: inventory of tables persisted by OTHER existing modules of this project. Used by the
// persistence index prompt (so maintenance runs exclude them as 'existingModuleOwned' instead of
// the 'mdmOwned' catch-all) and by the layer_4 entity writer (storage binding to the base module).
export interface ExistingModuleTable {
  moduleId: string;
  tableId: string;
  tableName: string;
  rootEntity: string;
  kind: 'transactional' | 'metricTimeseries';
  fileRef: string;
}

export async function readExistingModuleTables(currentModuleName: string): Promise<ExistingModuleTable[]> {
  const out: ExistingModuleTable[] = [];
  try {
    const project = mls.actualProject || 0;
    const current = normalizeModuleFolderName(currentModuleName, 'module');
    for (const file of Object.values(mls.stor.files)) {
      if (file.project !== project || file.level !== 1 || file.extension !== '.defs.ts') continue;
      if (file.status === 'deleted') continue;
      const match = /^([^/]+)\/layer_1_external$/.exec(file.folder);
      if (!match || match[1] === current) continue;
      const moduleId = match[1];
      try {
        const raw = await file.getContent();
        if (typeof raw !== 'string') continue;
        const artifact = parsePlanArtifactSource(raw, '.defs.ts');
        if (!isRecord(artifact)) continue;
        const data = isRecord(artifact.data) ? artifact.data : artifact;
        const table = getRecord(data.tableDefinition);
        const metric = getRecord(data.metricTableDefinition);
        const def = table || metric;
        if (!def) continue; // mdmEntity refs and other artifacts are not module tables
        const tableId = readString(table ? def.tableId : def.metricTableId) || file.shortName;
        out.push({
          moduleId,
          tableId,
          tableName: readString(def.tableName) || tableId,
          rootEntity: readString(def.rootEntity) || '',
          kind: table ? 'transactional' : 'metricTimeseries',
          fileRef: `_${project}_/l1/${moduleId}/layer_1_external/${file.shortName}${file.extension}`,
        });
      } catch {
        // unreadable file: skip silently (inventory is best-effort)
      }
    }
  } catch (error) {
    console.warn('[readExistingModuleTables] failed', error);
  }
  return out;
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

  // T-004: merge project dependencies (e.g. { projectId: '102034', kind: 'mdm-infrastructure' }),
  // deduped by projectId+kind, preserving existing entries.
  const existingDeps = Array.isArray(base.dependencies) ? base.dependencies.filter(isRecord) : [];
  const incomingDeps = Array.isArray(newData.dependencies) ? newData.dependencies.filter(isRecord) : [];
  const depsMap = new Map<string, Record<string, unknown>>();
  for (const dep of [...existingDeps, ...incomingDeps]) {
    depsMap.set(`${readString(dep.projectId)}:${readString(dep.kind)}`, dep);
  }

  const merged = {
    ...base,
    modules: [...moduleMap.values()],
    ...(depsMap.size > 0 ? { dependencies: [...depsMap.values()] } : {}),
  };
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
