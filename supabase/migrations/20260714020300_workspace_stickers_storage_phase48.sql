-- Fase 48: sticker-teller per workspace + storage-RLS naar workspace.

-- 1. app_settings wordt workspace-gescoped: één rij per (key, workspace_id).
delete from public.app_settings a using public.app_settings b
where a.key = b.key and a.workspace_id = b.workspace_id and a.ctid <> b.ctid
  and a.key = 'last_sticker_number'
  and ( (a.value)::int < (b.value)::int
        or ((a.value)::int = (b.value)::int and a.ctid > b.ctid) );
delete from public.app_settings a using public.app_settings b
where a.key = b.key and a.workspace_id = b.workspace_id and a.ctid > b.ctid
  and a.key <> 'last_sticker_number';

alter table public.app_settings drop constraint app_settings_pkey;
alter table public.app_settings add constraint app_settings_pkey primary key (key, workspace_id);

-- 2. reserve_next_sticker: per workspace i.p.v. per user.
drop function if exists reserve_next_sticker(int, uuid);
create or replace function reserve_next_sticker(p_count int)
returns text[] language plpgsql security definer set search_path = '' as $$
declare w_id uuid; last_num int; start_num int; result text[] := '{}'; i int;
begin
  w_id := public.active_workspace_id();
  if w_id is null then raise exception 'no_active_workspace'; end if;

  select (value)::int into last_num
    from public.app_settings
    where key = 'last_sticker_number' and workspace_id = w_id
    for update;

  if last_num is null then
    last_num := 0;
    insert into public.app_settings(key, value, user_id, workspace_id)
      values ('last_sticker_number', '0'::jsonb, auth.uid(), w_id)
      on conflict (key, workspace_id) do nothing;
  end if;

  start_num := last_num + 1;
  if start_num + p_count - 1 > 9999 then
    raise exception 'sticker_range_overflow: last=% count=%', last_num, p_count;
  end if;
  for i in 0..(p_count - 1) loop
    result := array_append(result, lpad((start_num + i)::text, 4, '0'));
  end loop;

  update public.app_settings
    set value = to_jsonb(last_num + p_count), updated_at = now()
    where key = 'last_sticker_number' and workspace_id = w_id;
  return result;
end $$;
grant execute on function reserve_next_sticker(int) to authenticated;

-- 3. Storage-RLS: record-fallback naar workspace i.p.v. user. Schrijven blijft
--    onder de eigen {user_id}/-prefix; lezen/verwijderen mag iedereen in de
--    workspace via het owning-record.
drop policy if exists own_read_product_photos on storage.objects;
create policy own_read_product_photos on storage.objects for select to authenticated
  using (
    bucket_id = 'product-photos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.photos p
                 where p.storage_path = name and public.is_workspace_member(p.workspace_id))
    )
  );
drop policy if exists own_delete_product_photos on storage.objects;
create policy own_delete_product_photos on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-photos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.photos p
                 where p.storage_path = name and public.is_workspace_member(p.workspace_id))
    )
  );

drop policy if exists own_read_sticker_sheets on storage.objects;
create policy own_read_sticker_sheets on storage.objects for select to authenticated
  using (
    bucket_id = 'sticker-sheets' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.sticker_sheets ss
                 where ss.pdf_storage_path = name and public.is_workspace_member(ss.workspace_id))
    )
  );
drop policy if exists own_delete_sticker_sheets on storage.objects;
create policy own_delete_sticker_sheets on storage.objects for delete to authenticated
  using (
    bucket_id = 'sticker-sheets' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.sticker_sheets ss
                 where ss.pdf_storage_path = name and public.is_workspace_member(ss.workspace_id))
    )
  );

drop policy if exists own_read_taxatie_pdfs on storage.objects;
create policy own_read_taxatie_pdfs on storage.objects for select to authenticated
  using (
    bucket_id = 'taxatie-pdfs' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.taxatie_exports te
                 where te.pdf_storage_path = name and public.is_workspace_member(te.workspace_id))
    )
  );
