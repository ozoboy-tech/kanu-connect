"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import VoteButton from "@/app/components/vote-button";

interface CommentItem {
  id: string;
  parentId: string | null;
  authorId: string | null;
  authorHandle: string | null;
  body: string;
  depth: number;
  createdAt: string;
  deleted: boolean;
}

interface SolutionState {
  commentId: string | null;
  resolved: boolean;
  votes: number;
}

export default function Comments({
  postId, viewerId, canWrite, isQuestion, canResolve,
}: {
  postId: string;
  viewerId: string | null;
  canWrite: boolean;
  isQuestion: boolean;
  canResolve: boolean;
}) {

  const [items, setItems] = useState<CommentItem[]>([]);
  const [message, setMessage] = useState("");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [solution, setSolution] = useState<SolutionState | null>(null);

  const reloadSolution = useCallback(async () => {
    if (!isQuestion) return;
    const response = await fetch(
      `/api/posts/${postId}/solution`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error("Solution indisponible.");
    }
    setSolution(await response.json() as SolutionState);
  }, [postId, isQuestion]);

  const reload = useCallback(async () => {

    const response = await fetch(`/api/posts/${postId}/comments`, { cache: "no-store" });
    if (!response.ok) throw new Error("Chargement impossible.");
    setItems(await response.json());
  }, [postId]);

  useEffect(() => {
    void reload().catch(
      () => setMessage("Commentaires indisponibles."),
    );
    void reloadSolution().catch(
      () => setMessage("Solution indisponible."),
    );
  }, [reload, reloadSolution]);

  async function toggleResolved() {
    if (!solution) return;
    try {
      const response = await fetch(`/api/posts/${postId}/solution`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolved: !solution.resolved }),
      });
      if (!response.ok) {
        setMessage(
          (await response.json()).error ?? "Action impossible.",
        );
        return;
      }
      setSolution(await response.json() as SolutionState);
      setMessage("");
    } catch {
      setMessage("Connexion impossible. Réessaie.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ body, parentId: replyTo }),
      });
      if (!response.ok) {
        setMessage((await response.json()).error ?? "Envoi impossible.");
        return;
      }
      setBody("");
      setReplyTo(null);
      setMessage("");
      await reload();
    } catch { setMessage("Connexion impossible. Réessaie."); }
  }

  async function saveEdit(id: string) {
    try {
      const response = await fetch(`/api/posts/${postId}/comments/${id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: editBody }),
      });
      if (!response.ok) {
        setMessage((await response.json()).error ?? "Modification impossible.");
        return;
      }
      setEditing(null);
      setMessage("");
      await reload();
    } catch { setMessage("Connexion impossible. Réessaie."); }
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer ce commentaire ?")) return;
    try {
      const response = await fetch(`/api/posts/${postId}/comments/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setMessage((await response.json()).error ?? "Suppression impossible.");
        return;
      }
      setMessage("");
      await reload();
      await reloadSolution();
    } catch { setMessage("Connexion impossible. Réessaie."); }
  }

  const known = new Set(items.map((item) => item.id));
  const children = new Map<string | null, CommentItem[]>();
  for (const item of items) {
    const parent = item.parentId && known.has(item.parentId) ? item.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), item]);
  }

  function render(parentId: string | null): ReactNode {
    return (children.get(parentId) ?? []).map((item) => {
      const mayEdit = !item.deleted && viewerId === item.authorId &&
        Date.now() - new Date(item.createdAt).getTime() < 15 * 60_000;
      return <li key={item.id}>
        <p>{item.deleted ? "Contenu supprimé" : <>
          <a href={`/u/${item.authorHandle}`}>@{item.authorHandle}</a> :{" "}
          <span style={{ whiteSpace: "pre-wrap" }}>{item.body}</span>
        </>}</p>
        {!item.deleted && <VoteButton kind="comment" id={item.id}
          viewerId={viewerId} authorId={item.authorId}
          canVote={canWrite}
          onChanged={() => void reloadSolution().catch(
            () => setMessage("Solution indisponible."),
          )} />}
        {!item.deleted && solution?.commentId === item.id &&
          <strong> Solution de la communauté · {solution.votes} votes</strong>}

        {canWrite && item.depth < 4 &&
          <button type="button" onClick={() => setReplyTo(item.id)}>Répondre</button>}
        {mayEdit && <>
          <button type="button" onClick={() => {
            setEditing(item.id); setEditBody(item.body);
          }}>Modifier</button>
          <button type="button" onClick={() => void remove(item.id)}>Supprimer</button>
        </>}
        {editing === item.id && <div>
          <textarea value={editBody} maxLength={2000}
            onChange={(event) => setEditBody(event.target.value)} />
          <button type="button" onClick={() => void saveEdit(item.id)}>Enregistrer</button>
          <button type="button" onClick={() => setEditing(null)}>Annuler</button>
        </div>}
        <ul>{render(item.id)}</ul>
      </li>;
    });
  }

  return <section aria-label="Commentaires">
    <h2>Commentaires et réponses</h2>
    {isQuestion && <p>
      Question {solution?.resolved ? "résolue" : "ouverte"}.
      {canResolve && solution && <button type="button"
        onClick={() => void toggleResolved()}>
        {solution.resolved
          ? "Rouvrir la question"
          : "Marquer comme résolue"}
      </button>}
    </p>}
    {items.length === 0 && <p>Pas encore de commentaire.</p>}
    <ul>{render(null)}</ul>
    {canWrite && <form onSubmit={submit}>
      <label>{replyTo ? "Répondre au commentaire" : "Ajouter un commentaire"}<br />
        <textarea value={body} maxLength={2000} required
          onChange={(event) => setBody(event.target.value)} />
      </label>
      <button type="submit">Envoyer</button>
      {replyTo && <button type="button" onClick={() => setReplyTo(null)}>Annuler la réponse</button>}
    </form>}
    {!viewerId && !canWrite && <p>Connecte-toi pour participer.</p>}
    <p role="status">{message}</p>
  </section>;
}
