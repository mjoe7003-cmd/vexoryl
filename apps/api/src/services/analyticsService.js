import { createClient } from '@supabase/supabase-js';
import { getAnalytics } from '../models/store.js';

let client;
function getClient() {
  if (process.argv.includes('--test')) return null;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  client ||= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  return client;
}

export async function getCreatorAnalytics(creatorId) {
  const supabase = getClient();
  if (!supabase) return getAnalytics(creatorId);
  const { data, error } = await supabase.rpc('creator_analytics', { creator_id_input: creatorId });
  if (error) {
    console.error('[Vexoryl] analytics aggregation unavailable; using development metrics', { error: error.message });
    return getAnalytics(creatorId);
  }
  return { ...getAnalytics(creatorId), ...data };
}