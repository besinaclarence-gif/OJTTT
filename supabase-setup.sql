-- Run this entire file once in Supabase: SQL Editor -> New query -> Run.
-- The account using besina.clarence@llcc.edu.ph is the administrator.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  course text,
  school text,
  role text not null default 'student' check (role in ('student', 'admin')),
  time_preferences jsonb not null default '{"timeIn":"08:00","timeOut":"18:00"}'::jsonb,
  holidays jsonb not null default '[]'::jsonb,
  absences jsonb not null default '[]'::jsonb,
  documents jsonb not null default '{"daily":[],"weekly":[],"monthly":[]}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.time_records (
  user_id uuid not null references public.profiles(id) on delete cascade,
  record_date date not null,
  time_in text not null,
  time_out text not null,
  hours numeric(6,2) not null check (hours >= 0),
  primary key (user_id, record_date)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, course, school, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'course',
    new.raw_user_meta_data->>'school',
    case when new.email = 'besina.clarence@llcc.edu.ph' then 'admin' else 'student' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.time_records enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;

create policy "Users can read their profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "Users can update their profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = 'student' or public.is_admin());

create policy "Users can read allowed time records" on public.time_records for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "Users can add their own time records" on public.time_records for insert to authenticated
  with check (user_id = auth.uid());
create policy "Users can change their own time records" on public.time_records for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can delete their own time records" on public.time_records for delete to authenticated
  using (user_id = auth.uid());
