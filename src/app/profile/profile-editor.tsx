"use client";

import { useState, type FormEvent } from "react";

import type { OwnProfile } from "@/server/members/profile-repository";
import { PageHeading } from "@/app/components/ui";

export default function ProfileEditor({ initial }: { initial: OwnProfile }) {
  const [profile, setProfile] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setMessage("");
    const form = new FormData(event.currentTarget);
    const list = (key: string) => String(form.get(key) ?? "")
      .split(/\r?\n/u).map((item) => item.trim()).filter(Boolean);
    setBusy(true);
    try {
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          handle: form.get("handle"),
          photoUrl: form.get("photoUrl"),
          bio: form.get("bio"),
          location: form.get("location"),
          skills: list("skills"),
          hobbies: list("hobbies"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Enregistrement impossible.");
        return;
      }
         setProfile(result as OwnProfile);
      setMessage("Profil enregistré.");
    } catch {
      setMessage("Connexion impossible. Réessaie.");
    } finally { setBusy(false); }
  }

  return <main>
    <PageHeading title="Modifier mon profil" description="Tes compétences et tes centres d’intérêt facilitent les rencontres."
      action={<a className="button button-secondary" href={`/u/${profile.handle}`}>Voir mon profil public</a>} />
    <p><a href="/preferences">Catégories, rappels et notifications</a> · <a href="/saved">Mes enregistrements</a>
      {" · "}<a href={`/u/${profile.handle}/activity`}>Mon activité</a>
      {" · "}<a href="/account">Compte et confidentialité</a></p>
    <p>Nom légal (privé) : {profile.legalName}</p>
    {profile.photoUrl && <img src={profile.photoUrl} alt="Ma photo de profil"
      width={96} height={96} />}
    <form className="editor-form" onSubmit={submit} aria-busy={busy}>
      <fieldset className="editor-fields" disabled={busy}>
      <p><label>Pseudo public<br />
        <input name="handle" key={profile.handle} defaultValue={profile.handle}
          required minLength={3} maxLength={30} pattern="[a-z0-9_]{3,30}" />
      </label></p>
      <p><label>URL HTTPS de la photo<br />        <input name="photoUrl" type="url" key={profile.photoUrl ?? ""}
          defaultValue={profile.photoUrl ?? ""} maxLength={2048} />
      </label></p>
      <p><label>Bio<br />
        <textarea name="bio" key={profile.bio ?? ""}
          defaultValue={profile.bio ?? ""} maxLength={500} />
      </label></p>
      <p><label>Localisation<br />
        <input name="location" key={profile.location ?? ""}
          defaultValue={profile.location ?? ""} maxLength={120} />
      </label></p>
      <p><label>Compétences (une par ligne, 20 maximum)<br />
        <textarea name="skills" key={profile.skills.join("\n")}
          defaultValue={profile.skills.join("\n")} />
      </label></p>
      <p><label>Loisirs (un par ligne, 20 maximum)<br />
        <textarea name="hobbies" key={profile.hobbies.join("\n")}
          defaultValue={profile.hobbies.join("\n")} />
      </label></p>
      <div className="form-footer"><button type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
        <a href={`/u/${profile.handle}`}>Retour au profil public</a></div>
      </fieldset>
    </form>
    <p role="status">{message}</p>
  </main>;
}