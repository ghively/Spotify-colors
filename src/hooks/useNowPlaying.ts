import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentlyPlaying, type Track } from "../spotify/api";

type State = {
  track: Track | null;
  loading: boolean;
  error: string | null;
};

export function useNowPlaying(enabled: boolean, intervalMs = 5000) {
  const [state, setState] = useState<State>({ track: null, loading: false, error: null });
  const inFlight = useRef(false);
  const cancelled = useRef(false);

  const fetchNow = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const track = await getCurrentlyPlaying();
      if (cancelled.current) return;
      setState((s) => {
        // preserve identity if track + progress haven't meaningfully changed
        if (
          s.track &&
          track &&
          s.track.id === track.id &&
          Math.abs(s.track.progressMs - track.progressMs) < 1500 &&
          s.track.isPlaying === track.isPlaying
        ) {
          return { ...s, loading: false, error: null };
        }
        return { track, loading: false, error: null };
      });
    } catch (e) {
      if (cancelled.current) return;
      setState({ track: null, loading: false, error: (e as Error).message });
    } finally {
      inFlight.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    await fetchNow();
  }, [fetchNow]);

  useEffect(() => {
    cancelled.current = false;
    if (!enabled) return;
    setState((s) => ({ ...s, loading: true }));
    void fetchNow();
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void fetchNow();
    }, intervalMs);
    const onVisible = () => {
      if (!document.hidden) void fetchNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled.current = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, intervalMs, fetchNow]);

  return { ...state, refresh };
}
