import type { Color } from "../lib/palette";
import { tap } from "../lib/haptics";

type Props = {
  palette: Color[];
  disabled?: boolean;
  pending?: string | null; // color id currently being processed
  classifiedColorIds?: string[];
  onPick: (color: Color) => void;
};

export function ColorPalette({
  palette,
  disabled,
  pending,
  classifiedColorIds = [],
  onPick,
}: Props) {
  const classified = new Set(classifiedColorIds);
  return (
    <div className="palette" role="group" aria-label="Color palette">
      {palette.map((c) => {
        const isPending = pending === c.id;
        const isClassified = classified.has(c.id);
        return (
          <button
            key={c.id}
            className={`swatch ${isClassified ? "swatch--classified" : ""}`}
            style={{ background: c.hex }}
            disabled={disabled || isPending}
            onClick={() => {
              void tap();
              onPick(c);
            }}
            aria-label={
              isClassified
                ? `Already classified as ${c.name}`
                : `Classify as ${c.name}`
            }
            aria-pressed={isClassified}
            title={c.name}
          >
            <span className="swatch-label" style={{ color: textOn(c.hex) }}>
              {isPending ? "…" : c.name}
            </span>
            {isClassified && (
              <span className="swatch-check" style={{ color: textOn(c.hex) }} aria-hidden>
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function textOn(hex: string): string {
  const n = hex.replace("#", "");
  if (n.length !== 6) return "#fff";
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1a1a1a" : "#fff";
}
