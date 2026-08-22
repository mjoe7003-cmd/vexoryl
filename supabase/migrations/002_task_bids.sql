create table if not exists public.task_bids (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_prompt text not null,
  bid_amount numeric(12,2) not null check (bid_amount > 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists idx_task_bids_stream_created_at on public.task_bids (stream_id, created_at desc);

alter table public.task_bids enable row level security;

create policy "Authenticated users can view task bids"
on public.task_bids
for select
to authenticated
using (true);

create policy "Authenticated users can create task bids"
on public.task_bids
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Creators can update task bid status"
on public.task_bids
for update
to authenticated
using (exists (
  select 1 from public.streams s where s.id = stream_id and s.creator_id = auth.uid()
))
with check (exists (
  select 1 from public.streams s where s.id = stream_id and s.creator_id = auth.uid()
));
