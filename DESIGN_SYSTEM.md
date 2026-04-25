# Geschenk Design System

## Principles

- Warm utility: functional first, with subtle seasonal warmth.
- Scannable hierarchy: assignments, groups, and actions should be obvious at a glance.
- Private by default: UI should feel calm and trustworthy.
- Desktop-native, mobile-native: avoid stretching one layout across both.
- Soft, not cute: gift-giving cues through color, copy, and small icons, not decoration.

## Visual Tone

Geschenk should feel friendly, calm, and slightly festive. The visual language should resemble winter stationery, paper cards, evergreen neutrals, soft red accents, and warm off-white surfaces.

Avoid mascot-style illustration, candy colors, heavy gradients, decorative blobs, confetti, and generic SaaS blue/purple dominance.

## Tokens

Core tokens live in [src/styles/app.css](/Users/mirkoteschke/Dev/geschenk25/src/styles/app.css) under `:root`.

Primary token groups:

- Color: base, text, brand, evergreen, gold, state, focus
- Typography: text sizes, line heights, font weights
- Spacing: 4px to 64px scale
- Radius: 4px to 16px plus full
- Shadow: small, medium, large

## Components

Current shared component classes:

- Buttons: `.primary-button`, `.secondary-button`, `.danger-button`, `.link-button`, `.danger-outline-button`
- Cards: `.native-card`, `.profile-card`, `.overview-group-card`, `.modal-panel`
- Forms: `label`, `input`, `textarea`, `select`, `.readonly-field`
- Avatars/images: `.avatar-button`, `.group-image`, `.small-avatar`, `.profile-preview`, `.profile-placeholder`
- Empty states: `.empty-card`, `.overview-empty-state`, `.empty-inline`
- Skeletons: `.skeleton-avatar`, `.skeleton-line`, `.skeleton-block`, `.skeleton-row`
- Modals: `.modal-backdrop`, `.modal-panel`

## Page Patterns

- Group overview: dashboard header, group card grid, floating create action.
- Group detail: page header, group summary, main column, sidebar.
- Edit profile: profile summary card plus settings cards.
- Auth: centered form card.

## Implementation Rules

- Prefer CSS variables over hard-coded colors and spacing.
- Use 6-8px radius for most cards and controls.
- Prefer borders plus subtle shadows.
- Keep mobile layouts single-column and touch-friendly.
- Use desktop grids only when content has enough room.
- Do not add decorative blobs, confetti, or oversized seasonal graphics.
