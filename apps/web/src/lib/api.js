import { supabase, isSupabaseConfigured } from './supabase.js';

export const API_BASE = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

function getApiToken() {
  return window.localStorage.getItem('vexoryl_token');
}

async function apiRequest(path, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(getApiToken() ? { Authorization: `Bearer ${getApiToken()}` } : {}),
        ...options.headers,
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
    return body;
  } catch (error) {
    if (error instanceof TypeError) throw new Error(`Cannot reach Vexoryl API at ${API_BASE}. Set VITE_API_URL to the public API URL or start the API locally.`);
    throw error;
  }
}

export async function signInWithApi(email, password) {
  const body = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  window.localStorage.setItem('vexoryl_token', body.token);
  return { ...body.user, sub: body.user.id };
}

export async function signUpWithApi(name, email, password) {
  const body = await apiRequest('/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) });
  window.localStorage.setItem('vexoryl_token', body.token);
  return { ...body.user, sub: body.user.id };
}

export async function getApiWallet() {
  return (await apiRequest('/wallet/deposit', { method: 'POST', body: JSON.stringify({ amount: 0 }) })).wallet;
}

export async function listLiveStreams() { return (await apiRequest('/streams')).streams; }
export async function getFollowingCreators() { return (await apiRequest('/users/me/following')).creatorIds; }
export async function setCreatorFollowState(creatorId, following) {
  return (await apiRequest(`/creators/${creatorId}/follow`, { method: following ? 'POST' : 'DELETE' })).creatorIds;
}

export async function purchaseStreamAccess(streamId, requestId) {
  return apiRequest(`/streams/${streamId}/access`, { method: 'POST', headers: { 'Idempotency-Key': requestId } });
}

export async function panicStopStream(streamId) {
  return apiRequest(`/streams/${streamId}/panic`, { method: 'POST', body: JSON.stringify({ reason: 'creator_emergency_stop' }) });
}

export async function getCommunityFeed() { return (await apiRequest('/community')).posts; }
export async function publishCommunityPost(body) { return (await apiRequest('/community/posts', { method: 'POST', body: JSON.stringify({ body }) })).post; }
export async function exportCommunityAudience() { return (await apiRequest('/community/audience/export')).audience; }

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

export async function getAiInsights(payload) {
  return apiRequest('/ai/insights', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
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
