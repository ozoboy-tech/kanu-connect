import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { listDiscussionMessages } from "@/server/projects/discussion-repository";
import ProjectDiscussion from "./project-discussion";

export default async function DiscussionPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!validPostId(id)) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");
  if (!session.user.onboarded) redirect("/onboarding");
  const connection = await authPool().getConnection();
  let page;
  try { page = await listDiscussionMessages(connection, id, session.user.id); }
  finally { connection.release(); }
  if (!page) notFound();
  return <main>
    <p><a href={`/projects/${id}`}>Retour au projet</a></p>
    <h1>Discussion du projet</h1>
    <p>Le créateur et les collaborateurs acceptés peuvent lire tout l’historique
      et échanger ici. Les nouveaux messages apparaissent après actualisation.</p>
    <ProjectDiscussion key={`${id}:${session.user.id}`} projectId={id} initialPage={page} />
  </main>;
}
