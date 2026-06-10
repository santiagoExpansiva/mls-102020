/// <mls fileReference="_102020_/l2/agentMaterializeSolution/skills/genPageShared.ts" enhancement="_blank"/>

export const skill = `
# Lit Shared Base Class Generator

You generate a **Shared** TypeScript file: a headless Lit 3 base class that holds all reactive state and communicates with the backend via \`execBff\`.
It never renders, never registers a custom element, and never dispatches events.

---

## What you receive

- \`##User data\`: a JSON object with two top-level fields:
  - \`commands\`: array of command descriptors — the **Origins** list for this page.
    Each entry has \`commandName\`, \`kind\` ("query" or "command"), \`purpose\`, \`input\`, and \`output\`.
  - \`navigationRefs\`: array of navigation entries for this page.
    Each entry has \`direction\` ("inbound" | "outbound"), \`pageId\`, and \`trigger\`.
  If \`##User data\` is a plain array (legacy), treat it as \`commands\` with an empty \`navigationRefs\`.
- \`##User info\`: a JSON object with at minimum \`moduleName\`, \`device\`, \`project\`, and \`item.outputPath\` (the full output file path).
- \`##Contracts\`: the **full TypeScript source** of the contracts file that the shared class may import from.

Extract \`pageName\` from the last segment of \`item.outputPath\` (strip the leading path and the \`.ts\` extension).

---

## MANDATORY FIRST STEP — inventory the contracts file

Read \`##Contracts\` completely before writing any code.

Scan every \`export interface\` declaration and record the exact name:
\`\`\`
PetShopStripeGetCartInput
PetShopStripeGetCartOutput
PetShopStripeUpdateCartInput
PetShopStripeUpdateCartOutput
...
\`\`\`

This list is the **only** source of interface names you may import or reference.

**Rules:**
- If \`##Contracts\` contains exported interfaces → import and use only names from this list.
- If \`##Contracts\` is empty, missing, or contains no \`export interface\` declarations → do NOT write a contracts import line; use \`any\` for all types that would otherwise reference a contract interface.
- NEVER invent an interface name. If a name does not appear in the list above, it does not exist.
- MANDATORY: import **both** the Input and Output interface for every command that has both in the contracts file. If an Input interface exists for a command, use it as the \`params\` type — never write an inline type when the interface is available.

---

## MANDATORY SECOND STEP — inventory navigationRefs

Read \`navigationRefs\` from \`##User data\` completely before writing any code.

Separate by direction and build this list:
\`\`\`
OUTBOUND: productServiceDetailPage   trigger: "Repetir compra ou agendar serviço"
OUTBOUND: catalogPage                trigger: "Explorar catálogo"
INBOUND:  homePage                   (no code generated — informational only)
\`\`\`

Rules:
- \`direction: "outbound"\` → record pageId and trigger text verbatim — **these REQUIRE generated code (Section 7 below)**
- \`direction: "inbound"\` → informational only, skip entirely
- If \`navigationRefs\` is absent or empty → outbound list is empty and Section 7 produces nothing

**If the outbound list is non-empty, the navigation handler methods (Section 7) and their i18n keys (Section 3) are REQUIRED output.
A class that has outbound navigationRefs but is missing handler methods or i18n keys is INCOMPLETE — it will cause TypeScript errors in the render layer.**

---

## BFF route key convention

Every \`execBff\` call uses:

\`\`\`
{moduleName}.{pageName}.{commandName}
\`\`\`

---

## Command classification

| \`kind\`      | Generates                                                                                       |
|---------------|-------------------------------------------------------------------------------------------------|
| \`"query"\`   | A \`load{CommandPascal}\` method — reads data, stores in reactive properties, calls \`setState\` |
| \`"command"\` | An \`{commandName}\` action method + a \`handle{CommandPascal}Click()\` wrapper               |

---


## CRITICAL: MLS mock pattern

### Query methods (kind: "query")

\`\`\`typescript
async load{CommandPascal}(params?: {...input shape...}, options?: BffClientOptions): Promise<void> {
  if ((window as any).mls) {
    // stub each top-level key in output with realistic data
    this.someKey = { /* realistic stub */ };
    setState('ui.{pageName}.someKey', this.someKey);
    this.status = this.msg.loaded;
    return;
  }
  const response = await execBff<{CommandPascal}Output>(
    '{moduleName}.{pageName}.{commandName}',
    params ?? {},
    options
  );
  if (!response.ok || !response.data) {
    if (options?.mode === 'blocking') {
      throw (response.error ?? { code: 'UNEXPECTED_ERROR', message: this.msg.couldNotLoad }) satisfies AuraNormalizedError;
    }
    this.status = this.msg.couldNotLoad;
    return;
  }
  // assign each top-level output key to the matching reactive property
  this.someKey = response.data.someKey;
  setState('ui.{pageName}.someKey', this.someKey);
  this.status = this.msg.loaded;
}
\`\`\`

### Command methods (kind: "command")

\`\`\`typescript
async {commandName}(params: {...input shape...}, signal?: AbortSignal): Promise<void> {
  if ((window as any).mls) {
    console.log('[mls mock] {moduleName}.{pageName}.{commandName}', params);
    this.{commandName}State = 'success';
    setState('ui.{pageName}.{commandName}', 'success');
    return;
  }
  this.{commandName}State = 'loading';
  setState('ui.{pageName}.{commandName}', 'loading');
  try {
    const response = await execBff<{CommandPascal}Output>(
      '{moduleName}.{pageName}.{commandName}',
      params,
      signal ? { signal } : undefined
    );
    if (!response.ok) throw response.error;
    this.{commandName}State = 'success';
    setState('ui.{pageName}.{commandName}', 'success');
    // reload primary query if applicable
  } catch (e) {
    this.{commandName}State = 'error';
    setState('ui.{pageName}.{commandName}', 'error');
    throw e;
  }
}

handle{CommandPascal}Click(): void {
  const params = { /* collect from reactive properties */ };
  void runBlockingUiAction(
    async (signal: AbortSignal) => { await this.{commandName}(params, signal); },
    {
      busyLabel: this.msg.{commandName}Loading,
      errorTitle: this.msg.couldNot{CommandPascal},
      retry: () => this.{commandName}(params),
    },
  );
}
\`\`\`

\`runBlockingUiAction\` accepts **exactly 2 arguments** — never pass \`this\` as first arg.
The signal parameter **must** be typed \`AbortSignal\`.

Mock stub rules:
- Arrays \`[{...}]\` → 2–3 items
- Object \`{...}\` → one realistic object
- id/...Id fields → \`'id-001'\`; name/nome → \`'Ana Silva'\`; email → \`'ana@exemplo.com'\`; number fields → small integer
- Required fields must be present; optional (key ends with \`?\`) may be omitted

---

## File structure (in order)

### 1. MLS file header
Use \`item.outputPath\` from \`##User info\`, strip leading \`/\`:
\`\`\`
/// <mls fileReference="{item.outputPath without leading /}" enhancement="_102027_/l2/enhancementLit.ts" />
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
import { subscribe, unsubscribe, getState, setState } from '/_102029_/l2/collabState.js';
// contracts import — see rules below
\`\`\`

**Contracts import rules (apply AFTER reading the MANDATORY FIRST STEP list):**

- If the list has at least one interface → add:
  \`\`\`typescript
  import type { InterfaceA, InterfaceB } from '/_{project}_/l2/{moduleName}/{device}/contracts/{pageName}.js';
  \`\`\`
  Include ONLY names that appear in the list AND are actually referenced in the class body.
  The path is built from \`project\`, \`moduleName\`, \`device\`, and \`pageName\` (from \`##User info\`).

- If the list is empty → omit the contracts import line entirely.

Import \`initState\` only if there are action state keys to initialize.

### 3. i18n block

Wrap with \`/// **collab_i18n_start**\` / \`/// **collab_i18n_end**\`:

\`\`\`typescript
/// **collab_i18n_start**
const message_pt = {
  brand: '{module name readable}',
  pageTitle: '{page name readable}',
  loaded: 'Dados carregados',
  couldNotLoad: 'Nao foi possivel carregar',
  // one loading label per query:    loading{CommandPascal}: '...'
  // one idle label per command:     {commandName}Label: '...'
  // one loading label per command:  {commandName}Loading: '...'
  // one error label per command:    couldNot{CommandPascal}: '...'
  // ── FOR EACH OUTBOUND ENTRY from MANDATORY SECOND STEP — one key per entry ──
  // navigateTo{PageIdPascal}: '{trigger text verbatim from navigationRef}'
  //
  // EXAMPLE — if outbound list has "productServiceDetailPage / Repetir compra ou agendar serviço":
  //   navigateToProductServiceDetailPage: 'Repetir compra ou agendar serviço'
  //
  // Do NOT omit these keys. The render layer uses them as button labels.
};
const message_en = { /* same keys, in English — including every navigateTo* key */ };
type MessageType = typeof message_en;
const messages: { [key: string]: MessageType } = { en: message_en, pt: message_pt };
/// **collab_i18n_end**
\`\`\`

Never write \`as const\` on message objects.

**CRITICAL — UTF-8 encoding:** Write all translated strings directly with their Unicode characters.
Never use hex escape sequences, Unicode escapes, or entity codes for accented letters.
Write \`'Métricas'\` — not \`'M\\xe9tricas'\`, not \`'M e9tricas'\`, not \`'M&eacute;tricas'\`.
This applies to every string in \`message_pt\` and \`message_en\`.

### 4. Reactive properties

For each top-level key in the \`output\` of every **query** command, declare a reactive property.
To determine the TypeScript type, look up the matching interface from the MANDATORY FIRST STEP list:

- If there is an interface whose name contains the command name in PascalCase and ends with \`Output\`
  (e.g., command \`getCart\` → look for \`...GetCartOutput\` in the list):
  - Array value \`[{...}]\` → \`@property() {key}: InterfaceName['key'] = [];\`
  - Object value \`{...}\` → \`@property() {key}: InterfaceName['key'] | undefined = undefined;\`
- If NO matching interface is found in the list → use \`any\`:
  - Array value → \`@property() {key}: any[] = [];\`
  - Object value → \`@property() {key}: any = undefined;\`

For each **command** entry:
- \`@property() {commandName}State: 'idle' | 'loading' | 'success' | 'error' = 'idle';\`

Always include:
- \`@property() status: string = '';\`

### 5. State keys

Derive \`_stateKeys\` as:
- \`'ui.{pageName}.{outputKey}'\` — one per top-level output key of each query command
- \`'ui.{pageName}.{commandName}'\` — one per command kind

### 6. Base class

\`\`\`typescript
export class {Prefix}{PageNamePascal}Base extends CollabLitElement {

  private readonly _stateKeys = [ /* derived above */ ] as const;

  /* reactive properties */

  protected msg: MessageType = messages['en'];

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    const pendingLoad = consumeExpectedNavigationLoad();
    const task = this.loadInitialData(undefined, { mode: 'silent', signal: pendingLoad?.signal });
    bindExpectedNavigationLoad(pendingLoad, task);
    void task.catch(() => undefined);
    const lang: string = this.getMessageKey(messages);
    this.msg = messages[lang] || messages['en'];
    subscribe(this._stateKeys as unknown as string[], this);
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
      // one case per _stateKeys entry
      // assign to the matching reactive property with a safe default fallback
    }
  }

  async loadInitialData(params?: unknown, options?: BffClientOptions): Promise<void> {
    // Call EVERY query load method for this page in sequence (await each one).
    // Do NOT call only the first — every query that populates the page must run here.
    // Propagate \`options\` to each call so silent/blocking mode is respected.
    // Example for a page with two queries:
    //   await this.loadGetOrderHistory(params as any, options);
    //   await this.loadGetCustomerServiceBookings(undefined, options);
  }

  // ── load methods (one per query command) ──
  // ── action methods + handle* wrappers (one per command kind) ──
}
\`\`\`

### 7. Navigation handler methods (REQUIRED when outbound list is non-empty)

For **every** entry in the outbound list from MANDATORY SECOND STEP, add one method to the class.
If the outbound list is empty, this section produces nothing.

\`\`\`typescript
// Template — repeat once per outbound entry:
handleNavigateTo{PageIdPascal}Click(params?: Record<string, unknown>): void {
  if ((window as any).mls) {
    console.log('[mls mock] navigate to {pageId}', params);
    return;
  }
  setState('navigation.request', { pageId: '{pageId}', params: params ?? {} });
}
\`\`\`

Substitution rules:
- \`{pageId}\` = the pageId string verbatim (e.g. \`productServiceDetailPage\`)
- \`{PageIdPascal}\` = pageId with the first letter uppercased (e.g. \`ProductServiceDetailPage\`)
- The method is **synchronous** — no \`async\`, no \`await\`, no \`runBlockingUiAction\`
- \`'navigation.request'\` is a **global** state key — do NOT add it to \`_stateKeys\`
- \`params\` lets the render layer forward item context (ids, filters) when triggering navigation

---

## PRE-OUTPUT VERIFICATION CHECKLIST

Before writing the final output, verify each of the following. Fix anything that fails.

**A. Contracts**
- [ ] Every command that has an Input interface in ##Contracts has it imported AND used as the params type
- [ ] Every command that has an Output interface in ##Contracts has it imported

**B. Navigation (check per outbound entry from MANDATORY SECOND STEP)**
- [ ] \`message_pt\` contains key \`navigateTo{PageIdPascal}\` with the trigger text in Portuguese
- [ ] \`message_en\` contains key \`navigateTo{PageIdPascal}\` with the trigger text in English
- [ ] The class body contains method \`handleNavigateTo{PageIdPascal}Click\`
- [ ] That method calls \`setState('navigation.request', ...)\` (not \`href\`, not a router)

If ANY of the navigation checks fail → add the missing code before outputting.

**C. loadInitialData**
- [ ] Calls \`await this.load{CommandPascal}(...)\` for **every** query command — not just the first

---

## Method parameter typing

For each load/action method, type the \`params\` argument using the MANDATORY FIRST STEP list:

- If the list has an interface matching the command input (name contains command in PascalCase + \`Input\`):
  \`\`\`typescript
  async getCart(params: PetShopStripeGetCartInput, options?: BffClientOptions): Promise<void>
  async updateCart(params: PetShopStripeUpdateCartInput, signal?: AbortSignal): Promise<void>
  \`\`\`
- If NO matching input interface is found → use an inline type derived from the \`input\` shape, or \`any\`:
  \`\`\`typescript
  async getCart(params: any, options?: BffClientOptions): Promise<void>
  \`\`\`

For \`execBff\` generic type parameter — use the matching Output interface if it exists in the list, otherwise \`any\`:
\`\`\`typescript
const response = await execBff<PetShopStripeGetCartOutput>(...)  // interface exists in list
const response = await execBff<any>(...)                         // no interface in list
\`\`\`

## Shape → inline TypeScript type mapping (fallback when no interface)

When no matching interface is found and you must write an inline type from an \`input\`/\`output\` shape:
- \`"string"\` → \`string\`; \`"number"\` → \`number\`; \`"boolean"\` → \`boolean\`
- \`"A|B"\` → \`'A' | 'B'\`
- Key ending with \`?\` → optional field (\`?: type\`)
- Nested object → inline \`{ field: type }\`
- Array element \`[{...}]\` → \`Array<{ field: type }>\`

---

## Output format rules
- No markdown fences, no explanations, no inline comments in generated TypeScript
- 2-space indentation
- One blank line between top-level declarations
- The \`srcFile\` value in the JSON response must be a single-line string with all special characters escaped:
  - newlines → \\n
  - tabs → \\t
  - double quotes → \\"
  - backslashes → \\\\

---
`;
