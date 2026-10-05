"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password: data.get("password") }),
    });
    const result = await response.json();
    setMessage(result.message ?? result.error);
  }
  return <main><h1>Réinitialiser le mot de passe</h1>
    <form onSubmit={submit}>
      <label>Nouveau mot de passe (12 caractères minimum)
        <input type="password" name="password" minLength={12} required autoComplete="new-password" />
      </label>
      <button type="submit" disabled={!token}>Enregistrer</button>
    </form>
    <p role="status">{message}</p>
  </main>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<p>Chargement…</p>}><ResetForm /></Suspense>;
}
