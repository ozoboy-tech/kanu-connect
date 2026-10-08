import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { getPost } from "@/server/posts/post-repository";
import VoteButton from "@/app/components/vote-button";
import ReportButton from "@/app/components/report-button";
import PostActions from "./post-actions";
import Comments from "./comments";
import { opportunityLabels } from "@/modules/opportunities/domain/opportunity-input";
export const dynamic = "force-dynamic";



export default async function PostPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!validPostId(id)) notFound();
  const connection = await authPool().getConnection();
  let post;
  try { post = await getPost(connection, id); }
  finally { connection.release(); }
  if (!post) notFound();
  const session = await auth();
  const mayEdit = !post.deleted && session?.user.id === post.authorId &&
    Date.now() - new Date(post.createdAt).getTime() < 15 * 60_000;
  return <main>
    <p><a href="/feed">Retour aux publications</a></p>
    <h1>{post.title}</h1>
    {!post.deleted && <>
      <p>Par <a href={`/u/${post.authorHandle}`}>@{post.authorHandle}</a></p>
      <p>Espace : {post.space} · Type : {post.kind}</p>

      {post.kind === "opportunity" && <section>
        <h2>Opportunité</h2>

        {post.opportunity ? <>
          <p>{opportunityLabels[post.opportunity.category]}</p>

          <p>
            Date limite :{" "}
            {post.opportunity.deadline.slice(0, 16).replace("T", " ")} UTC
          </p>

          {post.opportunity.archived
            ? <p>Opportunité archivée : la date limite est dépassée.</p>
            : <p>
                <a href={post.opportunity.applyUrl}
                  target="_blank" rel="noopener noreferrer">
                  Postuler sur le site externe
                </a>
              </p>}
        </> : <p>
          Opportunité archivée : informations de candidature manquantes.
        </p>}
      </section>}

      <p style={{ whiteSpace: "pre-wrap" }}>{post.body}</p>
      {post.code && <section><h2>Code ({post.codeLanguage})</h2>
        <pre><code>{post.code}</code></pre></section>}
          <p>Mots-clés : {post.keywords.join(", ")}</p>
      <VoteButton kind="post" id={post.id}
        viewerId={session?.user.id ?? null}
        authorId={post.authorId}
        canVote={!!session?.user.onboarded} />
      <ReportButton kind="post" id={post.id}
        viewerId={session?.user.id ?? null}
        authorId={post.authorId}
        canReport={!!session?.user.onboarded} />

    </>}
    {mayEdit && <PostActions id={post.id} />}
    <Comments postId={post.id} viewerId={session?.user.id ?? null}
      canWrite={!!session?.user.onboarded && !post.deleted}
      isQuestion={post.kind === "question" && !post.deleted}
      canResolve={!!session?.user.onboarded &&
        session.user.id === post.authorId &&
        post.kind === "question" && !post.deleted} />

  </main>;
}
