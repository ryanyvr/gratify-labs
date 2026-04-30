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

## 2) Add Supabase credentials

Populate `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
```

Get these from the Labs Supabase project (non-production). Never commit real secrets.

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
