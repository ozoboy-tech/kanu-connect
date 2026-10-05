"use client";

import { useState, type FormEvent } from "react";

export default function RegisterPage() {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const response = await fetch("/api/register", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: fields.get("email"), password: fields.get("password"),
        legalName: fields.get("legalName"), handle: fields.get("handle"),
      }),
    });
    const result = await response.json();
    setMessage(result.message ?? result.error);
  }
  return <main><h1>Créer un compte</h1>
    <form onSubmit={submit}>
      <label>Nom légal (privé)<input name="legalName" required minLength={2} maxLength={160} /></label>
      <label>Pseudo public (facultatif)<input name="handle" minLength={3} maxLength={30} pattern="[a-z0-9_]{3,30}" /></label>
      <label>Adresse e-mail<input type="email" name="email" required autoComplete="email" /></label>
      <label>Mot de passe (12 caractères minimum)
        <input type="password" name="password" required minLength={12} autoComplete="new-password" />
      </label>
      <button type="submit">Créer le compte</button>
    </form>
    <p role="status">{message}</p>
    <a href="/resend-verification">Renvoyer le lien de vérification</a><br />
    <a href="/api/auth/signin">Déjà inscrit ? Se connecter</a>
  </main>;
}
