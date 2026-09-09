-- Requires 003_wallets_transactions.sql, which defines public.wallets and public.transactions.
-- Apply the Supabase migrations in filename order before running this migration.
create or replace function public.send_gift(
  sender_id_input uuid,
  recipient_id_input uuid,
  gift_type_input text,
  gift_amount_input numeric,
  request_key_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_wallet public.wallets;
  recipient_wallet public.wallets;
  existing_transaction public.transactions;
  gift_id uuid;
begin
  if auth.uid() is null or auth.uid() <> sender_id_input then
    raise exception 'Not authorized';
  end if;
  if gift_amount_input <= 0 then
    raise exception 'Gift amount must be positive';
  end if;

  if request_key_input is not null then
    select * into existing_transaction
    from public.transactions
    where sender_id = sender_id_input
      and type = 'gift'
      and metadata ->> 'request_key' = request_key_input
    limit 1;
    if found then
      return jsonb_build_object('id', existing_transaction.id, 'status', existing_transaction.status);
    end if;
  end if;

  select * into sender_wallet from public.wallets where user_id = sender_id_input for update;
  select * into recipient_wallet from public.wallets where user_id = recipient_id_input for update;
  if sender_wallet.id is null or recipient_wallet.id is null then
    raise exception 'Wallet not found';
  end if;
  if sender_wallet.balance < gift_amount_input then
    raise exception 'Insufficient wallet balance';
  end if;

  update public.wallets set balance = balance - gift_amount_input, updated_at = now() where id = sender_wallet.id;
  update public.wallets set balance = balance + gift_amount_input, updated_at = now() where id = recipient_wallet.id;

  gift_id := gen_random_uuid();
  insert into public.transactions (id, sender_id, receiver_id, wallet_id, type, amount, currency, status, reference, metadata)
  values (gift_id, sender_id_input, recipient_id_input, sender_wallet.id, 'gift', gift_amount_input, sender_wallet.currency, 'completed', gift_type_input,
    jsonb_build_object('gift_type', gift_type_input, 'request_key', request_key_input));

  return jsonb_build_object('id', gift_id, 'gift_type', gift_type_input, 'amount', gift_amount_input, 'status', 'completed');
end;
$$;

grant execute on function public.send_gift(uuid, uuid, text, numeric, text) to authenticated;

alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.task_bids;
