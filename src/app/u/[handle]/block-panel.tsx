"use client";

import { useState } from "react";

export default function BlockPanel({ handle }: { handle: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function block() {
    if (!window.confirm(`Bloquer @${handle} et retirer les abonnements mutuels ?`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/members/${handle}/block`, { method: "PUT" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Blocage impossible.");
      window.location.assign("/account");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Blocage impossible."); }
    finally { setBusy(false); }
  }
  return <section><button type="button" disabled={busy} onClick={() => void block()}>
    Bloquer ce membre</button><p role="status">{message}</p></section>;
}
