# Rapport: a mobile-first networking CRM

**Capture now, organize later.** Rapport is an installable web app for remembering the people you meet at career fairs, conferences, hackathons and coffee chats. Open it from your iPhone Home Screen and you land on Quick Add. Type a name (and a dictated note if you like), tap **Save contact**, and you're done in about ten seconds. Later you can organize everyone into categories, tags, follow-ups and a full interaction history.

Built with Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4, shadcn/ui, Lucide, Supabase (Postgres + Auth) and Zod. It runs on the free tiers of Vercel and Supabase. There is no separate backend, no paid API and no AI service.

---

## Features

| Area | What you get |
| --- | --- |
| **Quick Add** (home screen) | Only the name is required. Contact info (with a Phone / Email / Other dropdown), notes (dictation-friendly) and "where you met" are always visible; company, title and LinkedIn sit behind a collapsible section. A large sticky Save button is reachable with one thumb. Duplicate suggestions appear as you type a name, and tapping one switches to **log a new conversation** with that person instead of creating a duplicate. The active event and meeting location are remembered between entries. Submissions are idempotent, so a double tap or retry never creates two records. |
| **People** | Search across name, company, title, notes, where-met and every interaction note. Sort by name, recently added or recently contacted. Filter by category or company. Cards on mobile, a table on desktop, with edit and delete. |
| **Profile** | Basic info, relationship category and strength, next follow-up and next action, tags, general notes, and a chronological timeline of interactions you can add to, edit or delete. Adding an interaction never overwrites earlier notes. |
| **Follow-Ups** | Overdue, due today, upcoming (14 days), recently added and recently contacted. Each row has **Done**, **Snooze** (presets or pick a date), **Log interaction** and a link to the profile. "Today" is computed in *your* time zone. |
| **Events** | Lightweight events (name, date, optional location and description). Set one as **active** and every contact and conversation you capture is linked to it until you change it. The event page lists who you met there and what you talked about. |
| **Export** | `contacts.csv`, `interactions.csv` (the full history) and a nested `backup.json`, all from Settings. CSVs are UTF-8 with a BOM (they open cleanly in Excel) and protected against formula injection. |
| **PWA** | Manifest, icons (including a maskable icon and an Apple touch icon), standalone display, safe-area-aware layout, light and dark mode. |
| **Offline-tolerant capture** | If a Quick Add save fails because of the network, the entry is stored on the device, shown as **"N not synced yet"**, and retried automatically when you're back online or reopen the app. See [Offline behavior](#offline-behavior-honest-version). |

---

## Architecture (short version)

```
Browser (React client components)
   │  Server Actions (mutations)      Route Handlers (export, duplicate lookup)
   ▼
Next.js on Vercel ── lib/actions/* → withAuth() → lib/services/*  ──┐
                     lib/data/* (reads, Server Components)          │  user-scoped Supabase client
                     proxy.ts (session refresh + auth redirects)    │  (publishable key + user JWT)
                                                                    ▼
                                                    Supabase Postgres (RLS on every table)
```

Key decisions:

- **Server Actions for writes, Server Components for reads.** The browser never talks to the database directly. Every action goes through `withAuth()`, which verifies the JWT (`getClaims()`) and passes the *verified* user id to a plain service function. That keeps business logic out of UI components and makes it unit-testable with a fake client.
- **Defense in depth for multi-user safety.**
  1. RLS on every table: `user_id = auth.uid()`.
  2. **Composite foreign keys** `(contact_id, user_id) → contacts(id, user_id)` (likewise for events and tags), so Postgres itself refuses to link your interaction to someone else's contact, even if a policy were misconfigured.
  3. Views and functions are `security invoker`, so RLS still applies.
  4. Only the publishable (anon) key is used. **There is no service-role key anywhere in this app.**
- **Idempotent Quick Add.** The client generates the contact and interaction UUIDs, and the `quick_add_contact` RPC inserts both in one transaction with `ON CONFLICT DO NOTHING`. Double taps, flaky networks and the offline queue all collapse to a single record.
- **Cache Components.** Pages are static shells with the user-specific parts streamed inside `<Suspense>`. User data is never cached across users.
- **Time zones.** Follow-ups are stored as `date`s. A tiny client component writes a `tz` cookie so the server can work out "today" for *you*, not for the server's UTC clock.

### Project structure

```
src/
  app/
    (auth)/login, (auth)/signup     Email + password auth pages
    auth/confirm/route.ts           Email-confirmation landing (PKCE + token_hash)
    (app)/page.tsx                  Quick Add (default screen)
    (app)/people/[id]/edit          Directory, profile, edit
    (app)/follow-ups, events, settings
    api/export/[kind]/route.ts      contacts.csv | interactions.csv | backup.json
    api/contacts/similar/route.ts   Duplicate suggestions (GET, abortable)
    manifest.ts, icon.png           PWA
  proxy.ts                          Next 16 "proxy" (formerly middleware)
  components/                       UI by feature + shadcn/ui primitives in components/ui
  lib/
    actions/       "use server" wrappers (auth + revalidation only)
    services/      Business logic: validate → query → map errors (unit tested)
    data/          Server-side reads for pages and exports
    validation/    Zod schemas (shared by client and server)
    supabase/      Server, browser and proxy clients
    offline-queue.ts, local-prefs.ts, dates.ts, csv.ts, constants.ts
supabase/
  migrations/20261107000000_init.sql   Schema, RLS, view, RPCs
  tests/rls.sql                        RLS and ownership assertions (rolls back)
tests/                                 Vitest unit tests
scripts/generate-icons.mjs             Regenerates PWA icons
```

---

## Setup

### 1. Create a Supabase project (free)

1. Sign in at [supabase.com](https://supabase.com) → **New project**. Pick a region near you and save the database password somewhere safe.
2. Open **SQL Editor** → **New query**, paste the whole of [`supabase/migrations/20261107000000_init.sql`](supabase/migrations/20261107000000_init.sql) and click **Run**. Then do the same, in order, for every later file in [`supabase/migrations/`](supabase/migrations/) (e.g. `20261112000000_contact_phone_other.sql`, then `20261116000000_custom_categories.sql` , `20261117000000_multi_categories.sql` and `20261118000000_optional_first_met.sql`).
   - Or use the CLI: `npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push`
3. *(Recommended)* Verify security: in a new SQL Editor query, paste and run [`supabase/tests/rls.sql`](supabase/tests/rls.sql). It creates two throwaway users, checks that neither can read or link the other's data, then **rolls everything back**. It should finish without errors; any failure raises a descriptive exception.

### 2. Configure authentication

In **Authentication → Sign In / Providers → Email**:

- **Email provider:** enabled (the default).
- **Confirm email:** choose one.
  - **Off**: the simplest option for a personal app. Sign-up logs you in immediately.
  - **On**: users must click the emailed link. Supabase's built-in mailer is heavily rate-limited on the free plan (a few emails per hour), which is fine for personal use.

In **Authentication → URL Configuration**:

- **Site URL:** your production URL, e.g. `https://your-app.vercel.app`
- **Redirect URLs:** add `http://localhost:3000/**` and `https://your-app.vercel.app/**`

(Optional) **Sign Up → "Allow new users to sign up"**: turn this off after creating your own account if you want a strictly personal instance.

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in the values from **Project Settings → API** (or the **Connect** button):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The **publishable** key (`sb_publishable_…`), or the legacy **anon** key |
| `NEXT_PUBLIC_SITE_URL` | Optional: `http://localhost:3000` locally, your Vercel URL in production |

> Never add the `service_role` / secret key. The app doesn't need it, and a `NEXT_PUBLIC_` variable would ship it to every browser.

### 4. Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

### Quality checks

```bash
npm run lint
npm run typecheck
npm test           # Vitest unit tests
npm run build
```

What the tests cover:

- Validation: name required, blank → null, email/LinkedIn normalization, dates.
- Contact creation through the idempotent RPC and contact edits.
- Interactions: appended, linked to the right contact, duplicate id → no second row.
- Follow-up date math across time zones, DST and month ends.
- The offline queue: per-user isolation, dedupe, nothing lost on failure.
- CSV and JSON export (escaping, formula injection, no user-id leakage).
- Auth boundaries: Server Actions reject unauthenticated calls, and the proxy redirects pages and 401s APIs.

Database-level authorization is covered by `supabase/tests/rls.sql`.

---

## Deploy to Vercel (Hobby plan)

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project**, import the repo. The framework preset is detected as Next.js; keep the defaults.
3. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL` (your `https://….vercel.app` URL) for Production (and Preview if you use it).
4. **Deploy.**
5. Back in Supabase → **Authentication → URL Configuration**, make sure the Site URL and Redirect URLs include the deployed domain.

`NEXT_PUBLIC_*` values are inlined at build time, so redeploy after changing them.

## Install on your iPhone

1. Open your deployed URL in **Safari** and sign in.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Launch **Rapport** from the Home Screen. It opens full-screen, straight to Quick Add, and stays signed in.

Tip: in the notes field, tap the 🎤 on the iOS keyboard to dictate.

---

## Offline behavior (honest version)

- **What works:** if you're *already in the app* and a save fails (bad Wi-Fi at the venue, server unreachable), Quick Add keeps the entry in `localStorage`, clears the form so you can keep capturing, and shows a visible **"N not synced yet"** list. Entries upload automatically when the connection returns, when you reopen the app, or when you tap **Retry now**. Each entry carries its client-generated UUID, so retries can't create duplicates. Nothing is removed until the server confirms it.
- **What doesn't:** there is no service worker. **Launching the app from a cold start with no connection will not load.** Browsing contacts offline isn't supported either.
- **Privacy:** pending entries are stored under a key namespaced by your user id, so another account on the same device never sees or sends them. Signing out deletes them (after a warning if any are unsynced). Synced contact data is never cached on the device.

## Free-tier notes

- **Supabase Free:** 500 MB database, 50k monthly active users, limited built-in auth emails per hour. **Projects pause after about 7 days without activity**; resume from the dashboard (data is kept). Using the app regularly avoids this.
- **Vercel Hobby:** for personal, non-commercial use. This app uses only Server Actions and Route Handlers, with no cron jobs, no image optimization and no paid add-ons.
- Rendering is capped at 1,000 contacts per directory view (exports are not capped). That's plenty for a personal network; add pagination if you outgrow it.

## Possible next steps

- Service worker for a cold-start offline shell plus an IndexedDB cache.
- Business-card / QR-code scanning (on-device).
- vCard import/export and LinkedIn CSV import.
- Optional reminder emails via a scheduled job (deliberately left out of v1).
- Playwright end-to-end tests against a local Supabase (`supabase start`).
