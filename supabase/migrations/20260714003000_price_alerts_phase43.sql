-- Fase 43 (audit A2): in-app price-drop-notificaties. De price-watcher berekende
-- al of een prijs onder de drempel zakte maar leverde die 'alert' nergens af.
-- Deze tabel bewaart de alerts; de web-app toont ongelezen alerts.
create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  watch_id uuid references public.price_watches(id) on delete cascade,
  search_query text,
  lowest numeric,
  threshold numeric,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.price_alerts enable row level security;

create policy own_price_alerts on public.price_alerts
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Snel ongelezen alerts per gebruiker ophalen.
create index if not exists idx_price_alerts_user_unread
  on public.price_alerts (user_id, read_at);
