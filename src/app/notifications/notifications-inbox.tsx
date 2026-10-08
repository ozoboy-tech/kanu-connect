"use client";

import { useState } from "react";
import type { NotificationPage } from "@/modules/notifications/domain/notification-input";

const labels = {
  request: "a envoyé une demande de collaboration",
  accepted: "a accepté ta demande de collaboration",
  rejected: "a refusé ta demande de collaboration",
  discussion: "a envoyé un message dans la discussion",
  publication: "a publié un nouveau contenu",
  reply: "t’a répondu",
  mention: "t’a mentionné dans un contenu",

};

export default function NotificationsInbox({ initialPage }: { initialPage: NotificationPage }) {
  const [data, setData] = useState<NotificationPage | null>(initialPage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endpoint = "/api/notifications";

  async function check(response: Response) {
    const body = await response.json();
    if (!response.ok) {
      if ([401, 403].includes(response.status)) setData(null);
      throw new Error(body.error ?? "Action impossible.");
    }
    return body;
  }

  async function read(cursor: string | null = null): Promise<NotificationPage> {
    const url = endpoint + (cursor ? `?before=${encodeURIComponent(cursor)}` : "");
    return check(await fetch(url, { cache: "no-store" }));
  }

  async function load(older = false) {
    if (busy || (older && !data?.nextCursor)) return;
    setBusy(true); setError("");
    try {
      const next = await read(older ? data!.nextCursor : null);
      setData(older && data
        ? { ...next, notifications: [...data.notifications, ...next.notifications] }
        : next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Lecture impossible.");
    } finally { setBusy(false); }
  }

  async function markRead(id: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await check(await fetch(endpoint, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }));
      setData(await read());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action impossible.");
    } finally { setBusy(false); }
  }

  return <section aria-label="Notifications" aria-busy={busy}>
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={busy} onClick={() => void load()}>Actualiser</button>
    {busy && <p role="status">Chargement…</p>}
    {data && <>
      <p aria-live="polite">Notifications non lues : {data.unreadCount}</p>
      {data.notifications.length === 0 && <p>Aucune notification pour le moment.</p>}
      <ul>{data.notifications.map((item) => <li key={item.id}>
        <p><strong>{item.readAt ? "Lue" : "Non lue"}</strong>{" — "}
          @{item.actorHandle} {labels[item.kind]}.</p>
        <p>{"projectId" in item ? <a
          href={`/projects/${item.projectId}${item.kind === "discussion" ? "/discussion" : ""}`}>
          {item.projectTitle}
        </a> : <a href={`/posts/${item.postId}`}>{item.postTitle}</a>}</p>
        <p><time dateTime={item.createdAt}>
          {item.createdAt.slice(0, 19).replace("T", " ")} UTC
        </time></p>
        {!item.readAt && <button type="button" disabled={busy}
          onClick={() => void markRead(item.id)}>Marquer comme lue</button>}
      </li>)}</ul>
      {data.nextCursor && <button type="button" disabled={busy}
        onClick={() => void load(true)}>Afficher les notifications précédentes</button>}
    </>}
  </section>;
}
