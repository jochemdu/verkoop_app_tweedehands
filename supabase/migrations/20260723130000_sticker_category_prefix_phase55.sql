-- Fase 55: sticker-prefix per categorie (bijv. geheugen → MEM0001).
-- sticker_sheets krijgt een prefix-kolom zodat ranges per prefix onafhankelijk
-- zijn (MEM0001-0010 botst niet met 0001-0010). De categorie→prefix-map en de
-- per-prefix tellers leven in app_settings (workspace-RLS hergebruikt); geen
-- nieuwe tabel nodig.

alter table public.sticker_sheets add column if not exists prefix text not null default '';

-- Overlap- en unieke-constraint opnieuw, nu per prefix.
alter table public.sticker_sheets drop constraint if exists sticker_sheets_no_overlap;
alter table public.sticker_sheets drop constraint if exists sticker_sheets_user_start_unique;
alter table public.sticker_sheets
  add constraint sticker_sheets_no_overlap
  exclude using gist (user_id with =, prefix with =, int4range(start_number, end_number, '[]') with &&);
alter table public.sticker_sheets
  add constraint sticker_sheets_user_prefix_start_unique unique (user_id, prefix, start_number);

-- Clamp-trigger uitbreiden: ook per-prefix tellers (last_sticker_number:MEM)
-- kunnen nooit dalen.
create or replace function public.clamp_sticker_counter()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.key like 'last_sticker_number%'
     and old.value is not null and new.value is not null
     and jsonb_typeof(old.value) = 'number' and jsonb_typeof(new.value) = 'number'
     and (new.value #>> '{}')::numeric < (old.value #>> '{}')::numeric
  then
    new.value := old.value;
  end if;
  return new;
end $$;
