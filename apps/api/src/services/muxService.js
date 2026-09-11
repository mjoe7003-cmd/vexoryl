const MUX_BASE_URL = 'https://api.mux.com/video/v1/live_streams';
const MUX_ASSET_BASE_URL = 'https://api.mux.com/video/v1/assets';

function getMuxCredentials() {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    throw new Error('Mux is not configured. Set MUX_TOKEN_ID and MUX_TOKEN_SECRET in your environment.');
  }

  return { tokenId, tokenSecret };
}

export async function createMuxLiveStream({
  name,
  passthrough,
  latency_mode = 'low',
  playback_policy = ['public'],
  vod_retention_hours = Number(process.env.VOD_RETENTION_HOURS || 48),
  ...extraConfig
} = {}) {
  const { tokenId, tokenSecret } = getMuxCredentials();

  const payload = {
    name: name || 'Vexoryl live stream',
    passthrough: passthrough || 'vexoryl',
    latency_mode,
    playback_policy,
    new_asset_settings: {
      playback_policies: playback_policy,
      passthrough: passthrough || 'vexoryl',
    },
    ...extraConfig,
  };

  const response = await fetch(MUX_BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let rawBody;

  try {
    rawBody = text ? JSON.parse(text) : {};
  } catch {
    rawBody = { message: text };
  }

  if (!response.ok) {
    const message = rawBody?.errors?.[0]?.message || rawBody?.message || 'Failed to create Mux live stream';
    throw new Error(`Mux API error: ${message}`);
  }

  const liveStream = rawBody?.data || rawBody;
  const playback = liveStream.playback_ids?.[0] || null;

  return {
    id: liveStream.id,
    asset_id: liveStream.recent_asset_id || null,
    stream_key: liveStream.stream_key,
    playback_id: playback?.id || null,
    status: liveStream.status || 'created',
    created_at: liveStream.created_at,
    latency_mode: liveStream.latency_mode,
    vod_retention_hours,
    playback_url: playback ? `https://stream.mux.com/${playback.id}.m3u8` : null,
  };
}

export async function deleteMuxAsset(assetId) {
  if (!assetId) return false;
  const { tokenId, tokenSecret } = getMuxCredentials();
  const response = await fetch(`${MUX_ASSET_BASE_URL}/${encodeURIComponent(assetId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64')}` },
  });
  if (!response.ok && response.status !== 404) throw new Error(`Mux API error: failed to delete asset ${assetId}`);
  return true;
}

export async function getMuxLiveStream(liveStreamId) {
  if (!liveStreamId) return null;
  const { tokenId, tokenSecret } = getMuxCredentials();
  const response = await fetch(`${MUX_BASE_URL}/${encodeURIComponent(liveStreamId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64')}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Mux API error: failed to inspect live stream ${liveStreamId}`);
  const body = await response.json();
  return body?.data || body;
}
