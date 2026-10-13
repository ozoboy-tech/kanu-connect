"use client";

import { useState } from "react";
import type { AccountRole } from "@/server/accounts/account-repository";

type Member = { id: string; handle: string; status: string; role: AccountRole;
  reason: string | null };
export default function AdminPanel({ members }: { members: Member[] }) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  async function act(member: Member, action: "suspend" | "restore" | "role", role?: AccountRole) {
    if (reason.trim().length < 5) { setMessage("Motif requis (5 caractères minimum)."); return; }
    if (!window.confirm(`${action} @${member.handle} ?`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/members/${member.id}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, role, reason }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Action impossible.");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action impossible."); }
    finally { setBusy(false); }
  }
  return <>
    <label>Motif consigné dans l’historique<br />
      <textarea minLength={5} maxLength={500} value={reason}
        onChange={(event) => setReason(event.target.value)} /></label>
    <p role="status">{message}</p>
    <ul>{members.map((member) => <li key={member.id}>
      @{member.handle} · {member.status} · {member.role}
      {member.reason && <span> · Motif de suspension : {member.reason}</span>}
      {member.role !== "admin" && <div>
        {member.status === "active" && <button type="button" disabled={busy}
          onClick={() => void act(member, "suspend")}>Suspendre</button>}
        {member.status === "suspended" && <button type="button" disabled={busy}
          onClick={() => void act(member, "restore")}>Réactiver</button>}
        {member.status === "active" && ["member", "moderator", "admin"].map((role) =>
          <button key={role} type="button" disabled={busy || member.role === role}
            onClick={() => void act(member, "role", role as AccountRole)}>
            Rôle {role}</button>)}
      </div>}
    </li>)}</ul>
  </>;
}
