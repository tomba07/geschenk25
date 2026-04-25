# Geschenk Design System

## Direction

Geschenk now follows the blue winter reference mockup: calm, crisp, friendly, and app-like. The feel is closer to a polished gift-exchange tool than a generic SaaS dashboard.

The UI should feel:

- wintery without becoming decorative
- trustworthy and private
- clear at a glance
- desktop-native on wide screens
- mobile-native on small screens

Avoid:

- red/green holiday overload
- decorative blobs, confetti, or mascot art
- stretched mobile layouts on desktop
- heavy shadows or oversized border radii
- generic purple/blue gradient SaaS styling

## Tokens

Core tokens live in [src/styles/app.css](/Users/mirkoteschke/Dev/geschenk25/src/styles/app.css) under `:root`.

Current palette:

```css
--color-bg: #eef5ff;
--color-surface: #ffffff;
--color-surface-muted: #f2f6fc;
--color-border: #d8e4f5;

--color-text: #08245a;
--color-text-muted: #3f5578;
--color-text-soft: #7b8ca8;
--color-text-inverse: #ffffff;

--color-brand: #1559b7;
--color-brand-hover: #0f4796;
--color-brand-soft: #dcebff;

--color-danger: #c9362c;
--color-focus: #1559b7;
```

Compatibility aliases still exist for older component CSS:

```css
--primary: var(--color-brand);
--primary-hover: var(--color-brand-hover);
--danger: var(--color-danger);
--surface: var(--color-surface-muted);
--border: var(--color-border);
--muted: var(--color-text-muted);
```

## Typography

Use the existing token scale in `app.css`:

- page title: `--text-2xl` to `--text-3xl`
- section title: `--text-xl`
- card title: `--text-lg`
- body: `--text-md`
- metadata: `--text-sm`
- labels: `--text-sm`, medium weight

Headings should be strong and compact. Metadata should stay quiet, not faint.

## Layout Patterns

### App Frame

Authenticated pages use the shared [AppShell](/Users/mirkoteschke/Dev/geschenk25/src/components/AppShell.tsx).

Desktop:

- fixed left sidebar
- main content area scrolls
- sidebar contains brand, Groups, Profile, Settings, Sign out
- no redundant user card at bottom

Mobile:

- compact top bar
- drawer sidebar opened by menu button
- floating primary action where useful

### Group Overview

Reference classes:

- `.app-frame`
- `.app-sidebar`
- `.app-frame-main`
- `.overview-screen`
- `.overview-page-header`
- `.overview-group-grid`
- `.overview-group-card`
- `.overview-fab`

Rules:

- `+ New Group` is floating, not in the header.
- Desktop uses a compact two-column card grid.
- Cards should be dense, with image/initial, title, metadata, and optional description.
- Do not show placeholder text like “No description.”

### Group Detail

Reference classes:

- `.group-detail-screen`
- `.detail-topbar`
- `.detail-layout`
- `.detail-page-hero`
- `.detail-main`
- `.detail-sidebar`

Rules:

- Desktop uses main/sidebar layout.
- Sidebar holds members, pending invites, and exclusions.
- Assignment and gift ideas sit in the main column.
- Invite, member removal, and exclusion edits are hidden once assignments exist.

### Profile

Reference classes:

- `.profile-screen`
- `.profile-topbar`
- `.profile-layout`
- `.profile-card`
- `.profile-summary-card`
- `.profile-fields-card`
- `.profile-danger-card`

Rules:

- Profile uses the same app frame/sidebar as other authenticated pages.
- Photo actions sit directly beneath the image.
- “Remove Photo” remains a bordered danger-outline button.
- Save is disabled until changes exist.

## Components

Shared component classes currently in use:

- Buttons: `.primary-button`, `.secondary-button`, `.danger-button`, `.link-button`, `.danger-outline-button`
- Sidebar: `.app-sidebar`, `.sidebar-nav-item`, `.sidebar-icon`, `.sidebar-signout`
- Cards: `.native-card`, `.profile-card`, `.overview-group-card`, `.modal-panel`
- Forms: `label`, `input`, `textarea`, `select`, `.readonly-field`
- Avatars/images: `.avatar-button`, `.group-image`, `.small-avatar`, `.profile-preview`, `.profile-placeholder`
- Empty states: `.empty-card`, `.overview-empty-state`, `.empty-inline`
- Skeletons: `.skeleton-avatar`, `.skeleton-line`, `.skeleton-block`, `.skeleton-row`
- Modals: `.modal-backdrop`, `.modal-panel`

## Loading

Loading states should match the page layout.

- App/session loading uses `.app-loading-screen`.
- Overview data loading uses skeleton group cards.
- Group detail loading uses layout skeletons.
- Avoid old centered spinner-only states inside redesigned authenticated pages.

## Implementation Rules

- Prefer tokens over hard-coded colors.
- Use 6-8px radius for cards and controls.
- Prefer borders plus subtle shadows.
- Make desktop layouts genuinely desktop-native.
- Keep mobile layouts touch-friendly and single-column.
- Keep seasonal cues restrained: gift icon, blue winter palette, soft panels.
