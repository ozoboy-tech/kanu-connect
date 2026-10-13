import { notFound } from "next/navigation";
import { normalizeHandle } from "@/modules/members/domain/choose-handle";
import { parsePage } from "@/shared/domain/pagination";
import { authPool } from "@/server/auth/db";
import { getPublicProfile } from "@/server/members/profile-repository";
import { listProfileActivity } from "@/server/discovery/profile-activity";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ params, searchParams }: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let handle: string;
  try { handle = normalizeHandle((await params).handle); } catch { notFound(); }
  let page: number;
  try {
    const query = await searchParams;
    if (Object.keys(query).some((key) => key !== "page") || Array.isArray(query.page)) throw new TypeError();
    page = parsePage(query.page ?? null);
  } catch { return <main><p role="alert">Page invalide.</p><a href={`/u/${handle}/activity`}>Recommencer</a></main>; }
  const session = await auth();
  const connection = await authPool().getConnection();
  try {
    if (!await getPublicProfile(connection, handle, session?.user.id ?? null)) notFound();
    const result = await listProfileActivity(connection, handle, page);
    return <main><p><a href={`/u/${handle}`}>Retour au profil</a></p><h1>Activité de @{handle}</h1>
      {!result.items.length && <p>Aucune activité publique sur cette page.</p>}
      <ul>{result.items.map((item) => <li key={`${item.kind}:${item.id}`}>
        {item.kind === "comment" ? "Réponse" : item.kind === "project" ? "Projet" : "Publication"}{" : "}
        <a href={`/${item.kind === "project" ? "projects" : "posts"}/${item.targetId}`}>{item.title}</a>
        {" · "}{new Date(item.createdAt).toISOString().slice(0, 10)}
      </li>)}</ul>
      <nav aria-label="Pagination de l’activité">
        {page > 1 && <a href={`/u/${handle}/activity?page=${page - 1}`}>Page précédente</a>}{" "}
        {result.hasNext && <a href={`/u/${handle}/activity?page=${page + 1}`}>Page suivante</a>}
      </nav>
    </main>;
  } finally { connection.release(); }
}
