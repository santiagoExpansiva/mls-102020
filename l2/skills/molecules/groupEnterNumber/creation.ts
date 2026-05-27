/// <mls fileReference="_102020_/l2/skills/molecules/groupEnterNumber/creation.ts" enhancement="_blank"/>

export const skill = `
# groupEnterNumber — Creation

> Implementation reference for creating molecules in the **groupEnterNumber** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupEnterNumber\` |
| **Category** | Data Entry |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Label\` | No | Label displayed above or beside the field |
| \`Helper\` | No | Help text displayed below the field |
| \`Prefix\` | No | Content rendered before the input (e.g. unit symbol) |
| \`Suffix\` | No | Content rendered after the input (e.g. unit label) |

\`\`\`typescript
slotTags = ['Label', 'Helper', 'Prefix', 'Suffix'];
\`\`\`

---

## 3. Properties

### 3.1 Data

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`value\` | \`number \| null\` | \`null\` | \`@propertyDataSource\` | Current numeric value |
| \`error\` | \`string\` | \`''\` | \`@propertyDataSource\` | Error message (empty = no error) |
| \`name\` | \`string\` | \`''\` | \`@propertyDataSource\` | Field name (for forms) |

### 3.2 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`min\` | \`number \| null\` | \`null\` | \`@propertyDataSource\` | Minimum allowed value (null = no minimum) |
| \`max\` | \`number \| null\` | \`null\` | \`@propertyDataSource\` | Maximum allowed value (null = no maximum) |
| \`step\` | \`number\` | \`1\` | \`@propertyDataSource\` | Increment/decrement step for stepper and slider |
| \`decimals\` | \`number\` | \`0\` | \`@propertyDataSource\` | Number of decimal places allowed |
| \`locale\` | \`string\` | \`''\` | \`@propertyDataSource\` | Locale for display formatting (e.g. \`'en-US'\`, \`'pt-BR'\`) |
| \`placeholder\` | \`string\` | \`''\` | \`@propertyDataSource\` | Placeholder text when value is null |

### 3.3 States

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`isEditing\` | \`boolean\` | \`true\` | \`@propertyDataSource\` | Edit mode (true) or view mode (false) |
| \`disabled\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Field is disabled |
| \`readonly\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Field is read-only |
| \`required\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Value is required |
| \`loading\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Loading state |

### 3.4 Internal State

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`rawValue\` | \`string\` | \`''\` | \`@state\` | Formatted string currently shown in the input (derived from \`value\`) |

---

## 4. Value Contract

### Storage Format

- Value stored and emitted as a native **JavaScript number**
- \`null\` means not yet provided
- Decimal precision controlled by \`decimals\` property
- Display format respects \`locale\` and \`decimals\`; stored value is always a plain number
- When \`decimals = 0\`, only integers are accepted

### Display Format

| \`locale\` | \`decimals\` | Value | Displayed |
|----------|------------|-------|-----------|
| \`'en-US'\` | \`0\` | \`1500\` | \`1,500\` |
| \`'pt-BR'\` | \`2\` | \`1500.5\` | \`1.500,50\` |
| \`''\` | \`2\` | \`1500.5\` | \`1500.50\` (browser default) |

### View Mode

- If value is \`null\`: display \`"—"\`
- Otherwise: display value formatted with \`locale\` and \`decimals\`
- Prefix/Suffix slots are rendered in view mode

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`change\` | \`{ value: number \| null }\` | ✓ | Value confirmed (on blur or stepper click) |
| \`input\` | \`{ value: number \| null }\` | ✓ | Value changed on each keystroke |
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
| **Edit** | \`true\` | Renders numeric input (with optional stepper or slider) |
| **View** | \`false\` | Renders formatted number as static text |

- In view mode: no input, no stepper, no events, no error, no helper

---

## 7. Stepper Logic

When the implementation uses a stepper (+/− buttons):

\`\`\`typescript
private increment() {
  const current = this.value ?? 0;
  const next = current + this.step;
  if (this.max !== null && next > this.max) return;
  this.value = this.roundToDecimals(next);
  this.rawValue = this.formatToDisplay(this.value);
  this.emitChange();
}

private decrement() {
  const current = this.value ?? 0;
  const next = current - this.step;
  if (this.min !== null && next < this.min) return;
  this.value = this.roundToDecimals(next);
  this.rawValue = this.formatToDisplay(this.value);
  this.emitChange();
}
\`\`\`

---

## 8. Validation Rules

| Rule | Behavior |
|------|----------|
| Value < \`min\` | Clamp to \`min\` on blur |
| Value > \`max\` | Clamp to \`max\` on blur |
| Non-numeric input | Ignored on keydown; cleared on blur |
| Decimals > \`decimals\` | Truncate or round on blur |
| \`required\` and \`null\` | Error state until a value is entered |

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
| **Focused** | Input border highlighted |
| **Filled** | Value present |
| **Disabled** | Reduced opacity, no interaction |
| **Readonly** | No editing, text selectable |
| **Error** | Error border/style, error message visible |
| **Loading** | Loading indicator visible, input blocked |
| **View Mode** | Formatted text only |

---

## 11. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Label | \`aria-labelledby\` pointing to rendered label |
| Error | \`aria-describedby\` pointing to error element |
| Invalid | \`aria-invalid="true"\` when error exists |
| Required | \`aria-required="true"\` |
| Stepper buttons | \`aria-label="Increment"\` / \`aria-label="Decrement"\` |
| Min/Max | \`aria-valuemin\` / \`aria-valuemax\` on slider implementations |
| Current value | \`aria-valuenow\` on slider implementations |

---

## 12. Possible Implementations

| Component | Description |
|-----------|-------------|
| **Number Input** | Plain text input accepting numeric values |
| **Stepper** | Input flanked by − and + buttons |
| **Slider** | Horizontal range slider for bounded values |
| **Percentage Input** | Number input locked to 0–100 with \`%\` suffix |
| **Quantity Selector** | Stepper with compact visual for cart-style quantities |

---

## 13. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-20 | Initial creation reference |

`;
