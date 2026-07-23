-- Fase 51: dashboard_stats + get_dashboard_stats van user_id naar workspace_id.
-- De matview en RPC telden alleen auth.uid()'s producten; de rest van de app
-- werkt workspace-breed (RLS is_workspace_member), waardoor het dashboard bij
-- een gedeelde workspace onderrapporteerde. Ook: composite hot-path indexen van
-- user_id (fase 31) naar workspace_id, want daar filtert de app nu op.

-- 1. RPC eerst weg (SQL-functie leest de matview).
drop function if exists public.get_dashboard_stats();

-- 2. Matview herbouwen, nu per workspace.
drop materialized view if exists public.dashboard_stats;
create materialized view public.dashboard_stats as
select
  workspace_id,
  count(*) as total_products,
  count(*) filter (where status = 'indexed') as indexed_count,
  count(*) filter (where status = 'ready_to_list') as ready_count,
  count(*) filter (where status = 'listed') as listed_count,
  count(*) filter (where status = 'sold') as sold_count,
  count(*) filter (where status = 'pending_review') as pending_count,
  count(*) filter (where status = 'approved') as approved_count,
  count(*) filter (where status = 'archived') as archived_count,
  coalesce(sum(coalesce(sold_price, recommended_price, 0)), 0) as total_est_value,
  now() as refreshed_at
from public.products
where deleted_at is null and workspace_id is not null
group by workspace_id;

-- Unieke index vereist voor REFRESH ... CONCURRENTLY (pg_cron elke 15 min).
create unique index dashboard_stats_workspace_idx on public.dashboard_stats(workspace_id);

-- BELANGRIJK: een verse matview krijgt default grants → hij zou weer direct via
-- PostgREST selecteerbaar zijn (anon/authenticated), wat de workspace-filter van
-- get_dashboard_stats() omzeilt. Herstel de fase-31 REVOKE: alleen de SECURITY
-- DEFINER-RPC mag de matview lezen.
revoke select on public.dashboard_stats from anon, authenticated;

-- 3. RPC herbouwen: som over de workspaces van de caller (matcht de products-RLS).
create or replace function public.get_dashboard_stats()
returns table(
  total_products bigint, indexed_count bigint, ready_count bigint,
  listed_count bigint, sold_count bigint, pending_count bigint,
  approved_count bigint, archived_count bigint,
  total_est_value numeric, refreshed_at timestamptz
)
language sql security definer set search_path = '' as $$
  select
    coalesce(sum(total_products), 0)::bigint,
    coalesce(sum(indexed_count), 0)::bigint,
    coalesce(sum(ready_count), 0)::bigint,
    coalesce(sum(listed_count), 0)::bigint,
    coalesce(sum(sold_count), 0)::bigint,
    coalesce(sum(pending_count), 0)::bigint,
    coalesce(sum(approved_count), 0)::bigint,
    coalesce(sum(archived_count), 0)::bigint,
    coalesce(sum(total_est_value), 0)::numeric,
    max(refreshed_at)
  from public.dashboard_stats
  where workspace_id in (select public.current_workspace_ids());
$$;
grant execute on function public.get_dashboard_stats() to authenticated;

-- 4. Workspace composite hot-path indexen (partieel op actieve rijen).
create index if not exists idx_products_ws_active   on public.products(workspace_id) where deleted_at is null;
create index if not exists idx_products_ws_status   on public.products(workspace_id, status) where deleted_at is null;
create index if not exists idx_products_ws_category on public.products(workspace_id, category_slug) where deleted_at is null;
create index if not exists idx_products_ws_indexed  on public.products(workspace_id, indexed_at desc) where deleted_at is null;

-- 5. Dode fase31 user_id-composites opruimen (RLS + queries draaien nu op workspace).
drop index if exists public.idx_products_user_active;
drop index if exists public.idx_products_user_status;
drop index if exists public.idx_products_user_category;
drop index if exists public.idx_products_user_indexed;
