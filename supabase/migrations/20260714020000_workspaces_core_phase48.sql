-- Fase 48: household/team-sharing. Workspace = huishouden/team dat data bezit.
-- Elke gebruiker hoort bij >=1 workspace; bij signup een persoonlijke workspace.

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on workspace_members(user_id);

create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists workspace_invites_ws_idx on workspace_invites(workspace_id);

alter table profiles
  add column if not exists active_workspace_id uuid references workspaces(id) on delete set null;

-- Helpers (SECURITY DEFINER: bypassen RLS -> geen recursie op workspace_members).
create or replace function current_workspace_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select workspace_id from public.workspace_members where user_id = auth.uid()
$$;

create or replace function is_workspace_member(w uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.workspace_members
    where workspace_id = w and user_id = auth.uid()
  )
$$;

create or replace function is_workspace_owner(w uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.workspace_members
    where workspace_id = w and user_id = auth.uid() and role = 'owner'
  )
$$;

create or replace function active_workspace_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select active_workspace_id from public.profiles where id = auth.uid()),
    (select workspace_id from public.workspace_members
       where user_id = auth.uid() order by created_at limit 1)
  )
$$;

grant execute on function current_workspace_ids() to authenticated;
grant execute on function is_workspace_member(uuid) to authenticated;
grant execute on function is_workspace_owner(uuid) to authenticated;
grant execute on function active_workspace_id() to authenticated;

-- RLS op de workspace-tabellen.
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;

drop policy if exists ws_select on workspaces;
drop policy if exists ws_insert on workspaces;
drop policy if exists ws_update on workspaces;
drop policy if exists ws_delete on workspaces;
create policy ws_select on workspaces for select to authenticated using (is_workspace_member(id));
create policy ws_insert on workspaces for insert to authenticated with check (created_by = auth.uid());
create policy ws_update on workspaces for update to authenticated using (is_workspace_owner(id)) with check (is_workspace_owner(id));
create policy ws_delete on workspaces for delete to authenticated using (is_workspace_owner(id));

drop policy if exists wm_select on workspace_members;
drop policy if exists wm_insert on workspace_members;
drop policy if exists wm_update on workspace_members;
drop policy if exists wm_delete on workspace_members;
create policy wm_select on workspace_members for select to authenticated using (is_workspace_member(workspace_id));
create policy wm_insert on workspace_members for insert to authenticated with check (is_workspace_owner(workspace_id));
create policy wm_update on workspace_members for update to authenticated using (is_workspace_owner(workspace_id)) with check (is_workspace_owner(workspace_id));
create policy wm_delete on workspace_members for delete to authenticated using (is_workspace_owner(workspace_id) or user_id = auth.uid());

drop policy if exists wi_select on workspace_invites;
drop policy if exists wi_insert on workspace_invites;
drop policy if exists wi_delete on workspace_invites;
create policy wi_select on workspace_invites for select to authenticated using (is_workspace_member(workspace_id));
create policy wi_insert on workspace_invites for insert to authenticated with check (is_workspace_owner(workspace_id));
create policy wi_delete on workspace_invites for delete to authenticated using (is_workspace_owner(workspace_id));

-- Aanmaken van een workspace + owner-membership in één atomische call.
create or replace function create_workspace(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare w_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.workspaces(name, created_by)
    values (coalesce(nullif(trim(p_name), ''), 'Huishouden'), auth.uid())
    returning id into w_id;
  insert into public.workspace_members(workspace_id, user_id, role)
    values (w_id, auth.uid(), 'owner');
  return w_id;
end $$;
grant execute on function create_workspace(text) to authenticated;

-- Invite accepteren op token; e-mail moet matchen met het ingelogde account.
create or replace function accept_workspace_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare inv public.workspace_invites; uid uuid; uemail text;
begin
  uid := auth.uid();
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into inv from public.workspace_invites where token = p_token;
  if inv.id is null then raise exception 'invite_not_found'; end if;
  if inv.accepted_at is not null then raise exception 'invite_already_used'; end if;
  if inv.expires_at < now() then raise exception 'invite_expired'; end if;
  select email into uemail from auth.users where id = uid;
  if lower(inv.email) <> lower(coalesce(uemail, '')) then
    raise exception 'invite_email_mismatch';
  end if;
  insert into public.workspace_members(workspace_id, user_id, role)
    values (inv.workspace_id, uid, inv.role)
    on conflict (workspace_id, user_id) do nothing;
  update public.workspace_invites set accepted_at = now() where id = inv.id;
  update public.profiles set active_workspace_id = inv.workspace_id where id = uid;
  return inv.workspace_id;
end $$;
grant execute on function accept_workspace_invite(text) to authenticated;

-- Signup: profiel + persoonlijke workspace + owner-membership + actieve workspace.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare w_id uuid;
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.workspaces(name, created_by) values ('Huishouden', new.id)
    returning id into w_id;
  insert into public.workspace_members(workspace_id, user_id, role)
    values (w_id, new.id, 'owner');
  update public.profiles set active_workspace_id = w_id where id = new.id;
  return new;
end $$;
