/// <mls fileReference="_102020_/l2/skills/molecules/groupScanCode/creation.ts" enhancement="_blank"/>

export const skill = `
# groupScanCode — Creation

> Implementation reference for creating molecules in the **groupScanCode** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupScanCode\` |
| **Category** | Data Entry |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Label\` | No | Label displayed above the scanner area |
| \`Helper\` | No | Help text displayed below the scanner |
| \`Trigger\` | No | Custom content for the button that opens the camera |
| \`Result\` | No | Custom content for displaying the decoded result |

\`\`\`typescript
slotTags = ['Label', 'Helper', 'Trigger', 'Result'];
\`\`\`

### Slot Hierarchy

\`\`\`
component (root)
├── <Label>
├── <Trigger>
├── <Result>
└── <Helper>
\`\`\`

---

## 3. Properties

### 3.1 Data

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`value\` | \`string \| null\` | \`null\` | \`@propertyDataSource\` | Decoded result set by the page after processing |
| \`error\` | \`string\` | \`''\` | \`@propertyDataSource\` | Error message (empty = no error) |
| \`name\` | \`string\` | \`''\` | \`@propertyDataSource\` | Field name (for forms) |

### 3.2 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`facing\` | \`string\` | \`'environment'\` | \`@propertyDataSource\` | Camera facing: \`'environment'\` (rear) or \`'user'\` (front) |
| \`autoCapture\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Continuously capture frames while camera is open (for real-time scanning) |
| \`captureInterval\` | \`number\` | \`500\` | \`@propertyDataSource\` | Interval in ms between auto captures (used when \`autoCapture=true\`) |

### 3.3 States

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`disabled\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Disables the scanner |
| \`loading\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Loading state (e.g. page is processing a captured frame) |

### 3.4 Internal State

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`isOpen\` | \`boolean\` | \`false\` | \`@state\` | Whether the camera viewfinder is active |

---

## 4. Value Contract

### Storage Format

- \`value\` is a plain **string** containing the decoded result (text from QR, barcode number, OCR text, etc.)
- \`null\` means no result yet
- The **page** is responsible for decoding — the component only captures and emits image data
- When the page finishes processing, it sets \`value\` with the decoded text

### Capture Flow

\`\`\`
1. User opens the camera (click trigger or auto-open)
2. Component activates camera via navigator.mediaDevices.getUserMedia()
3. User frames the target OR autoCapture sends frames periodically
4. Component captures frame as base64 image → emits \`capture\` event
5. Page receives image, processes via BFF (QR decode, barcode read, OCR)
6. Page sets \`value\` with the decoded result
7. Component displays the result (via Result slot or default display)
8. Camera closes (manual or auto on successful decode)
\`\`\`

### View After Capture

- If \`value\` is set: display decoded result text
- If \`hasSlot('Result')\`: use custom result layout
- Camera viewfinder is replaced by the result display

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`capture\` | \`{ image: string }\` | ✓ | Frame captured — \`image\` is a base64 data URL |
| \`open\` | \`{}\` | ✓ | Camera opened |
| \`close\` | \`{}\` | ✓ | Camera closed |
| \`change\` | \`{ value: string \| null }\` | ✓ | Value changed (result set by page) |

### Dispatch Example

\`\`\`typescript
this.dispatchEvent(new CustomEvent('capture', {
  bubbles: true,
  composed: true,
  detail: { image: base64DataUrl }
}));
\`\`\`

---

## 6. Camera Management

- Open camera via \`navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facing } })\`
- Stream is rendered to a \`<video>\` element inside the component
- Capture a frame by drawing the video to an offscreen \`<canvas>\` and calling \`canvas.toDataURL()\`
- On close: stop all tracks via \`stream.getTracks().forEach(t => t.stop())\`
- Handle permission denied gracefully — set \`error\` with appropriate message

---

## 7. Visual States

| State | Behavior |
|-------|----------|
| **Idle** | Trigger button visible, no camera |
| **Open** | Camera viewfinder active, capture button visible |
| **Capturing** | Flash or pulse animation on capture |
| **Loading** | Processing indicator while page decodes |
| **Result** | Decoded value displayed, camera closed |
| **Disabled** | Trigger dimmed, no interaction |
| **Error** | Error message (permission denied, camera unavailable, decode failed) |

---

## 8. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Trigger | \`role="button"\`, \`aria-label="Open camera scanner"\` |
| Video | \`aria-hidden="true"\` (visual-only element) |
| Capture button | \`aria-label="Capture"\` |
| Result | \`aria-live="polite"\` to announce decoded result |
| Error | \`aria-describedby\` pointing to error element |
| Keyboard | \`Enter\`/\`Space\` on trigger opens camera; \`Escape\` closes |

---

## 9. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-21 | Initial creation reference |
`;