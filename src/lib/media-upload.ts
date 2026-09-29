import type { AdminMediaAsset } from "@/lib/admin-types";
import { createMediaUploadFn, finalizeMediaUploadFn } from "@/lib/admin.functions";
import { prepareImage } from "@/lib/image-upload";

export const MAX_MEDIA_MB = 50;

/** Sends the file straight to Supabase Storage (multipart PUT to a signed URL) and reports progress. */
function putToSignedUrl(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let detail = "";
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        detail = body.message ?? body.error ?? "";
      } catch {
        /* not JSON */
      }
      reject(new Error(detail || `The upload was rejected (${xhr.status}).`));
    };
    xhr.onerror = () =>
      reject(new Error("The upload could not reach storage. Check your connection."));
    xhr.onabort = () => reject(new Error("The upload was cancelled."));
    const form = new FormData();
    form.append("cacheControl", "31536000");
    form.append("", file);
    xhr.send(form);
  });
}

/**
 * Uploads any supported file to the media library and returns its catalogue row.
 * Pictures are shrunk first (WebP, max 2400px wide); videos and documents go up unchanged.
 * The file never passes through the app's own server — see `createMediaUpload` on the server side.
 */
export async function uploadMedia(
  file: File,
  options: { altText?: string; onProgress?: (fraction: number) => void } = {},
): Promise<AdminMediaAsset> {
  if (file.size > MAX_MEDIA_MB * 1024 * 1024)
    throw new Error(`That file is too large. The limit is ${MAX_MEDIA_MB} MB.`);
  const prepared = await prepareImage(file, 2400);
  const ticket = await createMediaUploadFn({
    data: { filename: prepared.name, size: prepared.size },
  });
  await putToSignedUrl(ticket.signedUrl, ticket.headers, prepared, options.onProgress);
  return finalizeMediaUploadFn({
    data: { path: ticket.path, filename: prepared.name, altText: options.altText ?? "" },
  });
}
