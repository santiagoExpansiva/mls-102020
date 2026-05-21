/// <mls fileReference="_102020_/l2/skills/molecules/groupEnterBoolean/creation.ts" enhancement="_blank"/>

export const skill = `# groupEnterBoolean — Creation

> Implementation reference for creating molecules in the **groupEnterBoolean** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupEnterBoolean\` |
| **Category** | Data Entry |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Label\` | No | Label displayed above or beside the field |
| \`Helper\` | No | Help text displayed below the field |

\`\`\`typescript
slotTags = ['Label', 'Helper'];
\`\`\`

### Slot Hierarchy

\`\`\`
component (root)
├── <Label>
└── <Helper>
\`\`\`

---

## 3. Properties

### 3.1 Data

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`value\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Current boolean value. Starts as \`false\` until the user changes it |
| \`error\` | \`string\` | \`''\` | \`@propertyDataSource\` | Error message (empty = no error) |
| \`name\` | \`string\` | \`''\` | \`@propertyDataSource\` | Field name (for forms) |

### 3.2 States

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`isEditing\` | \`boolean\` | \`true\` | \`@propertyDataSource\` | Edit mode (true) or view mode (false) |
| \`disabled\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Field is disabled — no interaction possible |

---

## 4. Value Contract

### Storage Format

- Value stored and emitted as a native **JavaScript boolean** (\`true\` or \`false\`)
- Default is \`false\` — the component always has a defined value
- \`true\` means the positive choice is active
- \`false\` means the negative choice is active (or the field has not been interacted with)

### View Mode

- If \`value\` is \`true\`: display \`"Yes"\`
- If \`value\` is \`false\`: display \`"No"\`

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`change\` | \`{ value: boolean }\` | ✓ | Value changed by user interaction |
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
| **Edit** | \`true\` | Renders the interactive boolean control |
| **View** | \`false\` | Renders the current value as static text |

- In view mode: no interaction, no events, no error, no helper
- In view mode with \`value=true\`: render \`"Yes"\`
- In view mode with \`value=false\`: render \`"No"\`

---

## 7. Interaction Behavior Rules

### Toggle / Switch

- Clicking the toggle flips the value: \`false → true\`, \`true → false\`
- Emits \`change\` on each toggle
- When \`disabled\`: click is ignored

### Checkbox

- Unchecked maps to \`false\`; checked maps to \`true\`
- Clicking flips the value and emits \`change\`
- When \`disabled\`: click is ignored


---

## 8. Error Handling

| \`error\` value | Behavior |
|---------------|----------|
| \`''\` | No error — show Helper if slot exists |
| \`'any message'\` | Show error message, apply error visual state |

- Error is never shown in view mode
- Page/Organism is responsible for setting the error message

---

## 9. Visual States

| State | Behavior |
|-------|----------|
| **True** | True/positive option visually active |
| **False** | False/negative option visually inactive |
| **Focused** | Focus ring visible on the active control element |
| **Disabled** | Reduced opacity, pointer-events none, no interaction |
| **Error** | Error border or highlight, error message visible below |
| **View Mode** | Static text: "Yes" or "No" |

---

## 10. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Toggle/Switch | \`role="switch"\`, \`aria-checked="true"\` / \`"false"\` |
| Checkbox | \`<input type="checkbox">\` with \`checked\` property |
| Label | \`aria-labelledby\` pointing to rendered label |
| Error | \`aria-describedby\` pointing to error element |
| Invalid | \`aria-invalid="true"\` when error exists |
| Disabled | \`aria-disabled="true"\` and \`disabled\` on interactive elements |
| Keyboard | \`Space\` flips the value (applies to both implementations) |

---

## 11. Possible Implementations

| Component | Description |
|-----------|-------------|
| **Toggle / Switch** | Sliding switch, typically used for on/off settings |
| **Checkbox** | Standard HTML checkbox |

All implementations share the same slot tag contract (\`Label\`, \`Helper\`), the same properties, and the same events — they are fully interchangeable. Swapping one for the other requires only changing the component tag.

---

## 12. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-05-21 | Initial creation reference |

`
