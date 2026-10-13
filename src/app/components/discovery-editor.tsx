"use client";

import { useState, type FormEvent } from "react";
import type { DiscoveryPreferences } from "@/modules/discovery/domain/discovery-input";

export default function DiscoveryEditor({ initial, welcome = false }: {
  initial: DiscoveryPreferences; welcome?: boolean;
}) {
  const [preferences, setPreferences] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showTour, setShowTour] = useState(false);
  async function save(value: DiscoveryPreferences) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/me/discovery", { method: "PUT",
        headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Enregistrement impossible.");
      setPreferences(result as DiscoveryPreferences);
      if (welcome) window.location.assign("/feed?feed=foryou");
      else setMessage("Préférences enregistrées.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Connexion impossible."); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await save({ ...preferences,
      topics: String(data.get("topics") ?? "").split(/[\s,;]+/u).filter(Boolean),
      remindersEnabled: data.get("remindersEnabled") === "on",
      welcomeCompleted: welcome || preferences.welcomeCompleted });
  }
  return <section>
    <h2>{welcome ? "Personnaliser mon arrivée" : "Catégories et rappels"}</h2>
    <p>Les catégories sont les mots-clés des publications : react, python, mysql… Tu peux n’en choisir aucune.</p>
    <form onSubmit={submit}>
      <p><label>Catégories suivies (20 maximum, séparées par une virgule)<br />
        <textarea name="topics" key={preferences.topics.join(",")}
          defaultValue={preferences.topics.join(", ")} maxLength={1000} disabled={busy} />
      </label></p>
      <p><label><input name="remindersEnabled" type="checkbox"
        defaultChecked={preferences.remindersEnabled} disabled={busy} /> Recevoir les rappels d’accueil Kanu</label></p>
      <button type="submit" disabled={busy}>{busy ? "Enregistrement…" : welcome ? "Commencer" : "Enregistrer mes préférences"}</button>
      {welcome && <>{" "}<button type="button" disabled={busy} onClick={() => save({
        ...preferences, welcomeCompleted: true, tourCompleted: true,
      })}>Passer l’accueil</button></>}
    </form>
    {welcome && <section aria-label="Visite guidée">
      <h2>Découvrir Kanu</h2>
      <button type="button" disabled={busy} onClick={() => setShowTour(true)}>Voir la visite</button>{" "}
      <button type="button" disabled={busy} onClick={() => {
        setShowTour(false); setPreferences({ ...preferences, tourCompleted: true });
      }}>Passer la visite</button>
      {showTour && <>
        <ol>
          <li><a href="/feed?feed=foryou">Pour vous</a> rassemble les contenus liés à tes centres d’intérêt.</li>
          <li><a href="/explore?kind=posts">Explorer</a> recherche publications, projets et membres.</li>
          <li>Le bouton Enregistrer garde les contenus dans ta <a href="/saved">liste privée</a>.</li>
        </ol>
        <button type="button" disabled={busy} onClick={() => {
          setShowTour(false); setPreferences({ ...preferences, tourCompleted: true });
        }}>Terminer la visite</button>
      </>}
      {preferences.tourCompleted && <p>Visite terminée ou passée. Tu peux commencer quand tu veux.</p>}
    </section>}
    <p role="status">{message}</p>
  </section>;
}