"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { submitAuthRequest } from "@/shared/http/auth-request";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !token) return;
    setBusy(true); setMessage(""); setFailed(false);
    const data = new FormData(event.currentTarget);
    try {
      const result = await submitAuthRequest("/api/auth/reset-password", {
        token, password: data.get("password"),
      });
      setMessage(result.message);
      setFailed(!result.ok);
    } finally { setBusy(false); }
  }
  return <main><h1>Réinitialiser le mot de passe</h1>
    {!token && <p role="alert">Le lien est incomplet. <a href="/forgot-password">Demander un nouveau lien</a>.</p>}
    <form onSubmit={submit} aria-busy={busy}>
      <fieldset className="editor-fields" disabled={busy || !token}>
      <label>Nouveau mot de passe (12 caractères minimum)
        <input type="password" name="password" minLength={12} required autoComplete="new-password" />
      </label>
      <button type="submit" disabled={busy || !token}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
      </fieldset>
    </form>
    <p role={failed ? "alert" : "status"}>{message}</p>
    <a href="/api/auth/signin">Se connecter</a>
  </main>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<p role="status">Chargement…</p>}><ResetForm /></Suspense>;
}
