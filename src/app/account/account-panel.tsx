"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

type State = { status: string; role: string; blocks: string[] };

export default function AccountPanel() {
  const [state, setState] = useState<State | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/me/account", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Compte indisponible.");
        setState(await response.json() as State);
      }).catch(() => setMessage("Impossible de charger le compte."));
  }, []);

  async function act(path: "deactivate" | "delete") {
    if (busy) return;
    if (path === "deactivate" && !window.confirm("Désactiver le compte ? Une connexion le réactivera.")) return;
    if (path === "delete" && !window.confirm("Suppression définitive : confirmer ?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/me/account/${path}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation, password }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Action impossible.");
      await signOut({ callbackUrl: "/" });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action impossible."); }
    finally { setBusy(false); }
  }

  async function unblock(handle: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/members/${handle}/block`, { method: "DELETE" });
      if (!response.ok) throw new Error("Déblocage impossible.");
      setState((current) => current ? { ...current,
        blocks: current.blocks.filter((name) => name !== handle) } : current);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action impossible."); }
    finally { setBusy(false); }
  }

  return <>
    <p role="status">{message}</p>
    {state && <>
      <p>État : {state.status} · Rôle : {state.role}</p>
      <section><h2>Membres bloqués</h2>
        {state.blocks.length === 0 && <p>Aucun membre bloqué.</p>}
        <ul>{state.blocks.map((handle) => <li key={handle}>@{handle}{" "}
          <button type="button" disabled={busy} onClick={() => void unblock(handle)}>
            Débloquer</button></li>)}</ul>
      </section>
      <section><h2>Désactiver</h2>
        <p>Le profil est mis en pause. Se reconnecter le réactive.</p>
        <button type="button" disabled={busy} onClick={() => void act("deactivate")}>
          Désactiver mon compte</button>
      </section>
      <section><h2>Supprimer définitivement</h2>
        <p>Action irréversible : identifiants et données privées effacés ;
          les publications deviennent des tombstones afin de conserver les réponses.</p>
        <p><label>Écris SUPPRIMER MON COMPTE<br />
          <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </label></p>
        <p><label>Mot de passe (si le compte en possède un)<br />
          <input type="password" value={password}
            onChange={(event) => setPassword(event.target.value)} /></label></p>
        <button type="button" disabled={busy || confirmation !== "SUPPRIMER MON COMPTE"}
          onClick={() => void act("delete")}>Supprimer définitivement mon compte</button>
      </section>
    </>}
  </>;
}
