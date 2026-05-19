import type { Track } from "../spotify/api";

type Props = {
  track: Track | null;
  loading: boolean;
  error: string | null;
};

export function NowPlaying({ track, loading, error }: Props) {
  if (error) {
    return (
      <div className="card">
        <div className="muted">{error}</div>
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
            {loading ? "" : "Start a song in Spotify, then come back."}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="card now-playing">
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
    </div>
  );
}
