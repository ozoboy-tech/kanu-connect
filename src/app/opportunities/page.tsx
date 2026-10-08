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
    });

    if (session?.user.id) {
      categories = await getOpportunityCategories(connection, session.user.id);
    }
  } finally {
    connection.release();
  }

  return <main>
    <p><a href="/">Accueil</a> · <a href="/feed">Publications</a></p>
    <h1>Opportunités</h1>

    <p>
      <a href="/posts/new?kind=opportunity">Publier une opportunité</a>
    </p>

    <form method="get">
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

    <p>Les opportunités expirées sont archivées et retirées de cette liste.</p>

    {posts.length === 0 && <p>Aucune opportunité active pour ces filtres.</p>}

    <ul>{posts.map((post) => <li key={post.id}>
      <a href={`/posts/${post.id}`}>{post.title}</a>{" — "}
      <a href={`/u/${post.authorHandle}`}>@{post.authorHandle}</a>

      {post.opportunity && <p>
        {opportunityLabels[post.opportunity.category]} · Date limite :{" "}
        {post.opportunity.deadline.slice(0, 16).replace("T", " ")} UTC
      </p>}
    </li>)}</ul>

    {session && <CategoryPreferences initial={categories} />}

    {!session && <p>
      <a href="/api/auth/signin?callbackUrl=/opportunities">
        Se connecter pour suivre des catégories
      </a>
    </p>}
  </main>;
}
