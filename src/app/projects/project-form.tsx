"use client";

import { useState, type FormEvent } from "react";

import type { PublicProject } from "@/server/projects/project-repository";

export default function ProjectForm({ initial }: { initial?: PublicProject }) {
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const input = {
      title: form.get("title"), summary: form.get("summary"),
      description: form.get("description"), status: form.get("status"),
      technologies: String(form.get("technologies") ?? "")
        .split(",").map((item) => item.trim()).filter(Boolean),
      repositoryUrl: String(form.get("repositoryUrl") ?? "").trim() || null,
      demoUrl: String(form.get("demoUrl") ?? "").trim() || null,
    };
    try {
      const response = await fetch(initial ? `/api/projects/${initial.id}` : "/api/projects", {
        method: initial ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Enregistrement impossible.");
        return;
      }
      window.location.assign(`/projects/${result.id}`);
    } catch { setMessage("Connexion impossible. Réessaie."); }
  }

  return <form onSubmit={submit}>
    <p><label>Nom du projet<br /><input name="title" required maxLength={160}
      defaultValue={initial?.title ?? ""} /></label></p>
    <p><label>Résumé<br /><input name="summary" required maxLength={300}
      defaultValue={initial?.summary ?? ""} /></label></p>
    <p><label>Description<br /><textarea name="description" required maxLength={6000}
      defaultValue={initial?.description ?? ""} /></label></p>
    <p><label>Avancement<br /><select name="status" defaultValue={initial?.status ?? "idea"}>
      <option value="idea">Idée</option>
      <option value="building">En cours</option>
      <option value="live">Disponible</option>
    </select></label></p>
    <p><label>Technologies (1 à 8, séparées par des virgules)<br />
      <input name="technologies" required
        defaultValue={initial?.technologies.join(", ") ?? ""} /></label></p>
    <p><label>Lien du dépôt HTTPS (facultatif)<br />
      <input name="repositoryUrl" type="url" maxLength={500}
        defaultValue={initial?.repositoryUrl ?? ""} /></label></p>
    <p><label>Lien de démonstration HTTPS (facultatif)<br />
      <input name="demoUrl" type="url" maxLength={500}
        defaultValue={initial?.demoUrl ?? ""} /></label></p>
    <button type="submit">{initial ? "Enregistrer" : "Présenter mon projet"}</button>
    <p role="status">{message}</p>
  </form>;
}
