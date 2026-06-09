/// <mls fileReference="_102020_/l2/agentMaterializeSolution/skills/genPageRender.ts" enhancement="_blank"/>

export const skill = `
# Lit WebComponent Render Generator

You generate the **page render** TypeScript file — a Lit 3 WebComponent that extends the Shared base class and only implements \`render()\`.
All state, all methods, and all i18n live in the base class. You NEVER invent names. You read the base and use what is there.

---

## What you receive

- \`##User data\`: the **page spec** JSON — \`pageId\`, \`pageName\`, \`actor\`, \`purpose\`, \`sections[]\`.
  Each section: \`sectionName\`, \`mode\`, \`organisms[]\`.
  Each organism: \`organismName\`, \`purpose\`, \`userActions[]\`, \`requiredEntities[]\`, \`readsFields[]\`, \`writesFields[]\`.
- \`##User info\`: JSON with \`moduleName\`, \`device\`, \`type\`, \`project\`, \`item.outputPath\`.
- \`##Base Class\`: the **full TypeScript source** of the Shared base class that this component will extend.
- \`##Design System\` (optional): component and styling guidelines.

---

## MANDATORY FIRST STEP — inventory the base class

Read \`##Base Class\` completely. Build three lists before writing any render code:

### List 1 — Reactive properties
Scan every \`@property()\` declaration. Record exact name and type.
\`\`\`
this.nome          : string
this.cpf           : string
this.save          : 'idle'|'loading'|'success'|'error'
this.formDirty     : boolean
this.status        : string
...
\`\`\`

### List 2 — Handler methods
Scan every method whose name starts with \`handle\`. Record exact name and parameter list.
\`\`\`
handleSaveClienteSubmit(event: SubmitEvent)
handleCancelCadastroClick()
handleValidateCpfCnhClick()
...
\`\`\`

### List 3 — i18n keys
Read \`const message_en = { ... }\`. Record every key.
\`\`\`
brand, pageTitle, save, saving, confirm, confirming, labelNome, statusReady, ...
\`\`\`

These three lists are the ONLY names you may use inside \`render()\`.
If a name is not in one of these lists it does not exist — do not use it.

---

## File structure

### 1. MLS header
\`item.outputPath\` from \`##User info\`, strip leading \`/\`:
\`\`\`
/// <mls fileReference="{item.outputPath}" enhancement="_102027_/l2/enhancementLit.ts" />
\`\`\`

### 2. Imports
\`\`\`typescript
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { {Prefix}{PageNamePascal}Base } from '/_\${project}_/l2/{moduleName}/web/shared/{pageName}.js';
\`\`\`
- \`Prefix\` = \`moduleName\` first letter uppercased (e.g., \`locadora\` → \`Locadora\`)
- \`PageNamePascal\` = filename without \`.ts\`, first letter uppercased
- No other imports unless a Lit directive (e.g., \`repeat\`) is genuinely needed

### 3. Class

Tag name: \`{kebab-module}--web--{device}--page11--{kebab-page}-{project}\`
Class name: \`{Prefix}{DevicePascal}Page11{PageNamePascal}Page\`

\`\`\`typescript
@customElement('{tag}')
export class {ClassName} extends {Prefix}{PageNamePascal}Base {
  render() {
    // Extract busy booleans from action-state props (only for props that exist in List 1):
    const saveBusy    = this.save    === 'loading';
    const cancelBusy  = this.cancel  === 'loading';

    return html\`
      <!-- page markup -->
    \`;
  }
}
\`\`\`

---

## How to bind events

### Rule A — base class has a matching handler → use direct method reference (no parens, no arrow)
\`\`\`typescript
// handler in base: handleSaveClienteSubmit(event: SubmitEvent)
<form @submit=\${this.handleSaveClienteSubmit}>

// handler in base: handleCancelCadastroClick()
<button @click=\${this.handleCancelCadastroClick}>

// handler in base: handleValidateCpfCnhClick()
<button @click=\${this.handleValidateCpfCnhClick}>
\`\`\`

### Rule B — no handle method for this interaction → inline arrow only for local reactive state mutation
\`\`\`typescript
// toggling a boolean prop that exists in List 1
@click=\${() => { this.showValidationHint = !this.showValidationHint; }}

// input bound to a reactive field in List 1
@input=\${(e: Event) => {
  this.nome = (e.target as HTMLInputElement).value;
  this.formDirty = true;
}}
\`\`\`

The decision tree for every interactive element:
1. Does \`##Base Class\` have a \`handle*\` method that fits this action? → Rule A
2. Is this a local state mutation (toggling, input binding) with no dedicated handler? → Rule B
3. Neither → do not add interactivity (the feature does not exist in the base)

---

## How to map organisms to sections

Use \`##User data\` sections and organisms to understand what to show and where.
Use \`##Base Class\` lists to decide exactly how to show it.

### Read-only organism (\`writesFields\` empty, \`userActions\` empty)
Render a display panel. For each field in \`readsFields\`:
- Find the matching reactive prop in List 1
  - Field \`"Cliente.nome"\` → if List 1 has \`this.nome\` → \`\${this.nome ?? ''}\`
  - Field \`"Cart.subtotalAmount"\` → if List 1 has \`this.cart\` → \`\${this.cart?.subtotalAmount ?? 0}\`
- If no matching prop exists in List 1, skip that field

### Collection organism (primary entity has an array prop in List 1)
\`\`\`typescript
\${(this.items ?? []).map((item: any) => html\`...\`)}
\`\`\`

### Form organism (\`writesFields\` non-empty)
- Find the \`handleXxxSubmit\` method in List 2 that matches this form's action → bind with Rule A
- Bind each input to the matching reactive prop from List 1 → Rule B for \`@input\`
- Submit button: \`?disabled=\${saveBusy}\`, label: \`\${saveBusy ? this.msg.saving : this.msg.save}\`

### Action organism (\`userActions\` non-empty, no form)
- Find the \`handleXxxClick\` in List 2 that matches the action → bind with Rule A
- \`?disabled=\${actionBusy}\`
- Label: from List 3 matching the action purpose

---

## Design

Follow \`##Design System\` guidelines if provided. Otherwise use Tailwind CSS freely.
Design for the \`purpose\` and \`actor\` from \`##User data\`.

- Each section → visually distinct block (card, panel, column)
- \`mode: "edit"\` → interactive; \`mode: "view"\` → read-only
- Extract busy booleans at the top of \`render()\` — only for props in List 1
- Guard nullable props with \`??\` and \`?.\`
- Show \`this.status\` visibly
- All human-visible text via \`this.msg.*\` using keys from List 3 only — never hardcode strings

---

## Output format rules
- No markdown fences, no explanations, no inline comments in generated TypeScript
- 2-space indentation inside the class; html template may use deeper indentation
- One blank line between top-level declarations
- The \`srcFile\` value in the JSON response must be a single-line string — escape all special characters:
  - newlines → \\n  |  tabs → \\t  |  double quotes → \\"  |  backslashes → \\\\

---
`;
