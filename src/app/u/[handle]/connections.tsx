import { notFound } from "next/navigation";

import { normalizeHandle } from "@/modules/members/domain/choose-handle";
import { authPool } from "@/server/auth/db";
import { getFollowStats, listConnections } from "@/server/members/follow-repository";

export default async function Connections({
  params, kind,
}: {
  params: Promise<{ handle: string }>;
  kind: "followers" | "following";
}) {
  let handle: string;
  try { handle = normalizeHandle((await params).handle); }
  catch { notFound(); }
  const connection = await authPool().getConnection();
  let members: string[];
  try {
    if (!await getFollowStats(connection, handle, null)) notFound();
    members = await listConnections(connection, handle, kind);
  } finally { connection.release(); }
  const label = kind === "followers" ? "Abonnés" : "Abonnements";
  return <main>
    <p><a href={`/u/${handle}`}>Retour au profil</a></p>
    <h1>{label} de @{handle}</h1>
    {members.length === 0 && <p>Aucun membre pour le moment.</p>}
    <ul>{members.map((member) => <li key={member}>
      <a href={`/u/${member}`}>@{member}</a>
    </li>)}</ul>
  </main>;
}
