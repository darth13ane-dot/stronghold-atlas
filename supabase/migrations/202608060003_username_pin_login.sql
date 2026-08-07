begin;

create table public.user_pin_logins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_email text not null unique,
  created_at timestamptz not null default now(),
  constraint user_pin_logins_internal_email
    check (lower(login_email) like '%@users.stronghold-atlas.invalid')
);

alter table public.user_pin_logins enable row level security;

revoke all on table public.user_pin_logins from public;
revoke all on table public.user_pin_logins from anon;
revoke all on table public.user_pin_logins from authenticated;

create or replace function public.resolve_pin_login(p_username text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resolved_email text;
  normalized_username text := lower(btrim(coalesce(p_username, '')));
begin
  select pin_login.login_email
  into resolved_email
  from public.user_pin_logins as pin_login
  join public.user_profiles as profile on profile.user_id = pin_login.user_id
  where lower(profile.username) = normalized_username;

  return coalesce(
    resolved_email,
    'missing-' || pg_catalog.md5(normalized_username) || '@users.stronghold-atlas.invalid'
  );
end;
$$;

create or replace function public.has_pin_login()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_pin_logins
    where user_id = (select auth.uid())
  );
$$;

create or replace function public.enable_pin_login()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
begin
  if current_user_id is null then
    raise exception 'Sign in before creating PIN access'
      using errcode = '42501';
  end if;

  select account.email::text
  into current_email
  from auth.users as account
  where account.id = current_user_id;

  if current_email is null or lower(current_email) not like '%@users.stronghold-atlas.invalid' then
    raise exception 'This account is not a PIN login identity'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.user_profiles where user_id = current_user_id
  ) then
    raise exception 'Choose a username before enabling PIN access'
      using errcode = '22023';
  end if;

  insert into public.user_pin_logins (user_id, login_email)
  values (current_user_id, lower(current_email))
  on conflict (user_id) do nothing;

  return true;
end;
$$;

create or replace function public.upgrade_current_user_to_pin(
  p_new_user_id uuid,
  p_username text,
  p_transfer_nonce uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_username text := btrim(p_username);
  target_email text;
  target_created_at timestamptz;
  target_transfer_nonce text;
begin
  if current_user_id is null then
    raise exception 'Sign in before creating PIN access'
      using errcode = '42501';
  end if;

  if p_new_user_id is null or p_new_user_id = current_user_id or p_transfer_nonce is null then
    raise exception 'The new PIN identity is invalid'
      using errcode = '22023';
  end if;

  if normalized_username is null or normalized_username !~ '^[A-Za-z0-9_]{3,24}$' then
    raise exception 'Usernames must be 3 to 24 letters, numbers, or underscores'
      using errcode = '22023';
  end if;

  select
    account.email::text,
    account.created_at,
    account.raw_user_meta_data ->> 'pin_transfer_nonce'
  into target_email, target_created_at, target_transfer_nonce
  from auth.users as account
  where account.id = p_new_user_id
  for update;

  if target_email is null
    or lower(target_email) not like '%@users.stronghold-atlas.invalid'
    or target_created_at < now() - interval '15 minutes'
    or target_transfer_nonce is distinct from p_transfer_nonce::text then
    raise exception 'The new PIN identity could not be verified'
      using errcode = '42501';
  end if;

  if exists (select 1 from public.user_pin_logins where user_id = current_user_id) then
    raise exception 'PIN access is already enabled for this account'
      using errcode = '22023';
  end if;

  if exists (select 1 from public.stronghold_members where user_id = p_new_user_id)
    or exists (select 1 from public.user_profiles where user_id = p_new_user_id)
    or exists (select 1 from public.user_pin_logins where user_id = p_new_user_id) then
    raise exception 'The new PIN identity is already in use'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.user_profiles
    where lower(username) = lower(normalized_username)
      and user_id <> current_user_id
  ) then
    raise exception 'That username is already in use'
      using errcode = '23505';
  end if;

  update public.strongholds
  set created_by = p_new_user_id
  where created_by = current_user_id;

  update public.stronghold_invites
  set created_by = p_new_user_id
  where created_by = current_user_id;

  update public.stronghold_invites
  set claimed_by = p_new_user_id
  where claimed_by = current_user_id;

  update public.stronghold_members
  set user_id = p_new_user_id
  where user_id = current_user_id;

  delete from public.user_profiles
  where user_id = current_user_id;

  insert into public.user_profiles (user_id, username)
  values (p_new_user_id, normalized_username);

  insert into public.user_pin_logins (user_id, login_email)
  values (p_new_user_id, lower(target_email));

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'pin_transfer_nonce'
  where id = p_new_user_id;

  return normalized_username;
exception
  when unique_violation then
    raise exception 'That username is already in use'
      using errcode = '23505';
end;
$$;

revoke all on function public.resolve_pin_login(text) from public;
revoke all on function public.has_pin_login() from public;
revoke all on function public.enable_pin_login() from public;
revoke all on function public.upgrade_current_user_to_pin(uuid, text, uuid) from public;
revoke all on function public.has_pin_login() from anon;
revoke all on function public.enable_pin_login() from anon;
revoke all on function public.upgrade_current_user_to_pin(uuid, text, uuid) from anon;

grant execute on function public.resolve_pin_login(text) to anon, authenticated;
grant execute on function public.has_pin_login() to authenticated;
grant execute on function public.enable_pin_login() to authenticated;
grant execute on function public.upgrade_current_user_to_pin(uuid, text, uuid) to authenticated;

commit;
