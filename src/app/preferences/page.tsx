import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { authPool } from "@/server/auth/db";
import { getDiscoveryPreferences } from "@/server/discovery/preferences-repository";
import DiscoveryEditor from "@/app/components/discovery-editor";
import NotificationPreferencesEditor from "@/app/components/notification-preferences-editor";
import { getNotificationPreferences } from "@/server/notifications/notification-preferences";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/preferences");
  if (!session.user.onboarded) redirect("/onboarding");
  const connection = await authPool().getConnection();
  try {
    const preferences = await getDiscoveryPreferences(connection, session.user.id);
    if (!preferences) redirect("/onboarding");
    const notifications = await getNotificationPreferences(connection, session.user.id);
    if (!notifications) redirect("/onboarding");
    return <main><p><a href="/profile">Mon profil</a></p><h1>Mes préférences</h1>
      <DiscoveryEditor initial={preferences} />
      <NotificationPreferencesEditor initial={notifications} />
      <p><a href="/welcome">Revoir l’accueil et les suggestions</a></p>
    </main>;
  } finally { connection.release(); }
}