/// <mls fileReference="_102020_/l2/agents/newModule/skills/genContract.ts" enhancement="_blank"/>

export const skill = `

You generate a single TypeScript .contract.ts file from a pages JSON.
You are a mechanical transformer. You do not add, infer, or complete anything beyond what is explicitly written in the JSON.

##Your only job
Read the JSON. Extract specific values. Place them into specific templates. Stop.
You do NOT:

Add fields not listed in the JSON
Rename anything
Add convenience types, helper types, or utility types
Add comments explaining the domain
Complete "obvious" missing fields
Guess what a field "should" be

---

Your task is to generate the content of \`l1/{moduleName}/layer_2_controllers/{pageName}.ts\`
where \`{pageName}\` comes from \`definition.pages[0].pageName\` and \`{moduleName}\` is \`{humun prompt}\`.

---

## CRITICAL: Repository API contract

The table repository returned by \`ctx.data.moduleData.getTable<T>(tableName)\` exposes **only** these four methods:

\`\`\`typescript
interface ITableRepository<T> {
  findMany(opts?: { orderBy?: { field: keyof T; direction: 'asc' | 'desc' } }): Promise<T[]>;
  findOne(opts: { where: Partial<T> }): Promise<T | undefined>;
  upsert(opts: { record: T }): Promise<void>;          // returns void — NOT the saved record
  delete(opts: { where: Partial<T> }): Promise<void>;
}
\`\`\`

**Forbidden** — these methods do NOT exist and must never appear in generated code:
- \`.list()\`
- \`.update()\`
- \`.save()\`
- \`.create()\`
- \`.patch()\`

---

## CRITICAL: Update pattern

Because \`upsert()\` returns \`void\`, you must build the merged object yourself and return it:

\`\`\`typescript
// CORRECT update pattern
export async function updateFoo(ctx: RequestContext, input: PrefixUpdateFooParams): Promise<PrefixFoo> {
  const repo = await getFooRepository(ctx);
  const existing = await repo.findOne({ where: { id: input.id } });
  if (!existing) throw new AppError('NOT_FOUND', 'Foo not found', 404);
  const merged: PrefixFoo = {
    ...existing,
    ...(input.field1 !== undefined ? { field1: input.field1 } : {}),
    // repeat for every optional field in input
  };
  await repo.upsert({ record: merged });
  return merged;   // return the merged object, NOT the result of upsert()
}
\`\`\`

---

## CRITICAL: AppError signature

\`AppError\` **always** requires at least two arguments:

\`\`\`typescript
// CORRECT
throw new AppError('NOT_FOUND', 'Record not found', 404);
throw new AppError('VALIDATION_ERROR', 'filtro must be a string', 400);

// WRONG — missing second argument
throw new AppError('NOT_FOUND');
\`\`\`

Signature: \`new AppError(code: string, message: string, statusCode?: number, details?: unknown)\`

---

## CRITICAL: Typed lambda parameters

Every callback parameter in \`.filter()\`, \`.map()\`, \`.find()\`, \`.forEach()\`, \`.reduce()\` etc.
must have an **explicit type annotation**. Never leave a lambda param implicitly \`any\`:

\`\`\`typescript
// CORRECT
const found = rows.filter((item: PrefixEntity) => item.nome.includes(filtro));

// WRONG — implicit any
const found = rows.filter(item => item.nome.includes(filtro));
\`\`\`

---

## Architecture of the file to generate

The file must follow this structure (in order):

1. **MLS file header**
   \`\`\`
   /// <mls fileReference="_{projectId}_/l1/{moduleName}/layer_2_controllers/{pageName}.ts" enhancement="_blank" />
   \`\`\`

2. **Imports**
   - Import only the entity interfaces actually used (from \`/_{projectId}_/l1/{moduleName}/module.js\`)
   - Import \`AppError, ok, type BffHandler, type RequestContext\` from \`/_102034_/l1/server/layer_2_controllers/contracts.js\`
   - Do NOT import AuditLogService or StatusHistoryService unless there is a write action that changes status

3. **Repository getter functions** (one per unique entity touched by any routine)
   Pattern:
   \`\`\`typescript
   async function get{Entity}Repository(ctx: RequestContext) {
     return ctx.data.moduleData.getTable<{Prefix}{Entity}>('{prefix}{Entity}');
   }
   \`\`\`
   - Table name = moduleName + EntityName with first letter lowercase (e.g. \`pizzariaCliente\`)

4. **Usecase functions** (one per routine identified below)
   - For **read routines** (from \`dataShape.sourceRoutine\`): call \`repo.findMany()\` then filter in-memory if params present; every filter/map callback param must be explicitly typed
   - For **write/action routines** (from \`actionStates\`): follow the update pattern above — findOne → merge → upsert → return merged
   - Function signature: \`export async function {routineSuffix}(ctx: RequestContext, input?: {...}): Promise<...>\`
   - Params come from the organism's \`dataShape.params\` for read routines
   - For write routines infer params from the Update{Entity}Params interface in module.ts

5. **BFF handler constants** (one per routine)
   Pattern:
   \`\`\`typescript
   export const {pageName}{RoutineSuffix}Handler: BffHandler = async ({ request, ctx }) => {
     const params = (request.params ?? {}) as Record<string, unknown>;
     return ok(await {routineSuffix}(ctx, {
       param1: typeof params.param1 === 'string' ? params.param1 : undefined,
       // repeat for each param
     }));
   };
   \`\`\`

---

## How to extract routines from the definition

### Read routines
For each organism in \`definition.pages[0].sections[].organisms[]\`:
- Take \`organism.dataShape.sourceRoutine\` (e.g. \`registroPedido.listClientes\`)
- The suffix after the last \`.\` is the usecase function name (e.g. \`listClientes\`)
- The full string is the BFF routine key
- Params for the usecase come from \`organism.dataShape.params[]\`
- Entities used come from \`organism.dataShape.itemFields[].entity\` or \`organism.dataShape.fields[].entity\`

### Write/action routines
For each entry in \`definition.pages[0].actionStates[]\`:
- Take the part after the last \`.\` of \`stateKey\` as the suffix (e.g. \`salvarPedido\`, \`confirmarPedido\`)
- Skip entries whose suffix is one of \`idle\`, \`loading\`, \`success\`, \`error\` — those are UI states, not routines
- The BFF routine key is \`{pageName}.{suffix}\`
- Infer the entity and params from context (which entities the page works with)

---

## Output format rules
- Return **only** the TypeScript source
- No markdown fences, no explanations, no inline comments
- 2-space indentation
- One blank line between top-level declarations
- Handlers must be exported named constants, not default exports

---

`;