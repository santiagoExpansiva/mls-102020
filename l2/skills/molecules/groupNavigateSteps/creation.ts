/// <mls fileReference="_102020_/l2/skills/molecules/groupNavigateSteps/creation.ts" enhancement="_blank"/>

export const skill = `
# groupNavigateSteps — Creation

> Implementation reference for creating molecules in the **groupNavigateSteps** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupNavigateSteps\` |
| **Category** | Navigation |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Label\` | No | Title displayed above the stepper |
| \`Step\` | Yes | Defines one step in the process. Attributes: \`title\` (required), \`description\`, \`disabled\`, \`completed\` |

\`\`\`typescript
slotTags = ['Label', 'Step'];
\`\`\`

### Slot Hierarchy

\`\`\`
component (root)
├── <Label>
└── <Step title="..." description="..." completed disabled>
\`\`\`

### Step Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| \`title\` | \`string\` | Step name displayed in the indicator |
| \`description\` | \`string\` (optional) | Short description below the title |
| \`completed\` | \`boolean\` (presence) | Step is marked as completed |
| \`disabled\` | \`boolean\` (presence) | Step cannot be navigated to |

---

## 3. Properties

### 3.1 Data

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`value\` | \`number\` | \`0\` | \`@propertyDataSource\` | Index of the current active step (0-based) |

### 3.2 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`linear\` | \`boolean\` | \`true\` | \`@propertyDataSource\` | Must complete steps in order. \`false\` = can jump to any non-disabled step |

### 3.3 States

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`disabled\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Disables all navigation |
| \`loading\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Show loading state |

---

## 4. Value Contract

- \`value\` is a **number** representing the index (0-based) of the current active step
- Default is \`0\` (first step)
- When the user navigates, \`value\` is updated and \`change\` is emitted
- The page reads \`value\` to know which step content to display

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`change\` | \`{ value: number, title: string }\` | ✓ | Fired when the active step changes |

### Dispatch Example

\`\`\`typescript
this.dispatchEvent(new CustomEvent('change', {
  bubbles: true,
  composed: true,
  detail: { value: this.value, title: 'Payment' }
}));
\`\`\`

---

## 6. Navigation Rules

### Linear Mode (\`linear=true\`)
- User can only go to the next step if the current step has \`completed\`
- User can always go back to previous completed steps
- Steps ahead of the current that are not completed are not clickable

### Free Mode (\`linear=false\`)
- User can click any step that is not \`disabled\`
- \`completed\` is visual only — does not gate navigation

### General
- Clicking a step: update \`value\`, emit \`change\`
- \`disabled\` steps are never clickable regardless of mode
- Component-level \`disabled\` blocks all navigation

---

## 7. Visual States

| State | Behavior |
|-------|----------|
| **Pending** | Step not yet reached — default/inactive style |
| **Active** | Current step — highlighted |
| **Completed** | Step done — checkmark or completed style |
| **Disabled** | Step dimmed, not clickable |
| **Loading** | Loading indicator on the component |

---

## 8. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Container | \`role="tablist"\`, \`aria-label\` from Label slot |
| Step indicator | \`role="tab"\`, \`aria-selected\` for active step |
| Completed | \`aria-label\` includes "completed" |
| Disabled | \`aria-disabled="true"\` |
| Keyboard | \`ArrowLeft\`/\`ArrowRight\` navigate between steps; \`Enter\` selects |

---


## 9. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-21 | Initial creation reference |
`;
