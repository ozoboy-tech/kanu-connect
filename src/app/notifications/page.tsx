import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { authPool } from "@/server/auth/db";
import { listNotifications } from "@/server/notifications/notification-repository";
import NotificationsInbox from "./notifications-inbox";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");
  if (!session.user.onboarded) redirect("/onboarding");
  const connection = await authPool().getConnection();
  let page;
  try { page = await listNotifications(connection, session.user.id); }
  finally { connection.release(); }
  return <main>
    <p><a href="/">Retour à l’accueil</a></p>
    <h1>Mes notifications</h1>
    <p>Les nouvelles notifications apparaissent après actualisation.</p>
    <NotificationsInbox key={session.user.id} initialPage={page} />
  </main>;
}
