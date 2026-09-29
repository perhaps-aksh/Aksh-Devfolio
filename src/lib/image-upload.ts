import { uploadImageFn } from "@/lib/admin.functions";

export type Bucket = "blog-images" | "project-images";

/**
 * Shrinks a picture before upload: max 1800px wide, re-encoded as WebP. Animated GIFs and files that
 * would not get smaller are left untouched. The server still validates the real file type.
 */
export async function prepareImage(file: File, maxWidth = 1800): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width);
    if (file.type === "image/webp" && scale === 1) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    if (!blob || (blob.size >= file.size && scale === 1)) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

/** Optimise + upload an image to Supabase Storage (through the admin server function). Returns its public URL. */
export async function uploadImage(file: File, bucket: Bucket): Promise<string> {
  if (file.size > 25 * 1024 * 1024)
    throw new Error("That file is too large. Choose an image under 25 MB.");
  const prepared = await prepareImage(file);
  if (prepared.size > 5 * 1024 * 1024)
    throw new Error("The image is still over 5 MB after optimising. Try a smaller picture.");
  const form = new FormData();
  form.set("bucket", bucket);
  form.set("file", prepared);
  const result = await uploadImageFn({ data: form });
  return result.url;
}
