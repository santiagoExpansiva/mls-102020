/// <mls fileReference="_102020_/l2/skills/molecules/groupEnterDateInterval/creation.ts" enhancement="_blank"/>

export const skill = `
# groupEnterDateInterval — Creation

> Implementation reference for creating molecules in the **groupEnterDateInterval** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupEnterDateInterval\` |
| **Category** | Data Entry |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Label\` | No | Overall label for the range field |
| \`LabelStart\` | No | Label for the start date input |
| \`LabelEnd\` | No | Label for the end date input |
| \`Helper\` | No | Help text displayed below the field |

\`\`\`typescript
slotTags = ['Label', 'LabelStart', 'LabelEnd', 'Helper'];
\`\`\`

---

## 3. Properties

### 3.1 Data

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`startDate\` | \`string \| null\` | \`null\` | \`@propertyDataSource\` | Start date (\`"YYYY-MM-DD"\`) |
| \`endDate\` | \`string \| null\` | \`null\` | \`@propertyDataSource\` | End date (\`"YYYY-MM-DD"\`) |
| \`error\` | \`string\` | \`''\` | \`@propertyDataSource\` | Error message (empty = no error) |
| \`name\` | \`string\` | \`''\` | \`@propertyDataSource\` | Field name (for forms) |

### 3.2 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`locale\` | \`string\` | \`''\` | \`@propertyDataSource\` | Locale for display formatting |
| \`minDate\` | \`string\` | \`''\` | \`@propertyDataSource\` | Minimum selectable date (\`"YYYY-MM-DD"\`) |
| \`maxDate\` | \`string\` | \`''\` | \`@propertyDataSource\` | Maximum selectable date (\`"YYYY-MM-DD"\`) |
| \`minRangeDays\` | \`number\` | \`0\` | \`@propertyDataSource\` | Minimum range in days (0 = no minimum) |
| \`maxRangeDays\` | \`number\` | \`0\` | \`@propertyDataSource\` | Maximum range in days (0 = no maximum) |
| \`firstDayOfWeek\` | \`number\` | \`0\` | \`@propertyDataSource\` | First day of week: 0=Sunday, 1=Monday |
| \`allowSameDay\` | \`boolean\` | \`true\` | \`@propertyDataSource\` | Allow start and end on the same day |

### 3.3 States

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`isEditing\` | \`boolean\` | \`true\` | \`@propertyDataSource\` | Edit mode (true) or view mode (false) |
| \`disabled\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Field is disabled |
| \`readonly\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Field is read-only |
| \`required\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Both dates are required |
| \`loading\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Loading state |

### 3.4 Internal State

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`isOpen\` | \`boolean\` | \`false\` | \`@state\` | Calendar panel is open |
| \`selectingEnd\` | \`boolean\` | \`false\` | \`@state\` | Currently in end-date selection phase |
| \`hoverDate\` | \`string \| null\` | \`null\` | \`@state\` | Date being hovered during range selection |

---

## 4. Value Contract

### Storage Format

- \`startDate\` and \`endDate\` are always ISO 8601 date strings: \`"YYYY-MM-DD"\`
- **No time component** — never store or emit time information
- \`null\` means the date has not been selected yet
- \`endDate\` must always be ≥ \`startDate\` (enforced by the component)

### Display Format

| Locale | Range | Displayed |
|--------|-------|-----------|
| \`en-US\` | \`"2026-04-01"\` → \`"2026-04-30"\` | \`04/01/2026 – 04/30/2026\` |
| \`pt-BR\` | \`"2026-04-01"\` → \`"2026-04-30"\` | \`01/04/2026 – 30/04/2026\` |

### View Mode

- If both are \`null\`: display \`"—"\`
- If only \`startDate\` is set: display \`"startDate – —"\`
- If both are set: display full formatted range

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`change\` | \`{ startDate: string \| null, endDate: string \| null }\` | ✓ | Both dates confirmed |
| \`startChange\` | \`{ value: string \| null }\` | ✓ | Start date changed |
| \`endChange\` | \`{ value: string \| null }\` | ✓ | End date changed |
| \`blur\` | \`{}\` | ✓ | Field lost focus |
| \`focus\` | \`{}\` | ✓ | Field received focus |

### Dispatch Example

\`\`\`typescript
// Emit individual change
this.dispatchEvent(new CustomEvent('startChange', {
  bubbles: true,
  composed: true,
  detail: { value: this.startDate }
}));

// Emit consolidated change when both are confirmed
this.dispatchEvent(new CustomEvent('change', {
  bubbles: true,
  composed: true,
  detail: { startDate: this.startDate, endDate: this.endDate }
}));
\`\`\`

---

## 6. isEditing Mode

| Mode | \`isEditing\` | Behavior |
|------|-------------|----------|
| **Edit** | \`true\` | Renders two date inputs + range calendar |
| **View** | \`false\` | Renders formatted date range as static text |

- In view mode: no inputs, no calendar, no events, no error, no helper

---

## 7. Selection Flow

\`\`\`
1. User clicks/focuses the trigger
2. Calendar opens — selectingEnd = false
3. User clicks start date:
   - startDate is set
   - endDate = null
   - selectingEnd = true
   - emit startChange
4. User hovers dates → range preview highlighted (startDate to hoverDate)
5. User clicks end date:
   - IF clicked date >= startDate: set endDate, emit endChange + change
   - IF clicked date < startDate: swap — new startDate = clicked, endDate = old startDate
   - selectingEnd = false
   - close calendar
\`\`\`

---

## 8. Error Handling

| \`error\` value | Behavior |
|---------------|----------|
| \`''\` | No error — show Helper if slot exists |
| \`'any message'\` | Show error message, apply error visual state |

- Error never shown in view mode
- Page/Organism is responsible for setting the error message

---

## 9. Visual States

| State | Behavior |
|-------|----------|
| **Normal** | Default appearance |
| **Selecting** | Start selected, range preview on hover |
| **Complete** | Both dates set, range highlighted |
| **Disabled** | Reduced opacity, no interaction |
| **Readonly** | No editing, text selectable |
| **Error** | Error border/style, error message visible |
| **Loading** | Loading indicator visible |
| **View Mode** | Formatted text only |

---

## 10. Value Handling

### Range Validation

| Rule | Behavior |
|------|----------|
| \`endDate < startDate\` | Swap the two values |
| \`allowSameDay=false\` and same day selected | Prevent selection, keep selectingEnd=true |
| Range < \`minRangeDays\` | Visually grey out invalid end dates |
| Range > \`maxRangeDays\` | Visually grey out dates beyond maximum |

### minDate / maxDate

- Disable calendar days outside the allowed bounds
- Prevent navigation to months entirely outside the allowed range

---

## 11. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Labels | \`aria-labelledby\` for each input |
| Error | \`aria-describedby\` pointing to error element |
| Invalid | \`aria-invalid="true"\` when error exists |
| Required | \`aria-required="true"\` |
| Calendar dialog | \`role="dialog"\`, \`aria-modal="true"\` |
| Day cells | \`role="gridcell"\`, \`aria-selected\`, \`aria-disabled\` |

---

## 12. Possible Implementations

| Component | Description |
|-----------|-------------|
| **Date Range Picker** | Two inputs + dual-month calendar popup |
| **Date Range Inline** | Always-visible dual calendar |
| **Date Range with Presets** | Quick options (Last 7 days, This month) + custom range |

---

## 13. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-17 | Initial creation reference |


`