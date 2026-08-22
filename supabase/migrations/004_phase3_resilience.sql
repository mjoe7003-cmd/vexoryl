alter table public.transactions add column if not exists idempotency_key uuid;
create unique index if not exists idx_transactions_sender_idempotency on public.transactions (sender_id, idempotency_key) where idempotency_key is not null;

alter table public.task_bids add column if not exists idempotency_key uuid;
create unique index if not exists idx_task_bids_user_idempotency on public.task_bids (user_id, idempotency_key) where idempotency_key is not null;

create table if not exists public.director_events (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams(id) on delete cascade,
  triggered_by uuid references public.profiles(id) on delete set null,
  event text not null check (event ~ '^[a-zA-Z0-9._-]{1,64}$'),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (stream_id, idempotency_key)
);

create index if not exists idx_director_events_stream_created_at on public.director_events (stream_id, created_at desc);
alter table public.director_events enable row level security;

create policy "Authenticated users can view director events" on public.director_events
for select to authenticated using (true);

create policy "Creators can create director events" on public.director_events
for insert to authenticated with check (exists (
  select 1 from public.streams where streams.id = stream_id and streams.creator_id = auth.uid()
));

alter publication supabase_realtime add table public.director_events;