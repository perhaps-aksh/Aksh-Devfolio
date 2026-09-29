import * as React from "react";
import { X } from "lucide-react";

type Props = {
  id: string;
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  /** Max characters per item, and max number of items. */
  maxLength: number;
  maxItems: number;
  hint?: string | undefined;
  placeholder?: string | undefined;
};

/** A list of short strings edited as chips: type, then Enter or comma to add; Backspace removes the last. */
export function TagField({
  id,
  label,
  value,
  onChange,
  maxLength,
  maxItems,
  hint,
  placeholder,
}: Props) {
  const [draft, setDraft] = React.useState("");

  const add = (raw: string) => {
    const incoming = raw
      .split(",")
      .map((part) => part.trim().slice(0, maxLength))
      .filter(Boolean);
    if (incoming.length === 0) {
      setDraft("");
      return;
    }
    const next = [...value];
    for (const item of incoming) if (!next.includes(item)) next.push(item);
    onChange(next.slice(0, maxItems));
    setDraft("");
  };

  const full = value.length >= maxItems;

  return (
    <div className="adm-field">
      <label className="adm-label" htmlFor={id}>
        {label}{" "}
        <span className="adm-mono">
          {value.length}/{maxItems}
        </span>
      </label>
      <input
        id={id}
        className="adm-input"
        value={draft}
        maxLength={maxLength * 3}
        disabled={full}
        placeholder={full ? "Limit reached" : (placeholder ?? "Type, then press Enter")}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add(draft);
          } else if (event.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
      />
      {value.length ? (
        <div className="adm-chips">
          {value.map((item) => (
            <span key={item} className="adm-chip">
              {item}
              <button
                type="button"
                aria-label={`Remove ${item}`}
                onClick={() => onChange(value.filter((entry) => entry !== item))}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {hint ? <p className="adm-hint">{hint}</p> : null}
    </div>
  );
}
