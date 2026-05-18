/// <mls fileReference="_102020_/l2/skills/layout/bento.ts" enhancement="_blank"/>

export const skill = `

# Bento Design System Skill

## Purpose

The “Bento” design model is a visual composition system based on asymmetric grid layouts composed of modular cards.

The main goal of Bento layouts is to create modern, organized, visually dynamic interfaces using different sizes, proportions, and visual importance levels between elements.

The layout should communicate:

- organization
- modularity
- visual hierarchy
- premium aesthetics
- modern interface design
- scan-friendly structure

---

# Core Concept

A Bento Grid behaves like a modular mosaic of cards.

Unlike traditional layouts where all elements share the same size, Bento layouts intentionally mix:

- large cards
- small cards
- wide cards
- tall cards
- featured areas
- controlled asymmetry

The final composition should feel fluid, balanced, and visually intentional.

---

# Layout Structure

A Bento layout should always be based on:

- CSS Grid
- multiple columns
- consistent spacing
- row and column spans

Conceptual example:

\`\`\`txt
[ HERO LARGE     ][ SMALL ]
[ HERO LARGE     ][ SMALL ]
[ MEDIUM ][ MEDIUM ][ TALL ]
\`\`\`

---

# Mandatory Characteristics

## 1. Asymmetry

The layout should NEVER look perfectly uniform.

Avoid:

\`\`\`txt
[ ][ ][ ]
[ ][ ][ ]
\`\`\`

Prefer:

\`\`\`txt
[ LARGE ][ SMALL ]
[ LARGE ][ SMALL ]
[ MEDIUM ][ TALL ]
\`\`\`

---

## 2. Primary Featured Card

Every Bento layout should contain at least one dominant card.

This card should:

- occupy more space
- attract visual attention
- act as the primary focal point

Common uses:

- hero section
- main feature
- featured dashboard widget
- product highlight
- primary CTA

---

## 3. Modularity

Each card should work independently.

Cards may contain:

- images
- text
- charts
- statistics
- previews
- buttons
- videos
- icons
- features
- testimonials
- lists

---

## 4. Visual Hierarchy

The layout must clearly communicate importance levels.

Example:

| Priority | Visual Weight |
|---|---|
| High | Large |
| Medium | Medium |
| Low | Small |

---

## 5. Spacing

Bento layouts rely heavily on spacing consistency.

Use:

- balanced gaps
- generous padding
- visual breathing room

Avoid cramped compositions.

---

# Recommended Structure

\`\`\`txt
SECTION
 ├── Header
 └── Bento Grid
      ├── Hero Card
      ├── Feature Card
      ├── Stats Card
      ├── Media Card
      ├── CTA Card
      └── Support Cards
\`\`\`

---

# Responsiveness

## Desktop

- rich asymmetric compositions
- multiple columns
- large featured areas

## Tablet

- partial vertical reorganization
- reduced spans
- simplified composition

## Mobile

- preferably single-column stacking
- maintain hierarchy order
- preserve spacing and readability

---

# Composition Rules

## Use:

- varied card sizes
- horizontal blocks
- vertical blocks
- mixed content density
- featured areas
- large media
- bold typography
- visually distinct cards

## Avoid:

- fully symmetrical grids
- identical card sizes
- excessive information density
- inconsistent alignment
- irregular spacing
- overcrowded layouts

---

# Card Types

## Hero Card

The main visual element.

Characteristics:

- large visual impact
- strong headline
- prominent placement

---

## Feature Card

Used to present features or benefits.

May contain:

- icon
- short description
- mini preview

---

## Stats Card

Displays metrics or numbers.

Examples:

- analytics
- revenue
- users
- performance
- KPIs

---

## Media Card

Focused on:

- screenshots
- videos
- imagery
- visual previews

---

## CTA Card

Conversion-focused block.

Purpose:

- encourage actions
- display buttons
- emphasize interaction

---

# Visual Style

Bento layouts commonly use:

- rounded corners
- soft shadows
- layered surfaces
- subtle gradients
- depth effects
- light glassmorphism
- premium spacing
- clean typography

---

# Mental Model

A Bento layout should feel like a combination of:

- editorial dashboard
- modular showcase
- smart widget system
- modern product presentation

---

# Visual Rhythm

The layout should alternate between:

- large and small blocks
- dense and lightweight areas
- text-heavy and media-heavy cards

This rhythm creates movement and improves content scanning.

---

# Recommended Proportions

Common examples:

| Type | Span |
|---|---|
| Hero | 6x2 |
| Medium | 3x1 |
| Tall | 2x2 |
| Small | 2x1 |

---

# Recommended Semantic Structure

Each item may define:

\\\json
{
  "type": "hero",
  "importance": "high",
  "colSpan": 6,
  "rowSpan": 2
}
\\\

---

# Expected Visual Feeling

The design should communicate:

- sophistication
- modernity
- clarity
- organization
- technology
- premium quality
- fluidity

---
---

# Summary

Bento Design is a composition system based on:

- asymmetric grids
- modular cards
- strong visual hierarchy
- varied proportions
- dynamic composition
- premium organization
- responsive adaptability

The primary goal is to transform content into a modular, visually engaging, highly scannable experience.

`