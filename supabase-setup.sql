create extension if not exists pgcrypto;

create table if not exists public.basho_sync_entries (
  sync_code text not null,
  entry_id text not null,
  payload jsonb not null,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (sync_code, entry_id)
);

alter table public.basho_sync_entries enable row level security;

revoke all on table public.basho_sync_entries from anon, authenticated;

create or replace function public.sync_basho_entries(sync_code_input text, entries_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(regexp_replace(coalesce(sync_code_input, ''), '[^A-Z0-9]', '', 'g'));
  entry_item jsonb;
begin
  if length(normalized_code) < 6 or length(normalized_code) > 16 then
    raise exception 'invalid sync code';
  end if;

  if jsonb_typeof(entries_input) <> 'array' then
    raise exception 'entries must be an array';
  end if;

  for entry_item in select * from jsonb_array_elements(entries_input)
  loop
    if coalesce(entry_item->>'id', '') <> '' then
      insert into public.basho_sync_entries (sync_code, entry_id, payload, saved_at, updated_at)
      values (
        normalized_code,
        entry_item->>'id',
        entry_item,
        to_timestamp(coalesce(nullif(entry_item->>'savedAt', ''), '0')::double precision / 1000),
        now()
      )
      on conflict (sync_code, entry_id)
      do update set
        payload = excluded.payload,
        saved_at = excluded.saved_at,
        updated_at = now();
    end if;
  end loop;

  return (
    select coalesce(jsonb_agg(payload order by saved_at desc, updated_at desc), '[]'::jsonb)
    from public.basho_sync_entries
    where sync_code = normalized_code
  );
end;
$$;

create or replace function public.get_basho_entries(sync_code_input text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(regexp_replace(coalesce(sync_code_input, ''), '[^A-Z0-9]', '', 'g'));
begin
  if length(normalized_code) < 6 or length(normalized_code) > 16 then
    raise exception 'invalid sync code';
  end if;

  return (
    select coalesce(jsonb_agg(payload order by saved_at desc, updated_at desc), '[]'::jsonb)
    from public.basho_sync_entries
    where sync_code = normalized_code
  );
end;
$$;

revoke all on function public.sync_basho_entries(text, jsonb) from public;
revoke all on function public.get_basho_entries(text) from public;
grant execute on function public.sync_basho_entries(text, jsonb) to anon, authenticated;
grant execute on function public.get_basho_entries(text) to anon, authenticated;
