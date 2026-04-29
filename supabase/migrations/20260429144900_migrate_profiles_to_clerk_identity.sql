-- Convert baseline schema from Supabase Auth user IDs to Clerk user IDs.

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  alter column id set default gen_random_uuid();

alter table public.profiles
  add column if not exists clerk_user_id text;

update public.profiles
set clerk_user_id = id::text
where clerk_user_id is null;

alter table public.profiles
  alter column clerk_user_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_clerk_user_id_key'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_clerk_user_id_key unique (clerk_user_id);
  end if;
end $$;

alter table public.feature_flags
  alter column allowed_user_ids type text[]
  using (allowed_user_ids::text[]);

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

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_select_all_labs_admin" on public.profiles;
drop policy if exists "orgs_select_member_org" on public.orgs;

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
