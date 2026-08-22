import { createClient } from '@supabase/supabase-js';

let client;
function getClient() {
  if (process.argv.includes('--test')) return null;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  client ||= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  return client;
}

export async function notifyCreator(creatorId, notification) {
  const supabase = getClient();
  if (!supabase) return { delivered: false, mode: 'local' };
  const channel = supabase.channel(`creator-notifications-${creatorId}`);
  try {
    await new Promise((resolve, reject) => channel.subscribe((status) => status === 'SUBSCRIBED' ? resolve() : ['CHANNEL_ERROR', 'TIMED_OUT'].includes(status) ? reject(new Error(`Notification channel ${status}`)) : undefined));
    const result = await channel.send({ type: 'broadcast', event: 'creator-notification', payload: notification });
    if (result !== 'ok') throw new Error('Creator notification was rejected');
    return { delivered: true, mode: 'supabase' };
  } finally {
    await supabase.removeChannel(channel);
  }
}