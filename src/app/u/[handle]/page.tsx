import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { normalizeHandle } from "@/modules/members/domain/choose-handle";
import { authPool } from "@/server/auth/db";
import { getFollowStats } from "@/server/members/follow-repository";
import { getPublicProfile } from "@/server/members/profile-repository";
import { listMemberProjects } from "@/server/projects/project-repository";
import { getReputation } from "@/server/reputation/reputation-repository";
import { getPublicStreak } from "@/server/streaks/streak-repository";
import { publicTopics } from "@/server/discovery/preferences-repository";
import { ProjectCard } from "@/app/components/content-card";
import { Avatar, EmptyState } from "@/app/components/ui";
import Icon from "@/app/components/ui-icon";
import FollowPanel from "./follow-panel";
import BlockPanel from "./block-panel";

export default async function PublicProfilePage({ params }: {
  params: Promise<{ handle: string }>;
}) {
  let handle: string;
  try { handle = normalizeHandle((await params).handle); } catch { notFound(); }
  const session = await auth();
  const connection = await authPool().getConnection();
  try {
    const profile = await getPublicProfile(connection, handle, session?.user.id ?? null);
    if (!profile) notFound();
    const topics = await publicTopics(connection, handle);
    const projects = await listMemberProjects(connection, handle);
    const reputation = await getReputation(connection, handle);
    const streak = await getPublicStreak(connection, handle);
    const stats = await getFollowStats(connection, handle, session?.user.id ?? null);
    if (!stats) notFound();
    const ownProfile = session?.user.id === profile.publicId;
    return <main>
      <div className="profile-cover" aria-hidden="true" />
      <div className="profile-surface">
        <header className="profile-hero"><Avatar handle={profile.handle} large photoUrl={profile.photoUrl} />
          <div><h1>@{profile.handle}</h1><p>{profile.location ?? "Développeur de la communauté Kanu"}</p></div>
          {ownProfile && <a className="button button-secondary" href="/profile">Modifier mon profil</a>}
        </header>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        <div className="profile-stats">
          <div><strong>{reputation?.points ?? 0}</strong><span>points de réputation</span></div>
          <div><strong className="streak-value"><Icon name="flame" /> {streak?.currentDays ?? 0}</strong><span>jours consécutifs · record {streak?.bestDays ?? 0}</span></div>
          <div><strong>{projects.length}</strong><span>projets présentés</span></div>
        </div>
        {!!reputation?.badges.length && <ul className="tag-list" aria-label="Badges de réputation">
          {reputation.badges.map((badge) => <li key={badge}>{badge}</li>)}</ul>}
        {streak?.hasThreeDayBadge && <p><span className="tag"><Icon name="flame" /> Flamme 3 jours</span></p>}
        <FollowPanel handle={profile.handle} initial={stats}
          canFollow={!!session?.user.onboarded && !ownProfile} />
        {session?.user.onboarded && !ownProfile && <BlockPanel handle={profile.handle} />}
        {!session?.user.id && <p><a href="/api/auth/signin">Connecte-toi</a> pour suivre ce membre.</p>}
        {session?.user.id && !session.user.onboarded && <p><a href="/onboarding">Complète ton profil</a> pour suivre des membres.</p>}
        <h2>Compétences</h2>
        {profile.skills.length ? <ul className="tag-list">{profile.skills.map((skill) => <li key={skill}>{skill}</li>)}</ul>
          : <p className="result-summary">Aucune compétence précisée.</p>}
        <h2>Catégories suivies</h2>
        {topics.length ? <ul className="tag-list">{topics.map((topic) => <li key={topic}>#{topic}</li>)}</ul>
          : <p className="result-summary">Aucune catégorie précisée.</p>}
        <h2>Loisirs</h2>
        {profile.hobbies.length ? <ul className="tag-list">{profile.hobbies.map((hobby) => <li key={hobby}>{hobby}</li>)}</ul>
          : <p className="result-summary">Aucun loisir précisé.</p>}
        <a className="text-link" href={`/u/${profile.handle}/activity`}>Voir l’activité publique →</a>
      </div>
      <section className="home-section"><h2>Projets</h2>
        {projects.length === 0 && <EmptyState title="Aucun projet présenté pour le moment." />}
        <ul className="card-list card-grid">{projects.map((project) => <li key={project.id}>
          <ProjectCard project={{ ...project, status: project.status! }} />
        </li>)}</ul>
      </section>
    </main>;
  } finally { connection.release(); }
}
