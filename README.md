## Gratify Labs Scaffold

Next.js App Router scaffold with:

- Next.js 16 + TypeScript + Tailwind CSS
- Clerk authentication (`@clerk/nextjs`)
- Supabase database client (`@supabase/supabase-js`)
- Vercel-ready environment workflow

## 1) Install and run locally

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Dev server shows 404 for every route (but `npm run build` / `npm run start` look fine)

Turbopack chooses a workspace root by walking up for lockfiles. If a parent directory (for example `$HOME`) has its own `package-lock.json`, Next can treat that folder as the app root, so no `src/app` routes match and you get Next’s generic 404. This repo sets `turbopack.root` in `next.config.ts` to the directory that contains that file so the correct project is always used. If problems persist: stop dev, delete `.next`, run `npm run dev` again, or remove the stray lockfile if it was created accidentally. As a fallback, `npx next dev --webpack` avoids Turbopack entirely.

## 2) Add Supabase credentials

Populate `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
```

Get these from the Labs Supabase project (non-production). Never commit real secrets.

Re-pricing server code uses **`SUPABASE_SERVICE_ROLE_KEY` when it is set**, otherwise **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**. If Supabase returns **Invalid API key**, the key does not match that project URL (or the service-role value is wrong): fix it under **Project Settings → API**, or clear `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` so the anon key is used.

## 3) Vercel link + env pull (recommended)

If this repo is linked to a Vercel project:

```bash
vercel whoami
vercel link
vercel env pull .env.local --yes
```

## Project structure

- `app/page.tsx`: placeholder home page rendering `Gratify Labs`
- `lib/supabase/client.ts`: browser client

## Deploy

```bash
vercel
```
