-- =============================================================================
-- POCKETPE SUPABASE DATABASE SCHEMA
-- Run this script in the Supabase Dashboard -> SQL Editor
-- Sets up user profiles, wallets, transactions, community spam reports, and split bills
-- with strict Row Level Security (RLS) policies.
-- =============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE (Linked to auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  simulated_bank text default 'HDFC Simulated Account',
  account_number text default '••• 4892',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Profiles
alter table public.profiles enable row level security;

create policy "Users can view own profile" 
  on public.profiles for select 
  using (auth.uid() = id);

create policy "Users can update own profile" 
  on public.profiles for update 
  using (auth.uid() = id);

create policy "Users can insert own profile" 
  on public.profiles for insert 
  with check (auth.uid() = id);

-- Auto-create profile trigger on Supabase Auth Sign Up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. WALLETS TABLE (Purpose-based virtual wallets)
create table if not exists public.wallets (
  id text not null,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  icon text default '💰',
  color text default '#3b82f6',
  balance numeric not null default 0,
  target_amount numeric default 0,
  monthly_limit numeric default 0,
  allocation_percentage numeric default 0,
  category text,
  is_free_money boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, id)
);

alter table public.wallets enable row level security;

create policy "Users can view own wallets" 
  on public.wallets for select 
  using (auth.uid() = user_id);

create policy "Users can insert own wallets" 
  on public.wallets for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own wallets" 
  on public.wallets for update 
  using (auth.uid() = user_id);

create policy "Users can delete own wallets" 
  on public.wallets for delete 
  using (auth.uid() = user_id);


-- 3. TRANSACTIONS TABLE
create table if not exists public.transactions (
  id text not null,
  user_id uuid references auth.users on delete cascade not null,
  merchant_name text not null,
  amount numeric not null,
  type text default 'debit',
  category text,
  wallet_id text,
  wallet_name text,
  wallet_icon text,
  upi_id text,
  mcc text,
  status text default 'success',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, id)
);

alter table public.transactions enable row level security;

create policy "Users can view own transactions" 
  on public.transactions for select 
  using (auth.uid() = user_id);

create policy "Users can insert own transactions" 
  on public.transactions for insert 
  with check (auth.uid() = user_id);


-- 4. COMMUNITY FRAUD REPORTS (Shared community spam protection)
create table if not exists public.community_fraud_reports (
  id uuid default uuid_generate_v4() primary key,
  upi_id text not null,
  reporter_id uuid references auth.users on delete set null,
  reason text not null,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (upi_id, reporter_id)
);

alter table public.community_fraud_reports enable row level security;

-- All authenticated users can read community reports to compute spam scores
create policy "Anyone authenticated can view community reports" 
  on public.community_fraud_reports for select 
  using (auth.role() = 'authenticated');

-- Authenticated users can insert their own reports (1 report per UPI ID per user)
create policy "Authenticated users can submit reports" 
  on public.community_fraud_reports for insert 
  with check (auth.uid() = reporter_id);


-- 5. SPLIT BILLS TABLE
create table if not exists public.split_bills (
  id text not null,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  total_amount numeric not null,
  split_type text default 'equal',
  members jsonb default '[]'::jsonb,
  is_settled boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, id)
);

alter table public.split_bills enable row level security;

create policy "Users can view own split bills" 
  on public.split_bills for select 
  using (auth.uid() = user_id);

create policy "Users can insert own split bills" 
  on public.split_bills for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own split bills" 
  on public.split_bills for update 
  using (auth.uid() = user_id);

create policy "Users can delete own split bills" 
  on public.split_bills for delete 
  using (auth.uid() = user_id);


-- 6. MERCHANT PREFERENCES TABLE (User-specific UPI ID and MCC to Wallet mappings)
create table if not exists public.merchant_preferences (
  user_id uuid references auth.users on delete cascade not null,
  upi_id text not null,
  merchant_name text,
  detected_mcc text,
  category text,
  wallet_id text not null,
  source text default 'user',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, upi_id)
);

alter table public.merchant_preferences enable row level security;

create policy "Users can view own merchant preferences"
  on public.merchant_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own merchant preferences"
  on public.merchant_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own merchant preferences"
  on public.merchant_preferences for update
  using (auth.uid() = user_id);

create policy "Users can delete own merchant preferences"
  on public.merchant_preferences for delete
  using (auth.uid() = user_id);

