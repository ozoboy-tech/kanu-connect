import { authPool } from "@/server/auth/db";
import { listPosts } from "@/server/posts/post-repository";
import { spaces, type Space } from "@/modules/posts/domain/post-input";

export const dynamic = "force-dynamic";

const labels: Record<Space, string> = {
  questions: "Questions", sharing: "Partages / astuces",
  projects: "Projets", opportunities: "Opportunités",
};

export default async function FeedPage({ searchParams }: {
  searchParams: Promise<{ space?: string }>;
}) {
  const raw = (await searchParams).space;
  const space = raw && spaces.includes(raw as Space) ? raw as Space : null;
  const connection = await authPool().getConnection();
  let posts;
  try { posts = await listPosts(connection, space); }
  finally { connection.release(); }
  return <main>
    <h1>Publications récentes</h1>
    <p><a href="/posts/new">Créer une publication</a></p>
    <p><a href="/projects">Découvrir les projets</a></p>
    <nav><a href="/feed">Tous</a>{" · "}
      {spaces.map((item) => <span key={item}>
        <a href={`/feed?space=${item}`}>{labels[item]}</a>{" · "}
      </span>)}
    </nav>
    {posts.length === 0 && <p>Aucune publication pour le moment.</p>}
    <ul>{posts.map((post) => <li key={post.id}>
      <a href={`/posts/${post.id}`}>{post.title}</a>{" — "}
      <a href={`/u/${post.authorHandle}`}>@{post.authorHandle}</a>
      {" · "}{labels[post.space as Space]}
    </li>)}</ul>
  </main>;
}
