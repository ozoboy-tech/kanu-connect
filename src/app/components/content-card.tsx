import { kindLabels, spaceLabels, type Kind, type Space } from "@/modules/posts/domain/post-input";
import { projectLabels, type ProjectStatus } from "@/modules/projects/domain/project-input";
import { Avatar } from "./ui";

export function PublicationCard({ post }: { post: {
  id: string; authorHandle: string; title: string; excerpt: string;
  kind: Kind; space: Space; votes7Days: number;
} }) {
  return <article className="content-card">
    <div className="card-meta"><a href={`/u/${post.authorHandle}`} className="identity">
      <Avatar handle={post.authorHandle} /><span><strong>@{post.authorHandle}</strong>
        <small>{spaceLabels[post.space]}</small></span></a>
      <span className={`tag${post.kind === "question" ? " tag-blue" : ""}`}>{kindLabels[post.kind]}</span>
    </div>
    <h2><a href={`/posts/${post.id}`}>{post.title}</a></h2>
    <p className="card-excerpt">{post.excerpt}</p>
    <div className="card-footer"><span>↑ {post.votes7Days} vote{post.votes7Days === 1 ? "" : "s"} sur 7 jours</span>
      <a className="button button-small" href={`/posts/${post.id}`}>{post.kind === "question" ? "Aider" : "Découvrir"} →</a>
    </div>
  </article>;
}

export function ProjectCard({ project }: { project: {
  id: string; authorHandle: string | null; title: string; summary: string | null;
  status: ProjectStatus; technologies: string[];
} }) {
  return <article className="content-card project-card">
    <div className="card-meta">{project.authorHandle && <a className="identity" href={`/u/${project.authorHandle}`}>
      <Avatar handle={project.authorHandle} /><span><strong>@{project.authorHandle}</strong>
        <small>Projet de la communauté</small></span></a>}<span className="tag">{projectLabels[project.status]}</span></div>
    <h2><a href={`/projects/${project.id}`}>{project.title}</a></h2><p className="card-excerpt">{project.summary}</p>
    <ul className="tag-list" aria-label="Technologies">{project.technologies.map((technology) => <li key={technology}>{technology}</li>)}</ul>
    <div className="card-footer"><a className="text-link" href={`/projects/${project.id}`}>Voir le projet →</a></div>
  </article>;
}

export function MemberCard({ member }: { member: {
  handle: string; bio?: string | null; location?: string | null; skills?: string[];
} }) {
  return <article className="content-card member-card"><a className="identity" href={`/u/${member.handle}`}>
    <Avatar handle={member.handle} /><span><strong>@{member.handle}</strong>
      <small>{member.location ?? "Membre de Kanu"}</small></span></a>
    {member.bio && <p className="card-excerpt">{member.bio}</p>}
    {!!member.skills?.length && <ul className="tag-list" aria-label="Compétences">
      {member.skills.map((skill) => <li key={skill}>{skill}</li>)}</ul>}
    <a className="text-link" href={`/u/${member.handle}`}>Voir le profil →</a>
  </article>;
}
