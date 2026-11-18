-- Bilim Hub: таблица предметов и прогресса студентов.
-- Запусти этот файл один раз: Supabase → SQL Editor → New query → Run.

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  progress integer not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subjects_user_name_unique
  on public.subjects (user_id, lower(name));

alter table public.subjects enable row level security;
grant select, insert, update, delete on public.subjects to authenticated;

drop policy if exists "Students can read their own subjects" on public.subjects;
create policy "Students can read their own subjects"
  on public.subjects for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Students can add their own subjects" on public.subjects;
create policy "Students can add their own subjects"
  on public.subjects for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Students can update their own subjects" on public.subjects;
create policy "Students can update their own subjects"
  on public.subjects for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Students can delete their own subjects" on public.subjects;
create policy "Students can delete their own subjects"
  on public.subjects for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Добавляем стартовый набор уже зарегистрированным студентам,
-- только если у них ещё нет ни одного предмета.
insert into public.subjects (user_id, name, progress)
select p.id, starter.name, starter.progress
from public.profiles p
cross join (values
  ('Математика', 72),
  ('Информатика', 68),
  ('История Казахстана', 85),
  ('Английский язык', 54)
) as starter(name, progress)
where not exists (
  select 1 from public.subjects existing where existing.user_id = p.id
);

-- Обновляем триггер: все новые аккаунты будут получать профиль
-- и стартовый набор предметов автоматически.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;

  insert into public.subjects (user_id, name, progress)
  values
    (new.id, 'Математика', 72),
    (new.id, 'Информатика', 68),
    (new.id, 'История Казахстана', 85),
    (new.id, 'Английский язык', 54)
  on conflict do nothing;

  return new;
end;
$$;
