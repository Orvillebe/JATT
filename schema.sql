-- JATL Schema (with Supabase Auth)

-- Members (linked to auth.users)
create table members (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  created_at timestamptz default now()
);

-- Auto-create member profile when a new auth user is created
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.members (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Customers
create table customers (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  created_at timestamptz default now()
);

-- Projects (linked to customer)
create table projects (
  id text primary key default gen_random_uuid()::text,
  customer_id text not null references customers(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- Phases (global)
create table phases (
  name text primary key
);

-- Time entries
create table entries (
  id text primary key default gen_random_uuid()::text,
  member_id uuid not null references members(id) on delete cascade,
  customer_id text not null references customers(id) on delete cascade,
  project_id text not null references projects(id) on delete cascade,
  phase text not null default '',
  date date not null,
  minutes integer not null,
  note text default '',
  created_at timestamptz default now()
);

-- Indexes
create index entries_member_date on entries(member_id, date);
create index entries_customer on entries(customer_id);
create index entries_project on entries(project_id);

-- =====================
-- Row Level Security
-- =====================

alter table members enable row level security;
alter table customers enable row level security;
alter table projects enable row level security;
alter table phases enable row level security;
alter table entries enable row level security;

-- Members: authenticated can read all, update own name
create policy "read members" on members
  for select to authenticated using (true);

create policy "update own member" on members
  for update to authenticated using (id = auth.uid());

create policy "insert own member" on members
  for insert to authenticated with check (id = auth.uid());

-- Customers: full access for authenticated
create policy "read customers" on customers
  for select to authenticated using (true);
create policy "insert customers" on customers
  for insert to authenticated with check (true);
create policy "delete customers" on customers
  for delete to authenticated using (true);

-- Projects: full access for authenticated
create policy "read projects" on projects
  for select to authenticated using (true);
create policy "insert projects" on projects
  for insert to authenticated with check (true);
create policy "delete projects" on projects
  for delete to authenticated using (true);

-- Phases: full access for authenticated
create policy "read phases" on phases
  for select to authenticated using (true);
create policy "insert phases" on phases
  for insert to authenticated with check (true);
create policy "delete phases" on phases
  for delete to authenticated using (true);

-- Entries: read all (for reports), write/edit/delete own only
create policy "read entries" on entries
  for select to authenticated using (true);

create policy "insert own entries" on entries
  for insert to authenticated with check (member_id = auth.uid());

create policy "update own entries" on entries
  for update to authenticated using (member_id = auth.uid());

create policy "delete own entries" on entries
  for delete to authenticated using (member_id = auth.uid());
