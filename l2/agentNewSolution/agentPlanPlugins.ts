/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanPlugins.ts" enhancement="_102027_/l2/enhancementAgent"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import {
  PlannerOutput,
  Priority,
  assertArray,
  assertPriority,
  assertRecord,
  assertString,
  createHoldIndexForReviewIntents,
  createPlannerPromptReadyIntent,
  createPlannerVariableToolSchema,
  createPlannerUpdateStatusIntent,
  extractPlannerOutput,
  getPlannerOutputWithRepair,
  getPlanningContextSnapshot,
  hasAcceptedArtifact,
  normalizeStringList,
  optionalString,
} from '/_102020_/l2/agentNewSolution/agentPlanningShared.js';
import { getFinalizeSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import type { FinalSolutionPlanOutput } from '/_102020_/l2/agentNewSolution/agentFinalizeSolutionPlan.js';
import { saveNewSolutionAgentTracePayload, saveNewSolutionPlanArtifacts } from '/_102020_/l2/agentNewSolution/agentNewSolutionArtifacts.js';
import type { PluginCatalogDefinition, PluginCatalogItem } from '/_102020_/l2/agentNewSolution/pluginCatalog.defs.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: 'agentPlanPlugins',
    agentProject: 102020,
    agentFolder: 'agentNewSolution',
    agentDescription: 'Plan approved external plugins for the final solution',
    visibility: 'private',
    beforePromptStep,
    afterPromptStep,
  };
}

export const PLAN_PLUGINS_TOOL_NAME = 'submitPluginPlan';
export const PLAN_PLUGINS_STEP_ID = '11-plan-plugins';
const PLAN_PLUGINS_ALIASES = [PLAN_PLUGINS_STEP_ID, 'plan-plugins'];

export type PluginResolution = 'existing' | 'create_draft';

export interface PluginPlan {
  pluginId: string;
  provider: string;
  priority: Priority;
  reason: string;
  events: string[];
  requiredCredentials: string[];
  inputData: string[];
  outputData: string[];
  webhooks: string[];
  risks: string[];
  questions: string[];
  resolution: PluginResolution;
  pluginDefsFileRef: string;
  moduleConnectionDefsFileRef: string;
  sourceProject?: number;
}

export interface PlanPluginsResult {
  plugins: PluginPlan[];
}

export type PlanPluginsOutput = PlannerOutput<PlanPluginsResult>;

export const PLAN_PLUGINS_RESULT_SCHEMA: Record<string, unknown> = {
    type: 'object',
    additionalProperties: false,
    required: ['plugins'],
    properties: {
      plugins: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'pluginId',
            'provider',
            'priority',
            'reason',
            'events',
            'requiredCredentials',
            'inputData',
            'outputData',
            'webhooks',
            'risks',
            'questions',
            'resolution',
            'pluginDefsFileRef',
            'moduleConnectionDefsFileRef',
          ],
          properties: {
            pluginId: { type: 'string' },
            provider: { type: 'string' },
            priority: { enum: ['now', 'soon', 'later', 'never'] },
            reason: { type: 'string' },
            events: { type: 'array', items: { type: 'string' } },
            requiredCredentials: { type: 'array', items: { type: 'string' } },
            inputData: { type: 'array', items: { type: 'string' } },
            outputData: { type: 'array', items: { type: 'string' } },
            webhooks: { type: 'array', items: { type: 'string' } },
            risks: { type: 'array', items: { type: 'string' } },
            questions: { type: 'array', items: { type: 'string' } },
            resolution: { enum: ['existing', 'create_draft'] },
            pluginDefsFileRef: { type: 'string' },
            moduleConnectionDefsFileRef: { type: 'string' },
            sourceProject: { type: 'number' },
          },
        },
      },
    },
};

const planPluginsToolSchema = createPlannerVariableToolSchema(
  PLAN_PLUGINS_TOOL_NAME,
  'Submit external plugin planning for the newSolution final plan.',
  PLAN_PLUGINS_RESULT_SCHEMA
);

async function beforePromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
  args?: string,
): Promise<mls.msg.AgentIntent[]> {
  if (!agent || !step) throw new Error('[agentPlanPlugins](beforePromptStep) invalid params');
  if (!args) throw new Error(`[${agent.agentName}](beforePromptStep) args invalid`);
  if (!context.task) throw new Error(`[${agent.agentName}](beforePromptStep) task invalid`);

  const finalPlan = getFinalizeSolutionPlanOutput(context);
  const snapshot = getPlanningContextSnapshot(context);
  const moduleName = getFinalPlanModuleName(finalPlan);
  const catalog = await buildRuntimePluginCatalog(finalPlan, snapshot);
  const inventory = await buildPluginInventory(moduleName, catalog);
  return [
    createPlannerPromptReadyIntent(
      context,
      parentStep,
      hookSequential,
      args,
      systemPrompt.split('{{toolName}}').join(PLAN_PLUGINS_TOOL_NAME),
      buildHumanPrompt(args, finalPlan, snapshot, catalog, inventory),
      planPluginsToolSchema,
      PLAN_PLUGINS_TOOL_NAME
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
  let output: PlanPluginsOutput | undefined;

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    output = extractPlanPluginsOutput(payload);
    validatePlanPluginsOutput(output, context);
    if (output.status === 'failed') {
      status = 'failed';
      traceMsg = 'agentPlanPlugins returned status failed';
    } else if (output.status === 'needs_input') {
      traceMsg = 'agentPlanPlugins returned status needs_input; keeping plugin plan draft.';
    }
  } catch (error) {
    status = 'failed';
    traceMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${agent.agentName}](afterPromptStep) ${traceMsg}`);
  }

  await saveNewSolutionAgentTracePayload(context, agent.agentName, step);

  // /024: hold the step open and run critic/repair before approving the plugin plan.
  // The incremental artifact save moves to the critic approval path (possibly with a repaired plan).
  if (status === 'completed' && output && output.status === 'ok') {
    return createHoldIndexForReviewIntents(context, parentStep, step, hookSequential, 'pluginPlan');
  }

  if (status === 'completed' && output) await saveNewSolutionPlanArtifacts(context, agent.agentName, step, output);

  return [createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined)];
}

export function getPlanPluginsOutput(context: mls.msg.ExecutionContext): PlanPluginsOutput {
  // prefer the latest repaired index when a repair step exists.
  return getPlannerOutputWithRepair(context, 'agentPlanPlugins', 'pluginPlan', planPluginsConfig, output => validatePlanPluginsOutput(output, context));
}

function extractPlanPluginsOutput(payload: unknown): PlanPluginsOutput {
  return extractPlannerOutput(payload, planPluginsConfig);
}

export const planPluginsConfig = {
  toolName: PLAN_PLUGINS_TOOL_NAME,
  stepId: PLAN_PLUGINS_STEP_ID,
  stepIdAliases: PLAN_PLUGINS_ALIASES,
  normalizeResult: normalizePlanPluginsResult,
};

export function normalizePlanPluginsResult(value: unknown): PlanPluginsResult {
  const result = assertRecord(value, 'result');
  return {
    plugins: assertArray(result.plugins, 'result.plugins').map((item, index) => normalizePlugin(item, `result.plugins[${index}]`)),
  };
}

function normalizePlugin(value: unknown, path: string): PluginPlan {
  const item = assertRecord(value, path);
  return {
    pluginId: assertString(item.pluginId, `${path}.pluginId`),
    provider: assertString(item.provider, `${path}.provider`),
    priority: assertPriority(item.priority, `${path}.priority`),
    reason: assertString(item.reason, `${path}.reason`),
    events: assertArray(item.events, `${path}.events`).map((value, index) => assertString(value, `${path}.events[${index}]`)),
    requiredCredentials: assertArray(item.requiredCredentials, `${path}.requiredCredentials`).map((value, index) => assertString(value, `${path}.requiredCredentials[${index}]`)),
    inputData: assertArray(item.inputData, `${path}.inputData`).map((value, index) => assertString(value, `${path}.inputData[${index}]`)),
    outputData: assertArray(item.outputData, `${path}.outputData`).map((value, index) => assertString(value, `${path}.outputData[${index}]`)),
    webhooks: assertArray(item.webhooks, `${path}.webhooks`).map((value, index) => assertString(value, `${path}.webhooks[${index}]`)),
    risks: assertArray(item.risks, `${path}.risks`).map((value, index) => assertString(value, `${path}.risks[${index}]`)),
    questions: normalizeStringList(item.questions, `${path}.questions`),
    resolution: normalizePluginResolution(item.resolution, `${path}.resolution`) || 'create_draft',
    pluginDefsFileRef: optionalString(item.pluginDefsFileRef, `${path}.pluginDefsFileRef`) || '',
    moduleConnectionDefsFileRef: optionalString(item.moduleConnectionDefsFileRef, `${path}.moduleConnectionDefsFileRef`) || '',
    sourceProject: optionalNumber(item.sourceProject, `${path}.sourceProject`),
  };
}

export function validatePlanPluginsOutput(output: PlanPluginsOutput, context: mls.msg.ExecutionContext): void {
  const finalPlan = getFinalizeSolutionPlanOutput(context);
  const snapshot = getPlanningContextSnapshot(context);
  const catalog = buildRuntimePluginCatalogSync(finalPlan, snapshot);
  const allowedById = new Map(catalog.plugins.map(item => [item.pluginId, item]));
  const moduleName = getFinalPlanModuleName(finalPlan);
  const inventory = buildPluginInventorySync(moduleName, catalog);
  const inventoryById = new Map(inventory.plugins.map(item => [item.pluginId, item]));
  const acceptedPluginDecisions = getAcceptedPluginDecisions(snapshot);

  for (const plugin of output.result.plugins) {
    const catalogItem = allowedById.get(plugin.pluginId);
    if (!catalogItem) throw new Error(`unknown pluginId: ${plugin.pluginId}`);
    if (toPluginId(catalogItem.provider) !== toPluginId(plugin.provider)) throw new Error(`plugin provider mismatch for ${plugin.pluginId}: ${plugin.provider}`);

    const expected = inventoryById.get(plugin.pluginId);
    if (!expected) throw new Error(`missing plugin inventory for ${plugin.pluginId}`);

    plugin.resolution = plugin.resolution || expected.resolution;
    plugin.pluginDefsFileRef = plugin.pluginDefsFileRef || expected.pluginDefsFileRef;
    plugin.moduleConnectionDefsFileRef = plugin.moduleConnectionDefsFileRef || expected.moduleConnectionDefsFileRef;
    plugin.sourceProject = plugin.sourceProject ?? expected.sourceProject;

    if (plugin.resolution !== expected.resolution) throw new Error(`invalid resolution for ${plugin.pluginId}: ${plugin.resolution}`);
    if (plugin.pluginDefsFileRef !== expected.pluginDefsFileRef) throw new Error(`invalid pluginDefsFileRef for ${plugin.pluginId}: ${plugin.pluginDefsFileRef}`);
    if (plugin.moduleConnectionDefsFileRef !== expected.moduleConnectionDefsFileRef) throw new Error(`invalid moduleConnectionDefsFileRef for ${plugin.pluginId}: ${plugin.moduleConnectionDefsFileRef}`);
    if (expected.resolution === 'existing' && plugin.sourceProject !== expected.sourceProject) {
      throw new Error(`invalid sourceProject for existing plugin ${plugin.pluginId}: ${plugin.sourceProject}`);
    }
  }
  if (output.status === 'ok' && acceptedPluginDecisions.length > 0 && output.result.plugins.length === 0 && output.questions.length > 0) {
    const normalizedTrace = 'Status normalized to needs_input because accepted plugins were blocked and top-level questions were returned.';
    output.status = 'needs_input';
    if (!output.trace.includes(normalizedTrace)) output.trace.push(normalizedTrace);
  }
  if (output.status === 'ok' && hasAcceptedArtifact(snapshot.implementationDecisions, 'plugin') && output.result.plugins.length === 0) {
    throw new Error('plugin was accepted, but plugins output is empty');
  }
  const hasPluginQuestions = output.result.plugins.some(plugin => plugin.questions.length > 0);
  if (output.status === 'needs_input' && output.questions.length === 0 && !hasPluginQuestions) {
    throw new Error('needs_input plugin plan must include top-level or per-plugin questions');
  }
}

function buildHumanPrompt(
  args: string,
  finalPlan: FinalSolutionPlanOutput,
  snapshot: ReturnType<typeof getPlanningContextSnapshot>,
  catalog: PluginCatalogDefinition,
  inventory: PluginInventory,
): string {
  const promptContext = buildPluginPromptContext(args, finalPlan, snapshot, catalog, inventory);
  return `## Planned step args
${args}

## Plugin planning context
${JSON.stringify(promptContext, null, 2)}
`;
}

interface PluginInventoryItem {
  pluginId: string;
  provider: string;
  resolution: PluginResolution;
  exists: boolean;
  sourceProject?: number;
  pluginDefsFileRef: string;
  moduleConnectionDefsFileRef: string;
  // set when this plugin reuses an existing plugin found by integration brand
  // (e.g. plan asked for "stripePayments" but "stripe" already exists). Recorded for trace.
  reusedFromPluginId?: string;
}

interface PluginInventory {
  actualProject: number;
  moduleName: string;
  searchProjects: number[];
  // brand-reuse ambiguities (more than one existing plugin for the same brand);
  // surfaced to the LLM and persisted by the critic checkpoint healthReport.
  reuseWarnings: string[];
  plugins: PluginInventoryItem[];
}

async function buildRuntimePluginCatalog(
  finalPlan: FinalSolutionPlanOutput,
  snapshot: ReturnType<typeof getPlanningContextSnapshot>,
): Promise<PluginCatalogDefinition> {
  const actualProject = getActualProject();
  try {
    await mls.stor.loadProjectdependenciesInfoIfNeed(actualProject);
  } catch {
    // The sync dependency list is enough when dependencies are already loaded.
  }
  return buildRuntimePluginCatalogSync(finalPlan, snapshot);
}

function buildRuntimePluginCatalogSync(
  finalPlan: FinalSolutionPlanOutput,
  snapshot: ReturnType<typeof getPlanningContextSnapshot>,
): PluginCatalogDefinition {
  const actualProject = getActualProject();
  const searchProjects = getPluginSearchProjects(actualProject);
  const byId = new Map<string, PluginCatalogItem>();

  for (const item of discoverExistingPluginCatalogItems(searchProjects)) {
    byId.set(item.pluginId, item);
  }

  for (const item of discoverApprovedPluginCatalogItems(finalPlan, snapshot)) {
    if (!byId.has(item.pluginId)) byId.set(item.pluginId, item);
  }

  return {
    schemaVersion: '2026-06-02',
    plugins: Array.from(byId.values()).sort((a, b) => a.pluginId.localeCompare(b.pluginId)),
  };
}

function discoverExistingPluginCatalogItems(searchProjects: number[]): PluginCatalogItem[] {
  const byId = new Map<string, PluginCatalogItem>();

  for (const file of Object.values(mls.stor.files)) {
    if (!searchProjects.includes(file.project)) continue;
    if (file.level !== 2 || file.shortName !== 'plugin' || file.extension !== '.defs.ts') continue;
    const pluginId = getPluginIdFromPluginFolder(file.folder);
    if (!pluginId || byId.has(pluginId)) continue;
    byId.set(pluginId, {
      pluginId,
      provider: toProviderName(pluginId),
      artifactType: 'plugin',
      capabilities: [],
      requiredCredentials: [],
    });
  }

  return Array.from(byId.values());
}

function discoverApprovedPluginCatalogItems(
  finalPlan: FinalSolutionPlanOutput,
  snapshot: ReturnType<typeof getPlanningContextSnapshot>,
): PluginCatalogItem[] {
  const candidates = [
    ...finalPlan.result.approvedArtifacts.plugins,
    ...getAcceptedPluginDecisions(snapshot),
  ];

  const byId = new Map<string, PluginCatalogItem>();
  candidates.forEach((candidate, index) => {
    const item = normalizePluginCatalogCandidate(candidate, `pluginCandidate[${index}]`);
    if (item && !byId.has(item.pluginId)) byId.set(item.pluginId, item);
  });
  return Array.from(byId.values());
}

function normalizePluginCatalogCandidate(value: unknown, path: string): PluginCatalogItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const pluginId = getPluginIdFromCandidate(record, path);
  if (!pluginId) return null;
  return {
    pluginId,
    provider: getProviderFromCandidate(record, pluginId, path),
    artifactType: 'plugin',
    capabilities: normalizeStringList(record.capabilities, `${path}.capabilities`),
    requiredCredentials: normalizeStringList(record.requiredCredentials, `${path}.requiredCredentials`),
  };
}

async function buildPluginInventory(moduleName: string, catalog: PluginCatalogDefinition): Promise<PluginInventory> {
  const actualProject = getActualProject();
  try {
    await mls.stor.loadProjectdependenciesInfoIfNeed(actualProject);
  } catch {
    // The sync dependency list is enough when dependencies are already loaded.
  }
  return buildPluginInventorySync(moduleName, catalog);
}

function buildPluginInventorySync(moduleName: string, catalog: PluginCatalogDefinition): PluginInventory {
  const actualProject = getActualProject();
  const searchProjects = getPluginSearchProjects(actualProject);
  const existingPlugins = scanExistingPlugins(searchProjects).filter(ref => isReusableExistingPlugin(ref, actualProject));
  const reuseWarnings: string[] = [];

  const plugins = catalog.plugins.map((plugin): PluginInventoryItem => {
    let reuse: ExistingPluginRef | null = existingPlugins.find(ref => ref.pluginId === plugin.pluginId) || null;
    let reusedFromPluginId: string | undefined;

    // no exact plugin file — try to reuse an existing plugin from the same
    // integration brand (e.g. plan asks for "stripePayments" but "stripe" already exists),
    // instead of creating a duplicate global draft in l2/plugins.
    if (!reuse) {
      const brandMatches = findExistingPluginsByBrand(plugin.pluginId, existingPlugins);
      if (brandMatches.length === 1) {
        reuse = brandMatches[0];
        reusedFromPluginId = brandMatches[0].pluginId;
      } else if (brandMatches.length > 1) {
        reuseWarnings.push(`plugin '${plugin.pluginId}': multiple existing plugins share the same integration brand (${brandMatches.map(m => m.pluginId).join(', ')}); not auto-reused, kept as create_draft for manual review`);
      }
    }

    if (reusedFromPluginId) {
      console.warn(`[agentPlanPlugins] reusing existing plugin '${reusedFromPluginId}' for requested '${plugin.pluginId}' (same integration brand)`);
    }

    return {
      pluginId: plugin.pluginId,
      provider: plugin.provider,
      resolution: reuse ? 'existing' : 'create_draft',
      exists: !!reuse,
      sourceProject: reuse ? reuse.project : undefined,
      pluginDefsFileRef: reuse ? reuse.fileRef : buildPluginDefsFileRef(actualProject, plugin.pluginId),
      moduleConnectionDefsFileRef: buildModuleConnectionDefsFileRef(actualProject, moduleName, plugin.pluginId),
      reusedFromPluginId,
    };
  });

  return { actualProject, moduleName, searchProjects, reuseWarnings, plugins };
}

interface ExistingPluginRef {
  pluginId: string;
  project: number;
  fileRef: string;
  status: mls.stor.IFileInfoStatus;
  inLocalStorage: boolean;
}

function scanExistingPlugins(searchProjects: number[]): ExistingPluginRef[] {
  const byKey = new Map<string, ExistingPluginRef>();
  for (const file of Object.values(mls.stor.files)) {
    if (!searchProjects.includes(file.project)) continue;
    if (file.level !== 2 || file.shortName !== 'plugin' || file.extension !== '.defs.ts') continue;
    if (file.status === 'deleted') continue;
    const pluginId = getPluginIdFromPluginFolder(file.folder);
    if (!pluginId) continue;
    const key = `${file.project}:${pluginId}`;
    if (byKey.has(key)) continue;
    byKey.set(key, {
      pluginId,
      project: file.project,
      fileRef: buildPluginDefsFileRef(file.project, pluginId),
      status: file.status,
      inLocalStorage: file.inLocalStorage,
    });
  }
  return [...byKey.values()];
}

// A plugin draft created earlier in the CURRENT plan is not a reusable "existing" plugin.
function isReusableExistingPlugin(ref: ExistingPluginRef, actualProject: number): boolean {
  return !(ref.project === actualProject && ref.inLocalStorage && ref.status !== 'nochange');
}

// brand reuse is intentionally conservative. Two plugins are "the same
// integration" only when they share the first brand token AND at least one side is the
// brand-only plugin (its normalized id equals the brand). This matches stripe<->stripePayments
// but avoids false positives like mailChimp<->mailGun (both share token "mail" but neither is
// the brand-only "mail" plugin).
function findExistingPluginsByBrand(requestedPluginId: string, existingPlugins: ExistingPluginRef[]): ExistingPluginRef[] {
  const brand = pluginBrandToken(requestedPluginId);
  if (!brand) return [];
  const requestedKey = normalizePluginKey(requestedPluginId);

  return existingPlugins.filter(ref => {
    if (ref.pluginId === requestedPluginId) return false;
    if (pluginBrandToken(ref.pluginId) !== brand) return false;
    const existingKey = normalizePluginKey(ref.pluginId);
    return existingKey === brand || requestedKey === brand;
  });
}

function pluginBrandToken(pluginId: string): string {
  const words = toAsciiWords(pluginId);
  return words.length > 0 ? words[0].toLowerCase() : '';
}

function normalizePluginKey(pluginId: string): string {
  return toAsciiWords(pluginId).join('').toLowerCase();
}

function getPluginIdFromPluginFolder(folder: string): string | null {
  const match = /^plugins\/([^/]+)$/.exec(folder);
  if (!match) return null;
  const pluginId = toPluginId(match[1]);
  return pluginId || null;
}

function getPluginSearchProjects(actualProject: number): number[] {
  const dependencies = mls.l5.getProjectDependencies(actualProject, false) || [];
  return Array.from(new Set([actualProject, ...dependencies]));
}

function buildPluginDefsFileRef(project: number, pluginId: string): string {
  return `_${project}_/l2/plugins/${pluginId}/plugin.defs.ts`;
}

function buildModuleConnectionDefsFileRef(project: number, moduleName: string, pluginId: string): string {
  return `_${project}_/l2/${moduleName}/plugins/${pluginId}.defs.ts`;
}

function getActualProject(): number {
  return mls.actualProject || 0;
}

function getFinalPlanModuleName(finalPlan: FinalSolutionPlanOutput): string {
  return assertString(finalPlan.result.module.moduleName, 'result.module.moduleName');
}

function buildPluginPromptContext(
  args: string,
  finalPlan: FinalSolutionPlanOutput,
  snapshot: ReturnType<typeof getPlanningContextSnapshot>,
  catalog: PluginCatalogDefinition,
  inventory: PluginInventory,
): Record<string, unknown> {
  return {
    args,
    module: finalPlan.result.module,
    approvedPluginArtifacts: summarizeObjects(finalPlan.result.approvedArtifacts.plugins),
    acceptedPluginDecisions: summarizeObjects(getAcceptedPluginDecisions(snapshot)),
    approvedWorkflowArtifacts: summarizeObjects(finalPlan.result.approvedArtifacts.workflows),
    approvedAgentArtifacts: summarizeObjects(finalPlan.result.approvedArtifacts.agents),
    approvedHorizontalModules: summarizeObjects(finalPlan.result.approvedArtifacts.horizontalModules),
    capabilities: summarizeObjects(finalPlan.result.capabilities),
    implementationDecisions: snapshot.implementationDecisions.decisions.filter(decision => isPluginRelevantDecision(decision)),
    pluginCatalog: catalog,
    pluginInventory: inventory,
  };
}

function getAcceptedPluginDecisions(snapshot: ReturnType<typeof getPlanningContextSnapshot>) {
  return snapshot.implementationDecisions.decisions.filter(decision =>
    decision.artifactType === 'plugin' && decision.accepted && decision.decidedPriority !== 'never'
  );
}

function summarizeObjects(items: unknown[]): unknown[] {
  return items.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const record = item as Record<string, unknown>;
    const summary: Record<string, unknown> = {};
    for (const key of ['pluginId', 'artifactId', 'signal', 'workflowId', 'agentId', 'horizontalModuleId', 'capabilityId', 'title', 'description', 'reason', 'priority', 'actor']) {
      if (record[key] !== undefined) summary[key] = record[key];
    }
    return Object.keys(summary).length > 0 ? summary : item;
  });
}

function isPluginRelevantDecision(decision: { artifactType: string; title?: string; description?: string; reason?: string }): boolean {
  if (['plugin', 'agent', 'horizontalModule', 'workflow'].includes(decision.artifactType)) return true;
  const text = [decision.title, decision.description, decision.reason].join(' ').toLowerCase();
  return /plugin|integracao|integration|provider|pagamento|payment|mensagem|message|comunicacao|communication|notifica|notification|webhook/.test(text);
}

function getPluginIdFromCandidate(record: Record<string, unknown>, path: string): string | null {
  const explicit = optionalString(record.pluginId, `${path}.pluginId`)
    || optionalString(record.providerId, `${path}.providerId`)
    || optionalString(record.integrationId, `${path}.integrationId`);
  if (explicit) return toPluginId(explicit);

  const provider = inferProviderFromText(record, path);
  if (provider) return toPluginId(provider);

  const idSource = optionalString(record.recommendationId, `${path}.recommendationId`)
    || optionalString(record.artifactId, `${path}.artifactId`)
    || optionalString(record.signal, `${path}.signal`)
    || optionalString(record.itemId, `${path}.itemId`);
  return idSource ? toPluginId(stripPluginSuffix(idSource)) : null;
}

function getProviderFromCandidate(record: Record<string, unknown>, pluginId: string, path: string): string {
  return optionalString(record.provider, `${path}.provider`)
    || optionalString(record.providerName, `${path}.providerName`)
    || inferProviderFromText(record, path)
    || toProviderName(pluginId);
}

function inferProviderFromText(record: Record<string, unknown>, path: string): string | null {
  const text = [
    optionalString(record.title, `${path}.title`),
    optionalString(record.description, `${path}.description`),
    optionalString(record.reason, `${path}.reason`),
    optionalString(record.decision, `${path}.decision`),
  ].filter((item): item is string => !!item).join(' ');
  const match = /(?:\bvia\b|\bcom\b|\busing\b)\s+([a-zA-Z][a-zA-Z0-9._-]*)/.exec(text);
  return match ? match[1] : null;
}

function stripPluginSuffix(value: string): string {
  return value.replace(/(?:Plugin|Integration|Provider)$/i, '');
}

function toPluginId(value: string): string {
  const words = toAsciiWords(value);
  if (words.length === 0) return '';
  return words.map((word, index) => index === 0 ? word.toLowerCase() : capitalize(word.toLowerCase())).join('');
}

function toProviderName(value: string): string {
  const words = toAsciiWords(value);
  if (words.length === 0) return value;
  return words.map(word => capitalize(word.toLowerCase())).join(' ');
}

function toAsciiWords(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizePluginResolution(value: unknown, path: string): PluginResolution | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'existing' || value === 'create_draft') return value;
  throw new Error(`${path} must be existing or create_draft`);
}

function optionalNumber(value: unknown, path: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new Error(`${path} must be a number`);
}

const systemPrompt = `
<!-- modelType: codeinstruct -->
<!-- x-tool-strict: true -->

You are agentPlanPlugins for the collab.codes "newSolution" flow.
Plan external plugins from the reduced plugin planning context, implementation decisions, plugin catalog, and plugin inventory.
Use the same language as the user for reasons, risks, questions, and trace.

## Tool mode
Call the "{{toolName}}" tool with only these top-level arguments: status, result, questions, and trace. Put questions and trace beside result, never inside result. Do not include type, runId, stepId, schemaVersion, toolName, or arguments; the harness fills those fields.
Do not return prose.

## Rules
- Use only pluginId and provider values from the provided plugin catalog.
- Use pluginInventory as the source of truth for resolution, pluginDefsFileRef, moduleConnectionDefsFileRef, and sourceProject.
- When pluginInventory marks a plugin as existing, return resolution "existing" and preserve sourceProject.
- When pluginInventory marks a plugin as create_draft, return resolution "create_draft"; the later defs save step will create l2/plugins/{pluginId}/plugin.defs.ts with draft status.
- Reuse first: when pluginInventory sets resolution "existing" (including reusedFromPluginId, which means an existing plugin from the same integration brand was found, e.g. requested "stripePayments" reusing existing "stripe"), reuse it and never create a duplicate global plugin draft for the same integration.
- Respect pluginInventory.reuseWarnings: when a brand has more than one existing plugin, do not invent a new draft to "disambiguate"; keep the inventory resolution and leave the ambiguity for review.
- Every acceptedPluginDecisions item with decidedPriority other than "never" must be planned when it has a matching pluginCatalog/pluginInventory item.
- Missing l2/plugins/{pluginId}/plugin.defs.ts is not a blocker; use the pluginInventory create_draft resolution instead of asking whether the catalog can be updated.
- Never return status "ok" with an empty plugins array when acceptedPluginDecisions is not empty.
- If pluginCatalog/pluginInventory is inconsistent and an accepted plugin cannot be planned, return status "needs_input", plugins: [], and a top-level question with the concrete missing pluginId/provider.
- moduleConnectionDefsFileRef must point to l2/{moduleName}/plugins/{pluginId}.defs.ts.
- Put plugin-specific questions in plugins[].questions. Use top-level questions only for general blockers.
- Do not hard-code plugin providers or priorities from a sample domain.
- A plugin can be "now" only when the approved MVP depends on that external integration.
- A plugin can be "soon" or "later" when it is useful for a future workflow, agent, notification, payment, document, or operational improvement.
- Do not plan a plugin as required for MVP unless implementation decisions approve it as "now".
- Communication plugins may be planned only when reminders, alerts, approvals, contact, follow-ups, or communication workflows justify them.
- Return an empty array when no external plugin is justified.
`;
