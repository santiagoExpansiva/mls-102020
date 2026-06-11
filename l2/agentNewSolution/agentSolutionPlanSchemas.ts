/// <mls fileReference="_102020_/l2/agentNewSolution/agentSolutionPlanSchemas.ts" enhancement="_102027_/l2/enhancementAgent"/>

const stringSchema = { type: 'string' };
const booleanSchema = { type: 'boolean' };
const stringArraySchema = { type: 'array', items: stringSchema };
const prioritySchema = { enum: ['now', 'soon', 'later', 'never'] };

const namedTextObjectSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'title', 'description'],
  properties: {
    id: stringSchema,
    title: stringSchema,
    description: stringSchema,
  },
};

const moduleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['moduleName', 'purpose', 'businessDomain', 'languages', 'visualStyle'],
  properties: {
    moduleName: stringSchema,
    title: stringSchema,
    purpose: stringSchema,
    businessDomain: stringSchema,
    languages: stringArraySchema,
    visualStyle: {
      anyOf: [
        stringSchema,
        {
          type: 'object',
          additionalProperties: false,
          required: ['tone', 'layout', 'palette'],
          properties: {
            tone: stringSchema,
            layout: stringSchema,
            palette: stringArraySchema,
          },
        },
      ],
    },
  },
};

const actorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'title', 'description'],
  properties: {
    actorId: stringSchema,
    title: stringSchema,
    description: stringSchema,
  },
};

const capabilitySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['capabilityId', 'title', 'description', 'actor', 'priority'],
  properties: {
    capabilityId: stringSchema,
    title: stringSchema,
    description: stringSchema,
    actor: stringSchema,
    priority: prioritySchema,
  },
};

const entityFieldSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['fieldId', 'type', 'required', 'description'],
  properties: {
    fieldId: stringSchema,
    type: stringSchema,
    required: booleanSchema,
    description: stringSchema,
  },
};

// T-001: fields is required (min 1) — entities without a declared shape cannot be
// materialized into .defs.ts downstream (see mls-102045 analiseErros E-001).
const ontologyEntitySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'fields'],
  properties: {
    entityId: stringSchema,
    title: stringSchema,
    description: stringSchema,
    kind: stringSchema,
    // A5: 'existingModuleOwned' = entity already persisted by ANOTHER existing module (used by
    // maintenance/extension runs); never model it as a new table nor as MDM.
    ownership: { enum: ['moduleOwned', 'mdmOwned', 'horizontalOwned', 'pluginOwned', 'existingModuleOwned', 'external'] },
    fields: { type: 'array', items: entityFieldSchema, minItems: 1 },
    statusEnum: stringArraySchema,
    lifecycleStates: stringArraySchema,
    rulesApplied: stringArraySchema,
  },
};

const ontologySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['entities'],
  properties: {
    entities: {
      type: 'object',
      additionalProperties: ontologyEntitySchema,
    },
  },
};

const ruleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ruleId', 'title', 'description', 'appliesTo'],
  properties: {
    ruleId: stringSchema,
    title: stringSchema,
    description: stringSchema,
    appliesTo: stringArraySchema,
    layer: stringSchema,
  },
};

const relationshipSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['relationshipId', 'fromEntity', 'toEntity', 'type', 'description'],
  properties: {
    relationshipId: stringSchema,
    fromEntity: stringSchema,
    toEntity: stringSchema,
    type: stringSchema,
    description: stringSchema,
  },
};

const userActionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['actionId', 'title', 'actor', 'capabilityId', 'description'],
  properties: {
    actionId: stringSchema,
    title: stringSchema,
    actor: stringSchema,
    capabilityId: stringSchema,
    description: stringSchema,
    commandType: stringSchema,
    affectedEntities: stringArraySchema,
    rulesApplied: stringArraySchema,
  },
};

const artifactItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['signal', 'title', 'reason', 'priority'],
  properties: {
    signal: stringSchema,
    title: stringSchema,
    reason: stringSchema,
    priority: prioritySchema,
    actor: stringSchema,
    artifactType: stringSchema,
    references: stringArraySchema,
    rulesApplied: stringArraySchema,
  },
};

const artifactPlanSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['pages', 'workflows', 'plugins', 'agents', 'horizontalModules', 'mdm', 'metricTables', 'metricDashboards', 'usecaseEntities'],
  properties: {
    pages: { type: 'array', items: artifactItemSchema },
    workflows: { type: 'array', items: artifactItemSchema },
    plugins: { type: 'array', items: artifactItemSchema },
    agents: { type: 'array', items: artifactItemSchema },
    horizontalModules: { type: 'array', items: artifactItemSchema },
    mdm: { type: 'array', items: artifactItemSchema },
    metricTables: { type: 'array', items: artifactItemSchema },
    metricDashboards: { type: 'array', items: artifactItemSchema },
    usecaseEntities: { type: 'array', items: artifactItemSchema },
  },
};

const coverageItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['capabilityId', 'coveredBy', 'notes'],
  properties: {
    capabilityId: stringSchema,
    coveredBy: stringArraySchema,
    notes: stringSchema,
  },
};

const decisionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['decisionId', 'title', 'decision', 'reason'],
  properties: {
    decisionId: stringSchema,
    title: stringSchema,
    decision: stringSchema,
    reason: stringSchema,
    affectedArtifacts: stringArraySchema,
  },
};

export const solutionBlueprintResultSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['module', 'actors', 'capabilities', 'ontology', 'rules', 'relationships', 'userActions', 'artifactPlan', 'coverage'],
  properties: {
    module: moduleSchema,
    actors: { type: 'array', items: actorSchema },
    capabilities: { type: 'array', items: capabilitySchema },
    ontology: ontologySchema,
    rules: { type: 'array', items: ruleSchema },
    relationships: { type: 'array', items: relationshipSchema },
    userActions: { type: 'array', items: userActionSchema },
    artifactPlan: artifactPlanSchema,
    coverage: { type: 'array', items: coverageItemSchema },
  },
};

export const finalSolutionPlanResultSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['module', 'actors', 'capabilities', 'ontology', 'rules', 'relationships', 'userActions', 'approvedArtifacts', 'decisions', 'deferredItems'],
  properties: {
    module: moduleSchema,
    actors: { type: 'array', items: actorSchema },
    capabilities: { type: 'array', items: capabilitySchema },
    ontology: ontologySchema,
    rules: { type: 'array', items: ruleSchema },
    relationships: { type: 'array', items: relationshipSchema },
    userActions: { type: 'array', items: userActionSchema },
    approvedArtifacts: artifactPlanSchema,
    decisions: { type: 'array', items: decisionSchema },
    deferredItems: { type: 'array', items: namedTextObjectSchema },
  },
};
