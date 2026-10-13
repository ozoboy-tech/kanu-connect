import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { parsePage } from "@/shared/domain/pagination";
import { authPool } from "@/server/auth/db";
import { listBookmarks } from "@/server/bookmarks/bookmark-repository";

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
    return <main><p><a href="/">Accueil</a> · <a href="/profile">Mon profil</a></p>
      <h1>Mes enregistrements</h1><p>Cette liste est privée.</p>
      {!result.items.length && <p>Aucun contenu enregistré sur cette page.</p>}
      <ul>{result.items.map((item) => <li key={`${item.kind}:${item.id}`}>
        <a href={`/${item.kind === "post" ? "posts" : "projects"}/${item.id}`}>{item.title}</a>
        {" · "}<a href={`/u/${item.authorHandle}`}>@{item.authorHandle}</a>
      </li>)}</ul>
      <nav aria-label="Pagination des enregistrements">
        {page > 1 && <a href={`/saved?page=${page - 1}`}>Page précédente</a>}{" "}
        {result.hasNext && <a href={`/saved?page=${page + 1}`}>Page suivante</a>}
      </nav>
    </main>;
  } finally { connection.release(); }
}
