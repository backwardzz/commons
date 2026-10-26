-- Общая база Commons. Каждая сущность платформы (профиль, проект, задача, вклад, обсуждение,
-- событие ленты, объявление, сообщение, приглашение, отметка о прочтении) — строка с JSON.
-- Читать: публичное — все, даже без входа; личное (visible_to) — только перечисленные участники.
-- Писать напрямую нельзя никому: изменения делает функция ops на сервере после проверки прав
-- теми же правилами, что и интерфейс (src/data/ops.ts, src/data/community.ts).

create table public.entities (
  kind text not null check (kind in ('user', 'project', 'task', 'contribution', 'thread', 'activity', 'announcement', 'message', 'invite', 'read')),
  id text not null,
  project_id text,
  visible_to text[],
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (kind, id)
);

create index entities_project_idx on public.entities (project_id);
create index entities_visible_idx on public.entities using gin (visible_to);

-- полная строка в событиях удаления — чтобы клиенты знали, что убирать
alter table public.entities replica identity full;

alter table public.entities enable row level security;

create policy entities_read on public.entities
  for select to anon, authenticated
  using (visible_to is null or (auth.uid())::text = any (visible_to));

revoke all on public.entities from anon, authenticated;
grant select on public.entities to anon, authenticated;

-- изменения одним махом: всё или ничего
create or replace function public.entities_apply(upserts jsonb, deletes jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.entities (kind, id, project_id, visible_to, data, updated_at)
  select
    r ->> 'kind',
    r ->> 'id',
    r ->> 'project_id',
    case when jsonb_typeof(r -> 'visible_to') = 'array'
      then array(select jsonb_array_elements_text(r -> 'visible_to'))
      else null end,
    r -> 'data',
    now()
  from jsonb_array_elements(coalesce(upserts, '[]'::jsonb)) as r
  on conflict (kind, id) do update
    set project_id = excluded.project_id,
        visible_to = excluded.visible_to,
        data = excluded.data,
        updated_at = now();

  delete from public.entities e
  using jsonb_array_elements(coalesce(deletes, '[]'::jsonb)) as d
  where e.kind = d ->> 'kind' and e.id = d ->> 'id';
end;
$$;

revoke all on function public.entities_apply(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.entities_apply(jsonb, jsonb) to service_role;

-- живые обновления в браузерах
alter publication supabase_realtime add table public.entities;
