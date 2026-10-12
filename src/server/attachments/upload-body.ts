import type { NextRequest } from "next/server";
import { maxAttachments, maxUploadBytes, validateAttachment, type AttachmentInput, type AttachmentKind } from "@/modules/attachments/domain/attachment-input";

export class UploadTooLarge extends Error {}

export async function uploadBody(request: NextRequest, kind: AttachmentKind): Promise<AttachmentInput[]> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data;")) throw new TypeError("Formulaire de fichiers requis.");
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/u.test(length) || Number(length) > maxUploadBytes)) throw new UploadTooLarge();
  if (!request.body) throw new TypeError("Fichiers requis.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxUploadBytes) { await reader.cancel(); throw new UploadTooLarge(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let form: FormData;
  try {
    form = await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: bytes }).formData();
  } catch { throw new TypeError("Formulaire invalide."); }
  if ([...form.keys()].some((key) => key !== "files")) throw new TypeError("Champs de fichier invalides.");
  const entries = form.getAll("files");
  if (!entries.length || entries.length > maxAttachments) throw new TypeError("Un à trois fichiers requis.");
  const output: AttachmentInput[] = [];
  for (const file of entries) {
    if (!(file instanceof File)) throw new TypeError("Fichier requis.");
    output.push(validateAttachment(file.name, file.type, new Uint8Array(await file.arrayBuffer()), kind === "project"));
  }
  return output;
}
