-- Labs baseline schema: profiles, orgs, feature_flags with RLS.

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('iso', 'payfac', 'acquirer', 'merchant')),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  email text not null,
  full_name text,
  role text not null check (role in ('labs_admin', 'iso_user', 'payfac_user', 'acquirer_user', 'merchant_user')),
  org_id uuid references public.orgs (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  feature_slug text not null unique,
  allowed_roles text[] not null default '{}',
  allowed_user_ids text[] default '{}',
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);

-- Helper to evaluate admin privileges inside RLS policies without recursion.
create or replace function public.is_labs_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.clerk_user_id = (auth.jwt() ->> 'sub')
      and p.role = 'labs_admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.orgs enable row level security;
alter table public.feature_flags enable row level security;

-- profiles policies
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (clerk_user_id = (auth.jwt() ->> 'sub'));

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (clerk_user_id = (auth.jwt() ->> 'sub'))
with check (clerk_user_id = (auth.jwt() ->> 'sub'));

create policy "profiles_select_all_labs_admin"
on public.profiles
for select
to authenticated
using (public.is_labs_admin());

-- orgs policies
create policy "orgs_select_member_org"
on public.orgs
for select
to authenticated
using (
  id = (
    select p.org_id
    from public.profiles p
    where p.clerk_user_id = (auth.jwt() ->> 'sub')
  )
);

create policy "orgs_select_all_labs_admin"
on public.orgs
for select
to authenticated
using (public.is_labs_admin());

create policy "orgs_insert_labs_admin"
on public.orgs
for insert
to authenticated
with check (public.is_labs_admin());

create policy "orgs_update_labs_admin"
on public.orgs
for update
to authenticated
using (public.is_labs_admin())
with check (public.is_labs_admin());

create policy "orgs_delete_labs_admin"
on public.orgs
for delete
to authenticated
using (public.is_labs_admin());

-- feature_flags policies
create policy "feature_flags_select_authenticated"
on public.feature_flags
for select
to authenticated
using (true);

create policy "feature_flags_insert_labs_admin"
on public.feature_flags
for insert
to authenticated
with check (public.is_labs_admin());

create policy "feature_flags_update_labs_admin"
on public.feature_flags
for update
to authenticated
using (public.is_labs_admin())
with check (public.is_labs_admin());

create policy "feature_flags_delete_labs_admin"
on public.feature_flags
for delete
to authenticated
using (public.is_labs_admin());

insert into public.feature_flags (feature_slug, allowed_roles, enabled)
values (
  'shell',
  array['labs_admin', 'iso_user', 'payfac_user', 'acquirer_user', 'merchant_user']::text[],
  true
)
on conflict (feature_slug) do update
set
  allowed_roles = excluded.allowed_roles,
  enabled = excluded.enabled;
