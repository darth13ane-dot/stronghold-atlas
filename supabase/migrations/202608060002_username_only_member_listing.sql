drop function if exists public.list_stronghold_members(uuid);

create function public.list_stronghold_members(p_stronghold_id uuid)
returns table (
  user_id uuid,
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
    coalesce(profile.username, 'Unnamed member')::text as display_name,
    membership.role,
    membership.joined_at,
    membership.user_id = (select auth.uid()) as is_current_user
  from public.stronghold_members as membership
  left join public.user_profiles as profile on profile.user_id = membership.user_id
  where membership.stronghold_id = p_stronghold_id
  order by
    case membership.role
      when 'owner' then 0
      when 'editor' then 1
      else 2
    end,
    membership.joined_at,
    lower(coalesce(profile.username, '')),
    membership.user_id;
end;
$$;

revoke all on function public.list_stronghold_members(uuid) from public;
revoke all on function public.list_stronghold_members(uuid) from anon;
grant execute on function public.list_stronghold_members(uuid) to authenticated;
