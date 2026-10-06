-- Run once in Supabase → SQL Editor
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  email text, full_name text, college_id text, department text, academic_year text,
  role text not null default 'student' check (role in ('student','faculty')),
  created_at timestamptz default now());
create table if not exists shared_resources (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null, category text, subject text, semester text, branch text,
  description text, author text, role text, visibility text, link text,
  created_at timestamptz default now());
create table if not exists transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null, amount numeric not null check (amount > 0),
  type text not null check (type in ('income','expense')),
  created_at timestamptz default now());

alter table profiles enable row level security;
alter table shared_resources enable row level security;
alter table transactions enable row level security;

drop policy if exists p_sel on profiles;  create policy p_sel on profiles for select using (auth.uid() = id);
drop policy if exists p_ins on profiles;  create policy p_ins on profiles for insert with check (auth.uid() = id);
drop policy if exists p_upd on profiles;  create policy p_upd on profiles for update using (auth.uid() = id);

drop policy if exists r_sel on shared_resources; create policy r_sel on shared_resources for select to authenticated using (true);
drop policy if exists r_ins on shared_resources; create policy r_ins on shared_resources for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists r_del on shared_resources; create policy r_del on shared_resources for delete to authenticated
  using (auth.uid() = user_id or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'faculty'));

drop policy if exists t_all on transactions; create policy t_all on transactions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Peer Guidance students (2nd / 3rd / 4th year)
create table if not exists peer_mentors (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null, dept text, year text default '2nd Year', tags text[] default '{}',
  resource text, contact text, created_at timestamptz default now());
alter table peer_mentors enable row level security;
drop policy if exists m_sel on peer_mentors; create policy m_sel on peer_mentors for select to authenticated using (true);
drop policy if exists m_ins on peer_mentors; create policy m_ins on peer_mentors for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists m_del on peer_mentors; create policy m_del on peer_mentors for delete to authenticated
  using (auth.uid() = user_id or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'faculty'));
