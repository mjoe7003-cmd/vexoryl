create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  avatar_url text,
  role text not null default 'creator' check (role in ('creator', 'viewer', 'admin')),
  wallet_balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.streams (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  mux_stream_id text,
  mux_stream_key text,
  playback_id text,
  title text not null,
  description text default '',
  category text not null default 'Just Chatting',
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended', 'moderated')),
  view_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_streams_creator_id on public.streams (creator_id);
create index if not exists idx_streams_status on public.streams (status);
create index if not exists idx_chat_stream_created_at on public.chat_messages (stream_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_user_meta_data ->> 'role', 'creator')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.streams enable row level security;
alter table public.chat_messages enable row level security;

create policy "Profiles are viewable by authenticated users"
on public.profiles
for select
to authenticated
using (true);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Creators can manage their streams"
on public.streams
for all
to authenticated
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

create policy "Authenticated users can view chat for a stream"
on public.chat_messages
for select
to authenticated
using (true);

create policy "Authenticated users can insert chat messages"
on public.chat_messages
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete their own chat messages"
on public.chat_messages
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.update_updated_at();

create trigger streams_updated_at
before update on public.streams
for each row
execute function public.update_updated_at();
