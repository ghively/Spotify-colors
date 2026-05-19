import type { Color } from "../lib/palette";

type Props = {
  palette: Color[];
  disabled?: boolean;
  pending?: string | null; // color id currently being processed
  onPick: (color: Color) => void;
};

export function ColorPalette({ palette, disabled, pending, onPick }: Props) {
  return (
    <div className="palette" role="group" aria-label="Color palette">
      {palette.map((c) => {
        const isPending = pending === c.id;
        return (
          <button
            key={c.id}
            className="swatch"
            style={{ background: c.hex }}
            disabled={disabled || isPending}
            onClick={() => onPick(c)}
            aria-label={`Classify as ${c.name}`}
            title={c.name}
          >
            <span className="swatch-label" style={{ color: textOn(c.hex) }}>
              {isPending ? "…" : c.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function textOn(hex: string): string {
  // pick black/white text based on perceived luminance
  const n = hex.replace("#", "");
  if (n.length !== 6) return "#fff";
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1a1a1a" : "#fff";
}
