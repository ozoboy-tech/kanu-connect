"use client";

import { useState, type FormEvent } from "react";

import type { PublicProject } from "@/server/projects/project-repository";
import { projectLabels, projectStatuses, type ProjectRole } from "@/modules/projects/domain/project-input";

export default function ProjectForm({ initial }: { initial?: PublicProject }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<ProjectRole[]>(initial?.roles ?? []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setMessage("");
    const form = new FormData(event.currentTarget);
    const input = {
      title: form.get("title"), summary: form.get("summary"),
      description: form.get("description"), status: form.get("status"),
      technologies: String(form.get("technologies") ?? "")
        .split(",").map((item) => item.trim()).filter(Boolean),
      repositoryUrl: String(form.get("repositoryUrl") ?? "").trim() || null,
      demoUrl: String(form.get("demoUrl") ?? "").trim() || null,
      roles,
    };
    if (input.status === "live" && !input.demoUrl) {
      setMessage("Ajoute une démonstration HTTPS pour marquer le projet terminé."); return;
    }
    setBusy(true);
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
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} aria-busy={busy}>
    <fieldset disabled={busy} style={{ border: 0, padding: 0 }}>
    <p><label>Nom du projet<br /><input name="title" required maxLength={160}
      defaultValue={initial?.title ?? ""} /></label></p>
    <p><label>Résumé<br /><input name="summary" required maxLength={300}
      defaultValue={initial?.summary ?? ""} /></label></p>
    <p><label>Description<br /><textarea name="description" required maxLength={6000}
      defaultValue={initial?.description ?? ""} /></label></p>
    <p><label>Avancement<br /><select name="status" defaultValue={initial?.status ?? "idea"}>
      {projectStatuses.map((status) => <option key={status} value={status}>{projectLabels[status]}</option>)}
    </select></label></p>
    <p><label>Technologies (1 à 8, séparées par des virgules)<br />
      <input name="technologies" required
        defaultValue={initial?.technologies.join(", ") ?? ""} /></label></p>
    <p><label>Lien du dépôt HTTPS (facultatif)<br />
      <input name="repositoryUrl" type="url" maxLength={500}
        defaultValue={initial?.repositoryUrl ?? ""} /></label></p>
    <p><label>Lien de démonstration HTTPS (requis pour un projet terminé)<br />
      <input name="demoUrl" type="url" maxLength={500}
        defaultValue={initial?.demoUrl ?? ""} /></label></p>
    <h2>Rôles recherchés</h2>
    <p>Huit rôles maximum. Tu peux modifier les besoins et marquer les rôles pourvus.</p>
    {roles.map((role, index) => <div key={index}>
      <p><label>Rôle {index + 1}{" "}<input required maxLength={64} value={role.label}
        onChange={(event) => setRoles((current) => current.map((item, position) => position === index ? { ...item, label: event.target.value } : item))} /></label>{" "}
        <label><input type="checkbox" checked={role.filled}
          onChange={(event) => setRoles((current) => current.map((item, position) => position === index ? { ...item, filled: event.target.checked } : item))} /> Pourvu</label>{" "}
        <button type="button" onClick={() => setRoles((current) => current.filter((_, position) => position !== index))}>Retirer ce rôle</button></p>
    </div>)}
    <button type="button" disabled={roles.length >= 8} onClick={() => setRoles((current) => [...current, { label: "", filled: false }])}>Ajouter un rôle</button>
    <p>Après enregistrement, tu peux ajouter les captures depuis la fiche du projet.</p>
    <button type="submit">{busy ? "Enregistrement…" : initial ? "Enregistrer" : "Présenter mon projet"}</button>
    </fieldset>
    <p role="status">{message}</p>
  </form>;
}
