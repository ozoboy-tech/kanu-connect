import { projectLabels as labels } from "@/modules/projects/domain/project-input";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { getProject } from "@/server/projects/project-repository";
import VoteButton from "@/app/components/vote-button";
import ReportButton from "@/app/components/report-button";
import ProjectActions from "./project-actions";
import ProjectCollaboration from "./project-collaboration";
import AttachmentPanel from "@/app/components/attachment-panel";
import BookmarkButton from "@/app/components/bookmark-button";
import { Avatar } from "@/app/components/ui";
export default async function ProjectPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!validPostId(id)) notFound();
  const session = await auth();
  const connection = await authPool().getConnection();
  let project;
  try { project = await getProject(connection, id, session?.user.id ?? null); }
  finally { connection.release(); }
  if (!project) notFound();
  return <main>
    <a className="back-link" href="/projects">← Retour aux projets</a>
    <header className="detail-heading"><h1>{project.title}</h1>
      {!project.deleted && <div className="card-meta">{project.authorHandle && <a className="identity" href={`/u/${project.authorHandle}`}>
        <Avatar handle={project.authorHandle} /><strong>@{project.authorHandle}</strong></a>}
        <span className="tag">{labels[project.status!]}</span></div>}
    </header>
    {!project.deleted && <>
      <BookmarkButton kind="project" id={project.id} canSave={!!session?.user.onboarded} />
      <p className="profile-bio">{project.summary}</p>
      <p className="detail-body">{project.description}</p>
      <h2>Technologies</h2>
      <ul className="tag-list">{project.technologies.map((item) => <li key={item}>{item}</li>)}</ul>
      <h2>Rôles recherchés</h2>
      {project.roles.length === 0 && <p>Aucun rôle précisé.</p>}
      <ul>{project.roles.map((role) => <li key={role.label}>{role.label} · {role.filled ? "Pourvu" : "À pourvoir"}</li>)}</ul>
      {project.status === "live" && !project.demoUrl && <p>La démonstration de ce projet ancien n’a pas encore été renseignée.</p>}
      {project.repositoryUrl && <p><a href={project.repositoryUrl}
        rel="noopener noreferrer">Dépôt du projet</a></p>}
            {project.demoUrl && <p><a href={project.demoUrl}
        rel="noopener noreferrer">Démonstration</a></p>}
      <VoteButton kind="project" id={project.id}
        viewerId={session?.user.id ?? null}
        authorId={project.authorId}
        canVote={!!session?.user.onboarded} />
      <ReportButton kind="project" id={project.id}
        viewerId={session?.user.id ?? null}
        authorId={project.authorId}
        canReport={!!session?.user.onboarded} />
      <AttachmentPanel kind="project" id={project.id}
        canEdit={!!session?.user.onboarded && session.user.id === project.authorId} />



    </>}
    {!project.deleted && session?.user.id === project.authorId &&
      <ProjectActions id={project.id} />}
    {!project.deleted && <ProjectCollaboration projectId={project.id}
      viewerId={session?.user.id ?? null} onboarded={!!session?.user.onboarded} />}

  </main>;
}
