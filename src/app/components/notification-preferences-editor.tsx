"use client";

import { useState } from "react";
import type { NotificationPreferences } from "@/modules/notifications/domain/notification-input";

const fields: { key: keyof NotificationPreferences; label: string }[] = [
  { key: "projectsEnabled", label: "Projets et collaboration" },
  { key: "communityEnabled", label: "Réponses, mentions et publications suivies" },
  { key: "opportunitiesEnabled", label: "Opportunités correspondant à mes catégories" },
  { key: "solutionsEnabled", label: "Une de mes réponses devient une solution" },
];

export default function NotificationPreferencesEditor({ initial }: {
  initial: NotificationPreferences;
}) {
  const [preferences, setPreferences] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/me/notifications", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Enregistrement impossible.");
      setPreferences(result as NotificationPreferences);
      setMessage("Préférences enregistrées. Elles s’appliquent aux prochaines notifications.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connexion impossible.");
    } finally { setBusy(false); }
  }

  return <form onSubmit={(event) => void save(event)} aria-busy={busy}>
    <h2>Notifications sur Kanu</h2>
    <p>Choisis les nouvelles notifications que tu veux recevoir dans ta boîte.</p>
    {fields.map(({ key, label }) => <p key={key}><label>
      <input type="checkbox" checked={preferences[key]} disabled={busy}
        onChange={(event) => setPreferences({ ...preferences, [key]: event.target.checked })} />
      {" "}{label}
    </label></p>)}
    <button type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer mes choix"}</button>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </form>;
}
