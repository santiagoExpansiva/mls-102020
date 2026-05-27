/// <mls fileReference="_102020_/l2/skills/molecules/groupViewCard/creation.ts" enhancement="_blank"/>

export const skill = `
# groupViewCard — Creation

> Implementation reference for creating molecules in the **groupViewCard** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupViewCard\` |
| **Category** | Data Display |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`CardHeader\` | No | Top section of the card, typically contains title and description |
| \`CardTitle\` | No | Main title text inside the header |
| \`CardDescription\` | No | Secondary text inside the header |
| \`CardContent\` | No | Main body area of the card |
| \`CardFooter\` | No | Bottom section of the card |
| \`CardAction\` | No | Actionable element (button, link) inside the card |

\`\`\`typescript
slotTags = ['CardHeader', 'CardTitle', 'CardDescription', 'CardContent', 'CardFooter', 'CardAction'];
\`\`\`

### Slot Hierarchy

\`\`\`
component (root)
├── <CardHeader>
│   ├── <CardTitle>
│   └── <CardDescription>
├── <CardContent>
├── <CardFooter>
└── <CardAction>
\`\`\`

### Flexible Composition

All slots are optional. The card renders only the slots that are present:

- Header only: quick info card
- Content only: media card
- Header + Content + Footer: full structured card
- Any combination is valid

---

## 3. Properties

### 3.1 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`clickable\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Entire card is clickable (adds hover effect and cursor pointer) |
| \`selected\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Card is visually selected/highlighted |
| \`disabled\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Card is dimmed and non-interactive |
| \`loading\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Show skeleton placeholder instead of content |
| \`isEditing\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Change all children web components, atribute is-editing  |


---

## 4. Value Contract

This component has **no \`value\` property**. It is a visual composition primitive. The page or organism that contains the card is responsible for data and state.

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`cardClick\` | \`{}\` | ✓ | Fired when the card is clicked (only when \`clickable=true\`) |

### Dispatch Example

\`\`\`typescript
this.dispatchEvent(new CustomEvent('cardClick', {
  bubbles: true,
  composed: true,
  detail: {}
}));
\`\`\`

---

## 7. Visual States

| State | Behavior |
|-------|----------|
| **Normal** | Default appearance |
| **Hover** | Subtle hover effect (only when \`clickable=true\`) |
| **Selected** | Highlighted border or background |
| **Disabled** | Reduced opacity, no interaction |
| **Loading** | Skeleton placeholder matching the card layout |

---

## 8. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Clickable card | \`role="button"\`, \`tabindex="0"\` |
| Keyboard | \`Enter\`/\`Space\` triggers \`cardClick\` when clickable |
| Disabled | \`aria-disabled="true"\` |
| Selected | \`aria-selected="true"\` |
| Non-clickable | No role needed, renders as plain \`<div>\` |

---

## 9. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-21 | Initial creation reference |

`;
