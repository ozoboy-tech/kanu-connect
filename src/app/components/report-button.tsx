"use client";

import { useEffect, useState } from "react";

import type {
  ReportKind,
  ReportReason,
} from "@/server/reports/report-rules";

export default function ReportButton({
  kind,
  id,
  viewerId,
  authorId,
  canReport,
  onHidden,
}: {
  kind: ReportKind;
  id: string;
  viewerId: string | null;
  authorId: string | null;
  canReport: boolean;
  onHidden?: () => void;
}) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [reported, setReported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const allowed = canReport &&
    !!viewerId &&
    viewerId !== authorId;
  const url = `/api/reports/${kind}/${id}`;

  useEffect(() => {
    if (!allowed) return;

    let mounted = true;

    void fetch(url, { cache: "no-store" })
      .then(async (response) => {
        if (response.ok && mounted) {
          const state = await response.json() as {
            reported: boolean;
          };
          if (mounted) setReported(state.reported);
        }
      })
      .catch(() => {
        if (mounted) {
          setMessage("Signalements indisponibles.");
        }
      });

    return () => {
      mounted = false;
    };
  }, [url, allowed]);

  async function submit() {
    if (!allowed || busy || reported) return;

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const result = await response.json() as {
          error?: string;
        };
        setMessage(result.error ?? "Signalement impossible.");
        return;
      }

      const state = await response.json() as {
        reported: boolean;
        hidden: boolean;
      };

      setReported(state.reported);
      setMessage("Signalement enregistré.");

      if (state.hidden) {
        if (onHidden) onHidden();
        else window.location.reload();
      }
    } catch {
      setMessage("Connexion impossible. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) return null;

  return <span>
    {!reported && <>
      <label>
        Motif du signalement{" "}
        <select value={reason}
          onChange={(event) => setReason(
            event.target.value as ReportReason,
          )}>
          <option value="spam">Spam</option>
          <option value="harassment">Harcèlement</option>
          <option value="inappropriate">
            Contenu inapproprié
          </option>
        </select>
      </label>
      <button type="button" disabled={busy}
        onClick={() => void submit()}>
        Signaler
      </button>
    </>}

    {reported && <small> Déjà signalé.</small>}
    {message && <small role="status"> {message}</small>}
  </span>;
}
