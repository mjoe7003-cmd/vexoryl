import { supabase } from './supabase.js';

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in to continue');
  return data.user;
}

export async function getStream(streamId) {
  const [{ data: stream, error: streamError }, { data: messages, error: messagesError }] = await Promise.all([
    supabase.from('streams').select('id, title, description, category, status, playback_id, view_count, creator_id').eq('id', streamId).maybeSingle(),
    supabase.from('chat_messages').select('id, stream_id, message, created_at, profiles(full_name, username)').eq('stream_id', streamId).order('created_at', { ascending: true }).limit(40),
  ]);
  if (streamError) throw streamError;
  if (messagesError) throw messagesError;
  return {
    stream,
    messages: (messages || []).map((message) => ({
      ...message,
      author: message.profiles?.full_name || message.profiles?.username || 'Guest',
      text: message.message,
    })),
  };
}

export async function listTaskBids(streamId) {
  const { data, error } = await supabase
    .from('task_bids')
    .select('id, stream_id, user_id, task_prompt, bid_amount, status, created_at')
    .eq('stream_id', streamId)
    .order('bid_amount', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
}

export async function createTaskBid(streamId, taskPrompt, bidAmount) {
  const user = await requireUser();
  const { data, error } = await supabase
    .from('task_bids')
    .insert({ stream_id: streamId, user_id: user.id, task_prompt: taskPrompt, bid_amount: bidAmount })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createChatMessage(streamId, text) {
  const user = await requireUser();
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ stream_id: streamId, user_id: user.id, message: text })
    .select('id, stream_id, message, created_at')
    .single();
  if (error) throw error;
  return { ...data, author: 'You', text: data.message };
}

export async function sendGift(recipientId, giftType, amount, requestId) {
  const user = await requireUser();
  const { data, error } = await supabase.rpc('send_gift', {
    sender_id_input: user.id,
    recipient_id_input: recipientId,
    gift_type_input: giftType,
    gift_amount_input: amount,
    request_key_input: requestId,
  });
  if (error) throw error;
  return data;
}

export async function getCreatorAnalytics() {
  const user = await requireUser();
  const { data, error } = await supabase.rpc('creator_analytics', { creator_id_input: user.id });
  if (error) throw error;
  return {
    totalViewers: Number(data?.concurrent_viewer_peak || 0),
    watchHours: 0,
    engagementRate: 0,
    demographics: data?.viewer_regions || [],
    devices: data?.device_types || [],
    engagementHeatmap: data?.engagement_heatmap || [],
    revenue: data?.revenue || {},
    streamDurationTrends: data?.stream_duration_trends || [],
  };
}

export async function getMonitoringSnapshot() {
  const { data, error } = await supabase.from('streams').select('id, title, status, view_count, playback_id').eq('status', 'live');
  if (error) throw error;
  return {
    streams: (data || []).map((stream) => ({
      title: stream.title,
      status: stream.status,
      viewers: stream.view_count || 0,
      health: stream.playback_id ? 'Healthy' : 'Awaiting ingest',
    })),
    alerts: [],
    anomalies: 0,
  };
}
