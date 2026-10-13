import { redirect } from "next/navigation";

import { auth } from "@/auth";
import ProjectForm from "../project-form";
import { PageHeading } from "@/app/components/ui";

export default async function NewProjectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/projects/new");
  if (!session.user.onboarded) redirect("/onboarding");
  return <main>
    <a className="back-link" href="/create">← Choisir un autre contenu</a>
    <PageHeading title="Présenter un projet" description="Une idée mérite d’être partagée. Fais découvrir la tienne." />
    <ProjectForm />
  </main>;
}
