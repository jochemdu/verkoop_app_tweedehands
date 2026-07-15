-- Fase 49: security-hardening n.a.v. audit.

-- 1. Dicht cross-tenant lekken. Twee oude SECURITY DEFINER-RPC's filteren enkel op
--    een door de caller aangeleverde p_user_id (geen auth.uid()-check) en waren aan
--    'authenticated' gegrant -> elke ingelogde gebruiker kon via /rest/v1/rpc de
--    inventaris/foto-metadata van een willekeurige andere tenant uitlezen. Alleen de
--    lokale MCP (service-role, vaste eigen id) gebruikt list_inventory_with_counts;
--    find_similar_photos heeft geen enkele app-caller. Oplossing: intrekken van
--    authenticated/public, expliciet aan service_role laten.
revoke execute on function list_inventory_with_counts(uuid, text, text, text, text, int) from authenticated, public;
revoke execute on function find_similar_photos(uuid, bigint, int, uuid) from authenticated, public;
grant execute on function list_inventory_with_counts(uuid, text, text, text, text, int) to service_role;
grant execute on function find_similar_photos(uuid, bigint, int, uuid) to service_role;

-- 2. active_workspace_id() self-heal: negeer een stale profiel-waarde als de gebruiker
--    geen lid (meer) is van die workspace (bv. na verwijderd/vertrokken zijn), anders
--    blokkeert de RLS with_check alle inserts. Val terug op de eerste membership.
create or replace function active_workspace_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.active_workspace_id from public.profiles p
       where p.id = auth.uid()
         and exists (
           select 1 from public.workspace_members m
           where m.workspace_id = p.active_workspace_id and m.user_id = auth.uid()
         )),
    (select workspace_id from public.workspace_members
       where user_id = auth.uid() order by created_at limit 1)
  )
$$;

-- 3. Sticker-uniekheid per workspace i.p.v. per user. Na fase 48 delen leden een
--    workspace; met de oude UNIQUE(user_id, sticker_id) konden twee leden hetzelfde
--    stickernummer krijgen -> /inventory/[sticker] brak (meerdere rijen op maybeSingle).
alter table public.products drop constraint products_user_sticker_unique;
alter table public.products
  add constraint products_workspace_sticker_unique unique (workspace_id, sticker_id);
