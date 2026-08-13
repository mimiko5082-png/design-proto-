create table if not exists public.basho_user_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  payload jsonb not null,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);

alter table public.basho_user_entries enable row level security;

revoke all on table public.basho_user_entries from anon;
grant select, insert, update, delete on table public.basho_user_entries to authenticated;

drop policy if exists "Users can read own basho entries" on public.basho_user_entries;
drop policy if exists "Users can insert own basho entries" on public.basho_user_entries;
drop policy if exists "Users can update own basho entries" on public.basho_user_entries;
drop policy if exists "Users can delete own basho entries" on public.basho_user_entries;

create policy "Users can read own basho entries"
on public.basho_user_entries
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own basho entries"
on public.basho_user_entries
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own basho entries"
on public.basho_user_entries
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own basho entries"
on public.basho_user_entries
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.sync_basho_user_entries(entries_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  entry_item jsonb;
begin
  if auth.uid() is null then
    raise exception 'login required';
  end if;

  if jsonb_typeof(entries_input) <> 'array' then
    raise exception 'entries must be an array';
  end if;

  for entry_item in select * from jsonb_array_elements(entries_input)
  loop
    if coalesce(entry_item->>'id', '') <> '' then
      insert into public.basho_user_entries (user_id, entry_id, payload, saved_at, updated_at)
      values (
        auth.uid(),
        entry_item->>'id',
        entry_item,
        to_timestamp(coalesce(nullif(entry_item->>'savedAt', ''), '0')::double precision / 1000),
        now()
      )
      on conflict (user_id, entry_id)
      do update set
        payload = excluded.payload,
        saved_at = excluded.saved_at,
        updated_at = now();
    end if;
  end loop;

  return public.get_basho_user_entries();
end;
$$;

create or replace function public.get_basho_user_entries()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(payload order by saved_at desc, updated_at desc), '[]'::jsonb)
  from public.basho_user_entries
  where user_id = auth.uid();
$$;

revoke all on function public.sync_basho_user_entries(jsonb) from public;
revoke all on function public.get_basho_user_entries() from public;
grant execute on function public.sync_basho_user_entries(jsonb) to authenticated;
grant execute on function public.get_basho_user_entries() to authenticated;
