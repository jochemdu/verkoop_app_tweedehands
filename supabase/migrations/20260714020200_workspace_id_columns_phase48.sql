-- Fase 48: workspace_id op alle user-gescopede datatabellen (excl. oauth_*, die
-- blijven persoonlijk). Kolom + backfill vanuit de persoonlijke workspace, dan
-- NOT NULL + index, een auto-fill trigger, en RLS omgezet naar workspace-scoping.

do $$
declare t text;
  tables text[] := array[
    'app_settings','bundle_items','bundles','buyback_quotes','claude_analyses',
    'containers','house_scans','import_candidates','listings','market_comparables',
    'photos','price_alerts','price_history','price_watches','products',
    'sticker_sheets','taxatie_exports'
  ];
begin
  foreach t in array tables loop
    execute format(
      'alter table public.%I add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade', t);
    execute format(
      'update public.%I x set workspace_id = (
         select m.workspace_id from public.workspace_members m
         where m.user_id = x.user_id order by m.created_at limit 1)
       where x.workspace_id is null and x.user_id is not null', t);
  end loop;
end $$;

-- Vult workspace_id bij insert automatisch met de actieve workspace van de
-- gebruiker (auth.uid()). Service-role inserts (edge functions) moeten
-- workspace_id expliciet meegeven, want daar is auth.uid() NULL.
create or replace function set_workspace_id()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.workspace_id is null then
    new.workspace_id := public.active_workspace_id();
  end if;
  return new;
end $$;

do $$
declare t text; pol record;
  tables text[] := array[
    'app_settings','bundle_items','bundles','buyback_quotes','claude_analyses',
    'containers','house_scans','import_candidates','listings','market_comparables',
    'photos','price_alerts','price_history','price_watches','products',
    'sticker_sheets','taxatie_exports'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I alter column workspace_id set not null', t);
    execute format('create index if not exists %I on public.%I(workspace_id)', t || '_workspace_idx', t);

    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    execute format(
      'create policy ws_all on public.%I for all to authenticated
         using (public.is_workspace_member(workspace_id))
         with check (public.is_workspace_member(workspace_id))', t);

    execute format('drop trigger if exists set_workspace_id_trg on public.%I', t);
    execute format(
      'create trigger set_workspace_id_trg before insert on public.%I
         for each row execute function public.set_workspace_id()', t);
  end loop;
end $$;
