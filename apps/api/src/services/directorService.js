import { createClient } from '@supabase/supabase-js';

let client;
function getClient() {
  if (process.argv.includes('--test')) return null;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  client ||= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  return client;
}

export async function broadcastDirectorTrigger(streamId, trigger) {
  const channel = getClient()?.channel(`director-${streamId}`);
  if (!channel) return { delivered: false, mode: 'local' };
  try {
    await new Promise((resolve, reject) => channel.subscribe((status) => status === 'SUBSCRIBED' ? resolve() : ['CHANNEL_ERROR', 'TIMED_OUT'].includes(status) ? reject(new Error(`Director channel ${status}`)) : undefined));
    const result = await channel.send({ type: 'broadcast', event: 'director-trigger', payload: trigger });
    if (result !== 'ok') throw new Error('Director trigger could not be broadcast');
    return { delivered: true, mode: 'supabase' };
  } finally {
    await getClient().removeChannel(channel);
  }
}