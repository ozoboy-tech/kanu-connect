"use client";

import { useState } from "react";
import type { DiscussionPage } from "@/modules/projects/domain/discussion-input";

export default function ProjectDiscussion({ projectId, initialPage }: {
  projectId: string; initialPage: DiscussionPage;
}) {
  const [data, setData] = useState<DiscussionPage | null>(initialPage);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/projects/${projectId}/discussion`;

  async function check(response: Response) {
    const body = await response.json();
    if (!response.ok) {
      if ([401, 403, 404].includes(response.status)) setData(null);
      throw new Error(body.error ?? "Action impossible.");
    }
    return body;
  }

  async function read(cursor: string | null = null): Promise<DiscussionPage> {
    const url = endpoint + (cursor ? `?before=${encodeURIComponent(cursor)}` : "");
    return check(await fetch(url, { cache: "no-store" }));
  }

  async function load(older = false) {
    if (busy || (older && !data?.nextCursor)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await read(older ? data!.nextCursor : null);
      setData(older && data ? { ...next, messages: [...data.messages, ...next.messages] } : next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Lecture impossible.");
    } finally { setBusy(false); }
  }

  async function send() {
    if (busy || !data) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await check(await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      }));
      setMessage("");
      setNotice("Message envoyé.");
      setData(await read());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Envoi impossible.");
    } finally { setBusy(false); }
  }

  return <section aria-label="Messages du projet" aria-busy={busy}>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <button type="button" disabled={busy} onClick={() => void load()}>Actualiser</button>
    {busy && <p role="status">Chargement…</p>}
    {data && <>
      {data.nextCursor && <p><button type="button" disabled={busy}
        onClick={() => void load(true)}>Afficher les messages précédents</button></p>}
      {data.messages.length === 0 && <p>Aucun message pour le moment.</p>}
      <ol>{[...data.messages].reverse().map((item) => <li key={item.id}>
        <p><a href={`/u/${item.authorHandle}`}>@{item.authorHandle}</a>{" — "}
          <time dateTime={item.createdAt}>
            {item.createdAt.slice(0, 19).replace("T", " ")} UTC
          </time></p>
        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.body}</p>
      </li>)}</ol>
      <form onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <label htmlFor="discussion-message">Ton message</label>
        <textarea id="discussion-message" required maxLength={2000} rows={4}
          value={message} onChange={(event) => setMessage(event.target.value)}
          aria-describedby="discussion-limit" disabled={busy} />
        <p id="discussion-limit">{message.length} / 2 000 caractères. Texte uniquement.</p>
        <button disabled={busy || !message.trim()}>Envoyer</button>
      </form>
    </>}
  </section>;
}
