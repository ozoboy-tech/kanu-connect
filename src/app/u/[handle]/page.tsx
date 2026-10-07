import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { normalizeHandle } from "@/modules/members/domain/choose-handle";
import { authPool } from "@/server/auth/db";
import { getFollowStats } from "@/server/members/follow-repository";
import { getPublicProfile } from "@/server/members/profile-repository";
import { listMemberProjects } from "@/server/projects/project-repository";
import { getReputation } from "@/server/reputation/reputation-repository";
import { getPublicStreak } from "@/server/streaks/streak-repository";
import FollowPanel from "./follow-panel";


export default async function PublicProfilePage({
  params,
}: { params: Promise<{ handle: string }> }) {
  let handle: string;
  try { handle = normalizeHandle((await params).handle); }
  catch { notFound(); }
  const session = await auth();
  const connection = await authPool().getConnection();
  try {
    const profile = await getPublicProfile(connection, handle);
    if (!profile) notFound();
const projects = await listMemberProjects(connection, handle);
    const reputation = await getReputation(connection, handle);
    const streak = await getPublicStreak(connection, handle);
    const stats = await getFollowStats(connection, handle, session?.user.id ?? null);
    if (!stats) notFound();
    return <main>
      <h1>@{profile.handle}</h1>
      <FollowPanel handle={profile.handle} initial={stats}
        canFollow={!!session?.user.onboarded && session.user.id !== profile.publicId} />
      {!session?.user.id && <p><a href="/api/auth/signin">Connecte-toi</a>
        {" pour suivre ce membre."}</p>}
      {session?.user.id && !session.user.onboarded &&
        <p><a href="/onboarding">Complète ton profil</a> pour suivre des membres.</p>}
      {profile.photoUrl && <img src={profile.photoUrl}
        alt={`Photo de ${profile.handle}`} width={128} height={128} />}
      {profile.bio && <p>{profile.bio}</p>}
      {profile.location && <p>Localisation : {profile.location}</p>}
      <h2>Réputation</h2>
      <p>{reputation?.points ?? 0} points</p>
      <ul>{reputation?.badges.map((badge) => <li key={badge}>{badge}</li>)}</ul>
      <h2>Flamme</h2>
      <p>🔥 {streak?.currentDays ?? 0} jours · Record : {streak?.bestDays ?? 0} jours</p>
      {streak?.hasThreeDayBadge && <p>Badge : Flamme 3 jours</p>}

      <h2>Compétences</h2>
      <ul>{profile.skills.map((skill) => <li key={skill}>{skill}</li>)}</ul>
      <h2>Loisirs</h2>
      <ul>{profile.hobbies.map((hobby) => <li key={hobby}>{hobby}</li>)}</ul>
      <h2>Projets</h2>
      {projects.length === 0 && <p>Aucun projet présenté.</p>}
      <ul>{projects.map((project) => <li key={project.id}>
        <a href={`/projects/${project.id}`}>{project.title}</a> — {project.summary}
      </li>)}</ul>

    </main>;
  } finally { connection.release(); }
}