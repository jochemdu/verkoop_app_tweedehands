-- Fase 48: elke bestaande gebruiker krijgt een persoonlijke workspace + owner-
-- membership, en die wordt de actieve workspace. Idempotent.
do $$
declare u record; w_id uuid;
begin
  for u in
    select id from auth.users
    where not exists (
      select 1 from public.workspace_members m where m.user_id = auth.users.id
    )
  loop
    insert into public.workspaces(name, created_by) values ('Huishouden', u.id)
      returning id into w_id;
    insert into public.workspace_members(workspace_id, user_id, role)
      values (w_id, u.id, 'owner');
    update public.profiles set active_workspace_id = w_id
      where id = u.id and active_workspace_id is null;
  end loop;
end $$;

update public.profiles p
set active_workspace_id = (
  select m.workspace_id from public.workspace_members m
  where m.user_id = p.id order by m.created_at limit 1
)
where p.active_workspace_id is null
  and exists (select 1 from public.workspace_members m where m.user_id = p.id);
