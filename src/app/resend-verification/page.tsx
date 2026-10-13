"use client";

import { useState, type FormEvent } from "react";
import { submitAuthRequest } from "@/shared/http/auth-request";

export default function ResendVerificationPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage(""); setFailed(false);
    const data = new FormData(event.currentTarget);
    try {
      const result = await submitAuthRequest("/api/auth/email-token", {
        email: data.get("email"), purpose: "verify",
      });
      setMessage(result.message);
      setFailed(!result.ok);
    } finally { setBusy(false); }
  }
  return <main><h1>Renvoyer le lien de vérification</h1>
    <form onSubmit={submit} aria-busy={busy}>
      <fieldset className="editor-fields" disabled={busy}>
        <label>Adresse e-mail<input name="email" type="email" required autoComplete="email" /></label>
        <button type="submit" disabled={busy}>{busy ? "Envoi…" : "Envoyer"}</button>
      </fieldset>
    </form>
    <p role={failed ? "alert" : "status"}>{message}</p>
    <a href="/api/auth/signin">Retour à la connexion</a>
  </main>;
}
