import { redirect } from "next/navigation";
import { authPool } from "@/server/auth/db";
import { getViewerSummary } from "@/server/ui/viewer-summary";
import { searchPublications, type PublicationCard as Publication } from "@/server/discovery/publication-search";
import { parseExploreQuery } from "@/modules/explore/domain/explore-query";
import { listLeaderboard } from "@/server/reputation/reputation-repository";
import CommunityBanner from "@/app/components/community-banner";
import Icon from "@/app/components/ui-icon";
import { PublicationCard } from "@/app/components/content-card";
import { Avatar, EmptyState } from "@/app/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await getViewerSummary();
  if (viewer && !viewer.onboarded) redirect("/onboarding");
  if (viewer?.preferences && !viewer.preferences.welcomeCompleted) redirect("/welcome");

  let question: Publication | undefined;
  let leader: { handle: string; points: number; votes: number; rank: number } | undefined;
  let unavailable = false;
  try {
    const connection = await authPool().getConnection();
    try {
      const result = await searchPublications(connection, parseExploreQuery(
        new URLSearchParams({ kind: "posts", type: "question", sort: "unanswered" }),
      ), viewer?.id ?? null);
      question = result.items[0];
      const ranking = await listLeaderboard(connection, "week", viewer?.id ?? null);
      if (ranking[0]) leader = { ...ranking[0], rank: 1 };
    } finally { connection.release(); }
  } catch { unavailable = true; }

  return <main>
    <section className="welcome">
      <div className="welcome-profile"><Avatar handle={viewer?.handle ?? "K"} large photoUrl={viewer?.photoUrl} />
        <div><h1>{viewer?.handle ? `Bonjour, @${viewer.handle}` : "Bienvenue sur Kanu"}</h1>
          <p>{viewer ? `${viewer.reputation?.points ?? 0} points de réputation`
            : "Développeurs africains. Plus loin ensemble."}</p>
        </div>
      </div>
      {viewer && <div className="streak-card" aria-label={`Flamme : ${viewer.streak?.currentDays ?? 0} jours consécutifs`}>
        <span aria-hidden="true"><Icon name="flame" /></span><div><strong>{viewer.streak?.currentDays ?? 0} jour{viewer.streak?.currentDays === 1 ? "" : "s"}</strong>
          <small>de suite</small></div></div>}
    </section>
    <CommunityBanner />
    {!viewer && <p><a className="button" href="/register">Rejoindre la communauté</a>{" "}
      <a className="text-link" href="/api/auth/signin">J’ai déjà un compte →</a></p>}
    {viewer?.preferences?.remindersEnabled && <p className="result-summary">
      Complète tes compétences et tes catégories pour personnaliser ton fil.{" "}
      <a href="/preferences">Modifier ou désactiver les rappels</a></p>}
    {unavailable && <p role="alert">Les contenus sont temporairement indisponibles. <a href="/">Réessayer</a></p>}
    <section className="home-section">
      <div className="section-heading"><div><h2 id="help-heading" tabIndex={-1}>Questions à aider</h2>
        <p>La communauté a besoin de ton expertise.</p></div>
        <a className="text-link" href="/feed?type=question&sort=unanswered">Voir tout →</a></div>
      {question ? <PublicationCard post={question} /> : <EmptyState title={unavailable
        ? "Les questions reviendront bientôt." : "Aucune question sans réponse pour le moment."}
        href="/feed" action="Découvrir les publications">Tu peux aussi partager une astuce ou présenter ton projet.</EmptyState>}
    </section>
    <section className="home-section">
      <div className="section-heading"><div><h2>Classement de la semaine</h2>
        <p>Les membres qui font avancer la communauté.</p></div>
        <a className="text-link" href="/leaderboard?period=week">Voir tout →</a></div>
      {leader ? <div className="ranking-card"><span className="rank-number">{leader.rank}</span>
        <a href={`/u/${leader.handle}`} className="identity"><Avatar handle={leader.handle} />
          <span><strong>@{leader.handle}</strong><small>Sur les 7 derniers jours</small></span></a>
        <strong className="rank-score">{leader.points} pts</strong></div>
        : <EmptyState title="Le classement se construit avec vos contributions." href="/leaderboard"
          action="Voir le classement" />}
    </section>
    <section className="home-section"><div className="section-heading"><div><h2>Ton prochain échange</h2>
      <p>Une question, une découverte, un projet : chaque contribution compte.</p></div></div>
      <div className="inline-actions"><a className="button" href="/feed?feed=foryou">Pour vous</a>
        <a className="button button-secondary" href="/feed?feed=following">Abonnements</a>
        <a className="button button-secondary" href="/posts/new">Partager une publication</a></div>
    </section>
  </main>;
}
