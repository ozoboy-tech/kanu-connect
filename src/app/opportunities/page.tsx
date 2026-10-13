import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  opportunityCategories,
  opportunityLabels,
  type OpportunityCategory,
} from "@/modules/opportunities/domain/opportunity-input";
import { authPool } from "@/server/auth/db";
import { getOpportunityCategories } from "@/server/opportunities/opportunity-repository";
import { listPosts } from "@/server/posts/post-repository";
import CategoryPreferences from "./category-preferences";
import { Avatar, EmptyState, PageHeading } from "@/app/components/ui";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage({ searchParams }: {
  searchParams: Promise<{ category?: string; mine?: string }>;
}) {
  const query = await searchParams;
  const category = query.category || null;

  if (
    category &&
    !opportunityCategories.includes(category as OpportunityCategory)
  ) {
    notFound();
  }

  const mine = query.mine === "1";
  const session = await auth();

  if (mine && !session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=/opportunities%3Fmine%3D1");
  }

  if (session && !session.user.onboarded) redirect("/onboarding");

  const connection = await authPool().getConnection();
  let posts;
  let categories: OpportunityCategory[] = [];

  try {
    posts = await listPosts(connection, "opportunities", null, {
      category: category as OpportunityCategory | null,
      subscribedBy: mine ? session!.user.id : null,
    }, session?.user.id ?? null);

    if (session?.user.id) {
      categories = await getOpportunityCategories(connection, session.user.id);
    }
  } finally {
    connection.release();
  }

  return <main>
    <PageHeading title="Opportunités" description="Des pistes pour apprendre, travailler et relever de nouveaux défis."
      action={<a className="button" href="/posts/new?kind=opportunity">Partager une opportunité</a>} />
    <form className="filter-panel" method="get">
      <p><label>
        Catégorie{" "}
        <select name="category" defaultValue={category ?? ""}>
          <option value="">Toutes les catégories</option>
          {opportunityCategories.map((item) => <option key={item} value={item}>
            {opportunityLabels[item]}
          </option>)}
        </select>
      </label></p>
      <p><label>
        <input
          type="checkbox"
          name="mine"
          value="1"
          defaultChecked={mine}
        />{" "}
        Uniquement mes catégories suivies
      </label></p>

      <button type="submit">Filtrer</button>
    </form>

    <p className="result-summary">Les opportunités expirées sont archivées et retirées de cette liste.</p>

    {posts.length === 0 && <EmptyState title="Aucune opportunité active pour ces filtres."
      href="/opportunities" action="Voir toutes les catégories" />}

    <ul className="card-list">{posts.map((post) => <li key={post.id}><article className="content-card">
      <div className="card-meta">{post.authorHandle && <a className="identity" href={`/u/${post.authorHandle}`}>
        <Avatar handle={post.authorHandle} /><strong>@{post.authorHandle}</strong></a>}
        <span className="tag">Opportunité</span></div>
      <h2><a href={`/posts/${post.id}`}>{post.title}</a></h2>
      <p className="card-excerpt">{post.body}</p>

      {post.opportunity && <p>
        {opportunityLabels[post.opportunity.category]} · Date limite :{" "}
        {post.opportunity.deadline.slice(0, 16).replace("T", " ")} UTC
      </p>}
      <div className="card-footer"><a className="text-link" href={`/posts/${post.id}`}>Voir les détails et la candidature →</a></div>
    </article></li>)}</ul>

    {session && <CategoryPreferences initial={categories} />}

    {!session && <p>
      <a href="/api/auth/signin?callbackUrl=/opportunities">
        Se connecter pour suivre des catégories
      </a>
    </p>}
  </main>;
}