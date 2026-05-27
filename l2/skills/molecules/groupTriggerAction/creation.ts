/// <mls fileReference="_102020_/l2/skills/molecules/groupTriggerAction/creation.ts" enhancement="_blank"/>

export const skill = `
# groupTriggerAction — Creation

> Implementation reference for creating molecules in the **groupTriggerAction** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupTriggerAction\` |
| **Category** | Actions |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Label\` | No | Button text content |
| \`Icon\` | No | Icon content (SVG, emoji, HTML) displayed alongside or instead of the label |

\`\`\`typescript
slotTags = ['Label', 'Icon'];
\`\`\`

### Slot Hierarchy

\`\`\`
component (root)
├── <Icon>
└── <Label>
\`\`\`

### Flexible Composition

- \`Label\` only: text button
- \`Icon\` only: icon button
- \`Icon\` + \`Label\`: button with icon and text
- Neither: component uses i18n default or renders empty

---

## 3. Properties

### 3.1 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`size\` | \`string\` | \`'md'\` | \`@propertyDataSource\` | Button size: \`'xs'\`, \`'sm'\`, \`'md'\`, \`'lg'\` |
| \`type\` | \`string\` | \`'button'\` | \`@propertyDataSource\` | HTML button type: \`'button'\`, \`'submit'\`, \`'reset'\` |
| \`iconPosition\` | \`string\` | \`'start'\` | \`@propertyDataSource\` | Icon placement: \`'start'\` (before label) or \`'end'\` (after label) |

### 3.2 States

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`disabled\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Button is disabled |
| \`loading\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Shows loading indicator, disables interaction |

---

## 4. Value Contract

This component has **no \`value\` property**. It is an action trigger.

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`action\` | \`{}\` | ✓ | Fired when the button is clicked (not fired when disabled or loading) |

### Dispatch Example

\`\`\`typescript
this.dispatchEvent(new CustomEvent('action', {
  bubbles: true,
  composed: true,
  detail: {}
}));
\`\`\`

---

## 6. Size Mapping

| Size | Description |
|------|-------------|
| \`xs\` | Compact, inline with text |
| \`sm\` | Small, for dense layouts |
| \`md\` | Default size |
| \`lg\` | Large, prominent action |

---

## 7. Visual States

| State | Behavior |
|-------|----------|
| **Normal** | Default appearance |
| **Hover** | Subtle highlight |
| **Active** | Pressed/depressed visual feedback |
| **Focused** | Focus ring for keyboard navigation |
| **Disabled** | Reduced opacity, no interaction |
| **Loading** | Loading indicator replaces icon or label, interaction blocked |

---

## 8. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Element | Native \`<button>\` element |
| Label | \`aria-label\` from Label slot content when icon-only |
| Disabled | \`disabled\` attribute on \`<button>\` |
| Loading | \`aria-busy="true"\`, \`aria-disabled="true"\` |
| Keyboard | \`Enter\`/\`Space\` triggers action |

---

## 9. Possible Implementations

| Component | Description |
|-----------|-------------|
| **Button** | Standard button with size options |
| **Icon Button** | Compact button with icon only |
| **FAB (Floating Action Button)** | Fixed-position circular action button |
| **Split Button** | Primary action + dropdown for secondary actions |
| **Button Group** | Row of related action buttons |

All implementations share the same slot tag contract.

---

## 10. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-21 | Initial creation reference |
`;