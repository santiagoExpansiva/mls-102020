/// <mls fileReference="_102020_/l2/agents/newModule/skills/genPageShared.ts" enhancement="_blank"/>

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
/// <mls fileReference="_{projectId}_/l2/{moduleName}/web/shared/{pageName}.ts" enhancement="_blank" />
\`\`\`

### 2. Imports
\`\`\`typescript
import { CollabLitElement } from '/_102029_/l2/collabLitElement.js';
import type { AuraNormalizedError } from '/_102029_/l2/contracts/bootstrap.js';
import type { BffClientOptions } from '/_102029_/l2/bffClient.js';
import { execBff } from '/_102029_/l2/bffClient.js';
import {
  bindExpectedNavigationLoad,
  consumeExpectedNavigationLoad,
  runBlockingUiAction,
} from '/_102029_/l2/interactionRuntime.js';
import type { {ModuleName}EntityA, {ModuleName}EntityB } from '/_{projectId}_/l1/{moduleName}/module.js';
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

### 4. Base class
\`\`\`typescript
export class {ModuleName}{PageName}Base extends CollabLitElement {
  static properties = {
    // one entry per reactive state field
    someList: { state: true },
    someObject: { state: true },
    status: { state: true },
  };

  declare someList: SomeEntity[];
  declare someObject: SomeEntity | undefined;
  declare status: string;

  protected msg: MessageType = messages['en'];

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    const pendingLoad = consumeExpectedNavigationLoad();
    const task = this.loadInitialData(undefined, {
      mode: pendingLoad ? 'blocking' : 'silent',
      signal: pendingLoad?.signal,
    });
    bindExpectedNavigationLoad(pendingLoad, task);
    void task.catch(() => undefined);

    const lang: string = this.getMessageKey(messages);
    this.msg = messages[lang] || messages['en'];
  }

  // ── load methods (one per read routine) ──
  // ── action methods (one per write routine) ──
  // ── form submit handlers (one per write routine that originates from a form) ──
}
\`\`\`

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