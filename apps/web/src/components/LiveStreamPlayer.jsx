import React, { useState } from 'react';
import MuxPlayer from '@mux/mux-player-react';

export function LiveStreamPlayer({ playbackId, fallbackPlaybackId = import.meta.env.VITE_MUX_TEST_PLAYBACK_ID, fallbackVideoSrc = import.meta.env.VITE_TEST_VIDEO_SRC || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', title = 'Live stream', viewerId, metadata = {}, className = '' }) {
  const resolvedPlaybackId = playbackId || fallbackPlaybackId;
  const [maxResolution, setMaxResolution] = useState('auto');

  return (
    <div className={`live-stream-frame ${className}`}>
      <MuxPlayer
        className="live-stream-player"
        playbackId={resolvedPlaybackId || undefined}
        src={resolvedPlaybackId ? undefined : fallbackVideoSrc}
        streamType={resolvedPlaybackId ? 'live' : 'on-demand'}
        maxResolution={maxResolution === 'auto' ? undefined : maxResolution}
        autoPlay
        muted
        playsInline
        controls
        metadata={{
          video_id: resolvedPlaybackId || 'local-fallback-video',
          video_title: title,
          viewer_user_id: viewerId,
          ...metadata,
        }}
        accentColor="#d9f85a"
        style={{ width: '100%', height: '100%' }}
      />
      <label className="stream-quality-control">
        <span>Quality</span>
        <select value={maxResolution} onChange={(event) => setMaxResolution(event.target.value)} aria-label="Maximum video quality">
          <option value="auto">Auto</option>
          <option value="144p">144p</option>
          <option value="240p">240p</option>
          <option value="360p">360p</option>
          <option value="480p">480p</option>
          <option value="720p">720p HD</option>
          <option value="1080p">1080p Full HD</option>
          <option value="1440p">1440p</option>
          <option value="2160p">2160p 4K</option>
        </select>
      </label>
    </div>
  );
}

export default LiveStreamPlayer;