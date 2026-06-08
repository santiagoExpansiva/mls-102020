/// <mls fileReference="_102020_/l2/agentMaterializeSolution/skills/genPageShared.ts" enhancement="_blank"/>

export const skill = `
# Lit Base Component — Shared File Generator

You generate a **Shared** TypeScript file: a headless Lit 3 base class that holds all reactive state and communicates with the backend via \`execBff\`. It never renders, never registers a custom element, never declares any enum, and never dispatches events.

---

Your task is to generate the content of \`l2/{moduleName}/web/shared/{pageName}.ts\`
where \`{pageName}\` comes from \`definition.pages[0].pageName\` and \`{moduleName}\` is \{humun prompt}\`.

---

## CRITICAL: MLS mock pattern for every BFF call

Every call to \`execBff\` must be wrapped with an MLS environment check:

\`\`\`typescript
if ((window as any).mls) {
  // Provide stub/mock data directly — no network call
  this.someList = [{ id: '1', field: 'mock value', ... }];
  this.status = \`\${this.someList.length} \${this.msg.itemsAvailable}\`;
} else {
  const response = await execBff<ReturnType>('routine.key', params, options);
  if (!response.ok || !response.data) {
    if (options?.mode === 'blocking') {
      throw (response.error ?? {
        code: 'UNEXPECTED_ERROR',
        message: this.msg.couldNotLoad,
      }) satisfies AuraNormalizedError;
    }
    this.status = this.msg.couldNotLoad;
    this.someList = [];
    return;
  }
  this.someList = response.data ?? [];
  this.status = \`\${this.someList.length} \${this.msg.itemsAvailable}\`;
}
\`\`\`

Rules for mock data:
- Provide 2–3 stub records per entity list; provide a sensible single object for object shapes
- Use realistic-looking Portuguese values for name/label fields (e.g. \`'João Silva'\`, \`'Margherita'\`)
- Match every required field from the entity interface — optional fields may be omitted
- For write/action routines, the mock branch should log the params to the console and resolve successfully
  \`\`\`typescript
  if ((window as any).mls) {
    console.log('[mls mock] routine.key', params);
    this.status = this.msg.savedSuccessfully;
    return;
  }
  \`\`\`

---

## Architecture of the file to generate

The file must follow this structure (in order):

### 1. MLS file header
\`\`\`
/// <mls fileReference="_{projectId}_/l2/{moduleName}/web/shared/{pageName}.ts" enhancement="_102027_/l2/enhancementLit.ts" />
\`\`\`

### 2. Imports
\`\`\`typescript
import { CollabLitElement } from '/_102029_/l2/collabLitElement.js';
import { property } from 'lit/decorators.js';
import type { AuraNormalizedError } from '/_102029_/l2/contracts/bootstrap.js';
import type { BffClientOptions } from '/_102029_/l2/bffClient.js';
import { execBff } from '/_102029_/l2/bffClient.js';
import {
  bindExpectedNavigationLoad,
  consumeExpectedNavigationLoad,
  runBlockingUiAction,
} from '/_102029_/l2/interactionRuntime.js';
import { subscribe, unsubscribe, getState, setState, initState } from '/_102029_/l2/collabState.js';
import type { {ModuleName}EntityA, {ModuleName}EntityB } from '/_{projectId}_/l2/{moduleName}/web/contracts/{pageName}.js';
\`\`\`
- Import only entity interfaces that are actually referenced in the class body
- Determine which entities are used by reading \`organism.dataShape.itemFields[].entity\` and \`organism.dataShape.fields[].entity\` across all organisms

### 3. i18n block
Wrap with \`/// **collab_i18n_start**\` and \`/// **collab_i18n_end**\`:

\`\`\`typescript
/// **collab_i18n_start**
const message_pt = {
  // all fixed text in Portuguese (no accents — use plain ASCII)
};
const message_en = {
  // same keys in English
};
type MessageType = typeof message_en;
const messages: { [key: string]: MessageType } = { en: message_en, pt: message_pt };
/// **collab_i18n_end**
\`\`\`

Required i18n keys (add more as needed by the page content):
- \`brand\` — module display name (e.g. \`'Pizzaria'\`)
- \`pageTitle\`, \`pageSubtitle\` — from \`definition.pages[0].pageName\` / \`purpose\`
- One loading/status label per read routine (e.g. \`loadingClientes\`, \`loadingCardapio\`)
- \`couldNotLoad\` — generic data load error
- One error label per write routine (e.g. \`couldNotSave\`, \`couldNotConfirm\`)
- One success label per write routine (e.g. \`savedSuccessfully\`, \`confirmedSuccessfully\`)
- Labels for form fields visible in the page (infer from entity fields)
- \`reload\`, \`save\`, \`saving\`, \`confirm\`, \`confirming\` as applicable
- Never types "const message_pt = { *** } as const"

### 4. Base class
\`\`\`typescript
export class {ModuleName}{PageName}Base extends CollabLitElement {

  private readonly _stateKeys = [
    'db.entity.field',          // one entry per observed stateKey (see collabState section)
    'ui.pageName.actionName',
    // ...
  ] as const;

  property() someList: SomeEntity[];
  property() someObject: SomeEntity | undefined;
  property() status: string;
  // reactive properties for actionStates (type: 'idle'|'loading'|'success'|'error')
  // reactive properties for tempStates
  // reactive properties for shape-'fields' individual fields

  protected msg: MessageType = messages['en'];

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    const pendingLoad = consumeExpectedNavigationLoad();
    const task = this.loadInitialData(undefined, {
      // mode: pendingLoad ? 'blocking' : 'silent',
      mode: 'silent',
      signal: pendingLoad?.signal,
    });
    bindExpectedNavigationLoad(pendingLoad, task);
    void task.catch(() => undefined);

    const lang: string = this.getMessageKey(messages);
    this.msg = messages[lang] || messages['en'];

    // initState for tempStates with initialValue
    // initState('ui.{pageName}.someKey', defaultValue);

    // subscribe to all observed state keys
    subscribe(this._stateKeys as unknown as string[], this);

    // read current values from global state
    (this._stateKeys as unknown as string[]).forEach(key => {
      const v = getState(key);
      if (v !== undefined) this.handleIcaStateChange(key, v);
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    unsubscribe(this._stateKeys as unknown as string[], this);
  }

  handleIcaStateChange(key: string, value: any): void {
    switch (key) {
      // one case per stateKey in _stateKeys
    }
  }

  // ── load methods (one per read routine) ──
  // ── action methods (one per write routine) ──
  // ── form submit handlers (one per write routine that originates from a form) ──
}
\`\`\`

Note: 
1- Always implement loadInitialData.
2- Always verify that all necessary fields and states are correlated and free of programming errors.

---

## How to derive reactive state

For each organism in \`definition.pages[0].sections[].organisms[]\`:
- \`dataShape.shape === 'collection'\` → declare \`{stateKeyLastSegment}: {Prefix}{Entity}[]\` (initialize to \`[]\`)
- \`dataShape.shape === 'object'\` → declare \`{stateKeyLastSegment}: {Prefix}{Entity} | undefined\` (initialize to \`undefined\`)
- The state field name = last segment of \`dataShape.stateKey\` after stripping \`[]\` (e.g. \`db.cliente[]\` → \`cliente\`)

Always include a \`status: string\` reactive property.

---

## How to generate load methods

For each organism with a \`dataShape.sourceRoutine\`:
- Method name: \`load{Suffix}()\` where Suffix is the routine suffix in PascalCase (e.g. \`listClientes\` → \`loadListClientes\`)
- The first load method is called from \`connectedCallback\`; subsequent ones may be called on demand
- Params come from \`organism.dataShape.params[]\` — accept them as an optional object arg
- Apply the MLS mock pattern described above
- For a collection shape: set the corresponding array state field
- For an object shape: set the corresponding object state field

---

## How to generate action methods

For each entry in \`definition.pages[0].actionStates[]\` whose suffix is NOT \`idle/loading/success/error\`:
- Method name: \`{suffix}(params, signal?)\` (e.g. \`salvarPedido\`, \`confirmarPedido\`)
- Infer the params type from the \`Update{Entity}Params\` interface in module.ts for the primary entity of the page
- Apply the MLS mock pattern (mock branch: console.log + set success status; else branch: execBff + handle response)
- After a successful write, re-run the relevant load method to refresh state

For each action method, also generate a \`handle{Suffix}Submit(event: SubmitEvent)\` or \`handle{Suffix}Click()\` helper that calls \`runBlockingUiAction\`.

---

## How to integrate collabState (state observation)

The shared class MUST subscribe to the global state on connect and unsubscribe on disconnect.
It MUST implement \`handleIcaStateChange\` to react when external code changes any observed key.
It MUST publish state via \`setState\` after loading from BFF or after mutations.

### Collect all state keys to observe

Gather every \`stateKey\` from the definition in this order:

1. **dataShape — shape 'fields'**: all \`organism.dataShape.entityFields[].stateKey\` (e.g. \`db.veiculo.placa\`)
2. **dataShape — shape 'object' or 'collection'**: \`organism.dataShape.stateKey\` (e.g. \`config.locadora.statusVeiculoOptions\`, strip trailing \`[]\`)
3. **tempStates** (both organism-level and page-level): all \`tempStates[].stateKey\`
4. **actionStates**: all \`actionStates[].stateKey\`

Collect them all into a single \`private readonly _stateKeys\` tuple constant inside the class.

### Mapping stateKey → local property name

- Last segment of the stateKey (split by \`.\`, strip \`[]\`) is the base name.
- If two keys share the same last segment, use the last **two** segments joined in camelCase (e.g. \`form.errors\` → \`formErrors\`).
- Use this same rule that was already applied when declaring the reactive properties.

### connectedCallback — subscribe and read initial state

After the existing super call and pendingLoad logic, add:

\`\`\`typescript
// initState for tempStates that have initialValue
initState('ui.{pageName}.someKey', defaultValue);

// subscribe to all state keys (use '*' prefix for exclusive subscription)
subscribe(this._stateKeys, this);

// read current values from global state
this._stateKeys.forEach(key => {
  const v = getState(key);
  if (v !== undefined) this.handleIcaStateChange(key, v);
});
\`\`\`

Rules:
- Only call \`initState\` for keys that have an \`initialValue\` in their tempState definition — parse the JSON initialValue as the default.
- Use \`'*' + stateKey\` (exclusive) when subscribing if you want to ensure only one active subscription exists. Prefer exclusive subscriptions for action state keys.
- Read initial values AFTER subscribing, so any setState triggered during init is properly handled.

### disconnectedCallback

\`\`\`typescript
disconnectedCallback() {
  super.disconnectedCallback();
  unsubscribe(this._stateKeys, this);
}
\`\`\`

### handleIcaStateChange

\`\`\`typescript
handleIcaStateChange(key: string, value: any): void {
  switch (key) {
    case 'db.veiculo.placa': this.placa = value ?? ''; break;
    case 'db.veiculo.modelo': this.modelo = value ?? ''; break;
    case 'config.locadora.statusVeiculoOptions': this.statusVeiculoOptions = value ?? []; break;
    case 'ui.veiculosCadastro.saveVeiculo': this.saveVeiculoState = value ?? 'idle'; break;
    case 'ui.veiculosCadastro.form.errors': this.formErrors = value ?? {}; break;
    // ... one case per observed stateKey
  }
}
\`\`\`

Rules:
- Cover EVERY key in \`_stateKeys\`.
- Use a sensible empty/default value (empty string, \`[]\`, \`{}\`, \`undefined\`, \`'idle'\`) as fallback when value is null/undefined.
- Do NOT call \`setState\` inside \`handleIcaStateChange\` — this method only syncs external → local.

### setState calls after load/action methods

After every successful BFF call (or mock branch) that produces data:

- **shape 'object' or 'collection'**: call \`setState(organism.dataShape.stateKey, loadedData)\` immediately after setting the local property.
- **shape 'fields'**: nothing extra needed in load — fields are written individually by the UI.
- **actionStates**: set the action state key around the async operation:
  \`\`\`typescript
  setState('ui.{pageName}.{actionName}', 'loading');
  try {
    // ... BFF call
    setState('ui.{pageName}.{actionName}', 'success');
  } catch (e) {
    setState('ui.{pageName}.{actionName}', 'error');
    throw e;
  }
  \`\`\`
- **tempStates mutations**: whenever the shared class updates a tempState property locally (e.g. formErrors), also call \`setState(stateKey, value)\`.

---

### CRITICAL: runBlockingUiAction signature

\`runBlockingUiAction\` accepts **exactly 2 arguments** — no \`this\` as first parameter:

\`\`\`typescript
// CORRECT — 2 args, signal typed as AbortSignal
void runBlockingUiAction(
  async (signal: AbortSignal) => { await this.salvarPedido(params, signal); },
  {
    busyLabel: this.msg.saving,
    errorTitle: this.msg.couldNotSave,
    retry: () => this.salvarPedido(params),
  },
);

// WRONG — do NOT pass this as first argument
void runBlockingUiAction(this, async (signal) => { ... }, { ... });
// WRONG — signal must be typed AbortSignal, never left implicit
void runBlockingUiAction(async (signal) => { ... }, { ... });
\`\`\`

The callback parameter \`signal\` **must always** be annotated as \`AbortSignal\`.

---
`;