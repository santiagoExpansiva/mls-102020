/// <mls fileReference="_102020_/l2/skills/molecules/groupEnterDateTime/creation.ts" enhancement="_blank"/>

export const skill = `

# groupEnterDateTime — Creation

> Implementation reference for creating molecules in the **groupEnterDateTime** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupEnterDateTime\` |
| **Category** | Data Entry |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Label\` | No | Field label |
| \`Helper\` | No | Help text displayed below the field |

\`\`\`typescript
slotTags = ['Label', 'Helper'];
\`\`\`

---

## 3. Properties

### 3.1 Data

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`value\` | \`string \| null\` | \`null\` | \`@propertyDataSource\` | ISO 8601 datetime string (\`"YYYY-MM-DDTHH:mm:ss"\`) |
| \`error\` | \`string\` | \`''\` | \`@propertyDataSource\` | Error message (empty = no error) |
| \`name\` | \`string\` | \`''\` | \`@propertyDataSource\` | Field name (for forms) |

### 3.2 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`locale\` | \`string\` | \`''\` | \`@propertyDataSource\` | Locale for display formatting (e.g., \`'en-US'\`, \`'pt-BR'\`) |
| \`timezone\` | \`string\` | \`''\` | \`@propertyDataSource\` | IANA timezone. Empty = local |
| \`minDatetime\` | \`string\` | \`''\` | \`@propertyDataSource\` | Minimum allowed datetime (ISO 8601) |
| \`maxDatetime\` | \`string\` | \`''\` | \`@propertyDataSource\` | Maximum allowed datetime (ISO 8601) |
| \`minuteStep\` | \`number\` | \`1\` | \`@propertyDataSource\` | Minutes increment in time picker |
| \`placeholder\` | \`string\` | \`''\` | \`@propertyDataSource\` | Placeholder text |

### 3.3 States

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`isEditing\` | \`boolean\` | \`true\` | \`@propertyDataSource\` | Edit mode (true) or view mode (false) |
| \`disabled\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Field is disabled |
| \`readonly\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Field is read-only |
| \`required\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Field is required |
| \`loading\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Loading state |

### 3.4 Internal State

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`isOpen\` | \`boolean\` | \`false\` | \`@state\` | Picker panel is open |
| \`isFocused\` | \`boolean\` | \`false\` | \`@state\` | Field has focus |

---

## 4. Value Contract

### Storage Format

- \`value\` is always stored as **ISO 8601**: \`"YYYY-MM-DDTHH:mm:ss"\`
- Time is always stored in **24-hour format**, regardless of display locale
- \`null\` represents no value selected

### Display Format

Display is locale-aware. The molecule formats \`value\` for display only — never modifies the stored value.

| Locale | Stored value | Displayed |
|--------|-------------|-----------|
| \`en-US\` | \`"2026-04-17T14:30:00"\` | \`04/17/2026 02:30 PM\` |
| \`pt-BR\` | \`"2026-04-17T14:30:00"\` | \`17/04/2026 14:30\` |
| \`de-DE\` | \`"2026-04-17T14:30:00"\` | \`17.04.2026 14:30\` |

### Derived State

\`value\` is bound via \`@propertyDataSource\`. If your implementation maintains derived state (e.g., a formatted display string), use \`handleIcaStateChange\` to recalculate when \`value\` changes externally. See \`molecule-generation2.md\` section 11.

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`change\` | \`{ value: string \| null }\` | ✓ | User confirmed a datetime selection |
| \`blur\` | \`{}\` | ✓ | Field lost focus |
| \`focus\` | \`{}\` | ✓ | Field received focus |

### Dispatch Example

\`\`\`typescript
this.dispatchEvent(new CustomEvent('change', {
  bubbles: true,
  composed: true,
  detail: { value: this.value } // "2026-04-17T14:30:00" or null
}));
\`\`\`

---

## 6. isEditing Mode

| Mode | \`isEditing\` | Behavior |
|------|-------------|----------|
| **Edit** | \`true\` | Renders input trigger + picker panel |
| **View** | \`false\` | Renders formatted datetime as static text |

### View Mode Rules

- Format \`value\` using \`locale\` and display as text
- If \`value\` is \`null\`, display \`"—"\` (em dash)
- No input, no picker, no events, no error, no helper

---

## 7. Error Handling

| \`error\` value | Behavior |
|---------------|----------|
| \`''\` | No error — show Helper if slot exists |
| \`'any message'\` | Show error message below input, apply error visual state |

- Error is never shown in view mode (\`isEditing === false\`)
- The molecule displays the error; the **Page/Organism** is responsible for setting it

---

## 8. Visual States

| State | Behavior |
|-------|----------|
| **Normal** | Default appearance |
| **Focus** | Highlighted border or outline |
| **Hover** | Subtle visual feedback |
| **Open** | Picker panel visible |
| **Disabled** | Reduced opacity, no interaction |
| **Readonly** | No editing, text selectable |
| **Error** | Error border/style, error message visible |
| **Loading** | Loading indicator visible |
| **View Mode** | Formatted text only, no picker |

---

## 9. Value Handling

### Parsing Input to Value

When the user selects date and time in the picker:

\`\`\`
date part  → "YYYY-MM-DD"  (from calendar selection)
time part  → "HH:mm"       (from time columns, always 24h)
combined   → "YYYY-MM-DDTHH:mm:00"
\`\`\`

### Applying minDatetime / maxDatetime

- Disable calendar days entirely outside the allowed range
- For the boundary day: disable time options that fall outside the boundary

### minuteStep

- Only show minutes that are multiples of \`minuteStep\`
- Example: \`minuteStep=15\` → show 00, 15, 30, 45

---

## 10. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Associated label | \`aria-labelledby\` |
| Error announced | \`aria-describedby\` pointing to error element |
| Invalid state | \`aria-invalid="true"\` when error exists |
| Required field | \`aria-required="true"\` |
| Picker dialog | \`role="dialog"\`, \`aria-modal="true"\` |
| Current value | \`aria-label\` on trigger with formatted datetime |
| Day cells | \`role="gridcell"\`, \`aria-selected\`, \`aria-disabled\` |

---

## 11. Possible Implementations

| Component | Description |
|-----------|-------------|
| **DateTime Picker** | Input trigger + calendar + clock panel (popup) |
| **DateTime Input** | Masked text input with format validation |
| **DateTime Inline** | Always-visible calendar + clock, no popup |

---

## 12. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-17 | Initial creation reference |


`