import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { authPool } from "@/server/auth/db";
import { isAdmin } from "@/server/moderation/moderator";
import { listAdminMembers } from "@/server/accounts/admin-repository";
import AdminPanel from "./admin-panel";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/api/auth/signin?callbackUrl=/admin");
  const connection = await authPool().getConnection();
  try {
    if (!await isAdmin(connection, session.user.id)) notFound();
    const members = await listAdminMembers(connection, session.user.id);
    return <main><p><a href="/moderation">Modération</a></p>
      <h1>Administration des comptes</h1>
      <AdminPanel members={members} />
    </main>;
  } finally { connection.release(); }
}
