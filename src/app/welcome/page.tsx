import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { authPool } from "@/server/auth/db";
import { getDiscoveryPreferences } from "@/server/discovery/preferences-repository";
import { getOwnProfile } from "@/server/members/profile-repository";
import { suggestedMembers } from "@/server/discovery/suggestions-repository";
import DiscoveryEditor from "@/app/components/discovery-editor";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/welcome");
  if (!session.user.onboarded) redirect("/onboarding");
  const connection = await authPool().getConnection();
  try {
    const preferences = await getDiscoveryPreferences(connection, session.user.id);
    const profile = await getOwnProfile(connection, session.user.id);
       if (!preferences || !profile) redirect("/onboarding");
    const suggestions = await suggestedMembers(connection, session.user.id);
    return <main><h1>Bienvenue, @{profile.handle}</h1>
      <p>Créer. Connecter. Avancer.</p>
      <DiscoveryEditor initial={preferences} welcome />
      <p><a href="/profile">Compléter ma bio et mes compétences</a> · <a href="/feed?feed=foryou">Découvrir mon fil</a></p>
      <h2>Membres à découvrir</h2>
      {!suggestions.length && <p>Les prochains membres apparaîtront ici.</p>}
      <ul>{suggestions.map((member) => <li key={member.handle}>
        <a href={`/u/${member.handle}`}>@{member.handle}</a>{member.bio && <p>{member.bio}</p>}
      </li>)}</ul>
    </main>;
  } finally { connection.release(); }
}
