import { useCallback, useEffect, useState } from "react";
import { NowPlaying } from "./components/NowPlaying";
import { ColorPalette } from "./components/ColorPalette";
import { Toast, type ToastKind } from "./components/Toast";
import { Settings } from "./components/Settings";
import { loadPalette, type Color } from "./lib/palette";
import {
  beginLogin,
  getPlatform,
  getRedirectUri,
  handleRedirectCallback,
  isConfigured,
  isLoggedIn,
  listenForNativeRedirect,
  logout,
} from "./spotify/auth";
import { addTrackToColor, clearCaches } from "./spotify/api";
import { useNowPlaying } from "./hooks/useNowPlaying";

type AuthState = "checking" | "anon" | "user";

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authError, setAuthError] = useState<string | null>(null);
  const [palette, setPalette] = useState<Color[]>(() => loadPalette());
  const [showSettings, setShowSettings] = useState(false);
  const [pendingColorId, setPendingColorId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await handleRedirectCallback();
      } catch (e) {
        setAuthError((e as Error).message);
      }
      setAuthState(isLoggedIn() ? "user" : "anon");
    })();

    const unsubscribe = listenForNativeRedirect((ok, err) => {
      if (err) {
        setAuthError(err.message);
        return;
      }
      if (ok) {
        setAuthError(null);
        setAuthState("user");
      }
    });
    return () => unsubscribe();
  }, []);

  const { track, loading, error } = useNowPlaying(authState === "user");

  const onPick = useCallback(
    async (color: Color) => {
      if (!track) {
        setToast({ msg: "Nothing playing right now.", kind: "info" });
        return;
      }
      if (pendingColorId) return;
      setPendingColorId(color.id);
      try {
        const { result } = await addTrackToColor(color.name, track);
        if (result === "added") {
          setToast({ msg: `Added to ${color.name}`, kind: "success" });
        } else {
          setToast({ msg: `Already in ${color.name}`, kind: "info" });
        }
      } catch (e) {
        setToast({ msg: (e as Error).message, kind: "error" });
      } finally {
        setPendingColorId(null);
      }
    },
    [track, pendingColorId],
  );

  if (!isConfigured()) {
    return (
      <main className="screen center">
        <div className="card">
          <h1>Setup needed</h1>
          <p className="muted">
            Set <code>VITE_SPOTIFY_CLIENT_ID</code> in your environment, then redeploy.
            Add this redirect URI to your Spotify Developer dashboard (platform:{" "}
            {getPlatform()}):
          </p>
          <pre className="code">{getRedirectUri()}</pre>
        </div>
      </main>
    );
  }

  if (authState === "checking") {
    return <main className="screen center"><div className="muted">Loading…</div></main>;
  }

  if (authState === "anon") {
    return (
      <main className="screen center">
        <div className="card auth-card">
          <h1>Spotify Colors</h1>
          <p className="muted">
            Sign in once to start sorting your songs by color into playlists.
          </p>
          {authError && <p className="error small">{authError}</p>}
          <button className="btn primary big" onClick={() => void beginLogin()}>
            Sign in with Spotify
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <header className="topbar">
        <h1 className="brand">Colors</h1>
        <button
          className="icon-btn"
          onClick={() => setShowSettings(true)}
          aria-label="Open settings"
        >
          ⚙
        </button>
      </header>

      <NowPlaying track={track} loading={loading} error={error} />

      <ColorPalette
        palette={palette}
        disabled={!track}
        pending={pendingColorId}
        onPick={onPick}
      />

      {showSettings && (
        <Settings
          palette={palette}
          onChange={setPalette}
          onClose={() => setShowSettings(false)}
          onLogout={() => {
            logout();
            clearCaches();
            setShowSettings(false);
            setAuthState("anon");
          }}
        />
      )}

      <Toast
        message={toast?.msg ?? null}
        kind={toast?.kind}
        onDismiss={() => setToast(null)}
      />
    </main>
  );
}
