import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { feedHref, parseExploreQuery, type ExploreQuery } from "@/modules/explore/domain/explore-query";
import { spaces, spaceLabels } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { searchPublications } from "@/server/discovery/publication-search";
import { suggestedMembers } from "@/server/discovery/suggestions-repository";

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
    return <main><p><a href="/">Accueil</a> · <a href="/explore?kind=posts">Recherche globale</a>
      {" · "}<a href="/saved">Enregistrements</a> · <a href="/preferences">Mes catégories</a></p>
      <h1>{query.feed === "foryou" ? "Pour vous" : query.feed === "following" ? "Abonnements" : "Fil public"}</h1>
      <p><a href="/posts/new">Créer une publication</a> · <a href="/projects">Projets</a> · <a href="/opportunities">Opportunités</a></p>
      <nav aria-label="Choisir un fil">
        {(["foryou", "following", "public"] as const).map((feed) => <span key={feed}>
          <a href={feedHref({ ...query, feed, page: 1 })} aria-current={query.feed === feed ? "page" : undefined}>
            {{ foryou: "Pour vous", following: "Abonnements", public: "Public" }[feed]}</a>{" · "}
        </span>)}
      </nav>
      <form action="/feed" method="get" key={feedHref(query)}>
        <input type="hidden" name="feed" value={query.feed} />
        <p><label>Recherche <input name="q" maxLength={120} defaultValue={query.q} /></label></p>
        <p><label>Espace <select name="space" defaultValue={query.space}>
          <option value="">Tous</option>{spaces.map((space) => <option key={space} value={space}>{spaceLabels[space]}</option>)}
        </select></label></p>
        <p><label>Mot-clé exact <input name="keyword" maxLength={32} defaultValue={query.keyword} /></label></p>
        <p><label>Trier <select name="sort" defaultValue={query.sort}>
          <option value="recent">Récent</option><option value="popular">Populaire sur 7 jours</option>
          <option value="unanswered">Questions sans réponse</option>
        </select></label></p><button type="submit">Afficher</button>
      </form>
      {query.feed === "foryou" && <p>Les contenus liés à tes catégories, compétences et abonnements passent en premier.</p>}
      {!result.items.length && <p>{query.feed === "following"
        ? "Aucune publication ici. Découvre et suis des membres dans Explorer."
        : "Aucune publication pour ces critères."}</p>}
      <ul>{result.items.map((post) => <li key={post.id}>
        <h2><a href={`/posts/${post.id}`}>{post.title}</a></h2><p>{post.excerpt}</p>
        <p><a href={`/u/${post.authorHandle}`}>@{post.authorHandle}</a> · {spaceLabels[post.space]}
          {" · "}{post.votes7Days} vote(s) sur 7 jours</p>
      </li>)}</ul>
      <nav aria-label="Pagination du fil">
        {query.page > 1 && <a href={feedHref(query, query.page - 1)}>Page précédente</a>}{" "}
        {result.hasNext && <a href={feedHref(query, query.page + 1)}>Page suivante</a>}
      </nav>
      {query.feed === "foryou" && <section><h2>Membres à découvrir</h2>
        {!suggestions.length && <p>Aucune nouvelle suggestion pour le moment.</p>}
        <ul>{suggestions.map((member) => <li key={member.handle}>
          <a href={`/u/${member.handle}`}>@{member.handle}</a>{member.bio && <p>{member.bio}</p>}
        </li>)}</ul>
      </section>}
    </main>;
  } finally { connection.release(); }
}
