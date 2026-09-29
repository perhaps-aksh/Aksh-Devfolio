/**
 * Identifies a file's real type from its bytes for the media library, which (unlike the blog/project
 * cover-image uploads) accepts more than just images — short videos, PDFs, Office documents, plain
 * text, zip archives. The browser-supplied MIME type and filename are never trusted on their own; they only
 * disambiguate formats that share a container (e.g. a .docx and a plain .zip are both PK\x03\x04).
 */
export type MediaKind = "image" | "pdf" | "video" | "document" | "archive" | "other";

export type SniffedFile = { mime: string; ext: string; kind: MediaKind };

const OOXML_BY_EXT: Record<string, { mime: string; kind: MediaKind }> = {
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    kind: "document",
  },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kind: "document",
  },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    kind: "document",
  },
};
const OLE_BY_EXT: Record<string, { mime: string; kind: MediaKind }> = {
  doc: { mime: "application/msword", kind: "document" },
  xls: { mime: "application/vnd.ms-excel", kind: "document" },
  ppt: { mime: "application/vnd.ms-powerpoint", kind: "document" },
};

/** ISO-BMFF brands that mean a still image (HEIF family), not a video. AVIF is matched earlier. */
const STILL_IMAGE_BRANDS = new Set(["heic", "heix", "heim", "heis", "mif1", "msf1", "avis"]);

function extOf(filename: string): string {
  return (filename.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Printable ASCII / common UTF-8 text, no embedded NUL bytes — a reasonable "is this actually text" check. */
function looksLikeText(bytes: Uint8Array, sampleSize = 2048): boolean {
  const end = Math.min(bytes.length, sampleSize);
  for (let i = 0; i < end; i++) {
    const b = bytes[i] ?? 0;
    if (b === 0) return false;
    if (b < 0x09 || (b > 0x0d && b < 0x20 && b !== 0x1b)) return false;
  }
  return true;
}

export function sniffMediaFile(
  bytes: Uint8Array,
  declaredType: string,
  filename: string,
): SniffedFile | null {
  const at = (i: number) => bytes[i] ?? 0;
  const ext = extOf(filename);

  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff)
    return { mime: "image/jpeg", ext: "jpg", kind: "image" };
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47)
    return { mime: "image/png", ext: "png", kind: "image" };
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38)
    return { mime: "image/gif", ext: "gif", kind: "image" };
  if (
    at(0) === 0x52 &&
    at(1) === 0x49 &&
    at(2) === 0x46 &&
    at(3) === 0x46 &&
    at(8) === 0x57 &&
    at(9) === 0x45 &&
    at(10) === 0x42 &&
    at(11) === 0x50
  ) {
    return { mime: "image/webp", ext: "webp", kind: "image" };
  }
  if (
    at(4) === 0x66 &&
    at(5) === 0x74 &&
    at(6) === 0x79 &&
    at(7) === 0x70 &&
    at(8) === 0x61 &&
    at(9) === 0x76 &&
    at(10) === 0x69 &&
    at(11) === 0x66
  ) {
    return { mime: "image/avif", ext: "avif", kind: "image" };
  }
  // Video. WebM starts with the EBML header; MP4 / MOV are ISO base media files: "ftyp" at byte 4 and a
  // brand at byte 8 ("qt  " is QuickTime). Still-image brands (HEIC and friends) are not accepted.
  if (at(0) === 0x1a && at(1) === 0x45 && at(2) === 0xdf && at(3) === 0xa3)
    return { mime: "video/webm", ext: "webm", kind: "video" };
  if (at(4) === 0x66 && at(5) === 0x74 && at(6) === 0x79 && at(7) === 0x70) {
    const brand = String.fromCharCode(at(8), at(9), at(10), at(11));
    if (brand === "qt  ") return { mime: "video/quicktime", ext: "mov", kind: "video" };
    if (!STILL_IMAGE_BRANDS.has(brand)) return { mime: "video/mp4", ext: "mp4", kind: "video" };
    return null;
  }
  // SVG: XML text starting with "<svg" or "<?xml" that goes on to mention <svg — sniffed as text, not by magic bytes.
  if (ext === "svg" && looksLikeText(bytes)) {
    const head = new TextDecoder().decode(bytes.slice(0, 512));
    if (/<svg[\s>]/i.test(head) || (/^<\?xml/i.test(head.trimStart()) && /<svg[\s>]/i.test(head)))
      return { mime: "image/svg+xml", ext: "svg", kind: "image" };
  }

  if (at(0) === 0x25 && at(1) === 0x50 && at(2) === 0x44 && at(3) === 0x46)
    return { mime: "application/pdf", ext: "pdf", kind: "pdf" };

  // ZIP container (PK\x03\x04 or the empty-archive PK\x05\x06): docx/xlsx/pptx are all zip files
  // internally — the extension picks which one, since the bytes alone can't tell them apart.
  if (
    (at(0) === 0x50 && at(1) === 0x4b && at(2) === 0x03 && at(3) === 0x04) ||
    (at(0) === 0x50 && at(1) === 0x4b && at(2) === 0x05 && at(3) === 0x06)
  ) {
    const ooxml = OOXML_BY_EXT[ext];
    if (ooxml) return { ...ooxml, ext };
    return { mime: "application/zip", ext: "zip", kind: "archive" };
  }

  // Legacy (pre-2007) MS Office binary format: doc/xls/ppt all share this OLE compound-file signature.
  if (
    at(0) === 0xd0 &&
    at(1) === 0xcf &&
    at(2) === 0x11 &&
    at(3) === 0xe0 &&
    at(4) === 0xa1 &&
    at(5) === 0xb1 &&
    at(6) === 0x1a &&
    at(7) === 0xe1
  ) {
    const ole = OLE_BY_EXT[ext];
    if (ole) return { ...ole, ext };
    return null;
  }

  // Plain text / CSV: no reliable magic bytes, so require both a matching declared type and content
  // that actually looks like text (no embedded binary/NUL bytes).
  if (
    (declaredType === "text/plain" ||
      declaredType === "text/csv" ||
      ext === "txt" ||
      ext === "csv") &&
    looksLikeText(bytes)
  ) {
    return ext === "csv" || declaredType === "text/csv"
      ? { mime: "text/csv", ext: "csv", kind: "document" }
      : { mime: "text/plain", ext: "txt", kind: "document" };
  }

  return null;
}
