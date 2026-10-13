import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { feedHref, parseExploreQuery, type ExploreQuery } from "@/modules/explore/domain/explore-query";
import { spaces, spaceLabels } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { searchPublications } from "@/server/discovery/publication-search";
import { suggestedMembers } from "@/server/discovery/suggestions-repository";
import { MemberCard, PublicationCard } from "@/app/components/content-card";
import { EmptyState, PageHeading, Pagination } from "@/app/components/ui";

export const dynamic = "force-dynamic";

export default async function FeedPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.append(key, value);
  }
  let query: ExploreQuery;
  try {
    if (params.has("kind")) throw new TypeError();
    params.set("kind", "posts");
    if (!params.has("feed")) params.set("feed", session?.user.id ? "foryou" : "public");
    query = parseExploreQuery(params);
  } catch { return <main><h1>Publications</h1><p role="alert">Filtres invalides.</p><a href="/feed">Recommencer</a></main>; }
  const personal = query.feed !== "public";
  if (personal && !session?.user.id) redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(feedHref(query))}`);
  if (personal && !session?.user.onboarded) redirect("/onboarding");
  const connection = await authPool().getConnection();
  try {
    const result = await searchPublications(connection, query, session?.user.id ?? null);
    const suggestions = query.feed === "foryou" ? await suggestedMembers(connection, session!.user.id) : [];
    return <main>
      <PageHeading title="Les échanges" description="Des questions, des astuces et des idées pour avancer ensemble."
        action={<a className="button" href="/posts/new">Créer une publication</a>} />
      <nav className="tabs" aria-label="Choisir un fil">
        {(["foryou", "following", "public"] as const).map((feed) =>
          <a key={feed} href={feedHref({ ...query, feed, page: 1 })} aria-current={query.feed === feed ? "page" : undefined}>
            {{ foryou: "Pour vous", following: "Abonnements", public: "Public" }[feed]}</a>)}
      </nav>
      <form className="filter-panel" action="/feed" method="get" key={feedHref(query)}>
        <input type="hidden" name="feed" value={query.feed} />
        {query.type && <input type="hidden" name="type" value={query.type} />}
        <p><label>Recherche <input type="search" name="q" maxLength={120} defaultValue={query.q} placeholder="Une question, une astuce…" /></label></p>
        <details className="advanced-filters" open={!!(query.space || query.keyword || (query.sort && query.sort !== "recent"))}>
          <summary>Filtrer et trier</summary><div className="filter-grid">
        <p><label>Espace <select name="space" defaultValue={query.space}>
          <option value="">Tous</option>{spaces.map((space) => <option key={space} value={space}>{spaceLabels[space]}</option>)}
        </select></label></p>
        <p><label>Mot-clé exact <input name="keyword" maxLength={32} defaultValue={query.keyword} /></label></p>
        <p><label>Trier <select name="sort" defaultValue={query.sort}>
          <option value="recent">Récent</option><option value="popular">Populaire sur 7 jours</option>
          <option value="unanswered">Questions sans réponse</option>
        </select></label></p></div></details><div className="filter-actions"><button type="submit">Afficher</button>
          <a href={feedHref({ ...query, q: "", keyword: "", space: "", type: "", sort: "recent", page: 1 })}>Réinitialiser</a></div>
      </form>
      {query.feed === "foryou" && <p className="result-summary">Les contenus liés à tes catégories, compétences et abonnements passent en premier.</p>}
      {!result.items.length && <EmptyState title={query.feed === "following"
        ? "Ton fil d’abonnements attend ses premiers échanges."
        : "Aucune publication pour ces critères."} href="/explore?kind=members" action="Découvrir des membres" />}
      <ul className="card-list">{result.items.map((post) => <li key={post.id}><PublicationCard post={post} /></li>)}</ul>
      <Pagination page={query.page} hasNext={result.hasNext} href={(page) => feedHref(query, page)} label="Pagination du fil" />
      {query.feed === "foryou" && <section className="home-section"><h2>Membres à découvrir</h2>
        {!suggestions.length && <p className="result-summary">Aucune nouvelle suggestion pour le moment.</p>}
        <ul className="card-list card-grid">{suggestions.map((member) => <li key={member.handle}>
          <MemberCard member={member} />
        </li>)}</ul>
      </section>}
    </main>;
  } finally { connection.release(); }
}
