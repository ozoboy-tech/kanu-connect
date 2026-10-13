"use client";

import { useState, type FormEvent } from "react";
import { submitAuthRequest } from "@/shared/http/auth-request";

export default function OnboardingPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await submitAuthRequest("/api/auth/onboard", {
        legalName: data.get("legalName"), handle: data.get("handle"),
      });
      if (result.ok) window.location.assign("/welcome");
      else setMessage(result.message);
    } finally { setBusy(false); }
  }
  return <main><h1>Compléter le compte</h1>
    <form onSubmit={submit} aria-busy={busy}>
      <fieldset className="editor-fields" disabled={busy}>
        <label>Nom légal (privé)<input name="legalName" required minLength={2} maxLength={160} /></label>
        <label>Pseudo public (facultatif, généré si vide)
          <input name="handle" minLength={3} maxLength={30} pattern="[a-z0-9_]{3,30}" /></label>
        <button type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Terminer"}</button>
      </fieldset>
    </form>
    {message && <p role="alert">{message}</p>}
  </main>;
}
