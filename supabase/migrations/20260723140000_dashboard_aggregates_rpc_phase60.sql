-- Fase 60: dashboard-aggregaties in de DB i.p.v. de volledige productset naar de
-- app trekken. Eén SECURITY INVOKER-functie (RLS scopet naar de workspace van de
-- caller) die categorie-, status-, week- en waarde-aggregaties als compacte
-- jsonb teruggeeft. Draait op de workspace-composite-indexen uit fase 51.
create or replace function public.get_dashboard_aggregates()
returns jsonb language sql security invoker set search_path = '' stable as $$
  with scoped as (
    select category_slug, status, indexed_at, sold_price, recommended_price
    from public.products
    where deleted_at is null
  )
  select jsonb_build_object(
    'category_counts', coalesce((
      select jsonb_object_agg(cs, c) from (
        select coalesce(category_slug, 'unknown') as cs, count(*) as c
        from scoped group by 1
      ) a), '{}'::jsonb),
    'status_counts', coalesce((
      select jsonb_object_agg(st, c) from (
        select coalesce(status::text, 'indexed') as st, count(*) as c
        from scoped group by 1
      ) b), '{}'::jsonb),
    'weekly', coalesce((
      select jsonb_object_agg(wk, c) from (
        select to_char(date_trunc('week', indexed_at), 'IYYY-"W"IW') as wk, count(*) as c
        from scoped
        where indexed_at is not null and indexed_at >= (now() - interval '12 weeks')
        group by 1
      ) d), '{}'::jsonb),
    'realized', coalesce((select sum(sold_price) from scoped where status = 'sold'), 0),
    'potential', coalesce((select sum(recommended_price) from scoped where status is distinct from 'sold'), 0)
  );
$$;
grant execute on function public.get_dashboard_aggregates() to authenticated;
