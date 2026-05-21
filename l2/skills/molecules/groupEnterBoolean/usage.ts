/// <mls fileReference="_102020_/l2/skills/molecules/groupEnterBoolean/usage.ts" enhancement="_blank"/>

export const skill = `
# enter + boolean — Usage

> Quick reference for using molecules in the **enter + boolean** group.
> Use this when you need the user to provide a **true/false decision**.
> Value is always \`boolean\` — starts as \`false\` until the user changes it.

---

## Slot Tags

| Tag | Description |
|-----|-------------|
| \`Label\` | Label displayed above or beside the field |
| \`Helper\` | Descriptive text shown below the field when there is no error |

---

## Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| \`value\` | \`boolean\` | \`false\` | Current boolean value. Starts as \`false\` until the user changes it |
| \`error\` | \`string\` | \`''\` | Error message. Empty string means no error |
| \`name\` | \`string\` | \`''\` | Field name for form identification |
| \`isEditing\` | \`boolean\` | \`true\` | \`true\` = interactive control, \`false\` = read-only display |
| \`disabled\` | \`boolean\` | \`false\` | Disables the field entirely |

---

## Events

| Event | Detail | Description |
|-------|--------|-------------|
| \`change\` | \`{ value: boolean }\` | Fired when the user changes the selection |
| \`blur\` | \`{}\` | Fired when the field loses focus |
| \`focus\` | \`{}\` | Fired when the field receives focus |

---

## Value Format

- Value is always a native **JavaScript boolean** (\`true\` or \`false\`)
- Default is \`false\` — the component always has a defined value
- In view mode: \`true\` → "Yes"; \`false\` → "No"

---

## Examples

### Simple toggle (on/off setting)

\`\`\`html
<molecules--toggle-102020
  value="{{ui.settings.notifications}}"
  error="{{ui.settings.notificationsError}}">
  <Label>Enable notifications</Label>
</molecules--toggle-102020>
\`\`\`

### Checkbox with terms acceptance

\`\`\`html
<molecules--checkbox-102020
  value="{{ui.form.acceptTerms}}"
  error="{{ui.form.acceptTermsError}}">
  <Label>I accept the terms and conditions</Label>
  <Helper>You must accept to continue</Helper>
</molecules--checkbox-102020>
\`\`\`

### Interchangeability — swapping toggle for checkbox

Both components share the same contract. Only the tag changes:

\`\`\`html
<molecules--toggle-102020
  value="{{ui.form.acceptTerms}}"
  error="{{ui.form.acceptTermsError}}">
  <Label>I accept the terms and conditions</Label>
  <Helper>You must accept to continue</Helper>
</molecules--toggle-102020>
\`\`\`

`
