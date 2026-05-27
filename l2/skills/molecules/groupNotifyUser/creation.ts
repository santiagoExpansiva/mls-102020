/// <mls fileReference="_102020_/l2/skills/molecules/groupNotifyUser/creation.ts" enhancement="_blank"/>

export const skill = `
# groupNotifyUser — Creation

> Implementation reference for creating molecules in the **groupNotifyUser** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupNotifyUser\` |
| **Category** | Feedback |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Title\` | No | Notification title/heading |
| \`Message\` | Yes | Notification body content |
| \`Action\` | No | Actionable element (button, link) inside the notification |
| \`Icon\` | No | Custom icon content |

\`\`\`typescript
slotTags = ['Title', 'Message', 'Action', 'Icon'];
\`\`\`

### Slot Hierarchy

\`\`\`
component (root)
├── <Icon>
├── <Title>
├── <Message>
└── <Action>
\`\`\`

---

## 3. Properties

### 3.1 Data

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`type\` | \`string\` | \`'info'\` | \`@propertyDataSource\` | Notification type: \`'info'\`, \`'success'\`, \`'warning'\`, \`'error'\` |
| \`visible\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Controls whether the notification is shown |

### 3.2 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`dismissible\` | \`boolean\` | \`true\` | \`@propertyDataSource\` | Show a close/dismiss button |
| \`duration\` | \`number\` | \`0\` | \`@propertyDataSource\` | Auto-dismiss after N milliseconds (0 = no auto-dismiss) |
| \`position\` | \`string\` | \`''\` | \`@propertyDataSource\` | Positioning hint: \`'top'\`, \`'bottom'\`, \`'top-right'\`, \`'bottom-right'\`, etc. Empty = inline |

---

## 4. Value Contract

This component has **no \`value\` property**. It is a feedback/display component controlled by the \`visible\` property.

- Page sets \`visible=true\` to show the notification
- Page sets \`visible=false\` or user dismisses to hide it
- When \`duration > 0\`, the component auto-sets \`visible=false\` after the timeout

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`dismiss\` | \`{}\` | ✓ | Fired when the notification is dismissed (by user or auto-timeout) |
| \`action\` | \`{}\` | ✓ | Fired when the Action slot content is clicked |

### Dispatch Example

\`\`\`typescript
this.dispatchEvent(new CustomEvent('dismiss', {
  bubbles: true,
  composed: true,
  detail: {}
}));
\`\`\`

---

## 6. Auto-Dismiss Logic

When \`duration > 0\` and \`visible=true\`:

- Start a timer on render
- After \`duration\` ms: set \`visible=false\`, emit \`dismiss\`
- If user dismisses manually before timeout: clear the timer
- If \`visible\` changes to \`false\` externally: clear the timer

---

## 7. Type Semantics

| Type | Usage |
|------|-------|
| \`info\` | General information, neutral |
| \`success\` | Action completed successfully |
| \`warning\` | Attention needed, non-critical |
| \`error\` | Something failed, requires attention |

The type drives the visual styling (colors, default icon). The component does not define specific colors — those are handled via Tailwind classes per type.

---

## 8. Visual States

| State | Behavior |
|-------|----------|
| **Hidden** | \`visible=false\` — nothing rendered |
| **Visible** | Notification displayed with enter animation |
| **Dismissing** | Exit animation, then hidden |

---

## 9. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Container | \`role="alert"\` for error/warning, \`role="status"\` for info/success |
| Live region | \`aria-live="assertive"\` for error, \`aria-live="polite"\` for others |
| Dismiss button | \`aria-label="Dismiss notification"\` |
| Action | Inherits a11y from the content inside Action slot |

---


## 10. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-21 | Initial creation reference |

`;