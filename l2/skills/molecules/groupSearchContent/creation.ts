/// <mls fileReference="_102020_/l2/skills/molecules/groupSearchContent/creation.ts" enhancement="_blank"/>

export const skill = `
# groupSearchContent — Creation

> Implementation reference for creating molecules in the **groupSearchContent** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupSearchContent\` |
| **Category** | Data Discovery |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Label\` | No | Label displayed above the search field |
| \`Helper\` | No | Help text displayed below the search field |
| \`Suggestion\` | No | One search suggestion. Attributes: \`value\` (required). Content = display label |
| \`Empty\` | No | Content shown when no suggestions match |

\`\`\`typescript
slotTags = ['Label', 'Helper', 'Suggestion', 'Empty'];
\`\`\`

### Slot Hierarchy

\`\`\`
component (root)
├── <Label>
├── <Suggestion value="...">...label...</Suggestion>
├── <Empty>
└── <Helper>
\`\`\`

---

## 3. Properties

### 3.1 Data

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`value\` | \`string \| null\` | \`null\` | \`@propertyDataSource\` | Confirmed value — either a suggestion's \`value\` or the raw typed text |
| \`error\` | \`string\` | \`''\` | \`@propertyDataSource\` | Error message (empty = no error) |
| \`name\` | \`string\` | \`''\` | \`@propertyDataSource\` | Field name (for forms) |

### 3.2 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`placeholder\` | \`string\` | \`''\` | \`@propertyDataSource\` | Placeholder text for the search input |
| \`debounce\` | \`number\` | \`300\` | \`@propertyDataSource\` | Debounce time in ms before emitting \`search\` event |

### 3.3 States

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`disabled\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Disables the search field |
| \`loading\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Shows loading indicator (e.g. while fetching suggestions) |

### 3.4 Internal State

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`query\` | \`string\` | \`''\` | \`@state\` | Current text in the search input |
| \`isOpen\` | \`boolean\` | \`false\` | \`@state\` | Whether the suggestions panel is open |

---

## 4. Value Contract

### Confirmation Logic

- **User selects a suggestion:** \`value\` = suggestion's \`value\` attribute, \`query\` = suggestion's label
- **User presses Enter without selecting:** \`value\` = raw \`query\` text
- **User clears the input:** \`value\` = \`null\`, \`query\` = \`''\`

### Search Flow

\`\`\`
1. User types → update query, debounce, emit \`search\` with { query }
2. Page calls BFF, updates <Suggestion> slot tags
3. Component renders suggestion list
4. User selects suggestion → value = suggestion.value, emit \`change\`
   OR user presses Enter → value = query text, emit \`change\`
5. Suggestions panel closes
\`\`\`

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`search\` | \`{ query: string }\` | ✓ | Fired (debounced) when user types — page should update suggestions |
| \`change\` | \`{ value: string \| null }\` | ✓ | Fired when a value is confirmed (suggestion selected or Enter pressed) |
| \`clear\` | \`{}\` | ✓ | Fired when the user clears the search |
| \`blur\` | \`{}\` | ✓ | Field lost focus |
| \`focus\` | \`{}\` | ✓ | Field received focus |

### Dispatch Example

\`\`\`typescript
this.dispatchEvent(new CustomEvent('search', {
  bubbles: true,
  composed: true,
  detail: { query: this.query }
}));

this.dispatchEvent(new CustomEvent('change', {
  bubbles: true,
  composed: true,
  detail: { value: this.value }
}));
\`\`\`

---

## 6. Reading Suggestions

Read suggestions inline using \`getSlots\`:

\`\`\`typescript
const suggestions = this.getSlots('Suggestion').map(el => ({
  value: el.getAttribute('value') || '',
  label: el.innerHTML,
}));
\`\`\`

---

## 7. Visual States

| State | Behavior |
|-------|----------|
| **Empty** | Placeholder visible, no suggestions |
| **Typing** | Input active, suggestions panel may open |
| **Open** | Suggestions panel visible |
| **Loading** | Loading indicator inside the suggestions area |
| **Selected** | Value confirmed, input shows selected label or query |
| **Disabled** | Dimmed, no interaction |
| **Error** | Error border/style, error message visible |

---

## 8. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Input | \`role="combobox"\`, \`aria-expanded\`, \`aria-autocomplete="list"\` |
| Suggestions panel | \`role="listbox"\` |
| Suggestion items | \`role="option"\`, \`aria-selected\` |
| Label | \`aria-labelledby\` pointing to rendered label |
| Error | \`aria-describedby\` pointing to error element |
| Invalid | \`aria-invalid="true"\` when error exists |
| Clear button | \`aria-label="Clear search"\` |
| Keyboard | \`ArrowDown\`/\`ArrowUp\` navigate suggestions; \`Enter\` confirms; \`Escape\` closes panel |

---

## 9. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-21 | Initial creation reference |
`;
