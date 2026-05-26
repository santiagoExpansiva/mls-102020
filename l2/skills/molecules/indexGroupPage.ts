/// <mls fileReference="_102020_/l2/skills/molecules/indexGroupPage.ts" enhancement="_blank" />

export const skill = `# Metadata
- Files: l2/molecules/{groupname}/index.ts  +  l2/molecules/{groupname}/index.html
- CustomElement: molecules--{groupname}--index-{actualProjectId}
- ClassName: Group{GroupName}Index
- {groupname} is ALWAYS the group name in lowercase (e.g. groupEnterBoolean → groupenterboolean).
  Apply lowercase in: imports, custom element tag names in the template, and fileReference path in the triple-slash header.

# Objective
Create a visual showcase page for a molecule group that presents every component in the group with live interactive examples and a quick-reference decision table. The page serves as both documentation and a live playground, helping developers pick the right component for their context.

# Structure

## index.ts
A Lit Web Component extending StateLitElement, composed of three mandatory sections each implemented as a private method returning TemplateResult.

## index.html
A single line containing only the custom element tag:
<molecules--{groupname}--index-{actualProjectId}></molecules--{groupname}--index-{actualProjectId}>

# Section layouts (follow exactly — do not invent alternative structures)

## renderHero()

\`\`\`html
<header class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-8 py-20 text-center">
  <span class="inline-block px-3 py-1 bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300 rounded-full text-xs font-semibold uppercase tracking-widest mb-6">
    {groupname in camelCase}
  </span>
  <h1 class="text-5xl font-bold text-slate-900 dark:text-slate-50 mb-5 tracking-tight">
    {Short human label, e.g. "Enter Boolean"}
  </h1>
  <p class="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
    {1–2 sentence subtitle describing the shared problem space and available implementations}
  </p>
</header>
\`\`\`

## renderShowcaseCards()

\`\`\`html
<section class="bg-slate-50 dark:bg-slate-950 px-8 py-12 border-b border-slate-200 dark:border-slate-700">
  <div class="max-w-2xl mx-auto flex flex-col gap-5">

    <!-- Repeat this block for each card: -->
    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div class="h-1 bg-{color}-500 rounded-t-2xl"></div>
      <div class="p-6">
        <div class="flex items-center justify-between mb-1">
          <p class="text-sm font-bold text-slate-900 dark:text-slate-50">Display Name</p>
          <code class="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded">tag-name</code>
        </div>
        <p class="text-xs text-slate-400 mb-5">One-line context description</p>
        <{groupname}--{component} name="card-{x}" .value=\${this.cardX} .isEditing=\${true}
          @change=\${(e: CustomEvent) => { this.cardX = e.detail.value; }}>
          <!-- Populate all available slot tags with realistic content (Label, Helper, Item, etc.) -->
        </{groupname}--{component}>
      </div>
    </div>

  </div>
</section>
\`\`\`

Accent bar colors rotate through: violet, emerald, amber, rose, sky, indigo, purple, teal, orange, pink — one distinct color per card.
A group may show the same component more than once when different configurations deserve separate illustration.

## renderReferenceTable()

\`\`\`html
<section class="bg-slate-100 dark:bg-slate-950 px-8 py-20 border-t border-slate-200 dark:border-slate-700">
  <div class="max-w-5xl mx-auto">
    <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">Quick reference</h2>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-8">{subtitle tailored to this group's decision — NOT a fixed string}</p>
    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            <th class="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-3/4">Scenario</th>
            \${headers.map(h => html\`
              <th class="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide \${h.cls}">\${h.label}</th>
            \`)}
          </tr>
        </thead>
        <tbody>
          \${rows.map((row, i) => html\`
            <tr class="\${i % 2 !== 0 ? 'bg-slate-50/60 dark:bg-slate-900/40' : ''} border-b border-slate-100 dark:border-slate-700/60 last:border-0">
              <td class="px-5 py-3.5 text-slate-700 dark:text-slate-300">\${row.scenario}</td>
              \${([row.componentA, row.componentB] as boolean[]).map(ok => html\`
                <td class="px-4 py-3.5 text-center">
                  \${ok
                    ? html\`<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-xs font-bold">✓</span>\`
                    : html\`<span class="text-slate-200 dark:text-slate-700 text-sm">—</span>\`}
                </td>
              \`)}
            </tr>
          \`)}
        </tbody>
      </table>
    </div>
  </div>
</section>
\`\`\`

Implement the \`rows\` and \`headers\` arrays at the top of renderReferenceTable(), before the return statement:

\`\`\`ts
const rows: Array<{ scenario: string; componentA: boolean; componentB: boolean }> = [
  { scenario: '...', componentA: true,  componentB: false },
  { scenario: '...', componentA: false, componentB: true  },
];
const headers = [
  { label: 'Component A', cls: 'text-{colorA}-600 dark:text-{colorA}-400' },
  { label: 'Component B', cls: 'text-{colorB}-600 dark:text-{colorB}-400' },
];
\`\`\`

Adapt the field names (componentA, componentB, ...) to the actual component names of the group.
Every distinct component in the group must appear as a column.

# Responsibilities
- Declare the custom element with @customElement('molecules--{groupname}--index-{actualProjectId}')
- Name the class Group{GroupName}Index (PascalCase, e.g. GroupEnterBooleanIndex)
- Always include these three imports at the top of index.ts, in this order:
  import { html, TemplateResult } from 'lit';
  import { customElement, state } from 'lit/decorators.js';
  import { StateLitElement } from '/_102029_/l2/stateLitElement.js';
- Import each component module from its canonical path before using it in the template:
  import '/_actualProjectId_/l2/molecules/{groupname}/{component-name}';
  (groupname is lowercase in the import path)
- Declare one @state() property per showcase card with a sensible default for the value type:
  boolean → false, string → '', number → 0 (unless a non-empty default better illustrates the component)
- Group all showcase state declarations under the comment: // ── Showcase card states ─────────────────────────────────────
- Bind the value to the component correctly by type:
  - String values: attribute binding   value="\${this.cardX}"
  - Boolean / number / null values: property binding   .value=\${this.cardX}
- Separate sections with 80-char section banners: // =========================================================================== SECTION NAME
- Compose all three sections in render() inside a single <div class="font-sans min-h-screen">

# Constraints
- index.ts file header: /// <mls fileReference="_actualProjectId_/l2/molecules/{groupname}/index.ts" enhancement="_102020_/l2/enhancementAura"/>
  (groupname is lowercase in the fileReference path)
- All three sections (Hero, Showcase Cards, Reference Table) are mandatory; none may be omitted
- Every live showcase instance must receive .isEditing=\${true} and have realistic slot content for all available slot tags
- Do not hardcode hex colors; use only Tailwind utility classes

# Notes
- Group descriptions (name, purpose, available implementations) are defined in _102020_/l2/skills/molecules/index.ts — use the corresponding entry's \`description\` field as the primary source for the hero subtitle and the reference table subtitle.
`;
