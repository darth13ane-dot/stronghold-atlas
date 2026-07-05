create extension if not exists pgcrypto;

create table public.strongholds (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  state jsonb not null default '{}'::jsonb,
  created_by uuid not null default (select auth.uid()) references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stronghold_members (
  stronghold_id uuid not null references public.strongholds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (stronghold_id, user_id)
);

create index stronghold_members_user_id_idx on public.stronghold_members (user_id);
create index stronghold_members_stronghold_role_idx on public.stronghold_members (stronghold_id, role);

create table public.stronghold_invites (
  token uuid primary key default gen_random_uuid(),
  stronghold_id uuid not null references public.strongholds(id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz
);

create index stronghold_invites_stronghold_id_idx on public.stronghold_invites (stronghold_id);
create index stronghold_invites_created_by_idx on public.stronghold_invites (created_by);
create index stronghold_invites_open_idx on public.stronghold_invites (token)
  where claimed_by is null;

create or replace function public.is_stronghold_member(p_stronghold_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stronghold_members
    where stronghold_id = p_stronghold_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.can_edit_stronghold(p_stronghold_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stronghold_members
    where stronghold_id = p_stronghold_id
      and user_id = (select auth.uid())
      and role in ('owner', 'editor')
  );
$$;

create or replace function public.is_stronghold_owner(p_stronghold_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stronghold_members
    where stronghold_id = p_stronghold_id
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

create or replace function public.add_stronghold_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stronghold_members (stronghold_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger strongholds_add_owner
after insert on public.strongholds
for each row execute function public.add_stronghold_owner();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger strongholds_touch_updated_at
before update on public.strongholds
for each row execute function public.touch_updated_at();

alter table public.strongholds enable row level security;
alter table public.stronghold_members enable row level security;
alter table public.stronghold_invites enable row level security;

create policy "members can read strongholds"
on public.strongholds for select
to authenticated
using ((select public.is_stronghold_member(id)));

create policy "users can create strongholds"
on public.strongholds for insert
to authenticated
with check (created_by = (select auth.uid()));

create policy "editors can update strongholds"
on public.strongholds for update
to authenticated
using ((select public.can_edit_stronghold(id)))
with check ((select public.can_edit_stronghold(id)));

create policy "owners can delete strongholds"
on public.strongholds for delete
to authenticated
using ((select public.is_stronghold_owner(id)));

create policy "members can read membership"
on public.stronghold_members for select
to authenticated
using ((select public.is_stronghold_member(stronghold_id)));

create policy "owners can add members"
on public.stronghold_members for insert
to authenticated
with check ((select public.is_stronghold_owner(stronghold_id)));

create policy "owners can update members"
on public.stronghold_members for update
to authenticated
using ((select public.is_stronghold_owner(stronghold_id)))
with check ((select public.is_stronghold_owner(stronghold_id)));

create policy "owners or self can leave"
on public.stronghold_members for delete
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_stronghold_owner(stronghold_id))
);

create or replace function public.create_stronghold_invite(
  p_stronghold_id uuid,
  p_role text default 'editor'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_token uuid;
begin
  if p_role not in ('editor', 'viewer') then
    raise exception 'Invalid invite role';
  end if;

  if not public.can_edit_stronghold(p_stronghold_id) then
    raise exception 'Not authorized';
  end if;

  insert into public.stronghold_invites (stronghold_id, role, created_by)
  values (p_stronghold_id, p_role, (select auth.uid()))
  returning token into invite_token;

  return invite_token;
end;
$$;

create or replace function public.accept_stronghold_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.stronghold_invites%rowtype;
begin
  select *
  into invite_row
  from public.stronghold_invites
  where token = p_token
    and claimed_by is null
    and expires_at > now()
  for update;

  if invite_row.token is null then
    raise exception 'Invite is invalid or expired';
  end if;

  insert into public.stronghold_members (stronghold_id, user_id, role)
  values (invite_row.stronghold_id, (select auth.uid()), invite_row.role)
  on conflict (stronghold_id, user_id)
  do update set role = excluded.role;

  update public.stronghold_invites
  set claimed_by = (select auth.uid()), claimed_at = now()
  where token = p_token;

  return invite_row.stronghold_id;
end;
$$;

revoke all on function public.create_stronghold_invite(uuid, text) from public;
revoke all on function public.accept_stronghold_invite(uuid) from public;
grant execute on function public.create_stronghold_invite(uuid, text) to authenticated;
grant execute on function public.accept_stronghold_invite(uuid) to authenticated;

grant select, insert, update, delete on public.strongholds to authenticated;
grant select, insert, update, delete on public.stronghold_members to authenticated;

alter publication supabase_realtime add table public.strongholds;

