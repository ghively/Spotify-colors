import { useState } from "react";
import type { UpdateInfo } from "../lib/updateCheck";

type Props = {
  info: UpdateInfo | null;
};

export function UpdateBanner({ info }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (!info || dismissed) return null;
  return (
    <div className="update-banner" role="status">
      <span>
        Update available: <strong>{info.latest}</strong>{" "}
        <span className="muted">(you have {info.current})</span>
      </span>
      <span className="row">
        {info.downloadUrl && (
          <a className="btn primary small-btn" href={info.downloadUrl} target="_blank" rel="noreferrer">
            Get it
          </a>
        )}
        <button className="icon-btn" onClick={() => setDismissed(true)} aria-label="Dismiss">
          ✕
        </button>
      </span>
    </div>
  );
}
