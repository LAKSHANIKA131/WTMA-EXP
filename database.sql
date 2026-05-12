create extension if not exists pgcrypto;

create table if not exists students (
  id bigserial primary key,
  register_number text not null unique,
  name text not null,
  email text not null,
  branch text not null,
  gender text not null,
  address text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists subjects (
  id bigserial primary key,
  code text not null unique,
  name text not null
);

create table if not exists results (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  semester integer not null,
  cgpa numeric(4, 2) not null default 0,
  published_at timestamptz not null default now(),
  unique (student_id, semester)
);

create table if not exists result_subjects (
  id bigserial primary key,
  result_id bigint not null references results(id) on delete cascade,
  subject_id bigint not null references subjects(id) on delete restrict,
  internal_marks integer not null check (internal_marks between 0 and 40),
  external_marks integer not null check (external_marks between 0 and 60),
  grade text not null,
  unique (result_id, subject_id)
);

create table if not exists result_catalogue (
  id bigserial primary key,
  semester integer not null unique,
  title text not null,
  status text not null default 'Open',
  published_at date not null default current_date
);

create table if not exists revaluation_requests (
  id uuid primary key default gen_random_uuid(),
  register_number text not null references students(register_number) on delete cascade,
  subject_code text not null references subjects(code) on delete restrict,
  reason text not null,
  submitted_at timestamptz not null default now()
);

insert into students (register_number, name, email, branch, gender, address, password_hash)
values (
  '2026CS101',
  'Laksha Siva',
  'laksha.siva@example.edu',
  'CSE',
  'Female',
  'Chennai',
  crypt('student123', gen_salt('bf'))
)
on conflict (register_number) do nothing;

insert into subjects (code, name)
values
  ('CS301', 'Data Structures'),
  ('CS302', 'Database Management'),
  ('MA301', 'Discrete Mathematics'),
  ('EC301', 'Digital Electronics')
on conflict (code) do nothing;

insert into result_catalogue (semester, title, status, published_at)
values
  (3, 'B.E CSE Semester 3', 'Open', date '2026-01-18'),
  (2, 'B.E CSE Semester 2', 'Archived', date '2025-10-12'),
  (1, 'B.E CSE Semester 1', 'Archived', date '2025-06-08')
on conflict (semester) do nothing;

with student_row as (
  select id from students where register_number = '2026CS101'
), inserted_result as (
  insert into results (student_id, semester, cgpa)
  select id, 3, 8.50 from student_row
  on conflict (student_id, semester) do update set cgpa = excluded.cgpa
  returning id
)
insert into result_subjects (result_id, subject_id, internal_marks, external_marks, grade)
select inserted_result.id, subjects.id, marks.internal_marks, marks.external_marks, marks.grade
from inserted_result
join (
  values
    ('CS301', 25, 60, 'A'),
    ('CS302', 23, 58, 'A'),
    ('MA301', 22, 55, 'B+'),
    ('EC301', 24, 62, 'A')
) as marks(code, internal_marks, external_marks, grade) on true
join subjects on subjects.code = marks.code
on conflict (result_id, subject_id) do update
set internal_marks = excluded.internal_marks,
    external_marks = excluded.external_marks,
    grade = excluded.grade;
