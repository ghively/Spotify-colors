import { useEffect, useState } from "react";
import { formatRelative, type LastClassification } from "../lib/classifications";

type Props = {
  last: LastClassification | null;
};

export function LastClassified({ last }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!last) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, [last]);

  if (!last) return null;
  return (
    <div className="last-classified" aria-live="polite">
      <span className="last-dot" style={{ background: last.colorHex }} aria-hidden />
      <span className="muted small">
        Last: <strong>{last.colorName}</strong> · {formatRelative(last.at)}
      </span>
    </div>
  );
}
