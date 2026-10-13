"use client";

import { useEffect, useState } from "react";

import type {
  ModerationItem,
  ModerationDecision,
} from "@/server/moderation/moderation-repository";

const labels = {
  post: "Publication",
  comment: "Commentaire",
  project: "Projet",
};

export default function ModerationQueue({
  items,
}: {
  items: ModerationItem[];
}) {
  const [notes, setNotes] = useState<
    Record<string, string>
  >({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/me/account", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as { role: string } : null)
      .then((account) => setIsAdmin(account?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  async function decide(
    item: ModerationItem,
    decision: ModerationDecision,
  ) {
    if (busy) return;

    const key = `${item.kind}:${item.id}`;
    setBusy(key);
    setMessage("");

    try {
      const response = await fetch(
        `/api/moderation/reports/${item.kind}/${item.id}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            decision,
            note: notes[key] ?? "",
          }),
        },
      );

      if (!response.ok) {
        const payload = await response.json() as {
          error?: string;
        };
        setMessage(
          payload.error ?? "Révision impossible.",
        );
        return;
      }

      window.location.reload();
    } catch {
      setMessage(
        "Connexion impossible. Réessaie.",
      );
    } finally {
      setBusy(null);
    }
  }

  return <section>
    {items.length === 0 &&
      <p>Aucun contenu signalé.</p>}

    <p role="status">{message}</p>

    <ul>
      {items.map((item) => {
        const key = `${item.kind}:${item.id}`;

        return <li key={key}>
          <h2>
            {labels[item.kind]} ·
            {" "}@{item.authorHandle}
          </h2>

          <p>{item.preview}</p>

          <p>
            {item.count} signalement(s) ·
            {" "}
            {item.hidden ? "Masqué" : "Visible"}
            {item.decision &&
              ` · Décision : ${
                item.decision === "hide"
                  ? "masquer"
                  : "rétablir"
              }`}
          </p>

          {item.note &&
            <p>Dernière note : {item.note}</p>}

          {!item.hidden &&
            <p><a href={item.url}>
              Voir le contenu
            </a></p>}

          <label>
            Motif de décision (obligatoire, 5 à 500 caractères)
            <br />
            <textarea
              maxLength={500}
              minLength={5}
              value={notes[key] ?? ""}
              onChange={(event) =>
                setNotes((previous) => ({
                  ...previous,
                  [key]: event.target.value,
                }))
              }
            />
          </label>

          <div>
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                void decide(item, "hide")
              }
            >
              Maintenir masqué
            </button>

            {isAdmin && <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                void decide(item, "restore")
              }
            >
              Rétablir (décision finale)
            </button>}
          </div>
        </li>;
      })}
    </ul>
  </section>;
}
