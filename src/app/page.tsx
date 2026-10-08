import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isModerator } from "@/server/moderation/moderator";

export default async function Home() {
  const session = await auth();
  if (session && !session.user.onboarded) redirect("/onboarding");
  return (
    <main>
      <div>KANU CONNECT</div>
      <p><a href="/feed">Publications</a> · <a href="/projects">Projets</a> · <a href="/leaderboard">Classement</a></p>
      {session && <p><a href="/profile">Mon profil</a></p>}
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
