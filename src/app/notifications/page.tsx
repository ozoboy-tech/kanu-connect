import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { authPool } from "@/server/auth/db";
import { parseNotificationFilter } from "@/modules/notifications/domain/notification-input";
import { listNotifications } from "@/server/notifications/notification-repository";
import NotificationsInbox from "./notifications-inbox";
import { PageHeading } from "@/app/components/ui";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({ searchParams }: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");
  if (!session.user.onboarded) redirect("/onboarding");
  let filter;
  try {
    const selected = (await searchParams).filter;
    filter = parseNotificationFilter(typeof selected === "string" ? selected : selected === undefined ? null : "invalid");
  } catch {
    return <main><h1>Mes notifications</h1><p role="alert">Filtre invalide.</p>
      <a href="/notifications">Afficher toutes les notifications</a></main>;
  }
  const connection = await authPool().getConnection();
  let page;
  try { page = await listNotifications(connection, session.user.id, null, filter); }
  finally { connection.release(); }
  return <main>
    <PageHeading title="Mes notifications" description="Les réponses, projets et échanges qui te concernent."
      action={<a className="button button-secondary" href="/preferences">Mes préférences</a>} />
    <NotificationsInbox key={`${session.user.id}-${filter}`} initialPage={page} filter={filter} />
  </main>;
}
