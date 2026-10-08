"use client";

import { useState, type FormEvent } from "react";
import {
  opportunityCategories,
  opportunityLabels,
  type OpportunityCategory,
} from "@/modules/opportunities/domain/opportunity-input";

export default function CategoryPreferences({
  initial,
}: {
  initial: OpportunityCategory[];
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const categories = new FormData(event.currentTarget).getAll("categories");

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/me/opportunity-categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Enregistrement impossible.");
        return;
      }

      window.location.reload();
    } catch {
      setMessage("Connexion impossible. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit}>
    <fieldset disabled={busy}>
      <legend>Mes catégories suivies</legend>
      <p>
        Tu recevras les nouvelles opportunités de ces catégories
        dans tes notifications.
      </p>

      {opportunityCategories.map((category) => <p key={category}>
        <label>
          <input
            type="checkbox"
            name="categories"
            value={category}
            defaultChecked={initial.includes(category)}
          />{" "}
          {opportunityLabels[category]}
        </label>
      </p>)}

      <button type="submit">
        {busy ? "Enregistrement…" : "Enregistrer mes catégories"}
      </button>
    </fieldset>

    <p role="status">{message}</p>
  </form>;
}
