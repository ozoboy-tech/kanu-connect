import { authPool } from "@/server/auth/db";
import { listProjects } from "@/server/projects/project-repository";
import { auth } from "@/auth";
import { ProjectCard } from "@/app/components/content-card";
import { EmptyState, PageHeading } from "@/app/components/ui";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await auth();
  const connection = await authPool().getConnection();
  let projects;
  try { projects = await listProjects(connection, session?.user.id ?? null); }
  finally { connection.release(); }
  return <main>
    <PageHeading title="Projets de la communauté" description="Des idées aux premières versions : construisons ensemble."
      action={<a className="button" href="/projects/new">Présenter mon projet</a>} />
    {projects.length === 0 && <EmptyState title="Le prochain projet pourrait être le tien."
      href="/projects/new" action="Présenter un projet">Partage ton idée, les technologies et les rôles que tu recherches.</EmptyState>}
    <ul className="card-list card-grid">{projects.map((project) => <li key={project.id}>
      <ProjectCard project={{ ...project, status: project.status! }} />
    </li>)}</ul>
    <a className="text-link" href="/explore?kind=projects">Rechercher par technologie ou avancement →</a>
  </main>;
}
