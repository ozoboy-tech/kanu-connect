"use client";

import { useState } from "react";

import type { FollowStats } from "@/server/members/follow-repository";

export default function FollowPanel({ handle, initial, canFollow }: {
  handle: string;
  initial: FollowStats;
  canFollow: boolean;
}) {
  const [stats, setStats] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function toggle() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/members/${handle}/follow`, {
        method: stats.isFollowing ? "DELETE" : "PUT",
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Action impossible.");
        return;
      }
      setStats(result as FollowStats);
    } catch { setMessage("Connexion impossible. Réessaie."); }
    finally { setBusy(false); }
  }

  return <section aria-label="Abonnements">
    <p>
      <a href={`/u/${handle}/followers`}>{stats.followerCount} abonnés</a>{" · "}
      <a href={`/u/${handle}/following`}>{stats.followingCount} abonnements</a>
    </p>
    {canFollow && <button type="button" disabled={busy}
      onClick={() => void toggle()}>
      {stats.isFollowing ? "Se désabonner" : "S’abonner"}
    </button>}
    <p role="status">{message}</p>
  </section>;
}
