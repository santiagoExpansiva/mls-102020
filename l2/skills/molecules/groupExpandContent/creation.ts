/// <mls fileReference="_102020_/l2/skills/molecules/groupExpandContent/creation.ts" enhancement="_blank"/>

export const skill = `

# groupExpandContent — Creation

> Implementation reference for creating molecules in the **groupExpandContent** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupExpandContent\` |
| **Category** | Data Display |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Label\` | No | Title displayed above the component |
| \`Section\` | Yes | One expandable section. Attributes: \`title\` (required), \`disabled\`, \`expanded\` |

\`\`\`typescript
slotTags = ['Label', 'Section'];
\`\`\`

### Slot Hierarchy

\`\`\`
component (root)
├── <Label>
└── <Section title="..." expanded disabled>
      ...content...
    </Section>
\`\`\`

### Section Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| \`title\` | \`string\` | Header text displayed in the trigger area |
| \`expanded\` | \`boolean\` (presence) | Section starts expanded |
| \`disabled\` | \`boolean\` (presence) | Section cannot be toggled |

---

## 3. Properties

### 3.1 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`multiple\` | \`boolean\` | \`true\` | \`@propertyDataSource\` | Allow multiple sections open simultaneously. \`false\` = only one at a time (accordion) |

### 3.2 States

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`disabled\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Disables all sections |
| \`loading\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Show loading placeholder |

### 3.3 Internal State

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`openSections\` | \`Set<number>\` | from \`expanded\` attrs | \`@state\` | Indices of currently open sections |

---

## 4. Value Contract

This component has **no \`value\` property**. It is a layout/interaction component. Open/closed state is managed internally.

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`toggle\` | \`{ index: number, title: string, expanded: boolean }\` | ✓ | Fired when a section is expanded or collapsed |

### Dispatch Example

\`\`\`typescript
this.dispatchEvent(new CustomEvent('toggle', {
  bubbles: true,
  composed: true,
  detail: { index: 0, title: 'FAQ 1', expanded: true }
}));
\`\`\`

---

## 6. Reading Sections

Read sections inline using \`getSlots\`:

\`\`\`typescript
const sections = this.getSlots('Section').map((el, index) => ({
  index,
  title: el.getAttribute('title') || '',
  disabled: el.hasAttribute('disabled'),
  expanded: this.openSections.has(index),
}));
\`\`\`

Initialize \`openSections\` from \`expanded\` attributes in \`firstUpdated\`:

\`\`\`typescript
firstUpdated() {
  this.getSlots('Section').forEach((el, index) => {
    if (el.hasAttribute('expanded')) {
      this.openSections.add(index);
    }
  });
  this.requestUpdate();
}
\`\`\`

---

## 7. Visual States

| State | Behavior |
|-------|----------|
| **Collapsed** | Only section header visible |
| **Expanded** | Header + content visible, with expand animation |
| **Disabled (section)** | Individual section dimmed, cannot toggle |
| **Disabled (component)** | All sections dimmed, no interaction |
| **Loading** | Placeholder instead of sections |

---

## 8. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Section header | \`role="button"\`, \`tabindex="0"\`, \`aria-expanded\` |
| Section content | \`role="region"\`, \`aria-labelledby\` pointing to header |
| Disabled | \`aria-disabled="true"\` on header |
| Keyboard | \`Enter\`/\`Space\` toggles section; \`ArrowDown\`/\`ArrowUp\` navigate between headers |

---


## 9. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-21 | Initial creation reference |
`;