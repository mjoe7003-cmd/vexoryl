import React from 'react';
import MuxPlayer from '@mux/mux-player-react';

export function LiveStreamPlayer({ playbackId, fallbackPlaybackId = import.meta.env.VITE_MUX_TEST_PLAYBACK_ID, fallbackVideoSrc = import.meta.env.VITE_TEST_VIDEO_SRC || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', title = 'Live stream', viewerId, metadata = {}, className = '', playerRef }) {
  const resolvedPlaybackId = playbackId || fallbackPlaybackId;

  return (
    <MuxPlayer
      className={`live-stream-player ${className}`}
      ref={playerRef}
      playbackId={resolvedPlaybackId || undefined}
      src={resolvedPlaybackId ? undefined : fallbackVideoSrc}
      streamType={resolvedPlaybackId ? 'live' : 'on-demand'}
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
  );
}

export default LiveStreamPlayer;