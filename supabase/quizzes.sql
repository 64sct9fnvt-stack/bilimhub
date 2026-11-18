-- Bilim Hub: тренировочные рубежки и пробная сессия.
-- Запусти один раз: Supabase → SQL Editor → New query → вставь файл → Run.
-- Правильные ответы не выдаются браузеру: проверка выполняется внутри RPC-функции.

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '',
  assessment_type text not null check (assessment_type in ('midterm', 'final')),
  duration_minutes integer not null default 10 check (duration_minutes between 1 and 180),
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists quizzes_user_title_unique
  on public.quizzes (user_id, title);

create index if not exists quizzes_user_type_idx
  on public.quizzes (user_id, assessment_type, created_at);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  prompt text not null check (char_length(btrim(prompt)) between 1 and 1000),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8),
  correct_option integer not null check (correct_option >= 0 and correct_option < jsonb_array_length(options)),
  explanation text not null default '',
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  unique (quiz_id, position)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  correct_count integer not null check (correct_count >= 0),
  total_questions integer not null check (total_questions > 0),
  score_percent integer not null check (score_percent between 0 and 100),
  submitted_at timestamptz not null default now()
);

create index if not exists quiz_attempts_user_date_idx
  on public.quiz_attempts (user_id, submitted_at desc);

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;

-- Quiz metadata is visible only to its owner.
revoke all on table public.quizzes from anon, authenticated;
grant select on table public.quizzes to authenticated;
drop policy if exists "Students can read their own quizzes" on public.quizzes;
create policy "Students can read their own quizzes"
  on public.quizzes for select to authenticated
  using ((select auth.uid()) = user_id);

-- Grant only non-secret question columns. correct_option is never exposed to clients.
revoke all on table public.quiz_questions from anon, authenticated;
grant select (id, quiz_id, prompt, options, explanation, position)
  on table public.quiz_questions to authenticated;
drop policy if exists "Students can read questions from their own quizzes" on public.quiz_questions;
create policy "Students can read questions from their own quizzes"
  on public.quiz_questions for select to authenticated
  using (exists (
    select 1
    from public.quizzes q
    where q.id = quiz_questions.quiz_id
      and q.user_id = (select auth.uid())
      and q.is_published = true
  ));

-- Students can see only their own submitted results. Attempts are created by the secure RPC below.
revoke all on table public.quiz_attempts from anon, authenticated;
grant select on table public.quiz_attempts to authenticated;
drop policy if exists "Students can read their own quiz attempts" on public.quiz_attempts;
create policy "Students can read their own quiz attempts"
  on public.quiz_attempts for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_quiz public.quizzes%rowtype;
  v_question record;
  v_answer_text text;
  v_answer integer;
  v_total integer := 0;
  v_answer_count integer := 0;
  v_correct integer := 0;
  v_score integer := 0;
  v_attempt_id uuid;
begin
  if v_user_id is null then
    raise exception 'Необходимо войти в аккаунт.' using errcode = '42501';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Ответы должны быть переданы в формате объекта.' using errcode = '22023';
  end if;

  select * into v_quiz
  from public.quizzes q
  where q.id = p_quiz_id
    and q.user_id = v_user_id
    and q.is_published = true;

  if not found then
    raise exception 'Тест не найден или недоступен.' using errcode = 'P0002';
  end if;

  select count(*)::integer into v_total
  from public.quiz_questions qq
  where qq.quiz_id = p_quiz_id;

  if v_total = 0 then
    raise exception 'В этом тесте пока нет вопросов.' using errcode = '22023';
  end if;

  select count(*)::integer into v_answer_count
  from jsonb_object_keys(p_answers);

  if v_answer_count <> v_total then
    raise exception 'Переданы не все ответы теста.' using errcode = '22023';
  end if;

  for v_question in
    select qq.id, qq.correct_option, jsonb_array_length(qq.options) as option_count
    from public.quiz_questions qq
    where qq.quiz_id = p_quiz_id
    order by qq.position
  loop
    v_answer_text := p_answers ->> v_question.id::text;

    if v_answer_text is null or v_answer_text !~ '^(-1|[0-9]+)$' then
      raise exception 'Один из ответов имеет неверный формат.' using errcode = '22023';
    end if;

    v_answer := v_answer_text::integer;

    -- -1 означает, что студент оставил вопрос без ответа.
    if v_answer < -1 or v_answer >= v_question.option_count then
      raise exception 'Один из вариантов ответа недопустим.' using errcode = '22023';
    end if;

    if v_answer = v_question.correct_option then
      v_correct := v_correct + 1;
    end if;
  end loop;

  v_score := round((v_correct::numeric * 100) / v_total)::integer;

  insert into public.quiz_attempts (
    user_id, quiz_id, answers, correct_count, total_questions, score_percent
  ) values (
    v_user_id, p_quiz_id, p_answers, v_correct, v_total, v_score
  ) returning id into v_attempt_id;

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'quiz_id', p_quiz_id,
    'correct_count', v_correct,
    'total_questions', v_total,
    'score_percent', v_score
  );
end;
$function$;

revoke all on function public.submit_quiz_attempt(uuid, jsonb) from public, anon;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;

-- Seed a subject-specific midterm for the four starter disciplines.
insert into public.quizzes (user_id, subject_id, title, description, assessment_type, duration_minutes)
select s.user_id, s.id, 'Рубежка: ' || s.name,
       'Короткий тренировочный тест по дисциплине «' || s.name || '».',
       'midterm', 10
from public.subjects s
where s.name in ('Математика', 'Информатика', 'История Казахстана', 'Английский язык')
on conflict (user_id, title) do nothing;

-- Seed one mixed practice exam for each existing student.
insert into public.quizzes (user_id, subject_id, title, description, assessment_type, duration_minutes)
select s.user_id, null, 'Пробная сессия',
       'Небольшой комплексный тест по основным дисциплинам.',
       'final', 15
from public.subjects s
group by s.user_id
on conflict (user_id, title) do nothing;

-- Questions for subject-specific midterms.
with question_bank(subject_name, position, prompt, options, correct_option, explanation) as (
  values
    ('Математика', 1, 'Реши уравнение: 2x + 6 = 14.', '["2", "3", "4", "5"]'::jsonb, 2, 'Вычитаем 6: 2x = 8, поэтому x = 4.'),
    ('Математика', 2, 'Чему равна производная функции f(x) = x²?', '["x", "2x", "x²", "2"]'::jsonb, 1, 'По правилу степени производная x² равна 2x.'),
    ('Математика', 3, 'Чему равно log₁₀(100)?', '["1", "2", "10", "100"]'::jsonb, 1, '10² = 100, поэтому логарифм равен 2.'),

    ('Информатика', 1, 'Какой тип данных имеет значение [1, 2, 3] в Python?', '["str", "int", "list", "dict"]'::jsonb, 2, 'Квадратные скобки создают список list.'),
    ('Информатика', 2, 'Для чего используется оператор if в Python?', '["Для повторения", "Для проверки условия", "Для импорта", "Для создания класса"]'::jsonb, 1, 'if выполняет блок кода при истинности условия.'),
    ('Информатика', 3, 'Что вернёт выражение len("Bilim")?', '["4", "5", "6", "7"]'::jsonb, 1, 'В слове Bilim пять символов.'),

    ('История Казахстана', 1, 'Где был найден знаменитый «Золотой человек»?', '["В Отраре", "В Иссыкском кургане", "В Туркестане", "В Сарайшыке"]'::jsonb, 1, 'Золотой человек был найден в Иссыкском кургане близ Алматы.'),
    ('История Казахстана', 2, 'Как называется свод законов при Тауке-хане?', '["Қасым ханның қасқа жолы", "Жеті жарғы", "Есім ханның ескі жолы", "Кодекс степи"]'::jsonb, 1, 'При Тауке-хане был систематизирован свод законов «Жеті жарғы».'),
    ('История Казахстана', 3, 'Кого традиционно называют основателями Казахского ханства?', '["Абылай и Кенесары", "Керей и Жанибек", "Тауке и Есим", "Касым и Хакназар"]'::jsonb, 1, 'Керей и Жанибек считаются основателями Казахского ханства.'),

    ('Английский язык', 1, 'Choose the plural form of “child”.', '["childs", "childes", "children", "childrens"]'::jsonb, 2, 'The irregular plural of child is children.'),
    ('Английский язык', 2, 'What is the past form of “go”?', '["goed", "went", "gone", "going"]'::jsonb, 1, 'The Past Simple form of go is went.'),
    ('Английский язык', 3, 'Choose a synonym for “rapid”.', '["slow", "quiet", "fast", "weak"]'::jsonb, 2, 'Rapid means fast or quick.')
)
insert into public.quiz_questions (quiz_id, prompt, options, correct_option, explanation, position)
select q.id, b.prompt, b.options, b.correct_option, b.explanation, b.position
from public.quizzes q
join public.subjects s on s.id = q.subject_id and s.user_id = q.user_id
join question_bank b on b.subject_name = s.name
where q.assessment_type = 'midterm'
on conflict (quiz_id, position) do nothing;

-- Questions for the mixed practice final exam.
with final_bank(position, prompt, options, correct_option, explanation) as (
  values
    (1, 'Реши уравнение: 3x = 21.', '["6", "7", "8", "9"]'::jsonb, 1, 'Делим обе части на 3: x = 7.'),
    (2, 'Какой результат вернёт Python-код len([10, 20, 30])?', '["2", "3", "10", "30"]'::jsonb, 1, 'В списке три элемента.'),
    (3, 'Как называется традиционное переносное жилище казахских кочевников?', '["Юрта", "Замок", "Пагода", "Иглу"]'::jsonb, 0, 'Юрта — традиционное переносное жилище кочевых народов Центральной Азии.'),
    (4, 'Choose the correct sentence.', '["She go to class every day.", "She goes to class every day.", "She going to class every day.", "She gone to class every day."]'::jsonb, 1, 'With he/she/it in Present Simple, the verb usually takes -s.'),
    (5, 'Чему равна площадь прямоугольника со сторонами 4 см и 5 см?', '["9 см²", "18 см²", "20 см²", "25 см²"]'::jsonb, 2, 'Площадь равна произведению сторон: 4 × 5 = 20 см².')
)
insert into public.quiz_questions (quiz_id, prompt, options, correct_option, explanation, position)
select q.id, b.prompt, b.options, b.correct_option, b.explanation, b.position
from public.quizzes q
cross join final_bank b
where q.assessment_type = 'final'
  and q.title = 'Пробная сессия'
on conflict (quiz_id, position) do nothing;


-- Seed helper: called for existing students now and for every future signup.
create or replace function public.seed_default_quizzes(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $seed$
begin
  insert into public.quizzes (user_id, subject_id, title, description, assessment_type, duration_minutes)
  select s.user_id, s.id, 'Рубежка: ' || s.name,
         'Короткий тренировочный тест по дисциплине «' || s.name || '».',
         'midterm', 10
  from public.subjects s
  where s.user_id = p_user_id
    and s.name in ('Математика', 'Информатика', 'История Казахстана', 'Английский язык')
  on conflict (user_id, title) do nothing;

  insert into public.quizzes (user_id, subject_id, title, description, assessment_type, duration_minutes)
  values (p_user_id, null, 'Пробная сессия', 'Небольшой комплексный тест по основным дисциплинам.', 'final', 15)
  on conflict (user_id, title) do nothing;

  with question_bank(subject_name, position, prompt, options, correct_option, explanation) as (
    values
      ('Математика', 1, 'Реши уравнение: 2x + 6 = 14.', '["2", "3", "4", "5"]'::jsonb, 2, 'Вычитаем 6: 2x = 8, поэтому x = 4.'),
      ('Математика', 2, 'Чему равна производная функции f(x) = x²?', '["x", "2x", "x²", "2"]'::jsonb, 1, 'По правилу степени производная x² равна 2x.'),
      ('Математика', 3, 'Чему равно log₁₀(100)?', '["1", "2", "10", "100"]'::jsonb, 1, '10² = 100, поэтому логарифм равен 2.'),
      ('Информатика', 1, 'Какой тип данных имеет значение [1, 2, 3] в Python?', '["str", "int", "list", "dict"]'::jsonb, 2, 'Квадратные скобки создают список list.'),
      ('Информатика', 2, 'Для чего используется оператор if в Python?', '["Для повторения", "Для проверки условия", "Для импорта", "Для создания класса"]'::jsonb, 1, 'if выполняет блок кода при истинности условия.'),
      ('Информатика', 3, 'Что вернёт выражение len("Bilim")?', '["4", "5", "6", "7"]'::jsonb, 1, 'В слове Bilim пять символов.'),
      ('История Казахстана', 1, 'Где был найден знаменитый «Золотой человек»?', '["В Отраре", "В Иссыкском кургане", "В Туркестане", "В Сарайшыке"]'::jsonb, 1, 'Золотой человек был найден в Иссыкском кургане близ Алматы.'),
      ('История Казахстана', 2, 'Как называется свод законов при Тауке-хане?', '["Қасым ханның қасқа жолы", "Жеті жарғы", "Есім ханның ескі жолы", "Кодекс степи"]'::jsonb, 1, 'При Тауке-хане был систематизирован свод законов «Жеті жарғы».'),
      ('История Казахстана', 3, 'Кого традиционно называют основателями Казахского ханства?', '["Абылай и Кенесары", "Керей и Жанибек", "Тауке и Есим", "Касым и Хакназар"]'::jsonb, 1, 'Керей и Жанибек считаются основателями Казахского ханства.'),
      ('Английский язык', 1, 'Choose the plural form of “child”.', '["childs", "childes", "children", "childrens"]'::jsonb, 2, 'The irregular plural of child is children.'),
      ('Английский язык', 2, 'What is the past form of “go”?', '["goed", "went", "gone", "going"]'::jsonb, 1, 'The Past Simple form of go is went.'),
      ('Английский язык', 3, 'Choose a synonym for “rapid”.', '["slow", "quiet", "fast", "weak"]'::jsonb, 2, 'Rapid means fast or quick.')
  )
  insert into public.quiz_questions (quiz_id, prompt, options, correct_option, explanation, position)
  select q.id, b.prompt, b.options, b.correct_option, b.explanation, b.position
  from public.quizzes q
  join public.subjects s on s.id = q.subject_id and s.user_id = q.user_id
  join question_bank b on b.subject_name = s.name
  where q.user_id = p_user_id and q.assessment_type = 'midterm'
  on conflict (quiz_id, position) do nothing;

  with final_bank(position, prompt, options, correct_option, explanation) as (
    values
      (1, 'Реши уравнение: 3x = 21.', '["6", "7", "8", "9"]'::jsonb, 1, 'Делим обе части на 3: x = 7.'),
      (2, 'Какой результат вернёт Python-код len([10, 20, 30])?', '["2", "3", "10", "30"]'::jsonb, 1, 'В списке три элемента.'),
      (3, 'Как называется традиционное переносное жилище казахских кочевников?', '["Юрта", "Замок", "Пагода", "Иглу"]'::jsonb, 0, 'Юрта — традиционное переносное жилище кочевых народов Центральной Азии.'),
      (4, 'Choose the correct sentence.', '["She go to class every day.", "She goes to class every day.", "She going to class every day.", "She gone to class every day."]'::jsonb, 1, 'With he/she/it in Present Simple, the verb usually takes -s.'),
      (5, 'Чему равна площадь прямоугольника со сторонами 4 см и 5 см?', '["9 см²", "18 см²", "20 см²", "25 см²"]'::jsonb, 2, 'Площадь равна произведению сторон: 4 × 5 = 20 см².')
  )
  insert into public.quiz_questions (quiz_id, prompt, options, correct_option, explanation, position)
  select q.id, b.prompt, b.options, b.correct_option, b.explanation, b.position
  from public.quizzes q
  cross join final_bank b
  where q.user_id = p_user_id and q.assessment_type = 'final' and q.title = 'Пробная сессия'
  on conflict (quiz_id, position) do nothing;
end;
$seed$;

revoke all on function public.seed_default_quizzes(uuid) from public, anon, authenticated;

-- Keep the existing profile/subject trigger and extend it to seed tests for future accounts.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $trigger$
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

  perform public.seed_default_quizzes(new.id);
  return new;
end;
$trigger$;

-- Ensure existing students also have the starter tests.
select public.seed_default_quizzes(p.id)
from public.profiles p;
