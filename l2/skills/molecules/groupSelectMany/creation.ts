/// <mls fileReference="_102020_/l2/skills/molecules/groupSelectMany/creation.ts" enhancement="_blank"/>

export const skill = `
# groupSelectMany — Creation

> Implementation reference for creating molecules in the **groupSelectMany** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupSelectMany\` |
| **Category** | Data Entry |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Label\` | No | Label displayed above or beside the field |
| \`Helper\` | No | Help text displayed below the field |
| \`Trigger\` | No | Custom content for the trigger button (for dropdown implementations) |
| \`Item\` | Yes | Defines one selectable option. Attributes: \`value\` (required), \`disabled\` |
| \`Group\` | No | Groups items under a named heading. Attribute: \`label\` |
| \`Empty\` | No | Content shown when no items are available |

\`\`\`typescript
slotTags = ['Label', 'Helper', 'Trigger', 'Item', 'Group', 'Empty'];
\`\`\`

### Slot Hierarchy

\`\`\`
component (root)
├── <Label>
├── <Trigger>
├── <Group>
│   └── <Item value="..." disabled>
├── <Item>
├── <Empty>
└── <Helper>
\`\`\`

---

## 3. Properties

### 3.1 Data

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`value\` | \`string\` | \`''\` | \`@propertyDataSource\` | Comma-separated selected values (e.g. \`"tag1,tag2,tag3"\`) |
| \`error\` | \`string\` | \`''\` | \`@propertyDataSource\` | Error message (empty = no error) |
| \`name\` | \`string\` | \`''\` | \`@propertyDataSource\` | Field name (for forms) |

### 3.2 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`placeholder\` | \`string\` | \`''\` | \`@propertyDataSource\` | Text shown when no items are selected (fallback when no \`Trigger\` slot) |
| \`searchable\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Show a search input to filter items |
| \`minSelection\` | \`number\` | \`0\` | \`@propertyDataSource\` | Minimum number of selected items (0 = no minimum) |
| \`maxSelection\` | \`number\` | \`0\` | \`@propertyDataSource\` | Maximum number of selected items (0 = no limit) |

### 3.3 States

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`isEditing\` | \`boolean\` | \`true\` | \`@propertyDataSource\` | Edit mode (true) or view mode (false) |
| \`disabled\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Field is disabled |
| \`readonly\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Field is read-only |
| \`required\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | At least one selection is required |
| \`loading\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Loading state (items not yet available) |

### 3.4 Internal State

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`isOpen\` | \`boolean\` | \`false\` | \`@state\` | Whether the selector panel is currently open (for dropdown implementations) |
| \`searchQuery\` | \`string\` | \`''\` | \`@state\` | Current search filter text (used when \`searchable=true\`) |

---

## 4. Value Contract

### Storage Format

- Value stored as a **comma-separated string** of selected item values
- Empty string \`''\` means no items selected
- Example: \`"apple,banana,grape"\`
- Item values **must not contain commas**

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`change\` | \`{ value: string }\` | ✓ | Selection changed — value is comma-separated string |
| \`blur\` | \`{}\` | ✓ | Field lost focus |
| \`focus\` | \`{}\` | ✓ | Field received focus |

### Dispatch Example

\`\`\`typescript
this.dispatchEvent(new CustomEvent('change', {
  bubbles: true,
  composed: true,
  detail: { value: this.value }
}));
\`\`\`

---

## 6. isEditing Mode

| Mode | \`isEditing\` | Behavior |
|------|-------------|----------|
| **Edit** | \`true\` | Renders interactive multi-select |
| **View** | \`false\` | Renders selected labels as static text or tags |

- In view mode: no trigger, no panel, no events, no error, no helper

---


## 7. Open/Close Behavior (dropdown implementations)

- Clicking the trigger toggles \`isOpen\`
- Selecting an item toggles its value but **does not close** the panel (user may select more)
- Pressing \`Escape\` closes the panel
- Clicking outside the component closes the panel
- When \`disabled\` or \`readonly\`: trigger click is ignored, panel never opens

---

## 8. Validation Rules

| Rule | Behavior |
|------|----------|
| \`required\` and \`value === ''\` | Error state until at least one item is selected |
| Selected count < \`minSelection\` | Error state |
| Selected count >= \`maxSelection\` | Additional items cannot be selected (disabled visually) |
| Item with \`disabled\` attribute | Rendered but not selectable |

---

## 9. Error Handling

| \`error\` value | Behavior |
|---------------|----------|
| \`''\` | No error — show Helper if slot exists |
| \`'any message'\` | Show error message, apply error visual state |

- Error never shown in view mode
- Page/Organism is responsible for setting the error message

---

## 10. Visual States

| State | Behavior |
|-------|----------|
| **Normal** | Default appearance |
| **Open** | Selector panel visible (dropdown implementations) |
| **Partial** | Some items selected — trigger shows count or tags |
| **Full** | \`maxSelection\` reached — unselected items visually disabled |
| **Disabled** | Reduced opacity, no interaction |
| **Readonly** | No interaction, selected items visible |
| **Error** | Error border/style, error message visible |
| **Loading** | Loading indicator; panel does not open |
| **View Mode** | Selected labels as plain text or tags |

---

## 11. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Container (checkbox/chips) | \`role="group"\` |
| Container (dropdown) | \`role="combobox"\`, \`aria-expanded\`, \`aria-haspopup="listbox"\` |
| Panel (dropdown) | \`role="listbox"\`, \`aria-multiselectable="true"\` |
| Items | \`role="option"\`, \`aria-selected\`, \`aria-disabled\` |
| Label | \`aria-labelledby\` pointing to rendered label |
| Error | \`aria-describedby\` pointing to error element |
| Invalid | \`aria-invalid="true"\` when error exists |
| Required | \`aria-required="true"\` |
| Keyboard | \`ArrowDown\`/\`ArrowUp\` navigate; \`Space\` toggles; \`Escape\` closes |

---

## 12. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-21 | Initial creation reference |

`;
