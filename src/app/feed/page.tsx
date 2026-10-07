import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { authPool } from "@/server/auth/db";
import { listPosts } from "@/server/posts/post-repository";
import { spaces, type Space } from "@/modules/posts/domain/post-input";

export const dynamic = "force-dynamic";

const labels: Record<Space, string> = {
  questions: "Questions", sharing: "Partages / astuces",
  projects: "Projets", opportunities: "Opportunités",
};

export default async function FeedPage({ searchParams }: {
  searchParams: Promise<{ space?: string; feed?: string }>;
}) {
  const query = await searchParams;
  const raw = query.space;
  const space = raw && spaces.includes(raw as Space) ? raw as Space : null;
  const following = query.feed === "following";
  const session = following ? await auth() : null;
  if (following && !session?.user?.id) {
    const destination = `/feed?feed=following${space ? `&space=${space}` : ""}`;
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(destination)}`);
  }
  if (following && !session?.user.onboarded) redirect("/onboarding");
  const connection = await authPool().getConnection();
  let posts;
  try { posts = await listPosts(connection, space, following ? session!.user.id : null); }
  finally { connection.release(); }
  const base = following ? "feed=following" : "";
  const spaceQuery = space ? `&space=${space}` : "";
  return <main>
    <h1>{following ? "Mon fil" : "Publications récentes"}</h1>
    <p><a href="/posts/new">Créer une publication</a></p>
    <p><a href="/projects">Découvrir les projets</a></p>
    <nav aria-label="Choisir un fil">
      <a href={space ? `/feed?space=${space}` : "/feed"}
        aria-current={!following ? "page" : undefined}>Fil public</a>{" · "}
      <a href={`/feed?feed=following${spaceQuery}`}
        aria-current={following ? "page" : undefined}>Mon fil</a>
    </nav>
    <nav aria-label="Filtrer les espaces">
      <a href={base ? `/feed?${base}` : "/feed"}>Tous les espaces</a>{" · "}
      {spaces.map((item) => <span key={item}>
        <a href={`/feed?${base ? `${base}&` : ""}space=${item}`}>{labels[item]}</a>{" · "}
      </span>)}
    </nav>
    {posts.length === 0 && <p>{following
      ? "Aucune publication ici. Suis des membres depuis le fil public ou leur profil."
      : "Aucune publication pour le moment."}</p>}
    <ul>{posts.map((post) => <li key={post.id}>
      <a href={`/posts/${post.id}`}>{post.title}</a>{" — "}
      <a href={`/u/${post.authorHandle}`}>@{post.authorHandle}</a>
      {" · "}{labels[post.space as Space]}
    </li>)}</ul>
  </main>;
}
