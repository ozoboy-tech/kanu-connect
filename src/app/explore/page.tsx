import { exploreHref, parseExploreQuery, type ExploreQuery } from "@/modules/explore/domain/explore-query";
import { projectLabels } from "@/modules/projects/domain/project-input";
import { kinds, spaces, kindLabels, spaceLabels } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { searchExplore, type ExploreResult } from "@/server/explore/explore-repository";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function ExplorePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.append(key, value);
  }
  let query: ExploreQuery;
  try {
    query = parseExploreQuery(params);
    if (query.feed && query.feed !== "public") throw new TypeError();
  } catch {
    return <main><h1>Explorer</h1><p role="alert">Filtres invalides.</p>
      <a href="/explore?kind=posts">Recommencer la recherche</a></main>;
  }
  let result: ExploreResult;
  try {
    const session = await auth();
    const connection = await authPool().getConnection();
    try { result = await searchExplore(connection, query, session?.user.id ?? null); }
    finally { connection.release(); }
  } catch {
    return <main><h1>Explorer</h1><p role="alert">Recherche temporairement indisponible.</p>
      <a href="/explore?kind=posts">Réessayer</a></main>;
  }
  const tabHref = (kind: ExploreQuery["kind"]) => exploreHref({
    kind, q: query.q, skill: "", location: "", technology: "", status: "", page: 1,
  });
  return <main>
    <p><a href="/">Accueil</a> · <a href="/feed">Publications</a> · <a href="/projects">Projets</a></p>
    <h1>Explorer</h1>
    <nav aria-label="Type de recherche">
      {(["posts", "members", "projects"] as const).map((kind) => <span key={kind}>
        <a href={tabHref(kind)} aria-current={query.kind === kind ? "page" : undefined}>
          {{ posts: "Publications", members: "Membres", projects: "Projets" }[kind]}
        </a>{" · "}
      </span>)}
    </nav>
    <form action="/explore" method="get" key={exploreHref(query)}>
      <input type="hidden" name="kind" value={query.kind} />
      <p><label>Rechercher <input name="q" maxLength={120} defaultValue={query.q}
        placeholder={query.kind === "members" ? "Pseudo ou bio" : "Titre, texte ou mots-clés"} /></label></p>
      {query.kind === "members" && <>
        <p><label>Compétence exacte <input name="skill" maxLength={64} defaultValue={query.skill} /></label></p>
        <p><label>Localisation <input name="location" maxLength={120} defaultValue={query.location} /></label></p>
      </>}
      {query.kind === "projects" && <>
        <p><label>Technologie exacte <input name="technology" maxLength={32} defaultValue={query.technology} /></label></p>
        <p><label>Statut <select name="status" defaultValue={query.status}>
          <option value="">Tous</option>
          {Object.entries(projectLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label></p>
      </>}
      {query.kind === "posts" && <>
        <p><label>Espace <select name="space" defaultValue={query.space}>
          <option value="">Tous</option>{spaces.map((space) => <option key={space} value={space}>{spaceLabels[space]}</option>)}
        </select></label></p>
        <p><label>Type <select name="type" defaultValue={query.type}>
          <option value="">Tous</option>{kinds.map((kind) => <option key={kind} value={kind}>{kindLabels[kind]}</option>)}
        </select></label></p>
        <p><label>Mot-clé exact <input name="keyword" maxLength={32} defaultValue={query.keyword} /></label></p>
      </>}
      {query.kind !== "members" && <p><label>Trier <select name="sort" defaultValue={query.sort ?? "recent"}>
        <option value="recent">Récent</option><option value="popular">Populaire sur 7 jours</option>
        {query.kind === "posts" && <option value="unanswered">Questions sans réponse</option>}
      </select></label></p>}
      <button type="submit">Rechercher</button>{" "}<a href={`/explore?kind=${query.kind}`}>Réinitialiser</a>
    </form>
    <p>Les filtres se cumulent. Pour « Sans réponse », choisis tous les types ou les questions.</p>
    <p>Page {result.page} · {result.items.length} résultat(s).</p>
    {!result.items.length && <p>Aucun résultat pour ces critères.</p>}
    {result.kind === "members" && <ul>{result.items.map((member) => <li key={member.publicId}>
      <h2><a href={`/u/${member.handle}`}>@{member.handle}</a></h2>
      {member.bio && <p>{member.bio}</p>}{member.location && <p>{member.location}</p>}
      <p>{member.skills.join(", ")}</p>
    </li>)}</ul>}
    {result.kind === "projects" && <ul>{result.items.map((project) => <li key={project.id}>
      <h2><a href={`/projects/${project.id}`}>{project.title}</a></h2><p>{project.summary}</p>
      <p>{projectLabels[project.status]} · {project.technologies.join(", ")} · <a href={`/u/${project.authorHandle}`}>@{project.authorHandle}</a></p>
    </li>)}</ul>}
    {result.kind === "posts" && <ul>{result.items.map((post) => <li key={post.id}>
      <h2><a href={`/posts/${post.id}`}>{post.title}</a></h2><p>{post.excerpt}</p>
      <p>{spaceLabels[post.space]} · {kindLabels[post.kind]} · <a href={`/u/${post.authorHandle}`}>@{post.authorHandle}</a>
        {" · "}{post.votes7Days} vote(s) sur 7 jours</p>
    </li>)}</ul>}
    <nav aria-label="Pagination">
      {query.page > 1 && <a href={exploreHref(query, query.page - 1)}>Page précédente</a>}{" "}
      {result.hasNext && <a href={exploreHref(query, query.page + 1)}>Page suivante</a>}
    </nav>
  </main>;
}
