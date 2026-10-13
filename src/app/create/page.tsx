import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Icon from "@/app/components/ui-icon";
import { PageHeading } from "@/app/components/ui";

export default async function CreatePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/create");
  if (!session.user.onboarded) redirect("/onboarding");
  return <main><PageHeading title="Qu’est-ce qu’on construit aujourd’hui ?"
    description="Choisis ton point de départ. La communauté prend le relais." />
    <div className="create-options">
      <a className="create-option" href="/posts/new"><Icon name="create" />
        <h2>Une publication</h2><p>Pose une question, partage une astuce, un tutoriel ou une annonce.</p>
        <strong>Partager avec Kanu →</strong></a>
      <a className="create-option" href="/projects/new"><Icon name="projects" />
        <h2>Un projet</h2><p>Présente ton idée, son avancement et les rôles dont ton équipe a besoin.</p>
        <strong>Présenter mon projet →</strong></a>
      <a className="create-option" href="/posts/new?kind=opportunity"><Icon name="opportunities" />
        <h2>Une opportunité</h2><p>Partage un concours, une formation ou une piste professionnelle avec un lien externe.</p>
        <strong>Partager une opportunité →</strong></a>
    </div>
  </main>;
}
