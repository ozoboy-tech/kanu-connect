import { authPool } from "@/server/auth/db";
import { listProjects } from "@/server/projects/project-repository";

export const dynamic = "force-dynamic";

const labels = { idea: "Idée", building: "En cours", live: "Disponible" };

export default async function ProjectsPage() {
  const connection = await authPool().getConnection();
  let projects;
  try { projects = await listProjects(connection); }
  finally { connection.release(); }
  return <main>
    <h1>Projets de la communauté</h1>
    <p><a href="/projects/new">Présenter mon projet</a></p>
    <p><a href="/feed">Voir les publications</a></p>
    {projects.length === 0 && <p>Aucun projet présenté pour le moment.</p>}
    <ul>{projects.map((project) => <li key={project.id}>
      <h2><a href={`/projects/${project.id}`}>{project.title}</a></h2>
      <p>{project.summary}</p>
      <p>{labels[project.status!]} · {project.technologies.join(", ")} ·{" "}
        <a href={`/u/${project.authorHandle}`}>@{project.authorHandle}</a></p>
    </li>)}</ul>
  </main>;
}
