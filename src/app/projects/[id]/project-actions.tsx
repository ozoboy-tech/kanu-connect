"use client";

import { useState } from "react";

export default function ProjectActions({ id }: { id: string }) {
  const [message, setMessage] = useState("");

  async function remove() {
    if (!window.confirm("Supprimer ce projet ?")) return;
    try {
      const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!response.ok) {
        setMessage((await response.json()).error ?? "Suppression impossible.");
        return;
      }
      window.location.assign("/projects");
    } catch { setMessage("Connexion impossible. Réessaie."); }
  }

  return <div>
    <a href={`/projects/${id}/edit`}>Modifier mon projet</a>{" · "}
    <button type="button" onClick={() => void remove()}>Supprimer</button>
    <p role="status">{message}</p>
  </div>;
}
