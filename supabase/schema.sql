-- Bilim Hub: схема базы данных для новой установки.
-- Если profiles уже создана, для текущей версии достаточно запустить subjects.sql.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
grant select, update on public.profiles to authenticated;

drop policy if exists "Students can read their own profile" on public.profiles;
create policy "Students can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Students can update their own profile" on public.profiles;
create policy "Students can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Стартовые предметы для уже существующих профилей.
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
