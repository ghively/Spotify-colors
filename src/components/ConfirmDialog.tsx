type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-card confirm-card">
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {message && <p className="muted">{message}</p>}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={`btn ${danger ? "danger" : "primary"}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
