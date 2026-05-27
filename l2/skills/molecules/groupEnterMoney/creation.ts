/// <mls fileReference="_102020_/l2/skills/molecules/groupEnterMoney/creation.ts" enhancement="_blank"/>

export const skill = `
# groupEnterMoney — Creation

> Implementation reference for creating molecules in the **groupEnterMoney** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupEnterMoney\` |
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

---

## 3. Properties

### 3.1 Data

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`value\` | \`number \| null\` | \`null\` | \`@propertyDataSource\` | Monetary value as a plain number (e.g. \`1500.50\`) |
| \`error\` | \`string\` | \`''\` | \`@propertyDataSource\` | Error message (empty = no error) |
| \`name\` | \`string\` | \`''\` | \`@propertyDataSource\` | Field name (for forms) |

### 3.2 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`currency\` | \`string\` | \`'USD'\` | \`@propertyDataSource\` | ISO 4217 currency code (e.g. \`'USD'\`, \`'BRL'\`, \`'EUR'\`) |
| \`locale\` | \`string\` | \`''\` | \`@propertyDataSource\` | Locale for display formatting (e.g. \`'en-US'\`, \`'pt-BR'\`) |
| \`decimals\` | \`number\` | \`2\` | \`@propertyDataSource\` | Decimal places (use \`0\` for currencies without cents, e.g. JPY) |
| \`min\` | \`number \| null\` | \`null\` | \`@propertyDataSource\` | Minimum allowed value (null = no minimum) |
| \`max\` | \`number \| null\` | \`null\` | \`@propertyDataSource\` | Maximum allowed value (null = no maximum) |
| \`showSymbol\` | \`boolean\` | \`true\` | \`@propertyDataSource\` | Display currency symbol alongside the field |
| \`placeholder\` | \`string\` | \`''\` | \`@propertyDataSource\` | Placeholder when value is null |

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
| \`rawValue\` | \`string\` | \`''\` | \`@state\` | Locale-formatted string currently shown in the input (derived from \`value\`) |

---

## 4. Value Contract

### Storage Format

- Value stored and emitted as a native **JavaScript number** representing the monetary amount
- \`null\` means not yet provided
- **Never** store currency symbols or thousand separators — those are display only
- \`decimals\` defines precision (default 2 for cents-based currencies; 0 for e.g. JPY)

### Parsing Rules

Input typed by the user must be parsed according to the active locale:

| Locale | Thousand sep | Decimal sep | Input \`"1.500,50"\` → value |
|--------|-------------|-------------|---------------------------|
| \`pt-BR\` | \`.\` | \`,\` | \`1500.50\` |
| \`en-US\` | \`,\` | \`.\` | \`1500.50\` |
| \`''\` | (none) | \`.\` | \`1500.50\` |

Parsing algorithm:
1. Remove all characters that are not digits, the locale decimal separator, or a minus sign
2. Replace the locale decimal separator with \`.\`
3. Parse as \`parseFloat\`

### Display Format

| \`locale\` | \`currency\` | \`showSymbol\` | Value | Displayed |
|----------|-----------|-------------|-------|-----------|
| \`'en-US'\` | \`'USD'\` | \`true\` | \`1500.50\` | \`$1,500.50\` |
| \`'pt-BR'\` | \`'BRL'\` | \`true\` | \`1500.50\` | \`R$ 1.500,50\` |
| \`'en-US'\` | \`'EUR'\` | \`false\` | \`1500.50\` | \`1,500.50\` |

### View Mode

- If value is \`null\`: display \`"—"\`
- Otherwise: display value formatted with \`Intl.NumberFormat\` using \`currency\` and \`locale\`
- Currency symbol position follows the locale convention

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`change\` | \`{ value: number \| null }\` | ✓ | Value confirmed on blur |
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
| **Edit** | \`true\` | Renders locale-formatted text input |
| **View** | \`false\` | Renders fully formatted currency string as static text |

- In view mode: no input, no events, no error, no helper

---

## 7. Input Interaction

\`\`\`
ON FOCUS:
  - Select all input content for easy replacement
  - Emit \`focus\` event

ON INPUT (each keystroke):
  - Store raw string in rawValue
  - Attempt to parse: value = parseLocaleNumber(rawValue)
  - Emit \`input\` event with current parsed value (may be null if unparseable)

ON BLUR:
  - If rawValue is empty: set value = null
  - Else: parse rawValue → value
  - Clamp to min/max if applicable
  - Reformat: rawValue = formatToRaw(value)  ← normalize display
  - Emit \`change\` event
  - Emit \`blur\` event
\`\`\`

---

## 8. Validation Rules

| Rule | Behavior |
|------|----------|
| Value < \`min\` | Clamp to \`min\` on blur |
| Value > \`max\` | Clamp to \`max\` on blur |
| Non-numeric input | Clear on blur, value = null |
| \`required\` and \`null\` | Error state until a value is entered |
| Negative value when \`min >= 0\` | Clamp to \`min\` on blur |

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
| **Focused** | Input border highlighted, content selected |
| **Filled** | Value present, formatted |
| **Disabled** | Reduced opacity, no interaction |
| **Readonly** | No editing, text selectable |
| **Error** | Error border/style, error message visible |
| **Loading** | Loading indicator visible, input blocked |
| **View Mode** | Fully formatted currency string, no input |

---

## 11. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Label | \`aria-labelledby\` pointing to rendered label |
| Error | \`aria-describedby\` pointing to error element |
| Invalid | \`aria-invalid="true"\` when error exists |
| Required | \`aria-required="true"\` |
| Currency context | \`aria-label\` includes currency code when symbol alone is ambiguous |

---

## 12. Possible Implementations

| Component | Description |
|-----------|-------------|
| **Currency Input** | Locale-aware text input with currency symbol |
| **Price Field** | Compact input for product pricing, always positive |
| **Money Input** | General purpose, supports negative values (credits/debits) |
| **Currency Converter** | Two linked money inputs with exchange rate display |

---

## 13. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-20 | Initial creation reference |

`;
