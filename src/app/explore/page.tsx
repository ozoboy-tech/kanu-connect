import {
  exploreHref, exploreMaxPage, parseExploreQuery, type ExploreQuery,
} from "@/modules/explore/domain/explore-query";
import { authPool } from "@/server/auth/db";
import { searchExplore, type ExploreResult } from "@/server/explore/explore-repository";

export const dynamic = "force-dynamic";
const labels = { idea: "Idée", building: "En cours", live: "Disponible" };

export default async function ExplorePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.append(key, value);
  }
  let query: ExploreQuery;
  try { query = parseExploreQuery(params); }
  catch {
    return <main><h1>Explorer</h1><p role="alert">Filtres invalides.</p>
      <a href="/explore">Recommencer la recherche</a></main>;
  }
  let result: ExploreResult;
  try {
    const connection = await authPool().getConnection();
    try { result = await searchExplore(connection, query); }
    finally { connection.release(); }
  } catch {
    return <main><h1>Explorer</h1>
      <p role="alert">Recherche temporairement indisponible. Réessaie plus tard.</p>
      <a href="/">Accueil</a></main>;
  }
  const tabHref = (kind: ExploreQuery["kind"]) => exploreHref({
    kind, q: query.q, skill: "", location: "", technology: "", status: "", page: 1,
  });
  return <main>
    <p><a href="/">Accueil</a> · <a href="/feed">Publications</a> · <a href="/projects">Projets</a></p>
    <h1>Explorer</h1>
    <nav aria-label="Type de recherche">
      <a href={tabHref("members")} aria-current={query.kind === "members" ? "page" : undefined}>Membres</a>
      {" · "}<a href={tabHref("projects")} aria-current={query.kind === "projects" ? "page" : undefined}>Projets</a>
    </nav>
    <form action="/explore" method="get" key={exploreHref(query)}>
      <input type="hidden" name="kind" value={query.kind} />
      <p><label>Rechercher{" "}<input name="q" maxLength={120} defaultValue={query.q}
        placeholder={query.kind === "members" ? "Pseudo ou bio" : "Titre, résumé ou description"} /></label></p>
      {query.kind === "members" ? <>
        <p><label>Compétence exacte{" "}<input name="skill" maxLength={64} defaultValue={query.skill} placeholder="React" /></label></p>
        <p><label>Localisation contient{" "}<input name="location" maxLength={120} defaultValue={query.location} placeholder="Bamako" /></label></p>
      </> : <>
        <p><label>Technologie exacte{" "}<input name="technology" maxLength={32} defaultValue={query.technology} placeholder="Next.js" /></label></p>
        <p><label>Statut{" "}<select name="status" defaultValue={query.status}>
          <option value="">Tous les statuts</option>
          <option value="idea">Idée</option><option value="building">En cours</option>
          <option value="live">Disponible</option>
        </select></label></p>
      </>}
      <button type="submit">Rechercher</button>{" "}
      <a href={`/explore?kind=${query.kind}`}>Réinitialiser</a>
    </form>
    <p>Les filtres se cumulent. Les recherches ignorent la casse et les accents.</p>
    <p>Page {result.page} · {result.items.length} résultat(s) sur cette page.</p>
    {result.items.length === 0 && <p>Aucun résultat pour ces critères.</p>}
    {result.kind === "members" ? <ul>{result.items.map((member) => <li key={member.publicId}>
      <h2><a href={`/u/${member.handle}`}>@{member.handle}</a></h2>
      {member.bio && <p>{member.bio}</p>}
      {member.location && <p>{member.location}</p>}
      {member.skills.length > 0 && <p>Compétences : {member.skills.join(", ")}</p>}
    </li>)}</ul> : <ul>{result.items.map((project) => <li key={project.id}>
      <h2><a href={`/projects/${project.id}`}>{project.title}</a></h2>
      <p>{project.summary}</p>
      <p>{labels[project.status]} · {project.technologies.join(", ")} ·{" "}
        <a href={`/u/${project.authorHandle}`}>@{project.authorHandle}</a></p>
    </li>)}</ul>}
    <nav aria-label="Pagination">
      {query.page > 1 && <a href={exploreHref(query, query.page - 1)}>Page précédente</a>}
      {query.page > 1 && result.hasNext && " · "}
      {result.hasNext && <a href={exploreHref(query, query.page + 1)}>Page suivante</a>}
    </nav>
    {query.page === exploreMaxPage && <p>Affinez les filtres pour poursuivre la recherche.</p>}
  </main>;
}
