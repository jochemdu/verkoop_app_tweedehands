-- Fase 50: sticker-teller monotoon maken.
-- app_settings.last_sticker_number wordt door web (stickers/generate) en mobiel
-- (capture) via een blinde upsert geschreven die de teller kan VERLAGEN →
-- reeds uitgegeven nummers worden opnieuw uitgereikt → 23505 op
-- products_workspace_sticker_unique. Deze BEFORE UPDATE-trigger klemt de waarde
-- monotoon: de teller kan nooit omlaag, ongeacht welke client schrijft. Geen
-- app-wijziging nodig; alle bestaande schrijvers worden meteen veilig.

create or replace function public.clamp_sticker_counter()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.key = 'last_sticker_number'
     and old.value is not null and new.value is not null
     and jsonb_typeof(old.value) = 'number' and jsonb_typeof(new.value) = 'number'
     and (new.value #>> '{}')::numeric < (old.value #>> '{}')::numeric
  then
    new.value := old.value;
  end if;
  return new;
end $$;

drop trigger if exists clamp_sticker_counter_trg on public.app_settings;
create trigger clamp_sticker_counter_trg
  before update on public.app_settings
  for each row execute function public.clamp_sticker_counter();
