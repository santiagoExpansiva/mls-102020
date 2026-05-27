/// <mls fileReference="_102020_/l2/skills/molecules/groupEnterDate/creation.ts" enhancement="_blank"/>

export const skill = `

# groupEnterDate — Creation

> Implementation reference for creating molecules in the **groupEnterDate** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupEnterDate\` |
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
| \`value\` | \`string \| null\` | \`null\` | \`@propertyDataSource\` | ISO 8601 date string (\`"YYYY-MM-DD"\`) |
| \`error\` | \`string\` | \`''\` | \`@propertyDataSource\` | Error message (empty = no error) |
| \`name\` | \`string\` | \`''\` | \`@propertyDataSource\` | Field name (for forms) |

### 3.2 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`locale\` | \`string\` | \`''\` | \`@propertyDataSource\` | Locale for display formatting |
| \`minDate\` | \`string\` | \`''\` | \`@propertyDataSource\` | Minimum allowed date (\`"YYYY-MM-DD"\`) |
| \`maxDate\` | \`string\` | \`''\` | \`@propertyDataSource\` | Maximum allowed date (\`"YYYY-MM-DD"\`) |
| \`placeholder\` | \`string\` | \`''\` | \`@propertyDataSource\` | Placeholder text |
| \`firstDayOfWeek\` | \`number\` | \`0\` | \`@propertyDataSource\` | First day of week: 0=Sunday, 1=Monday |
| \`showWeekNumbers\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Show week numbers in the calendar |

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
| \`isOpen\` | \`boolean\` | \`false\` | \`@state\` | Calendar panel is open |
| \`viewMonth\` | \`number\` | current | \`@state\` | Month currently displayed in calendar |
| \`viewYear\` | \`number\` | current | \`@state\` | Year currently displayed in calendar |

---

## 4. Value Contract

### Storage Format

- \`value\` is always stored as **ISO 8601 date**: \`"YYYY-MM-DD"\`
- **No time component** — never store or emit time information
- \`null\` represents no value selected

### Display Format

| Locale | Stored | Displayed |
|--------|--------|-----------|
| \`en-US\` | \`"2026-04-17"\` | \`04/17/2026\` |
| \`pt-BR\` | \`"2026-04-17"\` | \`17/04/2026\` |
| \`de-DE\` | \`"2026-04-17"\` | \`17.04.2026\` |
| \`en-GB\` | \`"2026-04-17"\` | \`17/04/2026\` |

### View Mode

- If \`value\` is \`null\`, display \`"—"\` (em dash)

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`change\` | \`{ value: string \| null }\` | ✓ | User selected or cleared a date |
| \`monthChange\` | \`{ year: number, month: number }\` | ✓ | Calendar navigated to a different month |
| \`blur\` | \`{}\` | ✓ | Field lost focus |
| \`focus\` | \`{}\` | ✓ | Field received focus |

### Dispatch Example

\`\`\`typescript
this.dispatchEvent(new CustomEvent('change', {
  bubbles: true,
  composed: true,
  detail: { value: this.value } // "2026-04-17" or null
}));
\`\`\`

---

## 6. isEditing Mode

| Mode | \`isEditing\` | Behavior |
|------|-------------|----------|
| **Edit** | \`true\` | Renders input trigger + calendar panel |
| **View** | \`false\` | Renders formatted date as static text |

- In view mode: no input, no calendar, no events, no error, no helper

---

## 7. Error Handling

| \`error\` value | Behavior |
|---------------|----------|
| \`''\` | No error — show Helper if slot exists |
| \`'any message'\` | Show error message, apply error visual state |

- Error never shown in view mode
- Page/Organism is responsible for setting the error message

---

## 8. Visual States

| State | Behavior |
|-------|----------|
| **Normal** | Default appearance |
| **Focus** | Highlighted border or outline |
| **Hover** | Subtle visual feedback |
| **Open** | Calendar panel visible |
| **Disabled** | Reduced opacity, no interaction |
| **Readonly** | No editing, text selectable |
| **Error** | Error border/style, error message visible |
| **Loading** | Loading indicator visible |
| **View Mode** | Formatted text only, no calendar |

---

## 9. Value Handling

### Parsing

- Calendar day selection → \`"YYYY-MM-DD"\` string
- Never derive or append a time component

### minDate / maxDate

- Disable calendar days that fall outside the allowed range
- Prevent navigation to months entirely before \`minDate\` or after \`maxDate\`

---

## 10. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Associated label | \`aria-labelledby\` |
| Error announced | \`aria-describedby\` pointing to error element |
| Invalid state | \`aria-invalid="true"\` when error exists |
| Required field | \`aria-required="true"\` |
| Calendar dialog | \`role="dialog"\`, \`aria-modal="true"\` |
| Day cells | \`role="gridcell"\`, \`aria-selected\`, \`aria-disabled\` |
| Month heading | \`aria-live="polite"\` |

---

## 11. Possible Implementations

| Component | Description |
|-----------|-------------|
| **Date Picker** | Input trigger + calendar popup |
| **Date Input** | Masked text input (\`MM/DD/YYYY\`) |
| **Calendar Inline** | Always-visible calendar, no popup |
| **Month Picker** | Select month + year only, no day |

---

## 12. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-17 | Initial creation reference |

`