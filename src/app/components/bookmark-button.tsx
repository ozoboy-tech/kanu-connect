"use client";

import { useEffect, useState } from "react";
import type { BookmarkKind } from "@/modules/bookmarks/domain/bookmark-input";

export default function BookmarkButton({ kind, id, canSave }: {
  kind: BookmarkKind; id: string; canSave: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const endpoint = `/api/bookmarks/${kind}/${id}`;
  useEffect(() => {
    if (!canSave) { setBusy(false); return; }
    const controller = new AbortController();
    setBusy(true); setSaved(false); setError("");
    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Lecture impossible.");
        if (!controller.signal.aborted) setSaved(Boolean(result.saved));
      }).catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Lecture impossible.");
      }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [endpoint, canSave]);
  async function change() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: saved ? "DELETE" : "PUT" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Enregistrement impossible.");
      setSaved(Boolean(result.saved));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Connexion impossible."); }
    finally { setBusy(false); }
  }
  if (!canSave) return <p><a href={`/api/auth/signin?callbackUrl=${encodeURIComponent(`/${kind === "post" ? "posts" : "projects"}/${id}`)}`}>Connecte-toi</a>
    {" et complète ton profil pour enregistrer ce contenu."}</p>;
  return <div>
    <button type="button" onClick={change} disabled={busy} aria-pressed={saved}>
      {busy ? "Chargement…" : saved ? "Retirer des enregistrements" : "Enregistrer"}
    </button>{" "}<a href="/saved">Mes enregistrements</a>
    {error && <p role="alert">{error}</p>}
  </div>;
}