/// <mls fileReference="_102020_/l2/skills/molecules/groupNavigateSection/creation.ts" enhancement="_blank"/>

export const skill = `
# groupNavigateSection — Creation

> Implementation reference for creating molecules in the **groupNavigateSection** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupNavigateSection\` |
| **Category** | Navigation |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Label\` | No | Title displayed above the navigation |
| \`Tab\` | Yes | Defines one section. Attributes: \`value\` (required), \`title\` (required), \`disabled\`, \`icon\`. Content = the section body |

\`\`\`typescript
slotTags = ['Label', 'Tab'];
\`\`\`

### Slot Hierarchy

\`\`\`
component (root)
├── <Label>
└── <Tab value="..." title="..." icon="..." disabled>
      ...section content (text, HTML, web components)...
    </Tab>
\`\`\`

### Tab Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| \`value\` | \`string\` | Unique identifier for the section |
| \`title\` | \`string\` | Display text for the tab |
| \`icon\` | \`string\` (optional) | Icon content (emoji, text) displayed alongside the title |
| \`disabled\` | \`boolean\` (presence) | Tab cannot be selected |

---

## 3. Properties

### 3.1 Data

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`value\` | \`string \| null\` | \`null\` | \`@propertyDataSource\` | Value of the currently active tab. \`null\` = first tab is active |
| \`error\` | \`string\` | \`''\` | \`@propertyDataSource\` | Error message (empty = no error) |

### 3.2 States

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`disabled\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Disables all navigation |
| \`loading\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Show loading state |

---

## 4. Value Contract

- \`value\` is a **string** matching the \`value\` attribute of the active \`<Tab>\`
- \`null\` means no explicit selection — default to the first non-disabled tab
- When the user clicks a tab, \`value\` is updated and \`change\` is emitted
- The component renders only the content of the active tab — other tabs' content is hidden

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`change\` | \`{ value: string, title: string }\` | ✓ | Fired when the active tab changes |

### Dispatch Example

\`\`\`typescript
this.dispatchEvent(new CustomEvent('change', {
  bubbles: true,
  composed: true,
  detail: { value: this.value, title: 'Settings' }
}));
\`\`\`

---

## 6. Reading Tabs

Read tabs inline using \`getSlots\`:

\`\`\`typescript
const tabs = this.getSlots('Tab').map(el => ({
  value: el.getAttribute('value') || '',
  title: el.getAttribute('title') || '',
  icon: el.getAttribute('icon') || '',
  disabled: el.hasAttribute('disabled'),
}));
\`\`\`

---

## 7. Visual States

| State | Behavior |
|-------|----------|
| **Active** | Selected tab highlighted |
| **Inactive** | Default/unselected appearance |
| **Disabled (tab)** | Individual tab dimmed, not clickable |
| **Disabled (component)** | All tabs dimmed, no interaction |
| **Loading** | Loading placeholder |

---

## 8. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Container | \`role="tablist"\` |
| Tab | \`role="tab"\`, \`aria-selected\`, \`aria-disabled\`, \`aria-controls\` pointing to panel |
| Content panel | \`role="tabpanel"\`, \`aria-labelledby\` pointing to active tab |
| Label | \`aria-label\` from Label slot |
| Keyboard | \`ArrowLeft\`/\`ArrowRight\` navigate tabs; \`Enter\`/\`Space\` selects |

---

## 9. Possible Implementations

| Component | Description |
|-----------|-------------|
| **Tabs** | Horizontal tab bar with underline indicator |
| **Pills / Segmented Control** | Compact inline button group |
| **Navigation Menu** | Vertical or horizontal nav links |
| **Bottom Navigation** | Mobile bottom bar with icons and labels |
| **Pagination** | Numbered page navigation |

All implementations share the same slot tag contract.

---

## 10. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-21 | Initial creation reference |
| 1.1.0 | 2026-04-21 | Tab content rendered by component; section body inside Tab slot |
`