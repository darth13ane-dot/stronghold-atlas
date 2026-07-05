# Stronghold Atlas

A collaborative, setting-agnostic stronghold manager based on the mechanics in the [Stronghold Rules](https://scribe.pf2.tools/v/zCTJyMXH-stronghold-rules).

The app includes:

- a customizable SVG floor plan with draggable and resizable rooms;
- editable room-to-facility assignments, tiers, capacities, and dependencies;
- facility, downtime, roster, upkeep, and rules views;
- undo/redo and browser autosave;
- same-device live updates across tabs;
- optional Supabase-backed anonymous sign-in, secure invite links, row-level access, and realtime internet sync.

## Run locally

```powershell
pnpm install
pnpm dev
```

Without cloud settings, the app runs in local demo mode and stores its state in the browser.

## Turn on internet collaboration

1. Create a Supabase project.
2. Enable **Anonymous Sign-Ins** under Authentication → Providers.
3. Run [202607050001_stronghold_atlas.sql](./supabase/migrations/202607050001_stronghold_atlas.sql) in the project SQL editor.
4. Copy `.env.example` to `.env.local` and fill in the project URL and public anon key.
5. Restart the app. The first visitor creates a shared stronghold; **Invite** creates a single-use, seven-day link for an editor or viewer.

The database uses authenticated anonymous users, indexed membership checks, row-level security, and one-time invite claims. The service role key is never used by the browser.

## Deploy

The Vite build in `dist/` can be hosted on Netlify, Vercel, Cloudflare Pages, or any static web host. Add the two `VITE_SUPABASE_*` values as deployment environment variables.

## Design references

The desktop and mobile concepts used for implementation are stored in the local development workspace under `docs/concepts/`.

## Content note

Campaign-specific names, characters, settlements, and plot elements from the source document are intentionally omitted. Neutral defaults preserve the costs, timing, tier structure, DCs, outcomes, and dependencies while allowing groups to rename and adapt the content.
