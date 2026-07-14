-- Fase 46: verzendkosten-schatting. Optionele verzendklasse-override op product;
-- anders wordt de klasse afgeleid uit de categorie (zie packages/shared/src/shipping.ts).
alter table public.products
  add column if not exists shipping_class text
  check (shipping_class in ('letterbox', 'parcel', 'large'));

comment on column public.products.shipping_class is
  'Handmatige verzendklasse-override; anders afgeleid uit categorie (zie shared/shipping.ts).';
