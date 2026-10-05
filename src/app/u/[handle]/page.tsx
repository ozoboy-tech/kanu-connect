import { notFound } from "next/navigation";

import { normalizeHandle } from "@/modules/members/domain/choose-handle";
import { authPool } from "@/server/auth/db";
import { getPublicProfile } from "@/server/members/profile-repository";

export default async function PublicProfilePage({
  params,
}: { params: Promise<{ handle: string }> }) {
  let handle: string;
  try { handle = normalizeHandle((await params).handle); }
  catch { notFound(); }
  const connection = await authPool().getConnection();
  try {
    const profile = await getPublicProfile(connection, handle);
    if (!profile) notFound();
    return <main>
      <h1>@{profile.handle}</h1>
      {profile.photoUrl && <img src={profile.photoUrl}
        alt={`Photo de ${profile.handle}`} width={128} height={128} />}
      {profile.bio && <p>{profile.bio}</p>}
      {profile.location && <p>Localisation : {profile.location}</p>}
      <h2>Compétences</h2>
      <ul>{profile.skills.map((skill) => <li key={skill}>{skill}</li>)}</ul>
      <h2>Loisirs</h2>
      <ul>{profile.hobbies.map((hobby) => <li key={hobby}>{hobby}</li>)}</ul>
    </main>;
  } finally { connection.release(); }
}