import { useState } from "react";
import {
  DEFAULT_PALETTE,
  newColorId,
  savePalette,
  type Color,
} from "../lib/palette";
import { clearCaches } from "../spotify/api";
import { ConfirmDialog } from "./ConfirmDialog";

type Props = {
  palette: Color[];
  onChange: (next: Color[]) => void;
  onClose: () => void;
  onLogout: () => void;
};

type Pending =
  | { kind: "logout" }
  | { kind: "reset" }
  | { kind: "clearCache" }
  | null;

export function Settings({ palette, onChange, onClose, onLogout }: Props) {
  const [local, setLocal] = useState<Color[]>(palette);
  const [pending, setPending] = useState<Pending>(null);

  const update = (next: Color[]) => {
    setLocal(next);
    savePalette(next);
    onChange(next);
  };

  const setColor = (id: string, patch: Partial<Color>) => {
    update(local.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const remove = (id: string) => {
    if (local.length <= 1) return;
    update(local.filter((c) => c.id !== id));
  };

  const add = () => {
    update([...local, { id: newColorId(), name: "New color", hex: "#888888" }]);
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="modal-card">
        <header className="modal-header">
          <h2>Palette</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </header>

        <p className="muted small">
          The name is also used as the Spotify playlist name. The first time you pick a
          color, a private playlist with that name is created (or matched if it already
          exists).
        </p>

        <ul className="color-list">
          {local.map((c) => (
            <li className="color-row" key={c.id}>
              <input
                type="color"
                value={c.hex}
                onChange={(e) => setColor(c.id, { hex: e.target.value })}
                aria-label={`${c.name} color`}
              />
              <input
                type="text"
                value={c.name}
                onChange={(e) => setColor(c.id, { name: e.target.value })}
                placeholder="Color name"
                maxLength={40}
              />
              <button
                className="icon-btn danger"
                onClick={() => remove(c.id)}
                disabled={local.length <= 1}
                aria-label={`Remove ${c.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <div className="row">
          <button className="btn" onClick={add}>
            + Add color
          </button>
          <button className="btn ghost" onClick={() => setPending({ kind: "reset" })}>
            Reset to defaults
          </button>
        </div>

        <hr className="sep" />

        <div className="row">
          <button className="btn ghost" onClick={() => setPending({ kind: "clearCache" })}>
            Clear playlist cache
          </button>
          <button className="btn danger" onClick={() => setPending({ kind: "logout" })}>
            Sign out of Spotify
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={pending?.kind === "reset"}
        title="Reset palette?"
        message="Your custom colors will be replaced with the default set."
        confirmLabel="Reset"
        onConfirm={() => {
          update(DEFAULT_PALETTE);
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending?.kind === "clearCache"}
        title="Clear playlist cache?"
        message="The next classification will re-discover playlists by name. Existing songs stay put."
        confirmLabel="Clear"
        onConfirm={() => {
          clearCaches();
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending?.kind === "logout"}
        title="Sign out of Spotify?"
        message="You'll need to sign in again to keep classifying songs."
        confirmLabel="Sign out"
        danger
        onConfirm={onLogout}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
