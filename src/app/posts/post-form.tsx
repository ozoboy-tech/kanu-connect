"use client";

import { useEffect, useState, type FormEvent } from "react";
import { languages } from "@/modules/posts/domain/post-input";
import type { PublicPost } from "@/server/posts/post-repository";
import {
  opportunityCategories,
  opportunityLabels,
} from "@/modules/opportunities/domain/opportunity-input";

const kinds = [
  ["question", "Question"], ["tip", "Partage / astuce"],
  ["project", "Projet"], ["opportunity", "Opportunité"],
  ["tutorial", "Tutoriel"], ["announcement", "Annonce"],
];

const spaces = [
  ["questions", "Questions"], ["sharing", "Partages / astuces"],
  ["projects", "Projets"], ["opportunities", "Opportunités"],
];

export default function PostForm({
  initial,
  startAsOpportunity = false,
}: {
  initial?: PublicPost;
  startAsOpportunity?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState(
    initial?.kind ?? (startAsOpportunity ? "opportunity" : "question"),
  );
  const [space, setSpace] = useState(
    initial?.space === "opportunities"
      ? "questions"
      : initial?.space ?? "questions",
  );

  const isOpportunity = kind === "opportunity";
  const [localDeadline, setLocalDeadline] = useState("");

  useEffect(() => {
    const deadline = initial?.opportunity?.deadline;
    if (!deadline) return;

    const date = new Date(deadline);

    setLocalDeadline(
      new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
        .toISOString().slice(0, 16),
    );
  }, [initial?.opportunity?.deadline]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") ?? "").trim();
    const deadlineDate = isOpportunity
      ? new Date(String(form.get("deadline")))
      : null;

    if (
      deadlineDate &&
      (!Number.isFinite(deadlineDate.getTime()) ||
        deadlineDate.getTime() <= Date.now())
    ) {
      setMessage("Choisis une date limite future.");
      return;
    }

    const input = {
      kind,
      space: isOpportunity ? "opportunities" : space,
      title: form.get("title"),
      body: form.get("body"),
      code: code || null,
      codeLanguage: code ? form.get("codeLanguage") : null,
      keywords: String(form.get("keywords") ?? "")
        .split(",").map((keyword) => keyword.trim()).filter(Boolean),
      opportunity: isOpportunity ? {
        category: form.get("category"),
        deadline: deadlineDate!.toISOString(),
        applyUrl: form.get("applyUrl"),
      } : null,
    };

    try {
      const response = await fetch(
        initial ? `/api/posts/${initial.id}` : "/api/posts",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Enregistrement impossible.");
        return;
      }

      window.location.assign(`/posts/${result.id}`);
    } catch {
      setMessage("Connexion impossible. Réessaie.");
    }
  }

  return <form onSubmit={submit}>
    <p><label>Type<br />
      <select name="kind" value={kind}
        onChange={(event) => setKind(event.target.value)}>
        {kinds.map(([value, label]) =>
          <option key={value} value={value}>{label}</option>)}
      </select>
    </label></p>

    <p><label>Espace<br />
      <select name="space"
        value={isOpportunity ? "opportunities" : space}
        disabled={isOpportunity}
        onChange={(event) => setSpace(event.target.value)}>
        {spaces.map(([value, label]) => <option
          key={value}
          value={value}
          disabled={value === "opportunities" && !isOpportunity}>
          {label}
        </option>)}
      </select>
    </label></p>

    {isOpportunity && <fieldset>
      <legend>Informations de l’opportunité</legend>

      <p><label>Catégorie<br />
        <select name="category" required
          defaultValue={initial?.opportunity?.category ?? "frontend"}>
          {opportunityCategories.map((category) =>
            <option key={category} value={category}>
              {opportunityLabels[category]}
            </option>)}
        </select>
      </label></p>

      <p><label>Date limite (heure de ton appareil)<br />
        <input type="datetime-local" name="deadline" required
          value={localDeadline}
          onChange={(event) => setLocalDeadline(event.target.value)} />
      </label></p>

      <p><label>Lien externe pour postuler<br />
        <input type="url" name="applyUrl" required maxLength={500}
          placeholder="https://exemple.com/candidature"
          defaultValue={initial?.opportunity?.applyUrl ?? ""} />
      </label></p>
    </fieldset>}

    <p><label>Titre<br />
      <input name="title" required maxLength={160}
        defaultValue={initial?.title ?? ""} />
    </label></p>

    <p><label>Texte<br />
      <textarea name="body" required maxLength={6000}
        defaultValue={initial?.body ?? ""} />
    </label></p>

    <p><label>Mots-clés (1 à 5, séparés par des virgules)<br />
      <input name="keywords" required
        defaultValue={initial?.keywords.join(", ") ?? ""} />
    </label></p>

    <p><label>Code (facultatif)<br />
      <textarea name="code" maxLength={6000}
        defaultValue={initial?.code ?? ""} />
    </label></p>

    <p><label>Langage du code<br />
      <select name="codeLanguage"
        defaultValue={initial?.codeLanguage ?? "typescript"}>
        {languages.map((language) =>
          <option key={language} value={language}>{language}</option>)}
      </select>
    </label></p>

    <button type="submit">{initial ? "Enregistrer" : "Publier"}</button>
    <p role="status">{message}</p>
  </form>;
}
