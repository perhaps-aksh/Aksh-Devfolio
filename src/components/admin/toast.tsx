import * as React from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

type Toast = { id: number; kind: "ok" | "error"; text: string };
type Push = (kind: Toast["kind"], text: string) => void;

const ToastContext = React.createContext<Push>(() => {});
export const useToast = () => React.useContext(ToastContext);

/** Minimal accessible toast stack for the admin area. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const next = React.useRef(1);

  const push = React.useCallback<Push>((kind, text) => {
    const id = next.current++;
    setToasts((list) => [...list.slice(-3), { id, kind, text }]);
    window.setTimeout(
      () => setToasts((list) => list.filter((t) => t.id !== id)),
      kind === "error" ? 7000 : 3800,
    );
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="adm-toasts" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`adm-toast is-${t.kind}`}
            role={t.kind === "error" ? "alert" : "status"}
          >
            {t.kind === "ok" ? <CircleCheck size={16} /> : <CircleAlert size={16} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
