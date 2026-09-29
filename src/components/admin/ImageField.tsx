import * as React from "react";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";

import { type Bucket, uploadImage } from "@/lib/image-upload";

import { errorMessage } from "./format";
import { useToast } from "./toast";

type Props = {
  bucket: Bucket;
  value: string | null;
  onChange: (url: string | null) => void;
  /** Shown when no image is set (e.g. the bundled fallback for starter projects). */
  fallbackSrc?: string | undefined;
  label: string;
  hint?: string;
};

/** Upload / replace / remove for a single image, with a preview. */
export function ImageField({ bucket, value, onChange, fallbackSrc, label, hint }: Props) {
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const preview = value || fallbackSrc || null;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadImage(file, bucket));
      toast("ok", "Image uploaded.");
    } catch (error) {
      toast("error", errorMessage(error, "The upload failed. Please try again."));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="adm-field">
      <span className="adm-label">{label}</span>
      <div className="adm-image">
        <div className="adm-image-preview">
          {preview ? <img src={preview} alt="" /> : <span>No image</span>}
        </div>
        <div className="adm-image-actions">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            hidden
            onChange={(event) => void pick(event.target.files?.[0])}
            data-testid={`upload-${bucket}`}
          />
          <button
            type="button"
            className="adm-btn is-ghost is-sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 size={13} className="adm-spin" />
            ) : value ? (
              <Upload size={13} />
            ) : (
              <ImagePlus size={13} />
            )}
            {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          </button>
          {value ? (
            <button
              type="button"
              className="adm-btn is-danger is-sm"
              disabled={busy}
              onClick={() => onChange(null)}
            >
              <Trash2 size={13} /> Remove
            </button>
          ) : null}
        </div>
        {hint ? <p className="adm-hint">{hint}</p> : null}
      </div>
    </div>
  );
}
