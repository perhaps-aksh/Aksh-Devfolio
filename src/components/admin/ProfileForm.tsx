import * as React from "react";
import { useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { saveProfileFn } from "@/lib/admin.functions";
import { PROFILE_FIELDS, type SiteProfile } from "@/lib/site-content";

import { errorMessage } from "./format";
import { useToast } from "./toast";
import { Panel } from "./ui";

/** Edits the About copy and the contact email (the single `site_profile` row). */
export function ProfileForm({ profile }: { profile: SiteProfile }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = React.useState<Record<string, string>>({ ...profile });
  const [saving, setSaving] = React.useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const saved = await saveProfileFn({ data: { values } });
      setValues({ ...saved });
      toast("ok", "About & contact saved.");
      await router.invalidate();
    } catch (error) {
      toast("error", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="About & contact" jp="自己紹介">
      <form onSubmit={save} aria-label="About and contact">
        {PROFILE_FIELDS.map((field) => {
          const id = `profile-${field.key}`;
          const text = values[field.key] ?? "";
          const onChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setValues((v) => ({ ...v, [field.key]: event.target.value }));
          return (
            <div key={field.key} className="adm-field">
              <label className="adm-label" htmlFor={id}>
                {field.label}
                {field.required ? " *" : ""}{" "}
                {field.type === "longtext" ? (
                  <span className="adm-mono">
                    {Array.from(text).length}/{field.max}
                  </span>
                ) : null}
              </label>
              {field.type === "longtext" ? (
                <textarea
                  id={id}
                  className="adm-textarea"
                  value={text}
                  maxLength={field.max}
                  onChange={onChange}
                />
              ) : (
                <input
                  id={id}
                  className="adm-input"
                  type={field.key === "contact_email" ? "email" : "text"}
                  value={text}
                  maxLength={field.max}
                  required={field.required}
                  placeholder={field.placeholder}
                  onChange={onChange}
                />
              )}
              {field.hint ? <p className="adm-hint">{field.hint}</p> : null}
            </div>
          );
        })}
        <button type="submit" className="adm-btn" disabled={saving}>
          {saving ? <Loader2 size={14} className="adm-spin" /> : null}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </Panel>
  );
}
