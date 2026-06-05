/// <mls fileReference="_102020_/l2/agentNewSolution/agentPlanPlugins.ts" enhancement="_102027_/l2/enhancementAgent"/>

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
}

export interface PlanPluginsResult {
  plugins: PluginPlan[];
}

export type PlanPluginsOutput = PlannerOutput<PlanPluginsResult>;

const planPluginsToolSchema = createPlannerToolSchema(
  PLAN_PLUGINS_TOOL_NAME,
  'Submit external plugin planning for the newSolution final plan.',
  PLAN_PLUGINS_STEP_ID,
  {
    type: 'object',
    additionalProperties: false,
    required: ['plugins'],
    properties: {
      plugins: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['pluginId', 'provider', 'priority', 'reason', 'events', 'requiredCredentials', 'inputData', 'outputData', 'webhooks', 'risks'],
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
  if (!agent || !step) throw new Error('[agentPlanPlugins](beforePromptStep) invalid params');
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
      systemPrompt.split('{{toolName}}').join(PLAN_PLUGINS_TOOL_NAME),
      buildHumanPrompt(args, finalPlan, snapshot),
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

  try {
    const payload = step.interaction?.payload?.[0];
    if (!payload) throw new Error('missing payload');
    const output = extractPlanPluginsOutput(payload);
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

  return [createPlannerUpdateStatusIntent(context, parentStep, step, hookSequential, status, traceMsg, status === 'completed' ? 'input' : undefined)];
}

export function getPlanPluginsOutput(context: mls.msg.ExecutionContext): PlanPluginsOutput {
  return getPlannerOutput(context, 'agentPlanPlugins', planPluginsConfig, output => validatePlanPluginsOutput(output, context));
}

function extractPlanPluginsOutput(payload: unknown): PlanPluginsOutput {
  return extractPlannerOutput(payload, planPluginsConfig);
}

const planPluginsConfig = {
  toolName: PLAN_PLUGINS_TOOL_NAME,
  stepId: PLAN_PLUGINS_STEP_ID,
  stepIdAliases: PLAN_PLUGINS_ALIASES,
  normalizeResult: normalizePlanPluginsResult,
};

function normalizePlanPluginsResult(value: unknown): PlanPluginsResult {
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
  };
}

function validatePlanPluginsOutput(output: PlanPluginsOutput, context: mls.msg.ExecutionContext): void {
  const allowedIds = new Set(pluginCatalog.plugins.map(item => item.pluginId));
  const allowedProviders = new Set(pluginCatalog.plugins.map(item => item.provider));
  for (const plugin of output.result.plugins) {
    if (!allowedIds.has(plugin.pluginId)) throw new Error(`unknown pluginId: ${plugin.pluginId}`);
    if (!allowedProviders.has(plugin.provider)) throw new Error(`unknown plugin provider: ${plugin.provider}`);
  }
  const snapshot = getPlanningContextSnapshot(context);
  if (output.status === 'ok' && hasAcceptedArtifact(snapshot.implementationDecisions, 'plugin') && output.result.plugins.length === 0) {
    throw new Error('plugin was accepted, but plugins output is empty');
  }
  if (output.status === 'needs_input' && output.questions.length === 0) throw new Error('needs_input plugin plan must include questions');
}

function buildHumanPrompt(args: string, finalPlan: FinalSolutionPlanOutput, snapshot: ReturnType<typeof getPlanningContextSnapshot>): string {
  return `## Planned step args
${args}

## Final solution plan
${JSON.stringify(finalPlan, null, 2)}

## Accepted implementation decisions
${JSON.stringify(snapshot.implementationDecisions, null, 2)}

## Plugin catalog
${JSON.stringify(pluginCatalog, null, 2)}
`;
}

const pluginCatalog = {
  schemaVersion: '2026-06-02',
  plugins: [
    {
      pluginId: 'stripe',
      provider: 'Stripe',
      artifactType: 'plugin',
      capabilities: ['paymentIntent', 'checkout', 'refund', 'webhookPaymentStatus'],
      requiredCredentials: ['secretKey', 'webhookSecret'],
    },
    {
      pluginId: 'whatsapp',
      provider: 'WhatsApp',
      artifactType: 'plugin',
      capabilities: ['sendMessage', 'templateMessage', 'deliveryStatus'],
      requiredCredentials: ['accessToken', 'phoneNumberId'],
    },
    {
      pluginId: 'email',
      provider: 'Email',
      artifactType: 'plugin',
      capabilities: ['sendEmail', 'templateEmail'],
      requiredCredentials: ['apiKey'],
    },
  ],
};

const systemPrompt = `
<!-- modelType: codepro -->

You are agentPlanPlugins for the collab.codes "newSolution" flow.
Plan external plugins from the final solution plan, implementation decisions, and plugin catalog.
Use the same language as the user for reasons, risks, questions, and trace.

## Tool mode
Call the "{{toolName}}" tool with the complete structured result.
Do not return prose.

## Rules
- Use only pluginId and provider values from the provided plugin catalog.
- Do not hard-code plugin providers or priorities from a sample domain.
- A plugin can be "now" only when the approved MVP depends on that external integration.
- A plugin can be "soon" or "later" when it is useful for a future workflow, agent, notification, payment, document, or operational improvement.
- Do not plan a plugin as required for MVP unless implementation decisions approve it as "now".
- Messaging and email plugins may be planned only when reminders, alerts, approvals, contact, follow-ups, or communication workflows justify them.
- Return an empty array when no external plugin is justified.

## Content Memory
actualDate: 2026-06-05
userName: Wagner
taskName: newModule
flowName: newSolution
`;
