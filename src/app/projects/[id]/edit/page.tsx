import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { getProject } from "@/server/projects/project-repository";
import ProjectForm from "../../project-form";

export default async function EditProjectPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!validPostId(id)) notFound();
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/api/auth/signin?callbackUrl=/projects/${id}/edit`);
  }
  const connection = await authPool().getConnection();
  let project;
  try { project = await getProject(connection, id); }
  finally { connection.release(); }
  if (!project || project.deleted || project.authorId !== session.user.id) notFound();
  return <main>
    <p><a href={`/projects/${id}`}>Retour au projet</a></p>
    <h1>Modifier mon projet</h1>
    <ProjectForm initial={project} />
  </main>;
}
