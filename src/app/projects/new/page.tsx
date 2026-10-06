import { redirect } from "next/navigation";

import { auth } from "@/auth";
import ProjectForm from "../project-form";

export default async function NewProjectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/projects/new");
  if (!session.user.onboarded) redirect("/onboarding");
  return <main>
    <p><a href="/projects">Retour aux projets</a></p>
    <h1>Présenter un projet</h1>
    <ProjectForm />
  </main>;
}
