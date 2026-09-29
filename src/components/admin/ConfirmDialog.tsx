import * as React from "react";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmation for destructive actions, built on the native <dialog> (focus trap + Esc handled by the browser). */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="adm-dialog"
      aria-labelledby="adm-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !busy) onCancel();
      }}
    >
      <div className="adm-dialog-body">
        <h2 id="adm-dialog-title">{title}</h2>
        <p>{body}</p>
      </div>
      <div className="adm-dialog-actions">
        <button type="button" className="adm-btn is-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className={`adm-btn ${danger ? "is-danger" : ""}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? <Loader2 size={14} className="adm-spin" /> : null}
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
