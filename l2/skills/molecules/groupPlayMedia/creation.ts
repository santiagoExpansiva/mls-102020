/// <mls fileReference="_102020_/l2/skills/molecules/groupPlayMedia/creation.ts" enhancement="_blank"/>

export const skill = `
# groupPlayMedia — Creation

> Implementation reference for creating molecules in the **groupPlayMedia** group.
> Follow the general Lit/Aura rules defined in \`molecule-generation2.md\`.

---

## 1. Metadata

| Field | Value |
|-------|-------|
| **Group** | \`groupPlayMedia\` |
| **Category** | Data Display |
| **Version** | \`1.0.0\` |

---

## 2. Slot Tags

| Tag | Required | Description |
|-----|:--------:|-------------|
| \`Label\` | No | Title or description displayed alongside the player |
| \`Source\` | Yes | Media source. Attributes: \`src\` (required), \`type\` (e.g. \`"video/mp4"\`, \`"audio/mpeg"\`) |
| \`Track\` | No | Subtitle/caption track. Attributes: \`src\`, \`kind\` (\`"subtitles"\`, \`"captions"\`), \`lang\`, \`label\` |

\`\`\`typescript
slotTags = ['Label', 'Source', 'Track'];
\`\`\`

### Slot Hierarchy

\`\`\`
component (root)
├── <Label>
├── <Source src="..." type="..." />
├── <Source src="..." type="..." />
└── <Track src="..." kind="..." lang="..." label="..." />
\`\`\`

### Multiple Sources

Multiple \`<Source>\` tags allow fallback formats. The browser picks the first supported type:

\`\`\`html
<Source src="video.webm" type="video/webm" />
<Source src="video.mp4" type="video/mp4" />
\`\`\`

---

## 3. Properties

### 3.1 Configuration

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`poster\` | \`string\` | \`''\` | \`@propertyDataSource\` | Thumbnail image URL (used by video implementations, ignored by audio) |
| \`autoplay\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Start playback automatically |
| \`loop\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Restart playback when ended |
| \`muted\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Start muted |
| \`preload\` | \`string\` | \`'metadata'\` | \`@propertyDataSource\` | Preload strategy: \`'none'\`, \`'metadata'\`, \`'auto'\` |

### 3.2 States

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`disabled\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Disables all controls |
| \`loading\` | \`boolean\` | \`false\` | \`@propertyDataSource\` | Show loading indicator (e.g. while buffering) |

### 3.3 Internal State

| Property | Type | Default | Decorator | Description |
|----------|------|---------|-----------|-------------|
| \`isPlaying\` | \`boolean\` | \`false\` | \`@state\` | Whether media is currently playing |
| \`currentTime\` | \`number\` | \`0\` | \`@state\` | Current playback position in seconds |
| \`duration\` | \`number\` | \`0\` | \`@state\` | Total duration in seconds |
| \`volume\` | \`number\` | \`1\` | \`@state\` | Current volume (0–1) |
| \`isMuted\` | \`boolean\` | \`false\` | \`@state\` | Whether audio is muted |

---

## 4. Value Contract

This component has **no \`value\` property**. It is a display/playback component. Media sources come from slot tags.

---

## 5. Events

| Event | Detail | Bubbles | Description |
|-------|--------|:-------:|-------------|
| \`play\` | \`{}\` | ✓ | Playback started |
| \`pause\` | \`{}\` | ✓ | Playback paused |
| \`ended\` | \`{}\` | ✓ | Playback reached the end |
| \`timeUpdate\` | \`{ currentTime: number, duration: number }\` | ✓ | Playback position changed |
| \`error\` | \`{ message: string }\` | ✓ | Media failed to load or play |

### Dispatch Example

\`\`\`typescript
this.dispatchEvent(new CustomEvent('play', {
  bubbles: true,
  composed: true,
  detail: {}
}));

this.dispatchEvent(new CustomEvent('timeUpdate', {
  bubbles: true,
  composed: true,
  detail: { currentTime: this.currentTime, duration: this.duration }
}));
\`\`\`

---

## 6. Reading Sources

Read sources and tracks inline using \`getSlots\`:

\`\`\`typescript
const sources = this.getSlots('Source').map(el => ({
  src: el.getAttribute('src') || '',
  type: el.getAttribute('type') || '',
}));

const tracks = this.getSlots('Track').map(el => ({
  src: el.getAttribute('src') || '',
  kind: el.getAttribute('kind') || 'subtitles',
  lang: el.getAttribute('lang') || '',
  label: el.getAttribute('label') || '',
}));
\`\`\`

---

## 7. Playback Controls

The component must expose internal methods for controlling playback

---

## 8. Visual States

| State | Behavior |
|-------|----------|
| **Idle** | Poster shown (video) or default state (audio), controls visible |
| **Playing** | Media playing, progress bar advancing |
| **Paused** | Media paused, play button visible |
| **Buffering** | Loading indicator over the player |
| **Ended** | Replay button visible |
| **Disabled** | Controls dimmed, no interaction |
| **Error** | Error message displayed, controls hidden |

---

## 9. Accessibility (a11y)

| Requirement | Implementation |
|-------------|----------------|
| Label | \`aria-label\` from Label slot content |
| Play/Pause | \`aria-label="Play"\` / \`aria-label="Pause"\` |
| Progress bar | \`role="slider"\`, \`aria-valuenow\`, \`aria-valuemin="0"\`, \`aria-valuemax=duration\` |
| Volume | \`role="slider"\`, \`aria-valuenow\`, \`aria-valuemin="0"\`, \`aria-valuemax="1"\` |
| Mute | \`aria-label="Mute"\` / \`aria-label="Unmute"\` |
| Keyboard | \`Space\` toggle play/pause, \`ArrowLeft\`/\`ArrowRight\` seek, \`ArrowUp\`/\`ArrowDown\` volume |

---


## 10. Changelog

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-04-21 | Initial creation reference |
`;
