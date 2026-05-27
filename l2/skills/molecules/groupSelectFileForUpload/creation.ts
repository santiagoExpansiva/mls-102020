/// <mls fileReference="_102020_/l2/skills/molecules/groupSelectFileForUpload/creation.ts" enhancement="_blank"/>

export const skill = `
# groupSelectFileForUpload — Creation

> Implementation reference for creating molecules in the **groupSelectFileForUpload** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupSelectFileForUpload\` |
| **Category** | Data Entry |
| **Version** | \`1.0.1\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Label\` | No | Label displayed above or beside the field |
| \`Helper\` | No | Help text displayed below the field |
| \`Trigger\` | No | Custom content for the file selection button or drop zone |

\`\`\`typescript
slotTags = ['Label', 'Helper', 'Trigger'];
\`\`\`

### Slot Hierarchy

\`\`\`
component (root)
├── <Label>
├── <Trigger>
└── <Helper>
\`\`\`

---


## 3. Properties

### 3.1 Data

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`value\` | \`File[]\` | \`[]\` | \`@propertyDataSource\` | Currently selected files |
| \`error\` | \`string\` | \`''\` | \`@propertyDataSource\` | Error message (empty = no error) |

### 3.2 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`multiple\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Allow selecting more than one file |
| \`accept\` | \`string\` | \`''\` | \`@propertyDataSource\` | Accepted file types (e.g. \`'image/*'\`, \`'.pdf,.docx'\`) |
| \`maxSizeKb\` | \`number\` | \`0\` | \`@propertyDataSource\` | Maximum file size in KB per file (0 = no limit) |
| \`maxFiles\` | \`number\` | \`0\` | \`@propertyDataSource\` | Maximum number of files when \`multiple=true\` (0 = no limit) |

### 3.3 States

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`disabled\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Field is disabled |
| \`loading\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Loading state (e.g. upload in progress, controlled by page) |

### 3.4 Internal State

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`isDragging\` | \`boolean\` | \`false\` | \`@state\` | Whether a file is being dragged over the drop zone |

---

## 4. Value Contract

- \`value\` holds the current \`File[]\` bound to the global state via \`@propertyDataSource\`
- Default is \`[]\` (empty array)
- When the user selects or drops files, they are validated and merged into \`value\`
- When the user removes a file, it is removed from \`value\`
- The page reads \`value\` from the state and is responsible for uploading via BFF

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`reject\` | \`{ files: File[], reason: 'size' \| 'type' \| 'count' }\` | ✓ | Fired when files are rejected due to validation |

### Dispatch Example

\`\`\`typescript
this.dispatchEvent(new CustomEvent('reject', {
  bubbles: true,
  composed: true,
  detail: { files: rejectedFiles, reason: 'size' }
}));
\`\`\`

---

## 6. File Validation

Validation happens before adding files to \`value\`. Invalid files are emitted via \`reject\`.

| Rule | Condition | Reject reason |
|------|-----------|---------------|
| File type | \`accept\` is set and file type does not match | \`'type'\` |
| File size | \`maxSizeKb > 0\` and file size exceeds limit | \`'size'\` |
| File count | \`maxFiles > 0\` and total count would exceed limit | \`'count'\` |

- Valid files are merged into \`value\`
- Invalid files are emitted via \`reject\` event
- If all files are invalid, \`value\` remains unchanged

---

## 7. Drag and Drop

When the implementation supports drag and drop:

\`\`\`
@dragover: preventDefault(), set isDragging = true
@dragleave: set isDragging = false
@drop: preventDefault(), set isDragging = false
        extract files from event.dataTransfer.files
        run validation, add valid files to value, emit reject for invalid
\`\`\`

- \`isDragging\` drives the visual highlight of the drop zone
- Drop zone must call \`event.preventDefault()\` on \`dragover\` to allow dropping

---

## 8. Error Handling

| \`error\` value | Behavior |
|---------------|----------|
| \`''\` | No error — show Helper if slot exists |
| \`'any message'\` | Show error message, apply error visual state |

- Page/Organism is responsible for setting the error message
- Validation rejections are surfaced via the \`reject\` event — page decides how to display them

---

## 9. Visual States

| State | Behavior |
|-------|----------|
| **Normal** | Default appearance |
| **Dragging** | Drop zone highlighted, visual feedback |
| **Disabled** | Reduced opacity, no interaction, drag ignored |
| **Error** | Error border/style, error message visible |
| **Loading** | Loading indicator visible, interaction blocked |

---

## 10. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Input | \`<input type="file">\` always present (visually hidden) |
| Label | \`aria-labelledby\` pointing to rendered label |
| Error | \`aria-describedby\` pointing to error element |
| Invalid | \`aria-invalid="true"\` when error exists |
| Drop zone | \`role="button"\`, \`tabindex="0"\`, \`aria-label\` describing action |
| Keyboard | \`Enter\`/\`Space\` on drop zone triggers file picker |

---

## 11. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-20 | Initial creation reference |
`;
