/// <mls fileReference="_102020_/l2/skills/molecules/groupRateItem/creation.ts" enhancement="_blank"/>

export const skill = `
# groupRateItem — Creation

> Implementation reference for creating molecules in the **groupRateItem** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupRateItem\` |
| **Category** | Data Entry |
| **Version** | \`1.0.0\` |
---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Label\` | No | Label displayed above or beside the field |
| \`Helper\` | No | Help text displayed below the field |
| \`Item\` | No | Defines one selectable rating option. Attribute: \`value\` (required). Content = visual label (emoji, icon, text) |

\`\`\`typescript
slotTags = ['Label', 'Helper', 'Item'];
\`\`\`

### Slot Hierarchy

\`\`\`
component (root)
├── <Label>
├── <Item value="...">
└── <Helper>
\`\`\`

### Item vs Auto-generate

- **If \`<Item>\` slots exist:** render only the declared items. \`min\`, \`max\`, \`step\` are ignored
- **If no \`<Item>\` slots:** auto-generate options from \`min\` to \`max\` with \`step\` increments, using the implementation's default visual (stars, dots, numbers, etc.)

---

## 3. Properties

### 3.1 Data

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`value\` | \`number \| null\` | \`null\` | \`@propertyDataSource\` | Currently selected rating value |
| \`error\` | \`string\` | \`''\` | \`@propertyDataSource\` | Error message (empty = no error) |
| \`name\` | \`string\` | \`''\` | \`@propertyDataSource\` | Field name (for forms) |

### 3.2 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`min\` | \`number\` | \`0\` | \`@propertyDataSource\` | Minimum rating value (used when no \`<Item>\` slots) |
| \`max\` | \`number\` | \`5\` | \`@propertyDataSource\` | Maximum rating value (used when no \`<Item>\` slots) |
| \`step\` | \`number\` | \`1\` | \`@propertyDataSource\` | Increment between values (used when no \`<Item>\` slots) |

### 3.3 States

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`isEditing\` | \`boolean\` | \`true\` | \`@propertyDataSource\` | Edit mode (true) or view mode (false) |
| \`disabled\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Field is disabled |
| \`readonly\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Field is read-only |
| \`required\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | A rating is required |

### 3.4 Internal State

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`hoverValue\` | \`number \| null\` | \`null\` | \`@state\` | Value being hovered (for visual preview before selection) |

---

## 4. Value Contract

### Storage Format

- Value stored and emitted as a native **number**
- \`null\` means no rating selected
- When using \`<Item>\` slots, value matches the \`value\` attribute of the selected item (parsed as number)
- When auto-generated, value is a number in the \`min\`–\`max\` range

### View Mode

- If \`value\` is \`null\`: display \`"—"\`
- Otherwise: display the selected rating visually (filled stars, highlighted emoji, etc.)
- No hover effect, no interaction

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`change\` | \`{ value: number \| null }\` | ✓ | Rating selected |
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
| **Edit** | \`true\` | Renders interactive rating options |
| **View** | \`false\` | Renders selected value as static visual |

- In view mode: no interaction, no hover, no events, no error, no helper

---

## 7. Hover Behavior

When editing and not disabled/readonly:

- On mouse enter over an option: set \`hoverValue\` to that option's value
- All options up to \`hoverValue\` are visually highlighted (for cumulative implementations like stars)
- For discrete implementations (emoji, thumbs): only the hovered option is highlighted
- On mouse leave: reset \`hoverValue\` to \`null\`, visual returns to reflect \`value\`
- On click: set \`value\` = clicked option's value, emit \`change\`

---

## 8. Reading Items

When \`<Item>\` slots are present, read them inline using \`getSlots\`:

\`\`\`typescript
const items = this.getSlots('Item').map(el => ({
  value: Number(el.getAttribute('value')),
  label: el.innerHTML,
}));
\`\`\`

When no \`<Item>\` slots, generate options:

\`\`\`typescript
const items = [];
for (let v = this.min; v <= this.max; v += this.step) {
  items.push({ value: v, label: '' });
}
\`\`\`

---

## 9. Validation Rules

| Rule | Behavior |
|------|----------|
| \`required\` and \`value === null\` | Error state until a rating is selected |

---

## 10. Error Handling

| \`error\` value | Behavior |
|---------------|----------|
| \`''\` | No error — show Helper if slot exists |
| \`'any message'\` | Show error message, apply error visual state |

- Error never shown in view mode
- Page/Organism is responsible for setting the error message

---

## 11. Visual States

| State | Behavior |
|-------|----------|
| **Normal** | Default appearance, no selection |
| **Hovered** | Preview highlight on the hovered option |
| **Selected** | Selected value visually active |
| **Disabled** | Reduced opacity, no interaction |
| **Readonly** | No interaction, selected value visible |
| **Error** | Error border/style, error message visible |
| **View Mode** | Static visual of selected value |

---

## 12. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Container | \`role="radiogroup"\` |
| Each option | \`role="radio"\`, \`aria-checked\`, \`aria-label\` with the value |
| Label | \`aria-labelledby\` pointing to rendered label |
| Error | \`aria-describedby\` pointing to error element |
| Invalid | \`aria-invalid="true"\` when error exists |
| Required | \`aria-required="true"\` |
| Keyboard | \`ArrowLeft\`/\`ArrowRight\` navigate options; \`Enter\`/\`Space\` selects |

---


## 13. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-21 | Initial creation reference |
`;
