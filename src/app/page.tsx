import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isModerator } from "@/server/moderation/moderator";
import { authPool } from "@/server/auth/db";
import { countUnreadNotifications } from "@/server/notifications/notification-repository";


export default async function Home() {
  const session = await auth();
  if (session && !session.user.onboarded) redirect("/onboarding");
  let unreadCount = 0;
  if (session?.user?.id) {
    const connection = await authPool().getConnection();
    try { unreadCount = await countUnreadNotifications(connection, session.user.id); }
    finally { connection.release(); }
  }
  return (
    <main>
      <div>KANU CONNECT</div>
      <p><a href="/feed">Publications</a> · <a href="/projects">Projets</a> · <a href="/opportunities">Opportunités</a> · <a href="/leaderboard">Classement</a></p>
{session && <p><a href="/profile">Mon profil</a></p>}
      {session && <p><a href="/notifications">Notifications ({unreadCount})</a></p>}

      {isModerator(session?.user.id) &&
        <p><a href="/moderation">Modération</a></p>}

      {session && <a href="/api/auth/signout">Se déconnecter</a>}
      {!session && <nav>
        <a href="/register">Créer un compte</a>{" · "}
        <a href="/api/auth/signin">Se connecter</a>{" · "}
        <a href="/forgot-password">Mot de passe oublié</a>
      </nav>}
    </main>
  );
}
