import { useEffect } from "react";

export type ToastKind = "success" | "info" | "error";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

type Props = {
  message: string | null;
  kind?: ToastKind;
  action?: ToastAction | null;
  durationMs?: number;
  onDismiss: () => void;
};

export function Toast({ message, kind = "info", action, durationMs = 3500, onDismiss }: Props) {
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;
  return (
    <div className={`toast toast--${kind}`} role="status" aria-live="polite">
      <span>{message}</span>
      {action && (
        <button
          className="toast-action"
          onClick={(e) => {
            e.stopPropagation();
            action.onClick();
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
