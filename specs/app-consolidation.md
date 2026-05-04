# App consolidation (GRA-50)

The Re-Pricing Next.js app previously lived under `repricing/`. It is now merged into the **single** root app:

- **Route group** `app/(shell)/` — shared `Sidebar`, auth (Clerk), and shell layout (Inter, page background).
- **Labs** — ` /dashboard`, `/features/*` (moved under `(shell)`; URLs unchanged).
- **Re-Pricing** — `/re-pricing/dashboard`, `/re-pricing/merchants/[merchantId]`, `/re-pricing/partners/[partnerName]`.
- **Code** — `lib/repricing/*`, `components/repricing/*`, `components/shell/Sidebar.tsx`.

The `repricing/` directory is removed after migration. Set `NEXT_PUBLIC_SUPABASE_*` and Clerk keys in the root environment (see `.env.local.example` if present).
