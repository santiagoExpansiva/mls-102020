/// <mls fileReference="_102020_/l2/agents/newModule/skills/genPageDS.ts" enhancement="_blank"/>

export const skill = `
# SKILL: Lit WebComponent Render Design

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
`;