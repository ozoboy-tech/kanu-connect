export const maxAttachments = 3;
export const maxAttachmentBytes = 4 * 1024 * 1024;
export const maxUploadBytes = maxAttachments * maxAttachmentBytes + 64 * 1024;
export type AttachmentKind = "post" | "project";
export type AttachmentMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | "text/plain";
export interface AttachmentInfo { id: string; filename: string; mimeType: AttachmentMime; size: number }
export interface AttachmentInput { filename: string; mimeType: AttachmentMime; data: Uint8Array }

export function parseAttachmentKind(value: string): AttachmentKind {
  if (value !== "post" && value !== "project") throw new TypeError("Contenu invalide.");
  return value;
}

export function validateAttachment(name: string, type: string, data: Uint8Array, imagesOnly = false): AttachmentInput {
  if (!data.byteLength || data.byteLength > maxAttachmentBytes) throw new TypeError("Fichier vide ou trop volumineux.");
  const filename = name.split(/[\\/]/u).pop()!.replace(/[\u0000-\u001f\u007f]/gu, "").trim();
  if (!filename || filename.length > 160) throw new TypeError("Nom de fichier invalide.");
  const extension = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  let mimeType: AttachmentMime;
  const ascii = (start: number, end: number) => String.fromCharCode(...data.slice(start, end));
  if (["jpg", "jpeg"].includes(extension) && data.length >= 32 &&
      data[0] === 255 && data[1] === 216 && data[2] === 255 &&
      data[data.length - 2] === 255 && data[data.length - 1] === 217) {
    mimeType = "image/jpeg";
  } else if (extension === "png" && data.length >= 45 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => data[index] === value) &&
      ascii(12, 16) === "IHDR" && ascii(data.length - 8, data.length - 4) === "IEND") {
    mimeType = "image/png";
  } else if (extension === "webp" && data.length >= 20 &&
      ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP" &&
      new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(4, true) === data.length - 8) {
    mimeType = "image/webp";
  } else if (extension === "pdf" && /^%PDF-[12]\.[0-9]/u.test(ascii(0, 8)) &&
      ascii(Math.max(0, data.length - 1024), data.length).includes("%%EOF")) {
    mimeType = "application/pdf";
  } else if (extension === "txt") {
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(data); }
    catch { throw new TypeError("Texte UTF-8 requis."); }
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) throw new TypeError("Fichier texte invalide.");
    mimeType = "text/plain";
  } else throw new TypeError("Format ou signature de fichier invalide.");
  if ((type && type !== mimeType) || (imagesOnly && !mimeType.startsWith("image/"))) {
    throw new TypeError("Type de fichier invalide pour ce contenu.");
  }
  return { filename, mimeType, data };
}
