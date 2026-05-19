import { useEffect, useRef, useState } from "react";
import { getCurrentlyPlaying, type Track } from "../spotify/api";

type State = {
  track: Track | null;
  loading: boolean;
  error: string | null;
};

export function useNowPlaying(enabled: boolean, intervalMs = 5000) {
  const [state, setState] = useState<State>({ track: null, loading: false, error: null });
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      if (inFlight.current) return;
      if (document.hidden) return;
      inFlight.current = true;
      try {
        const track = await getCurrentlyPlaying();
        if (cancelled) return;
        setState((s) => ({
          track,
          loading: false,
          error: null,
          // preserve identity if unchanged to avoid re-renders
          ...(s.track && track && s.track.id === track.id ? { track: s.track } : {}),
        }));
      } catch (e) {
        if (cancelled) return;
        setState({ track: null, loading: false, error: (e as Error).message });
      } finally {
        inFlight.current = false;
      }
    };

    setState((s) => ({ ...s, loading: true }));
    void tick();
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, intervalMs]);

  return state;
}
