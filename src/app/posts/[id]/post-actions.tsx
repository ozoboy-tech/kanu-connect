"use client";

import { useState } from "react";

export default function PostActions({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  async function remove() {
    if (!window.confirm("Supprimer cette publication ?")) return;
    try {
      const response = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (response.ok) window.location.assign(`/posts/${id}`);
      else {
        const result = await response.json();
        setMessage(result.error ?? "Suppression impossible.");
      }
    } catch { setMessage("Connexion impossible. Réessaie."); }
  }
  return <p><a href={`/posts/${id}/edit`}>Modifier</a>{" · "}
    <button type="button" onClick={remove}>Supprimer</button>
    <span role="status">{message}</span>
  </p>;
}
