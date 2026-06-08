/// <mls fileReference="_102020_/l2/agentMaterializeSolution/skills/genContract.ts" enhancement="_blank"/>

export const skill = `

You generate two TypeScript files from a pages JSON and an ontology: an interface file and a contract file.
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

## CRITICAL: Write action patterns — three distinct patterns

Because \`upsert()\` returns \`void\`, you must build the merged object yourself and return it.
**Which pattern to use depends on the action name suffix** (see "How to classify write actions" below).

### Pattern A — Save / Upsert (no throw)
Use when the action name starts with: \`save\`, \`salvar\`, \`upsert\`, or is not clearly an explicit update or create.
If the record exists → merge and overwrite. If it does NOT exist → create it. Never throw NOT_FOUND.

\`\`\`typescript
export async function saveFoo(ctx: RequestContext, input: PrefixUpdateFooParams): Promise<PrefixFoo> {
  const repo = await getFooRepository(ctx);
  const existing = await repo.findOne({ where: { id: input.id } });
  let record: PrefixFoo;
  if (existing) {
    record = {
      ...existing,
      ...(input.field1 !== undefined ? { field1: input.field1 } : {}),
      // repeat for every optional field in input
    };
  } else {
    record = {
      id: input.id,
      field1: input.field1 ?? defaultValue,
      // repeat for every required field — fill required fields from input or a safe default
    };
  }
  await repo.upsert({ record });
  return record;
}
\`\`\`

### Pattern B — Explicit Update (throw if not found)
Use ONLY when the action name starts with: \`update\`, \`atualizar\`, \`editar\`, \`edit\`, \`patch\`.

\`\`\`typescript
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
  return merged;
}
\`\`\`

### Pattern C — Explicit Create (throw if already exists)
Use ONLY when the action name starts with: \`create\`, \`criar\`, \`add\`, \`adicionar\`, \`insert\`.

\`\`\`typescript
export async function createFoo(ctx: RequestContext, input: PrefixUpdateFooParams): Promise<PrefixFoo> {
  const repo = await getFooRepository(ctx);
  const existing = await repo.findOne({ where: { id: input.id } });
  if (existing) throw new AppError('ALREADY_EXISTS', 'Foo already exists', 409);
  const record: PrefixFoo = {
    id: input.id,
    field1: input.field1 ?? defaultValue,
    // all required fields
  };
  await repo.upsert({ record });
  return record;
}
\`\`\`

---

## CRITICAL: How to classify write actions

For each entry in \`definition.pages[0].actionStates[]\`, look at the suffix (part after the last \`.\` of \`stateKey\`, e.g. \`saveVeiculo\`, \`updateCliente\`, \`addLocacao\`):

| Suffix starts with | Pattern to use |
|---|---|
| \`save\`, \`salvar\`, \`upsert\` | **Pattern A** — no throw |
| \`update\`, \`atualizar\`, \`editar\`, \`edit\`, \`patch\` | **Pattern B** — throw NOT_FOUND |
| \`create\`, \`criar\`, \`add\`, \`adicionar\`, \`insert\` | **Pattern C** — throw ALREADY_EXISTS |
| anything else | **Pattern A** — safe default, no throw |

Only use Pattern B or C when the definition **explicitly names the action as update-only or create-only**.
When in doubt, use Pattern A.

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

## Two files to generate

### File 1 — Interface file (\`interfaceFile\`)

Contains all TypeScript interfaces and types the contract file needs.

Structure:
1. **MLS file header**
   \`\`\`
   /// <mls fileReference="{interfaceOutputPath without leading /}" enhancement="_blank" />
   \`\`\`
   Use the exact \`interfaceOutputPath\` value from **User info** (strip the leading \`/\`).

2. **Entity interfaces** — one per entity that exists in \`ontology.entities\` AND is referenced by the page definition.

   **CRITICAL rules:**
   - Include ONLY entities from \`ontology.entities\` — do NOT invent or add entities not present there
   - Map ONLY the fields listed in \`ontology.entities[Entity].fields\` — do NOT add, rename, or infer fields
   - All interface names MUST be prefixed with the module name in PascalCase (e.g. if moduleName is \`pizzaria\`, prefix is \`Pizzaria\`):
     - Main interface: \`{ModuleName}{EntityName}Response\` (e.g. \`PizzariaClienteResponse\`)
     - Update params: \`{ModuleName}Update{EntityName}Request\` (e.g. \`PizzariaUpdateClienteRequest\`)
   - Field mapping rules (from ontology field definition):
     - \`type: "string"\` → \`string\`
     - \`type: "number"\` → \`number\`
     - \`type: "boolean"\` → \`boolean\`
     - Field with \`values\` array → union literal type: \`'val1' | 'val2' | ...\`
     - Field with \`required: false\` → optional property: \`fieldName?: type\`
     - All other fields → required: \`fieldName: type\`
   - Update params rules:
     - The \`id\` field (or first field if none named \`id\`) is **required**
     - All other fields are **optional**
     - Fields with union types reference the main interface: \`{ModuleName}{Entity}['fieldName']\`
     - Always append \`author?: string;\` at the end

3. **No imports** — this file is self-contained; do not import from anywhere.

---

### File 2 — Contract file (\`srcFile\`)

The BFF handler file. Must follow this structure (in order):

1. **MLS file header**
   \`\`\`
   /// <mls fileReference="_{projectId}_/l1/{moduleName}/layer_2_controllers/{pageName}.ts" enhancement="_blank" />
   \`\`\`

2. **Imports**
   - Import only the entity interfaces actually used — from \`{interfaceOutputPath with .ts → .js}\` (the interface file generated above)
   - Import \`AppError, ok, type BffHandler, type RequestContext\` from \`/_102034_/l1/server/layer_2_controllers/contracts.js\`
   - Do NOT import AuditLogService or StatusHistoryService unless there is a write action that changes status
   - Import \`USE_MOCK\` and one named mock function per unique entity getter from \`"./mock.js"\`. Mock function name pattern: \`getMock{EntityName}Repository\` where EntityName is the ontology entity name verbatim (e.g., entity \`Caixa\` → \`getMockCaixaRepository\`, entity \`MovimentoCaixa\` → \`getMockMovimentoCaixaRepository\`). Collect all entity names that have a getter in this file and produce a single import line: \`import { USE_MOCK, getMock{A}Repository, getMock{B}Repository } from "./mock.js";\`

3. **Repository getter functions** (one per unique entity touched by any routine)
   Pattern:
   \`\`\`typescript
   async function get{Entity}Repository(ctx: RequestContext) {
     if (USE_MOCK) return getMock{Entity}Repository();
     return ctx.data.moduleData.getTable<{Prefix}{Entity}>('{prefix}{Entity}');
   }
   \`\`\`
   - Table name = moduleName + EntityName with first letter lowercase (e.g. \`pizzariaCliente\`)
   - \`getMock{Entity}Repository\` uses the EntityName verbatim (same casing as the interface, e.g. \`getMockCaixaRepository\`, \`getMockMovimentoCaixaRepository\`)

4. **Usecase functions** (one per routine identified below)
   - For **read routines** (from \`dataShape.sourceRoutine\`): call \`repo.findMany()\` then filter in-memory if params present; every filter/map callback param must be explicitly typed
   - For **write/action routines** (from \`actionStates\`): follow the update pattern above — findOne → merge → upsert → return merged
   - Function signature: \`export async function {routineSuffix}(ctx: RequestContext, input?: {...}): Promise<...>\`
   - Params come from the organism's \`dataShape.params\` for read routines
   - For write routines use the \`{ModuleName}Update{Entity}Params\` interface from the interface file generated above

5. **BFF handler constants** (one per routine)
   [RoutineSuffix] with the first letter capitalized.
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
- **Classify the action** using the table in "How to classify write actions" above to choose Pattern A, B, or C

---

## Output format rules (both files)
- No markdown fences, no explanations, no inline comments
- 2-space indentation
- One blank line between top-level declarations
- Handlers must be exported named constants, not default exports
- Both \`srcFile\` and \`interfaceFile\` must be single-line JSON strings with all special characters escaped:
  - newlines → \\n
  - tabs → \\t
  - double quotes → \\"
  - backslashes → \\\\

## How to populate routers[]

For every \`export const *Handler: BffHandler\` constant you generate in \`srcFile\`, add one entry to \`routers\`:

- \`funcName\`: the exact constant name (e.g. \`veiculosCadastroSaveHandler\`)
- \`router\`: the BFF route key — ALWAYS in the format \`{moduleName}.{pageName}.{routineSuffix}\`
  - \`moduleName\` = the module name from User info (e.g. \`locadora\`)
  - \`pageName\` = \`definition.pages[0].pageName\` (e.g. \`veiculosCadastro\`)
  - \`routineSuffix\` = the suffix used when building the handler (e.g. \`saveVeiculo\`, \`getStatusVeiculoOptions\`)

Example:
\`\`\`json
"routers": [
  { "router": "locadora.veiculosCadastro.getStatusVeiculoOptions", "funcName": "veiculosCadastroGetStatusVeiculoOptionsHandler" },
  { "router": "locadora.veiculosCadastro.saveVeiculo", "funcName": "veiculosCadastroSaveHandler" }
]
\`\`\`

Include ALL handlers — one entry per handler constant, no omissions.

---

`;