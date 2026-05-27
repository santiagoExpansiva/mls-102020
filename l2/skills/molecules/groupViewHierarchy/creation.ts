/// <mls fileReference="_102020_/l2/skills/molecules/groupViewHierarchy/creation.ts" enhancement="_blank"/>

export const skill = `

# groupViewHierarchy — Creation

> Implementation reference for creating molecules in the **groupViewHierarchy** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupViewHierarchy\` |
| **Category** | Data Display |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Label\` | No | Title displayed above the hierarchy |
| \`Node\` | Yes | A hierarchy node. Can contain free content (text, icons, HTML, web components) and nested \`<Node>\` children |
| \`Empty\` | No | Content shown when no nodes exist |

\`\`\`typescript
slotTags = ['Label', 'Node', 'Empty'];
\`\`\`

### Slot Hierarchy

\`\`\`
component (root)
├── <Label>
├── <Node>
│   ├── ...free content...
│   ├── <Node>
│   │   ├── ...free content...
│   │   └── <Node>
│   │       └── ...free content...
│   └── <Node>
│       └── ...free content...
├── <Node>
│   └── <Node>
└── <Empty>
\`\`\`

### Node Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| \`value\` | \`string\` (optional) | Identifier for the node, emitted on \`nodeClick\` |
| \`expanded\` | \`boolean\` (presence) | Node starts expanded |
| \`disabled\` | \`boolean\` (presence) | Node cannot be toggled or clicked |

### Node Content

The direct content of a \`<Node>\` (excluding nested \`<Node>\` children) is the node's visual label. It can be free HTML:

\`\`\`html
<Node>
  <img src="icon.png" /> Engineering Department
  <Node>Frontend</Node>
  <Node>Backend</Node>
</Node>
\`\`\`

---

## 3. Properties

### 3.1 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`multiple\` | \`boolean\` | \`true\` | \`@propertyDataSource\` | Allow multiple nodes open simultaneously. \`false\` = only one per level |
| \`expandAll\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Start with all nodes expanded |

### 3.2 States

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`disabled\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Disables all expand/collapse interaction |
| \`loading\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Show loading placeholder |

---

## 4. Value Contract

This component has **no \`value\` property**. It is a display-only component with expand/collapse interaction.

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`nodeClick\` | \`{ value: string \| null }\` | ✓ | Fired when a node is clicked |
| \`toggle\` | \`{ value: string \| null, expanded: boolean }\` | ✓ | Fired when a node is expanded or collapsed |

### Dispatch Example

\`\`\`typescript
this.dispatchEvent(new CustomEvent('nodeClick', {
  bubbles: true,
  composed: true,
  detail: { value: 'frontend' }
}));

this.dispatchEvent(new CustomEvent('toggle', {
  bubbles: true,
  composed: true,
  detail: { value: 'eng', expanded: true }
}));
\`\`\`

---

## 6. Expand/Collapse Behavior

- Nodes that have nested \`<Node>\` children are expandable
- Nodes without children (leaf nodes) have no toggle
- Clicking a node's toggle area expands/collapses its children
- When \`multiple=false\`: expanding a node at a given level collapses siblings at that same level
- When \`expandAll=true\`: all nodes start expanded, overriding individual \`expanded\` attributes
- When \`disabled\` (component or individual node): toggle is blocked

---

## 7. Visual States

| State | Behavior |
|-------|----------|
| **Collapsed** | Only node content visible, children hidden |
| **Expanded** | Node content + children visible, with indent |
| **Leaf** | No toggle icon, no expand/collapse |
| **Disabled (node)** | Individual node dimmed, cannot toggle |
| **Disabled (component)** | All nodes dimmed, no interaction |
| **Loading** | Placeholder instead of hierarchy |

---

## 8. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Container | \`role="tree"\` |
| Node with children | \`role="treeitem"\`, \`aria-expanded\` |
| Leaf node | \`role="treeitem"\` (no \`aria-expanded\`) |
| Children group | \`role="group"\` |
| Disabled | \`aria-disabled="true"\` |
| Keyboard | \`ArrowDown\`/\`ArrowUp\` navigate nodes; \`ArrowRight\` expands; \`ArrowLeft\` collapses; \`Enter\` toggles |


---

## 9. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-21 | Initial creation reference |
| 1.1.0 | 2026-04-21 | Added value attribute on Node and nodeClick event |
`;