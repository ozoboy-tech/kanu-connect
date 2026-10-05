"use client";

import { useState, type FormEvent } from "react";

export default function ResendVerificationPage() {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/email-token", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: data.get("email"), purpose: "verify" }),
    });
    const result = await response.json();
    setMessage(result.message ?? result.error);
  }
  return <main><h1>Renvoyer le lien de vérification</h1>
    <form onSubmit={submit}>
      <label>Adresse e-mail<input name="email" type="email" required autoComplete="email" /></label>
      <button type="submit">Envoyer</button>
    </form>
    <p role="status">{message}</p>
  </main>;
}
