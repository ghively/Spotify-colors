import { useCallback, useEffect, useState } from "react";
import { NowPlaying } from "./components/NowPlaying";
import { ColorPalette } from "./components/ColorPalette";
import { Toast, type ToastAction, type ToastKind } from "./components/Toast";
import { Settings } from "./components/Settings";
import { LastClassified } from "./components/LastClassified";
import { UpdateBanner } from "./components/UpdateBanner";
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
import {
  addTrackToColor,
  clearCaches,
  removeTrackFromPlaylist,
  type Track,
} from "./spotify/api";
import { useNowPlaying } from "./hooks/useNowPlaying";
import {
  classifiedColorsFor,
  loadLast,
  recordClassification,
  removeClassification,
  saveLast,
  type LastClassification,
} from "./lib/classifications";
import { success as hapticSuccess } from "./lib/haptics";
import { checkForUpdate, getAppVersion, type UpdateInfo } from "./lib/updateCheck";

type AuthState = "checking" | "anon" | "user";

type ToastState = {
  msg: string;
  kind: ToastKind;
  action?: ToastAction | null;
  durationMs?: number;
} | null;

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authError, setAuthError] = useState<string | null>(null);
  const [palette, setPalette] = useState<Color[]>(() => loadPalette());
  const [showSettings, setShowSettings] = useState(false);
  const [pendingColorId, setPendingColorId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [last, setLast] = useState<LastClassification | null>(() => loadLast());
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

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

    void checkForUpdate().then(setUpdateInfo);

    return () => unsubscribe();
  }, []);

  const { track, loading, error, refresh } = useNowPlaying(authState === "user");

  const classifiedIds = track ? classifiedColorsFor(track.id) : [];

  const onPick = useCallback(
    async (color: Color) => {
      if (!track) {
        setToast({ msg: "Nothing playing right now.", kind: "info" });
        return;
      }
      if (pendingColorId) return;
      setPendingColorId(color.id);
      try {
        const { result, playlistId } = await addTrackToColor(color.name, track);
        recordClassification(track.id, color.id);
        const lastEntry: LastClassification = {
          colorId: color.id,
          colorName: color.name,
          colorHex: color.hex,
          trackId: track.id,
          trackName: track.name,
          at: Date.now(),
        };
        saveLast(lastEntry);
        setLast(lastEntry);
        void hapticSuccess();
        const undoAction = buildUndo(track, color, playlistId, setToast, setLast);
        if (result === "added") {
          setToast({ msg: `Added to ${color.name}`, kind: "success", action: undoAction });
        } else {
          setToast({
            msg: `Already in ${color.name}`,
            kind: "info",
            action: undoAction,
          });
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
          <div className="muted small" style={{ marginTop: 16 }}>v{getAppVersion()}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <UpdateBanner info={updateInfo} />
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

      <NowPlaying track={track} loading={loading} error={error} onRefresh={() => void refresh()} />
      <LastClassified last={last} />

      <ColorPalette
        palette={palette}
        disabled={!track}
        pending={pendingColorId}
        classifiedColorIds={classifiedIds}
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
        action={toast?.action ?? null}
        durationMs={toast?.durationMs ?? 3500}
        onDismiss={() => setToast(null)}
      />
    </main>
  );
}

function buildUndo(
  track: Track,
  color: Color,
  playlistId: string,
  setToast: (t: ToastState) => void,
  setLast: (l: LastClassification | null) => void,
): ToastAction {
  return {
    label: "Undo",
    onClick: async () => {
      setToast({ msg: `Undoing…`, kind: "info" });
      try {
        await removeTrackFromPlaylist(playlistId, track.uri);
        removeClassification(track.id, color.id);
        const current = loadLast();
        if (current && current.trackId === track.id && current.colorId === color.id) {
          saveLast(null);
          setLast(null);
        }
        setToast({ msg: `Removed from ${color.name}`, kind: "info" });
      } catch (e) {
        setToast({ msg: (e as Error).message, kind: "error" });
      }
    },
  };
}
