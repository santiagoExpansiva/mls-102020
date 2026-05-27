/// <mls fileReference="_102020_/l2/skills/molecules/groupViewMetric/creation.ts" enhancement="_blank"/>

export const skill = `
# groupViewMetric — Creation

> Implementation reference for creating molecules in the **groupViewMetric** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupViewMetric\` |
| **Category** | Data Display |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Label\` | No | Metric name/title |
| \`Value\` | Yes | The main metric value (text, formatted number, HTML) |
| \`Icon\` | No | Icon displayed alongside the metric |
| \`Trend\` | No | Trend indicator content (arrow, percentage, text). Attributes: \`direction\` (\`'up'\`, \`'down'\`, \`'neutral'\`) |
| \`Helper\` | No | Supporting text below the metric (e.g. period, comparison) |

\`\`\`typescript
slotTags = ['Label', 'Value', 'Icon', 'Trend', 'Helper'];
\`\`\`

### Slot Hierarchy

\`\`\`
component (root)
├── <Icon>
├── <Label>
├── <Value>
├── <Trend direction="up|down|neutral">
└── <Helper>
\`\`\`

---

## 3. Properties

### 3.1 States

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`loading\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Show skeleton placeholder instead of metric |

---

## 4. Value Contract

This component has **no \`value\` property**. The metric data is provided entirely via slot tags. The \`<Value>\` slot contains the main number/text to display.

This allows full flexibility — the page formats the number, adds currency symbols, percentages, etc. directly in the slot content.

---

## 5. Events

This component emits **no events**. It is purely visual.

---

## 6. Trend Attribute

The \`<Trend>\` slot tag has an optional \`direction\` attribute:

| Direction | Meaning |
|-----------|---------|
| \`up\` | Positive trend — typically styled green |
| \`down\` | Negative trend — typically styled red |
| \`neutral\` | No change — typically styled grey |

The content inside \`<Trend>\` is free (arrow emoji, percentage text, SVG icon).

---

## 7. Visual States

| State | Behavior |
|-------|----------|
| **Normal** | Metric displayed with all available slots |
| **Loading** | Skeleton placeholder matching the metric layout |

---

## 8. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Container | \`role="figure"\`, \`aria-label\` from Label slot content |
| Value | \`aria-live="polite"\` to announce updates |
| Trend | \`aria-label\` describing the direction (e.g. "Trend: up") |

---

## 9. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-21 | Initial creation reference |

`;