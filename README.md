# Stronghold Atlas

A collaborative, setting-agnostic stronghold manager based on the mechanics in the [Stronghold Rules](https://scribe.pf2.tools/v/zCTJyMXH-stronghold-rules).

The app includes:

- a customizable SVG floor plan with draggable, resizable, and freeform polygon rooms plus reusable room types;
- editable room-to-facility assignments, tiers, capacities, and dependencies;
- facility, downtime, roster, upkeep, and rules views;
- undo/redo and browser autosave;
- same-device live updates across tabs;
- independent floor views, remembered in each browser for each account and stronghold;
- optional Supabase-backed browser sessions, usernames, owner-managed member access, secure invite links, row-level access, and realtime internet sync.

## Run locally

```powershell
pnpm install
pnpm dev
```

Without cloud settings, the app runs in local demo mode and stores its state in the browser.

Choosing a floor changes only your view. Rooms, floor creation, and floor deletion still sync with collaborators. If your selected floor is removed, your view returns to the first available floor. Floor preferences stay on the current browser and are separate from shared saves and undo/redo. Open tabs can browse independently; reopening uses the last saved preference for that account and stronghold. Cloud workspaces use their authenticated realtime channels; the shared browser cache and tab broadcast are reserved for local demo mode.

Cloud saves check the database version before writing and merge changes to different fields. Conflicting edits remain unsaved in the open tab with a visible message: retry after resolving the difference, or explicitly discard unsaved edits to load the shared version. Keep the tab open until saving succeeds. Undo and redo affect only the fields changed by that action and preserve newer edits; a floor containing another person's objects cannot be removed by undo.

Completing an upgrade through Advance or Edit task updates the linked room tier and its next upgrade cost and duration. Reopening and completing the same task does not apply the upgrade twice. Previously completed tasks are not retroactively applied; their room tiers can be corrected manually.

Run `pnpm test`, `pnpm lint`, and `pnpm build` to verify changes. After deploying collaboration updates, refresh all open tabs so every collaborator uses the new save checks.

## Turn on internet collaboration

1. Create a Supabase project.
2. Enable **Anonymous Sign-Ins** under Authentication → Providers.
3. Run every file in `supabase/migrations` in filename order in the project SQL editor.
4. Copy `.env.example` to `.env.local` and fill in the project URL and public anon key.
5. Restart the app. The first visitor creates a shared stronghold; **Invite** creates a single-use, seven-day link for an editor or viewer.

The database uses anonymous Supabase Auth sessions, indexed membership checks, row-level security, owner-only account-management functions, and one-time invite claims. The service role key is never used by the browser.

No external identity or messaging provider is required. A guest opens an invite, chooses a username, and stays connected through the anonymous session saved by that browser. The app remembers the active stronghold when the bare site is reopened, and the Invite dialog provides a reusable return link that members can bookmark. Clearing browser data or moving to a new device still requires a fresh invite.

## Deploy

The Vite build in `dist/` can be hosted on Netlify, Vercel, Cloudflare Pages, or any static web host. Add the two `VITE_SUPABASE_*` values as deployment environment variables.

## Design references

The desktop and mobile concepts used for implementation are saved under `docs/concepts/`.

## Content note

Campaign-specific names, characters, settlements, and plot elements from the source document are intentionally omitted. Neutral defaults preserve the costs, timing, tier structure, DCs, outcomes, and dependencies while allowing groups to rename and adapt the content.
