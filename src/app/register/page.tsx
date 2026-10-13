"use client";

import { useState, type FormEvent } from "react";
import { submitAuthRequest } from "@/shared/http/auth-request";

export default function RegisterPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage(""); setFailed(false);
    const fields = new FormData(event.currentTarget);
    try {
      const result = await submitAuthRequest("/api/register", {
        email: fields.get("email"), password: fields.get("password"),
        legalName: fields.get("legalName"), handle: fields.get("handle"),
      });
      setMessage(result.message);
      setFailed(!result.ok);
    } finally { setBusy(false); }
  }
  return <main><h1>Créer un compte</h1>
    <form onSubmit={submit} aria-busy={busy}>
      <fieldset className="editor-fields" disabled={busy}>
        <label>Nom légal (privé)<input name="legalName" required minLength={2} maxLength={160} /></label>
        <label>Pseudo public (facultatif)<input name="handle" minLength={3} maxLength={30} pattern="[a-z0-9_]{3,30}" /></label>
        <label>Adresse e-mail<input type="email" name="email" required autoComplete="email" /></label>
        <label>Mot de passe (12 caractères minimum)
          <input type="password" name="password" required minLength={12} autoComplete="new-password" />
        </label>
        <button type="submit" disabled={busy}>{busy ? "Création…" : "Créer le compte"}</button>
      </fieldset>
    </form>
    <p role={failed ? "alert" : "status"}>{message}</p>
    <p><a href="/resend-verification">Renvoyer le lien de vérification</a></p>
    <a href="/api/auth/signin">Déjà inscrit ? Se connecter</a>
  </main>;
}
