import { useState } from "react";
import {
  DEFAULT_PALETTE,
  newColorId,
  savePalette,
  type Color,
} from "../lib/palette";
import { clearCaches } from "../spotify/api";

type Props = {
  palette: Color[];
  onChange: (next: Color[]) => void;
  onClose: () => void;
  onLogout: () => void;
};

export function Settings({ palette, onChange, onClose, onLogout }: Props) {
  const [local, setLocal] = useState<Color[]>(palette);

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

  const resetDefaults = () => {
    if (!confirm("Reset palette to the default colors?")) return;
    update(DEFAULT_PALETTE);
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
          <button className="btn ghost" onClick={resetDefaults}>
            Reset to defaults
          </button>
        </div>

        <hr className="sep" />

        <div className="row">
          <button
            className="btn ghost"
            onClick={() => {
              clearCaches();
              alert("Cached playlist links cleared. Existing classifications are kept.");
            }}
          >
            Clear playlist cache
          </button>
          <button className="btn danger" onClick={onLogout}>
            Sign out of Spotify
          </button>
        </div>
      </div>
    </div>
  );
}
