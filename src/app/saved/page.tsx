import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { parsePage } from "@/shared/domain/pagination";
import { authPool } from "@/server/auth/db";
import { listBookmarks } from "@/server/bookmarks/bookmark-repository";
import BookmarkButton from "@/app/components/bookmark-button";
import { Avatar, EmptyState, PageHeading, Pagination } from "@/app/components/ui";

export const dynamic = "force-dynamic";

export default async function SavedPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/saved");
  if (!session.user.onboarded) redirect("/onboarding");
  const params = await searchParams;
  let page: number;
  try {
    if (Object.keys(params).some((key) => key !== "page") || Array.isArray(params.page)) throw new TypeError();
    page = parsePage(params.page ?? null);
  } catch { return <main><h1>Enregistrements</h1><p role="alert">Page invalide.</p><a href="/saved">Recommencer</a></main>; }
  const connection = await authPool().getConnection();
  try {
    const result = await listBookmarks(connection, session.user.id, page);
    return <main><PageHeading title="Mes enregistrements" description="Les contenus que tu gardes pour plus tard. Cette liste est privée." />
      {!result.items.length && <EmptyState title="Aucun contenu enregistré sur cette page."
        href="/explore?kind=posts" action="Explorer les publications">Le bouton Enregistrer est disponible sur chaque publication et projet.</EmptyState>}
      <ul className="card-list">{result.items.map((item) => <li key={`${item.kind}:${item.id}`}>
        <article className="content-card"><div className="card-meta"><a className="identity" href={`/u/${item.authorHandle}`}>
          <Avatar handle={item.authorHandle} /><strong>@{item.authorHandle}</strong></a>
          <span className="tag">{item.kind === "post" ? "Publication" : "Projet"}</span></div>
          <h2><a href={`/${item.kind === "post" ? "posts" : "projects"}/${item.id}`}>{item.title}</a></h2>
          <BookmarkButton kind={item.kind} id={item.id} canSave />
        </article>
      </li>)}</ul>
      <Pagination page={page} hasNext={result.hasNext} href={(next) => `/saved?page=${next}`} />
    </main>;
  } finally { connection.release(); }
}