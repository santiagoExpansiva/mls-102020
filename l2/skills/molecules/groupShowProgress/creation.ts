/// <mls fileReference="_102020_/l2/skills/molecules/groupShowProgress/creation.ts" enhancement="_blank"/>

export const skill = `
# groupShowProgress — Creation

> Implementation reference for creating molecules in the **groupShowProgress** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupShowProgress\` |
| **Category** | Feedback |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

This component has **no slot tags**. It is a visual primitive designed to be composed inside other components (e.g. button with spinner, upload zone with progress bar).

\`\`\`typescript
slotTags = [];
\`\`\`

---

## 3. Properties

### 3.1 Data

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`value\` | \`number \| null\` | \`null\` | \`@propertyDataSource\` | Progress percentage 0–100. \`null\` = indeterminate mode |

### 3.2 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`size\` | \`string\` | \`'md'\` | \`@propertyDataSource\` | Visual size: \`'xs'\`, \`'sm'\`, \`'md'\`, \`'lg'\` |
| \`label\` | \`string\` | \`''\` | \`@propertyDataSource\` | Accessible label describing what is loading |
| \`showValue\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Display the numeric percentage alongside the indicator |

---

## 4. Value Contract

### Determinate Mode (\`value\` is a number)

- \`value\` is clamped to \`0–100\` before rendering
- Represents the completion percentage of the operation
- When \`showValue=true\`, display formatted as \`"42%"\`

### Indeterminate Mode (\`value\` is \`null\`)

- Renders an animated indicator with no specific progress
- \`showValue\` is ignored — no percentage to display
- Used when the total duration or size is unknown

---

## 5. Events

This component emits **no events**. It is purely visual.

---

## 6. Visual States

| State | Condition | Behavior |
|-------|-----------|----------|
| **Indeterminate** | \`value === null\` | Animated loop (spinning, pulsing, or sliding) |
| **Progress** | \`value >= 0 && value < 100\` | Partial fill reflecting the percentage |
| **Complete** | \`value === 100\` | Full fill, animation stops |

---

## 7. Size Mapping

| Size | Typical dimension |
|------|-------------------|
| \`xs\` | 12–16px (inline with text) |
| \`sm\` | 20–24px (inside buttons) |
| \`md\` | 32–40px (standalone) |
| \`lg\` | 48–64px (prominent, page-level) |

Exact dimensions are implementation-specific (bar height, ring diameter, spinner size).

---

## 8. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Role | \`role="progressbar"\` |
| Label | \`aria-label\` from \`label\` prop |
| Determinate | \`aria-valuenow\`, \`aria-valuemin="0"\`, \`aria-valuemax="100"\` |
| Indeterminate | Omit \`aria-valuenow\` (screen readers announce as indeterminate) |

---

## 9. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-21 | Initial creation reference |

`;