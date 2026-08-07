create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  updated_at timestamptz not null default now(),
  constraint user_profiles_username_format
    check (username ~ '^[A-Za-z0-9_]{3,24}$')
);

create unique index if not exists user_profiles_username_lower_idx
  on public.user_profiles (lower(username));

alter table public.user_profiles enable row level security;

revoke all on table public.user_profiles from public;
revoke all on table public.user_profiles from anon;
revoke all on table public.user_profiles from authenticated;

create or replace function public.get_current_username()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profile.username
  from public.user_profiles as profile
  where profile.user_id = (select auth.uid());
$$;

create or replace function public.set_current_username(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_username text := btrim(p_username);
begin
  if current_user_id is null then
    raise exception 'Sign in before choosing a username'
      using errcode = '42501';
  end if;

  if normalized_username is null or normalized_username !~ '^[A-Za-z0-9_]{3,24}$' then
    raise exception 'Usernames must be 3 to 24 letters, numbers, or underscores'
      using errcode = '22023';
  end if;

  insert into public.user_profiles (user_id, username)
  values (current_user_id, normalized_username)
  on conflict (user_id)
  do update set
    username = excluded.username,
    updated_at = now();

  return normalized_username;
exception
  when unique_violation then
    raise exception 'That username is already in use'
      using errcode = '23505';
end;
$$;

create or replace function public.list_stronghold_members(p_stronghold_id uuid)
returns table (
  user_id uuid,
  email text,
  display_name text,
  role text,
  joined_at timestamptz,
  is_current_user boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_stronghold_owner(p_stronghold_id) then
    raise exception 'Only the stronghold owner can view registered accounts'
      using errcode = '42501';
  end if;

  return query
  select
    membership.user_id,
    account.email::text,
    coalesce(
      profile.username,
      nullif(account.raw_user_meta_data ->> 'full_name', ''),
      nullif(account.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(account.email, '@', 1), ''),
      'Anonymous account'
    )::text as display_name,
    membership.role,
    membership.joined_at,
    membership.user_id = (select auth.uid()) as is_current_user
  from public.stronghold_members as membership
  join auth.users as account on account.id = membership.user_id
  left join public.user_profiles as profile on profile.user_id = membership.user_id
  where membership.stronghold_id = p_stronghold_id
  order by
    case membership.role
      when 'owner' then 0
      when 'editor' then 1
      else 2
    end,
    membership.joined_at,
    account.email;
end;
$$;

create or replace function public.update_stronghold_member_role(
  p_stronghold_id uuid,
  p_user_id uuid,
  p_role text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_stronghold_owner(p_stronghold_id) then
    raise exception 'Only the stronghold owner can manage accounts'
      using errcode = '42501';
  end if;

  if p_role not in ('editor', 'viewer') then
    raise exception 'Members can only be editors or viewers'
      using errcode = '22023';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'Owners cannot change their own access'
      using errcode = '42501';
  end if;

  update public.stronghold_members
  set role = p_role
  where stronghold_id = p_stronghold_id
    and user_id = p_user_id
    and role <> 'owner';

  if not found then
    raise exception 'That member could not be changed'
      using errcode = 'P0002';
  end if;

  return p_role;
end;
$$;

create or replace function public.remove_stronghold_member(
  p_stronghold_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_stronghold_owner(p_stronghold_id) then
    raise exception 'Only the stronghold owner can manage accounts'
      using errcode = '42501';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'Owners cannot remove their own account'
      using errcode = '42501';
  end if;

  delete from public.stronghold_members
  where stronghold_id = p_stronghold_id
    and user_id = p_user_id
    and role <> 'owner';

  if not found then
    raise exception 'That member could not be removed'
      using errcode = 'P0002';
  end if;

  return true;
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
  do update set role = excluded.role
  where public.stronghold_members.role <> 'owner';

  update public.stronghold_invites
  set claimed_by = (select auth.uid()), claimed_at = now()
  where token = p_token;

  return invite_row.stronghold_id;
end;
$$;

revoke insert, update, delete on table public.stronghold_members from authenticated;

revoke all on function public.get_current_username() from public;
revoke all on function public.get_current_username() from anon;
revoke all on function public.set_current_username(text) from public;
revoke all on function public.set_current_username(text) from anon;
revoke all on function public.list_stronghold_members(uuid) from public;
revoke all on function public.list_stronghold_members(uuid) from anon;
revoke all on function public.update_stronghold_member_role(uuid, uuid, text) from public;
revoke all on function public.update_stronghold_member_role(uuid, uuid, text) from anon;
revoke all on function public.remove_stronghold_member(uuid, uuid) from public;
revoke all on function public.remove_stronghold_member(uuid, uuid) from anon;
revoke all on function public.create_stronghold_invite(uuid, text) from anon;
revoke all on function public.accept_stronghold_invite(uuid) from anon;

grant execute on function public.get_current_username() to authenticated;
grant execute on function public.set_current_username(text) to authenticated;
grant execute on function public.list_stronghold_members(uuid) to authenticated;
grant execute on function public.update_stronghold_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_stronghold_member(uuid, uuid) to authenticated;
