"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { maxAttachments, maxAttachmentBytes, type AttachmentInfo, type AttachmentKind } from "@/modules/attachments/domain/attachment-input";

export default function AttachmentPanel({ kind, id, canEdit }: { kind: AttachmentKind; id: string; canEdit: boolean }) {
  const [files, setFiles] = useState<AttachmentInfo[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inputId = useId();
  const endpoint = `/api/attachments/${kind}/${id}`;
  const read = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { cache: "no-store", signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Lecture des fichiers impossible.");
    return data as AttachmentInfo[];
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setFiles([]); setError("");
    read(controller.signal).then(setFiles).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Lecture impossible.");
    }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [read]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const selected = data.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);
    setError(""); setNotice("");
    if (!selected.length || files.length + selected.length > maxAttachments || selected.some((file) => file.size > maxAttachmentBytes)) {
      setError("Trois fichiers maximum par contenu, quatre Mio par fichier."); return;
    }
    setBusy(true);
    try {
      const response = await fetch(endpoint, { method: "POST", body: data });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Ajout impossible.");
      setFiles(await read()); form.reset(); setNotice("Fichiers ajoutés.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Ajout impossible."); }
    finally { setBusy(false); }
  }

  async function remove(fileId: string) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${endpoint}/${fileId}`, { method: "DELETE" });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error ?? "Retrait impossible."); }
      setFiles((current) => current.filter((file) => file.id !== fileId)); setNotice("Fichier retiré.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Retrait impossible."); }
    finally { setBusy(false); }
  }

  return <section aria-busy={busy}>
    <h2>{kind === "project" ? "Captures du projet" : "Images et pièces jointes"}</h2>
    {busy && <p role="status">Chargement…</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!busy && !files.length && !error && <p>Aucun fichier ajouté.</p>}
    <ul>{files.map((file) => <li key={file.id}>
      {file.mimeType.startsWith("image/") && <p><img src={`${endpoint}/${file.id}?view=1`}
        alt={file.filename} loading="lazy" style={{ maxWidth: "100%", maxHeight: 360, objectFit: "contain" }} /></p>}
      <a href={`${endpoint}/${file.id}`}>Télécharger {file.filename}</a>{" "}
      <span>({Math.ceil(file.size / 1024)} Kio)</span>{" "}
      {canEdit && <button type="button" disabled={busy} onClick={() => void remove(file.id)}>Retirer</button>}
    </li>)}</ul>
    {canEdit && <form onSubmit={(event) => void upload(event)}>
      <p><label htmlFor={inputId}>Ajouter {kind === "project" ? "des captures" : "des fichiers"}</label></p>
      <input id={inputId} name="files" type="file" multiple required
        accept={kind === "project" ? ".jpg,.jpeg,.png,.webp" : ".jpg,.jpeg,.png,.webp,.pdf,.txt"}
        disabled={busy || files.length >= maxAttachments} />
      <p>{kind === "project" ? "JPEG, PNG ou WebP." : "JPEG, PNG, WebP, PDF ou texte UTF-8 (.txt)."}
        {" "}Trois fichiers au total, quatre Mio par fichier.
        {kind === "post" && " Ajout et retrait possibles pendant les quinze premières minutes."}</p>
      <button disabled={busy || files.length >= maxAttachments}>Ajouter</button>
    </form>}
  </section>;
}
