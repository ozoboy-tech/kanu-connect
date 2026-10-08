"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CollaborationDecision, CollaborationState,
} from "@/modules/projects/domain/collaboration-input";

const labels = {
  pending: "En attente", accepted: "Acceptée", rejected: "Refusée",
};

export default function ProjectCollaboration({ projectId, viewerId, onboarded }: {
  projectId: string; viewerId: string | null; onboarded: boolean;
}) {
  const [data, setData] = useState<CollaborationState | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/projects/${projectId}/collaboration`;

  const read = useCallback(async (cursor: string | null = null, signal?: AbortSignal) => {
    const url = endpoint + (cursor ? `?before=${encodeURIComponent(cursor)}` : "");
    const response = await fetch(url, { cache: "no-store", signal });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Lecture impossible.");
    return body as CollaborationState;
  }, [endpoint]);

  useEffect(() => {
    if (!viewerId || !onboarded) return;
    const controller = new AbortController();
    setData(null);
    setError("");
    setBusy(true);
    read(null, controller.signal).then(setData).catch((reason: unknown) => {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : "Lecture impossible.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setBusy(false);
    });
    return () => controller.abort();
  }, [read, viewerId, onboarded]);

  async function send(decision?: CollaborationDecision, memberId?: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: decision ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(decision ? { memberId, decision } : { message }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Action impossible.");
      setData(await read());
      setMessage("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action impossible.");
    } finally { setBusy(false); }
  }

  async function more() {
    if (!data?.nextCursor) return;
    setBusy(true);
    setError("");
    try {
      const next = await read(data.nextCursor);
      setData({ ...next, requests: [...data.requests, ...next.requests] });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Lecture impossible.");
    } finally { setBusy(false); }
  }

  if (!viewerId) return <section>
    <h2>Collaborer sur ce projet</h2>
    <a href="/api/auth/signin">Se connecter pour proposer son aide</a>
  </section>;
  if (!onboarded) return <p><a href="/onboarding">Compléter mon profil pour participer</a></p>;

  return <section aria-busy={busy}>
    <h2>{data?.isOwner ? "Demandes de collaboration" : "Ma demande de collaboration"}</h2>
    {error && <p role="alert">{error}</p>}
    {busy && <p role="status">Chargement…</p>}
    {data && <>
      {data.isOwner && data.requests.length === 0 && <p>Aucune demande pour le moment.</p>}
      {!data.isOwner && data.requests.length === 0 && <form onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}>
        <label htmlFor="collaboration-message">Comment souhaites-tu contribuer ?</label>
        <textarea id="collaboration-message" required maxLength={1000}
          value={message} onChange={(event) => setMessage(event.target.value)}
          disabled={busy} />
        <p>Ton message est visible par le créateur du projet. 1 000 caractères maximum.</p>
        <button disabled={busy || !message.trim()}>Je suis intéressé</button>
      </form>}
      <ul>{data.requests.map((request) => <li key={request.memberId}>
        {data.isOwner && <a href={`/u/${request.handle}`}>@{request.handle}</a>}
        <p style={{ whiteSpace: "pre-wrap" }}>{request.message}</p>
        <p>Statut : {labels[request.status]}</p>
        {data.isOwner && request.status === "pending" && <>
          <button type="button" disabled={busy}
            onClick={() => void send("accepted", request.memberId)}>Accepter</button>{" "}
          <button type="button" disabled={busy}
            onClick={() => void send("rejected", request.memberId)}>Refuser</button>
        </>}
      </li>)}</ul>
      {data.nextCursor && <button type="button" disabled={busy}
        onClick={() => void more()}>Afficher les demandes suivantes</button>}
    </>}
  </section>;
}
