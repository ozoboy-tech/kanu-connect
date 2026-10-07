import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { getProject } from "@/server/projects/project-repository";
import VoteButton from "@/app/components/vote-button";
import ProjectActions from "./project-actions";

const labels = { idea: "Idée", building: "En cours", live: "Disponible" };

export default async function ProjectPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!validPostId(id)) notFound();
  const connection = await authPool().getConnection();
  let project;
  try { project = await getProject(connection, id); }
  finally { connection.release(); }
  if (!project) notFound();
  const session = await auth();
  return <main>
    <p><a href="/projects">Retour aux projets</a></p>
    <h1>{project.title}</h1>
    {!project.deleted && <>
      <p>Par <a href={`/u/${project.authorHandle}`}>@{project.authorHandle}</a></p>
      <p>Avancement : {labels[project.status!]}</p>
      <p>{project.summary}</p>
      <p style={{ whiteSpace: "pre-wrap" }}>{project.description}</p>
      <h2>Technologies</h2>
      <ul>{project.technologies.map((item) => <li key={item}>{item}</li>)}</ul>
      {project.repositoryUrl && <p><a href={project.repositoryUrl}
        rel="noopener noreferrer">Dépôt du projet</a></p>}
            {project.demoUrl && <p><a href={project.demoUrl}
        rel="noopener noreferrer">Démonstration</a></p>}
      {project.demoUrl && <p><a href={project.demoUrl}
        rel="noopener noreferrer">Démonstration</a></p>}
      <VoteButton kind="project" id={project.id}
        viewerId={session?.user.id ?? null}
        authorId={project.authorId}
        canVote={!!session?.user.onboarded} />


    </>}=
    {!project.deleted && session?.user.id === project.authorId &&
      <ProjectActions id={project.id} />}
  </main>;
}
