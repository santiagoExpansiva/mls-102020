/// <mls fileReference="_102020_/l2/agents/newModule/skills/genPageRender.ts" enhancement="_blank"/>

export const skill = `
# SKILL: Lit WebComponent Render Generator

You generate the **WebComponent** TypeScript file — the pure visual layer of a Lit feature.
You extend a Shared base class and your only job is to generate the \`render()\` method.
All state, logic, enums, and methods live in the Shared. You never redeclare or invent any of them.

---

## Architecture of the file to generate

The file has exactly four parts (in this order):

### 1. MLS file header
The enhancement is always \`_102027_/l2/enhancementLit.ts\` (NOT \`_blank\`):
\`\`\`
/// <mls fileReference="_{projectId}_/l2/{moduleName}/web/desktop/page11/{pageName}.ts" enhancement="_102027_/l2/enhancementLit.ts" />
\`\`\`

### 2. Imports
\`\`\`typescript
import { html } from 'lit';
import { {Prefix}{PageName}Base } from '/_{projectId}_/l2/{moduleName}/web/shared/{pageName}.js';
\`\`\`
- Import **only** what is used in the render body
- If the shared file exports helper functions (e.g. \`formatPrice\`), import them only when referenced in render
- Do NOT import entity interfaces — they are already available through the base class

### 3. Component class
\`\`\`typescript
@customElement('{module-name}--web--desktop--page11--{page-name}-{projectId}')
export class {ModuleName}WebDesktop{PageName}Page extends {ModuleName}{PageName}Base {
  render() {
    return html\`
      <!-- full page markup here -->
    \`;
  }
}
\`\`\`
- Tag name: both \`{module-name}\` and \`{page-name}\` in kebab-case
  - e.g. \`moduleName=pizzaria\`, \`pageName=registroPedido\` → \`pizzaria--web--desktop--page11--registro-pedido-102003\`

---

## CRITICAL: Only use what the base class exposes

Read the shared source carefully. You may ONLY reference:
- Reactive properties declared with \`declare\` (e.g. \`this.items\`, \`this.status\`)
- Non-reactive properties initialised in the class body (e.g. \`this.editorAuthor\`)
- The \`this.msg\` object and its keys
- Methods defined in the shared class (e.g. \`this.loadListClientes\`, \`this.handleSalvarPedidoSubmit\`)
- Any named exports from the shared file (e.g. helper functions like \`formatPrice\`)

Do NOT invent state, methods, or msg keys that do not exist in the shared source.

---

## Render structure — how to map organisms to markup

For each organism in \`definition.pages[0].sections[].organisms[]\`:

### Collection organism (\`dataShape.shape === 'collection'\`)
Render as a searchable list or card grid:
- If the organism has \`dataShape.params[]\` with a \`filtro\` param: add an \`<input>\` that calls the corresponding load method
- If the organism has \`dataShape.params[]\` with a \`categoria\` param: add filter buttons, one per unique value from the entity's category field
- Iterate with \`.map()\` over the corresponding base-class array property
- Each card/row shows the \`itemFields[]\` whose \`usage\` is \`display\` or \`filter\`
- Fields with \`priority: 'optional'\` may be shown conditionally with \`??\` or \`?.xxx\`
- If the organism has \`emits[]\` with a \`writesState\` that selects an item (e.g. \`clienteSelecionado\`): add a clickable row/button that calls the load method or sets state

### Object organism (\`dataShape.shape === 'object'\`)
Render as a summary card:
- Show each field in \`fields[]\` with \`usage: 'display'\`
- If the organism has \`navigationFields[]\`: add a back/nav button
- If the organism is associated with an \`actionStates\` entry (same page context): add a \`<form>\` calling the corresponding handler, or action buttons

---

## Render structure — how to map actionStates to controls

For each entry in \`definition.pages[0].actionStates[]\` whose suffix is NOT \`idle/loading/success/error\`:
- If the action is a save/create: render a \`<form @submit=\${this.handle{Suffix}Submit}>\` with hidden inputs for required fields and a submit button
- If the action is a confirm/approve: render a \`<button @click=\${() => this.handle{Suffix}Click({...params})}\`
- Place these controls near the organism whose data they affect (e.g. a "Salvar Pedido" form goes in the resumo section)

---

## Design freedom — Tailwind CSS

You have **full creative freedom** over the visual layout and design. Use Tailwind CSS utility classes to craft a UI that best fits the purpose of this page (read from \`definition.pages[0].purpose\`).

Design principles to follow:
- Create a UI that feels purpose-built for the page's context and audience (\`definition.pages[0].actor\`)
- Each organism should have a distinct visual section — choose the layout (sidebar, tabs, stacked panels, split view, etc.) that makes the most sense for the data
- Use spacing, typography hierarchy, color, and borders expressively — not just structurally
- Interactive elements (search, filter, selection) should feel obvious and responsive
- Status and feedback text (\`this.status\`) should be visible and contextual
- Collection organisms with many items benefit from compact rows rather than large cards if there are many fields
- Object organisms (summaries, drafts) benefit from structured panels with clear field labels
- Action controls (forms, confirm buttons) should be visually prominent and placed near the data they affect

Technical constraints that must still be respected:
- All text must come from \`this.msg.xxx\` — never hardcode strings
- Event bindings must use the exact Lit syntax: \`@event=\${handler}\` for methods, \`@event=\${(e: Event) => ...}\` for inline
- Property bindings use \`.property=\${value}\`
- Iterate collections with \`.map(item => html\`...\`)\` — always alias type if needed
- Use \`??\` guards on nullable reactive properties (\`this.someList ?? []\`, \`this.someObject?.field ?? ''\`)

---

## Output format rules
- Return **only** the TypeScript source
- No markdown fences, no explanations, no inline comments
- 2-space indentation inside the class; the html template may use 6-space indentation for readability
- One blank line between top-level declarations
- The class and \`customElements.define\` are the only two top-level declarations after the imports

---
`;