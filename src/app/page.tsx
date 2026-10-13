import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { roleOf } from "@/server/moderation/moderator";
import { authPool } from "@/server/auth/db";
import { countUnreadNotifications } from "@/server/notifications/notification-repository";
import { getDiscoveryPreferences } from "@/server/discovery/preferences-repository";


export default async function Home() {
  const session = await auth();
  if (session && !session.user.onboarded) redirect("/onboarding");
  let unreadCount = 0;
  let remindersEnabled = false;
  let role: "member" | "moderator" | "admin" | null = null;
  if (session?.user?.id) {
    const connection = await authPool().getConnection();
    try {
      const preferences = await getDiscoveryPreferences(connection, session.user.id);
      if (preferences && !preferences.welcomeCompleted) redirect("/welcome");
      remindersEnabled = preferences?.remindersEnabled ?? false;
      unreadCount = await countUnreadNotifications(connection, session.user.id);
      role = await roleOf(connection, session.user.id);
    }
    finally { connection.release(); }
  }
  return (
    <main>
      <div>KANU CONNECT</div>
            <p><a href="/feed">Publications</a> · <a href="/projects">Projets</a> · <a href="/opportunities">Opportunités</a> · <a href="/explore">Explorer</a> · <a href="/leaderboard">Classement</a></p>
{session && <p><a href="/profile">Mon profil</a> · <a href="/account">Mon compte</a> · <a href="/saved">Mes enregistrements</a>
  {" · "}<a href="/preferences">Mes préférences</a></p>}
      {session && remindersEnabled && <aside aria-label="Rappel Kanu">
        <p>Complète tes compétences et tes catégories pour personnaliser ton fil.
          {" "}<a href="/preferences">Modifier ou désactiver les rappels</a></p>
      </aside>}
      {session && <p><a href="/notifications">Notifications ({unreadCount})</a></p>}

      {(role === "moderator" || role === "admin") &&
        <p><a href="/moderation">Modération</a></p>}
      {role === "admin" && <p><a href="/admin">Administration</a></p>}

      {session && <a href="/api/auth/signout">Se déconnecter</a>}
      {!session && <nav>
        <a href="/register">Créer un compte</a>{" · "}
        <a href="/api/auth/signin">Se connecter</a>{" · "}
        <a href="/forgot-password">Mot de passe oublié</a>
        {" · "}<a href="/appeal">Contester une suspension</a>
      </nav>}
    </main>
  );
}
