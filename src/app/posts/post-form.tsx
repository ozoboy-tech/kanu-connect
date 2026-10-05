"use client";

import { useState, type FormEvent } from "react";

import { languages } from "@/modules/posts/domain/post-input";
import type { PublicPost } from "@/server/posts/post-repository";

const kinds = [
  ["question", "Question"], ["tip", "Partage / astuce"],
  ["project", "Projet"], ["opportunity", "Opportunité"],
  ["tutorial", "Tutoriel"], ["announcement", "Annonce"],
];
const spaces = [
  ["questions", "Questions"], ["sharing", "Partages / astuces"],
  ["projects", "Projets"], ["opportunities", "Opportunités"],
];

export default function PostForm({ initial }: { initial?: PublicPost }) {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") ?? "").trim();
    const input = {
      kind: form.get("kind"), space: form.get("space"),
      title: form.get("title"), body: form.get("body"),
      code: code || null,
      codeLanguage: code ? form.get("codeLanguage") : null,
      keywords: String(form.get("keywords") ?? "")
        .split(",").map((keyword) => keyword.trim()).filter(Boolean),
    };
    try {
      const response = await fetch(
        initial ? `/api/posts/${initial.id}` : "/api/posts",
        { method: initial ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input) },
      );
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Enregistrement impossible.");
        return;
      }
      window.location.assign(`/posts/${result.id}`);
    } catch { setMessage("Connexion impossible. Réessaie."); }
  }
  return <form onSubmit={submit}>
    <p><label>Type<br /><select name="kind" defaultValue={initial?.kind ?? "question"}>
      {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label></p>
    <p><label>Espace<br /><select name="space" defaultValue={initial?.space ?? "questions"}>
      {spaces.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label></p>
    <p><label>Titre<br /><input name="title" required maxLength={160}
      defaultValue={initial?.title ?? ""} /></label></p>
    <p><label>Texte<br /><textarea name="body" required maxLength={6000}
      defaultValue={initial?.body ?? ""} /></label></p>
    <p><label>Mots-clés (1 à 5, séparés par des virgules)<br />
      <input name="keywords" required
        defaultValue={initial?.keywords.join(", ") ?? ""} /></label></p>
    <p><label>Code (facultatif)<br /><textarea name="code" maxLength={6000}
      defaultValue={initial?.code ?? ""} /></label></p>
    <p><label>Langage du code<br /><select name="codeLanguage"
      defaultValue={initial?.codeLanguage ?? "typescript"}>
      {languages.map((language) =>
        <option key={language} value={language}>{language}</option>)}
    </select></label></p>
    <button type="submit">{initial ? "Enregistrer" : "Publier"}</button>
    <p role="status">{message}</p>
  </form>;
}