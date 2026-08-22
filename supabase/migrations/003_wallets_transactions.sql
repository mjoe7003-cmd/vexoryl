create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  balance numeric(14,2) not null default 0 check (balance >= 0),
  pending_balance numeric(14,2) not null default 0 check (pending_balance >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles(id) on delete set null,
  receiver_id uuid references public.profiles(id) on delete set null,
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  type text not null check (type in ('gift', 'subscription', 'bid', 'payout', 'deposit', 'fee', 'refund')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'reversed')),
  reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_wallet_created_at on public.transactions (wallet_id, created_at desc);
create index if not exists idx_transactions_sender_id on public.transactions (sender_id);
create index if not exists idx_transactions_receiver_id on public.transactions (receiver_id);

create or replace function public.debit_wallet(wallet_id_input uuid, payout_amount numeric)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare updated_wallet public.wallets;
begin
  update public.wallets
  set balance = balance - payout_amount, pending_balance = pending_balance + payout_amount, updated_at = now()
  where id = wallet_id_input and user_id = auth.uid() and balance >= payout_amount;
  if not found then raise exception 'Insufficient wallet balance'; end if;
  select * into updated_wallet from public.wallets where id = wallet_id_input;
  return updated_wallet;
end;
$$;

alter table public.wallets enable row level security;
alter table public.transactions enable row level security;

create policy "Users can view their own wallet" on public.wallets for select to authenticated using (auth.uid() = user_id);
create policy "Users can view their own transactions" on public.transactions for select to authenticated using (auth.uid() = sender_id or auth.uid() = receiver_id);

create trigger wallets_updated_at before update on public.wallets for each row execute function public.update_updated_at();

insert into public.wallets (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

alter publication supabase_realtime add table public.wallets;