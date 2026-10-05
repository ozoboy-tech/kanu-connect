import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  if (session && !session.user.onboarded) redirect("/onboarding");
  return (
    <main>
      <div>KANU CONNECT</div>
      {session && <p>Connecté : {session.user.id}</p>}
      {session && <a href="/api/auth/signout">Se déconnecter</a>}
      {!session && <nav>
        <a href="/register">Créer un compte</a>{" · "}
        <a href="/api/auth/signin">Se connecter</a>{" · "}
        <a href="/forgot-password">Mot de passe oublié</a>
      </nav>}
    </main>
  );
}
