# Geschenk: functionality and UX review

Reviewed October 28, 2026. Based on the current source, the existing automated tests, and screenshots shared during development. This is a product review, not a fresh usability study or a complete accessibility audit. The archive feature is implemented and tested locally but has not yet been committed or deployed.

## Product purpose

Geschenk helps a small group organize a Secret Santa exchange: bring people together, draw recipients, share gift ideas, and communicate without revealing the giver. The core user question is “Who am I buying for, and what would they like?” The organizer also needs to know who is participating and when the group is ready to draw.

## Current functionality

| Area | What the app currently provides |
| --- | --- |
| Accounts | Email-link login, password login, Google sign-in, profile setup, username and image editing, password reset, sign-out, and account deletion. Google and email delivery depend on deployment configuration. |
| Friends | Username search, friend requests, accepting/rejecting requests, removing friends, and a shareable username-based friend link. Test accounts are excluded from public lookup. |
| Group creation | Two steps: select existing friends, then provide a name and optional image. Friend search preserves selections when the query changes. A group can be created before friends are added. |
| Overview | A prominent latest group, cards for other groups, participant counts, draw state, recipient summary when available, and unread-message indicators. |
| Before the draw | Participant list, owner controls to add/remove people, member leave action, and guidance about the minimum of three participants. |
| Drawing names | Owner-triggered draw, optional pairing exclusions, and validation of impossible pairing rules. The owner can reset the draw; that deletes assignments and associated messages. |
| Recipient and ideas | A prominent recipient card, recipient gift ideas, and a separate ideas section. Ideas support text and an optional link. Members can contribute ideas for themselves or another member, and edit/delete their own contributions. Longer lists open in a dialog. |
| Messages | Assignment-based conversations with the recipient and the user's Secret Santa, with the giver's identity hidden in the recipient-facing conversation. Unread indicators and notification support help users return to messages. |
| Group settings | Clicking the group title opens details. Owners can change the name/image, reset the draw, or delete the group. Members can leave before the draw. |
| Personal archive — local change | Owners and members can hide a group from their own active list, open it under Archived, and restore it. Membership, assignments, ideas, and messages remain intact. After a draw, the UI explains organizer-managed withdrawal instead of offering a leave action that the API rejects. |
| Notifications | Email preferences, device push subscriptions, availability feedback, and notification delivery infrastructure. Archiving does not currently mute notifications. |
| Installable app | Responsive desktop/mobile layouts, web app manifest and service worker, install guidance, push support where available, and an offline fallback page. This is not a fully offline-capable exchange app. |
| Reliability | Hashed JavaScript/CSS assets, explicit HTTP cache rules, refreshed cached shell assets, and an in-memory login fallback when browser storage cannot save the session. |

## Would I build it differently?

I would keep the product focused and retain the current blue palette, gift imagery, familiar cards, and desktop sidebar. A wholesale visual redesign would add less value than improving the journey and information hierarchy.

### 1. Make the exchange the starting point, not the friend network

Today, adding someone new can require sharing a friend link, waiting for them to connect, returning to the exchange, and adding them separately. This is understandable for repeat users but creates friction for a first-time organizer inviting a family or team.

I would make the primary journey: **Create exchange → invite people to that exchange → review participants → draw names.** Existing friends would remain a convenient shortcut. A group invite should show the exchange name, organizer, and the consequence of joining before asking the person to authenticate; authentication should return them to that same exchange.

The API already contains group-invite routes, but the main Add People dialog currently emphasizes friend links. Before exposing group invites broadly, review who can join, whether links can be revoked, and what happens after a draw. Do not simply switch URLs without aligning those rules.

### 2. Organize each exchange around its current stage

Before drawing, prioritize participants and readiness. After drawing, prioritize the recipient, their ideas, and messages. The app already changes the assignment panel by stage; extend that hierarchy to the whole page.

Suggested order:

- **Before draw:** exchange heading, participant count and invitations, draw action, personal wishlist.
- **After draw:** recipient and wishlist, messages, personal wishlist, members.
- **Archived:** the same content and permissions, with a small “Archived for you” notice and Restore action.

On mobile, the current source places Members before the secondary column containing Messages and My Gift Ideas. A long member list can therefore push frequent actions far down the screen. Reorder the layout consistently in the DOM for the relevant stage, rather than relying only on CSS ordering that can diverge from keyboard and screen-reader order.

### 3. Clarify wishlist ownership and visibility

“My Gift Ideas” currently contains ideas authored by the user, including suggestions for other people. That title can be mistaken for a wishlist of gifts the user wants to receive.

I would distinguish **“My wishlist”** from **“Ideas I’ve shared.”** The recipient card would use **“Their wishlist.”** Keep adding an idea for someone else as a secondary action and explain who can see it. Do not describe ideas as private unless API permissions enforce that promise.

A lightweight first step is renaming the current authored-ideas section to “Ideas I’ve shared,” retaining the “for @username” labels, and explaining the destination in the add-idea form.

### 4. Make settings discoverable and keep destructive actions out of the main path

The clickable group title is an unobvious settings entry point. Add a labeled **Group settings** control on desktop and a clearly labeled icon/menu on mobile. Keep the centered identity and the aligned back navigation.

The settings dialog currently mixes identity editing, factual metadata, archiving, withdrawal guidance, resetting, and deletion. Separate ordinary editing from personal actions and organizer actions. Archive/Restore should be available without scrolling through unrelated settings. Reset and Delete should remain deliberately secondary, with specific consequences in their confirmations.

For withdrawal, retain the agreed model: leave before the draw; archive personally afterward; contact the organizer if participation is no longer possible. A future guided withdrawal action could combine reset, removal, and redraw, but should never silently change assignments.

### 5. Give archiving a precise meaning

Personal archiving is useful, but it is not completion and not withdrawal. Keep that distinction visible in the explanation. State that messages and notifications can still arrive. If people want to mute an exchange, add a separate control rather than silently changing notification behavior when archiving.

The current Active/Archived switch is a good simple first version. Avoid implying that an archived exchange is finished for everyone. A group-wide Completed state can wait until there is a clear need.

### 6. Prefer actionable status over recency

The home page gives the largest card to the newest exchange. That is useful initially, but the newest exchange is not necessarily the one requiring attention.

I would eventually prioritize unread messages and organizer actions, while keeping sorting predictable. Start with specific labels such as “2 unread messages” or “Ready to draw”; avoid inventing urgency when there is no deadline. Keep the active/archive distinction and use consistent card density rather than allowing one card to dominate every visit.

### 7. Improve recovery and trust through precise copy

The recent storage-quota issue showed why a general failure should not be labeled “Link expired.” Continue separating expired links, network failures, unavailable storage, unsupported push, and server configuration failures. Explain the next action beside the relevant control; toasts alone are easy to miss.

Correct the Friends screen’s “one-time link” wording: its username-based link is reusable in the current implementation. Also distinguish friend invitations from exchange invitations throughout the app. Test-account restrictions should be visible in development tools so testing does not look like a broken public flow.

### 8. Standardize the interaction details

Keep the recent restrained hover treatments and consistent icon/text alignment. Consolidate primary buttons, secondary buttons, icon buttons, list selection, and dialogs so each screen does not recreate their behavior.

Check modal focus trapping, Escape-to-close behavior, focus restoration, accessible names, visible keyboard focus, touch target sizes, long usernames, and narrow layouts. The friend picker currently nests a checkbox inside a button; use a single checkbox with a label styled as a selectable row so there is one coherent interactive control.

## Suggested delivery order

| Priority | Change | Why first | Acceptance criteria |
| --- | --- | --- | --- |
| 1 | Ship personal archive and withdrawal explanations | Resolves an existing broken expectation | Archive is per user; restore works; no assignment or access changes; leaving before draw still works; mobile remains usable. |
| 2 | Fix terminology and settings discovery | Small changes with broad clarity benefits | Reusable friend-link wording; explicit settings action; authored ideas named accurately; archive notification behavior explained. |
| 3 | Improve mobile content order and selection controls | Makes common actions easier and keyboard behavior cleaner | Recipient and messages precede long member lists after draw; friend rows have one accessible checkbox; dialogs pass keyboard checks. |
| 4 | Add a direct exchange invitation journey | Removes the largest onboarding detour | Invite preview, authentication return, successful join, revoked/invalid link handling, and post-draw rules all tested. |
| 5 | Add exchange date and optional gift budget | Gives members useful shared context | Optional fields with clear currency/date display; no mandatory setup burden. Reminders come later, with explicit notification behavior. |

I would defer purchased markers, automatic reassignment, elaborate dashboards, and extensive customization until the invitation, wishlist, and withdrawal journeys are clearer. They add states and privacy decisions before the basic exchange flow needs them.

## Validation and limits

The current 11 automated tests cover core navigation, group creation with friend search, overview/detail states, gift-idea list expansion, archive/restore, permission boundaries, preserved messages and ideas, pre-draw leaving, and reset/remove/redraw. These tests provide useful regression protection; they do not establish that every feature or device works.

Before broader release, add real-device checks for email-link login from mail apps, private/limited browser storage, installed iOS use, notification permission changes, push delivery, and keyboard/screen-reader dialog operation. Test the proposed copy and navigation changes with an organizer and a participant who have not seen the app before: can they invite someone, find their recipient, add a wishlist item, and explain the difference between archiving and withdrawing without assistance?
