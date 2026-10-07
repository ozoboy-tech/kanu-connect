"use client";
import { useEffect, useState } from "react";
import type { VoteKind, VoteState } from
  "@/server/votes/vote-repository";

export default function VoteButton({
  kind, id, viewerId, authorId, canVote,
}: {
  kind: VoteKind;
  id: string;
  viewerId: string | null;
  authorId: string | null;
  canVote: boolean;
}) {
  const [state, setState] = useState<VoteState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const url = `/api/votes/${kind}/${id}`;

  useEffect(() => {
    let mounted = true;
    void fetch(url, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<VoteState>;
      })
      .then((vote) => { if (mounted) setState(vote); })
      .catch(() => {
        if (mounted) setError("Votes indisponibles.");
      });
    return () => { mounted = false; };
  }, [url]);

  const allowed = canVote && !!viewerId && viewerId !== authorId;

  async function toggle() {
    if (!state || !allowed || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, {
        method: state.voted ? "DELETE" : "PUT",
      });
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        setError(payload.error ?? "Vote impossible.");
        return;
      }
      setState(await response.json() as VoteState);
    } catch {
      setError("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return <span>
    <button type="button" aria-pressed={state?.voted ?? false}
      disabled={!allowed || !state || busy}
      onClick={() => void toggle()}>
      {state?.voted ? "Retirer mon vote" : "Voter"} · {state?.count ?? "…"}
    </button>
    {!viewerId && <small> Connecte-toi pour voter.</small>}
    {viewerId === authorId && <small> Ton contenu.</small>}
    {error && <small role="status"> {error}</small>}
  </span>;
}
