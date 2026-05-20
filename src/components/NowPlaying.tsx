import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { Track } from "../spotify/api";

type Props = {
  track: Track | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

export function NowPlaying({ track, loading, error, onRefresh }: Props) {
  if (error) {
    return (
      <div className="card">
        <div className="muted">{error}</div>
        <button className="btn ghost" onClick={onRefresh} style={{ marginTop: 10 }}>
          Try again
        </button>
      </div>
    );
  }
  if (!track) {
    return (
      <div className="card now-playing now-playing--empty">
        <div className="np-art np-art--empty" aria-hidden />
        <div className="np-text">
          <div className="np-title">{loading ? "Checking…" : "Nothing playing"}</div>
          <div className="np-sub muted">
            {loading ? "" : "Open Spotify and press play."}
          </div>
        </div>
        <button
          className="icon-btn"
          onClick={onRefresh}
          aria-label="Check again"
          disabled={loading}
          title="Check again"
        >
          ↻
        </button>
      </div>
    );
  }
  return (
    <button
      className="card now-playing now-playing--clickable"
      onClick={() => openInSpotify(track)}
      aria-label={`Open ${track.name} in Spotify`}
    >
      {track.albumImage ? (
        <img className="np-art" src={track.albumImage} alt="" />
      ) : (
        <div className="np-art np-art--empty" aria-hidden />
      )}
      <div className="np-text">
        <div className="np-title" title={track.name}>
          {track.name}
        </div>
        <div className="np-sub" title={track.artists}>
          {track.artists}
        </div>
      </div>
      <ProgressBar track={track} />
    </button>
  );
}

function ProgressBar({ track }: { track: Track }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!track.isPlaying) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [track.id, track.isPlaying]);

  const elapsed = track.isPlaying ? now - track.fetchedAt : 0;
  const progress = Math.min(track.durationMs, track.progressMs + elapsed);
  const pct = track.durationMs > 0 ? (progress / track.durationMs) * 100 : 0;

  return (
    <div className="np-progress" aria-hidden>
      <div className="np-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function openInSpotify(track: Track): void {
  const webUrl = `https://open.spotify.com/track/${track.id}`;
  if (Capacitor.isNativePlatform()) {
    // Try Spotify deep link first; fall back to web
    window.location.href = track.uri;
    window.setTimeout(() => {
      window.open(webUrl, "_blank");
    }, 400);
  } else {
    window.open(webUrl, "_blank");
  }
}
