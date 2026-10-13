import type { ReactNode } from "react";

export function Avatar({ handle, large = false, photoUrl }: {
  handle: string; large?: boolean; photoUrl?: string | null;
}) {
  return <span className={`avatar${large ? " avatar-large" : ""}`} aria-hidden="true">
    {photoUrl ? <img src={photoUrl} alt="" width={large ? 76 : 40} height={large ? 76 : 40} />
      : handle.replace(/^@/u, "").slice(0, 2).toUpperCase()}
  </span>;
}

export function PageHeading({ title, description, action }: {
  title: string; description?: string; action?: ReactNode;
}) {
  return <header className="page-heading"><div><h1>{title}</h1>
    {description && <p>{description}</p>}</div>{action}</header>;
}

export function EmptyState({ title, children, href, action }: {
  title: string; children?: ReactNode; href?: string; action?: string;
}) {
  return <div className="empty-state"><span className="empty-symbol" aria-hidden="true">◇</span>
    <h2>{title}</h2>{children && <p>{children}</p>}
    {href && action && <a className="button button-secondary" href={href}>{action}</a>}
  </div>;
}

export function Pagination({ page, hasNext, href, label = "Pagination" }: {
  page: number; hasNext: boolean; href: (page: number) => string; label?: string;
}) {
  return <nav className="pagination" aria-label={label}>
    {page > 1 ? <a href={href(page - 1)}>← Précédente</a> : <span />}
    <span>Page {page}</span>
    {hasNext ? <a href={href(page + 1)}>Suivante →</a> : <span />}
  </nav>;
}
