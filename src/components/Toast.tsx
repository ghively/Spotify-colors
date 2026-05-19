import { useEffect } from "react";

export type ToastKind = "success" | "info" | "error";

type Props = {
  message: string | null;
  kind?: ToastKind;
  onDismiss: () => void;
};

export function Toast({ message, kind = "info", onDismiss }: Props) {
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDismiss, 2400);
    return () => window.clearTimeout(id);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <div className={`toast toast--${kind}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
