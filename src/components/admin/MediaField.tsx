import * as React from "react";
import { Film, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";

import { MAX_MEDIA_MB, uploadMedia } from "@/lib/media-upload";
import type { MediaKind } from "@/lib/site-content";

import { errorMessage } from "./format";
import { useToast } from "./toast";

type Props = {
  label: string;
  url: string | null;
  kind: MediaKind | null;
  onChange: (url: string | null, kind: MediaKind | null) => void;
  hint?: string | undefined;
  testId?: string;
};

/** Upload / replace / remove for one photo or short video, with a live preview and upload progress. */
export function MediaField({
  label,
  url,
  kind,
  onChange,
  hint,
  testId = "upload-media-field",
}: Props) {
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    try {
      const asset = await uploadMedia(file, { onProgress: setProgress });
      if (asset.kind !== "image" && asset.kind !== "video")
        throw new Error("Choose a photo (JPG, PNG, WebP, GIF) or a video (MP4, WebM).");
      onChange(asset.url, asset.kind);
      toast("ok", asset.kind === "video" ? "Video uploaded." : "Image uploaded.");
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
          {url && kind === "video" ? (
            <video src={url} muted playsInline controls preload="metadata" />
          ) : url ? (
            <img src={url} alt="" />
          ) : (
            <span>
              <Film size={14} style={{ verticalAlign: "-2px" }} /> No media
            </span>
          )}
        </div>
        <div className="adm-image-actions">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime"
            hidden
            onChange={(event) => void pick(event.target.files?.[0])}
            data-testid={testId}
          />
          <button
            type="button"
            className="adm-btn is-ghost is-sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 size={13} className="adm-spin" />
            ) : url ? (
              <Upload size={13} />
            ) : (
              <ImagePlus size={13} />
            )}
            {busy ? `Uploading ${Math.round(progress * 100)}%` : url ? "Replace" : "Upload"}
          </button>
          {url ? (
            <button
              type="button"
              className="adm-btn is-danger is-sm"
              disabled={busy}
              onClick={() => onChange(null, null)}
            >
              <Trash2 size={13} /> Remove
            </button>
          ) : null}
        </div>
        <p className="adm-hint">{hint ?? `Photo or video, up to ${MAX_MEDIA_MB} MB.`}</p>
      </div>
    </div>
  );
}
