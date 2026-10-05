"use client";

import { useState, type FormEvent } from "react";

export default function OnboardingPage() {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/onboard", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ legalName: data.get("legalName"), handle: data.get("handle") }),
    });
    const result = await response.json();
    if (response.ok) window.location.assign("/");
    else setMessage(result.error);
  }
  return <main><h1>Compléter le compte</h1>
    <form onSubmit={submit}>
      <label>Nom légal (privé)<input name="legalName" required minLength={2} maxLength={160} /></label>
      <label>Pseudo public (facultatif, généré si vide)<input name="handle" minLength={3} maxLength={30} /></label>
      <button type="submit">Terminer</button>
    </form>
    <p role="alert">{message}</p>
  </main>;
}
