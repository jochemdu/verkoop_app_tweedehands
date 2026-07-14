-- Fase 48: ledenlijst mét e-mail (auth.users is niet client-leesbaar). Alleen
-- leden van de workspace mogen de lijst opvragen.
create or replace function list_workspace_members(p_workspace uuid)
returns table(user_id uuid, email text, role text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = p_workspace
    and public.is_workspace_member(p_workspace)
  order by m.created_at
$$;
grant execute on function list_workspace_members(uuid) to authenticated;
