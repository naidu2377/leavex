create extension if not exists pgcrypto;

create sequence if not exists public.leave_reference_seq;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'mentor', 'hod')),
  full_name text not null,
  roll_number text unique,
  email text not null,
  department text,
  year text,
  section text,
  created_at timestamptz not null default now()
);

create table if not exists public.reviewer_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reviewer_role text not null check (reviewer_role in ('mentor', 'hod')),
  department text not null,
  section text,
  created_at timestamptz not null default now(),
  unique (user_id, reviewer_role, department, section)
);

create table if not exists public.leave_applications (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default (
    'LX-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('public.leave_reference_seq')::text, 5, '0')
  ),
  user_id uuid not null references public.profiles (id) on delete cascade,
  student_name text not null,
  roll text not null,
  department text not null,
  year text not null,
  section text not null,
  type text not null,
  from_date date not null,
  to_date date not null,
  departure_time time not null default '08:00',
  return_time time not null default '18:00',
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'PENDING_MENTOR'
    check (status in ('PENDING_MENTOR', 'MENTOR_APPROVED', 'MENTOR_REJECTED', 'HOD_APPROVED', 'HOD_REJECTED')),
  mentor_comment text,
  hod_comment text,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);

grant select on public.profiles to authenticated;
grant select on public.reviewer_assignments to authenticated;
grant select, insert, update on public.leave_applications to authenticated;

create index if not exists leave_applications_user_id_idx on public.leave_applications (user_id);
create index if not exists leave_applications_department_section_idx on public.leave_applications (department, section);

alter table public.profiles enable row level security;
alter table public.reviewer_assignments enable row level security;
alter table public.leave_applications enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Reviewers can read assigned applications" on public.leave_applications;
create policy "Reviewers can read assigned applications"
  on public.leave_applications for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.reviewer_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.department = leave_applications.department
        and (assignment.section is null or assignment.section = leave_applications.section)
        and (
          (assignment.reviewer_role = 'mentor' and leave_applications.status in ('PENDING_MENTOR', 'MENTOR_APPROVED', 'MENTOR_REJECTED'))
          or
          (assignment.reviewer_role = 'hod' and leave_applications.status in ('MENTOR_APPROVED', 'HOD_APPROVED', 'HOD_REJECTED'))
        )
    )
  );

drop policy if exists "Students can create their own applications" on public.leave_applications;
create policy "Students can create their own applications"
  on public.leave_applications for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'PENDING_MENTOR'
    and exists (
      select 1 from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.role = 'student'
        and profile.full_name = leave_applications.student_name
        and profile.roll_number = leave_applications.roll
        and profile.department = leave_applications.department
        and profile.year = leave_applications.year
        and profile.section = leave_applications.section
    )
  );

drop policy if exists "Assigned reviewers can update applications" on public.leave_applications;
create policy "Assigned reviewers can update applications"
  on public.leave_applications for update to authenticated
  using (
    exists (
      select 1
      from public.reviewer_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.department = leave_applications.department
        and (assignment.section is null or assignment.section = leave_applications.section)
        and (
          (assignment.reviewer_role = 'mentor' and leave_applications.status = 'PENDING_MENTOR')
          or
          (assignment.reviewer_role = 'hod' and leave_applications.status = 'MENTOR_APPROVED')
        )
    )
  )
  with check (
    exists (
      select 1
      from public.reviewer_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.department = leave_applications.department
        and (assignment.section is null or assignment.section = leave_applications.section)
        and (
          (assignment.reviewer_role = 'mentor' and leave_applications.status in ('MENTOR_APPROVED', 'MENTOR_REJECTED'))
          or
          (assignment.reviewer_role = 'hod' and leave_applications.status in ('HOD_APPROVED', 'HOD_REJECTED'))
        )
    )
  );

create or replace function public.guard_leave_application_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role text;
begin
  select profile.role into current_role
  from public.profiles profile
  where profile.id = (select auth.uid());

  if current_role = 'mentor'
    and old.status = 'PENDING_MENTOR'
    and new.status in ('MENTOR_APPROVED', 'MENTOR_REJECTED')
    and (to_jsonb(new) - 'status' - 'mentor_comment') = (to_jsonb(old) - 'status' - 'mentor_comment') then
    return new;
  end if;

  if current_role = 'hod'
    and old.status = 'MENTOR_APPROVED'
    and new.status in ('HOD_APPROVED', 'HOD_REJECTED')
    and (to_jsonb(new) - 'status' - 'hod_comment') = (to_jsonb(old) - 'status' - 'hod_comment') then
    return new;
  end if;

  raise exception 'This account is not allowed to make this application update';
end;
$$;

drop trigger if exists guard_leave_application_update on public.leave_applications;
create trigger guard_leave_application_update
  before update on public.leave_applications
  for each row execute function public.guard_leave_application_update();

drop policy if exists "Users can read their own reviewer assignment" on public.reviewer_assignments;
create policy "Users can read their own reviewer assignment"
  on public.reviewer_assignments for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.create_student_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name, roll_number, email, department, year, section)
  values (
    new.id,
    'student',
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    upper(nullif(new.raw_user_meta_data ->> 'roll_number', '')),
    new.email,
    nullif(new.raw_user_meta_data ->> 'department', ''),
    nullif(new.raw_user_meta_data ->> 'year', ''),
    nullif(new.raw_user_meta_data ->> 'section', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_student_profile();

create or replace function public.verify_leave_application(application_token uuid)
returns table (
  reference text,
  student_name text,
  roll text,
  from_date date,
  to_date date,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select application.reference, application.student_name, application.roll,
         application.from_date, application.to_date, application.status
  from public.leave_applications application
  where application.token = application_token
    and application.status = 'HOD_APPROVED'
  limit 1;
$$;

grant execute on function public.verify_leave_application(uuid) to anon, authenticated;
grant usage, select on sequence public.leave_reference_seq to authenticated;
