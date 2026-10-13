import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { validPostId, kindLabels, spaceLabels, type Kind, type Space } from "@/modules/posts/domain/post-input";
import { Avatar } from "@/app/components/ui";
import { authPool } from "@/server/auth/db";
import { getPost } from "@/server/posts/post-repository";
import VoteButton from "@/app/components/vote-button";
import ReportButton from "@/app/components/report-button";
import AttachmentPanel from "@/app/components/attachment-panel";
import BookmarkButton from "@/app/components/bookmark-button";
import PostActions from "./post-actions";
import Comments from "./comments";
import { opportunityLabels } from "@/modules/opportunities/domain/opportunity-input";
export const dynamic = "force-dynamic";
export default async function PostPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!validPostId(id)) notFound();
  const session = await auth();
  const connection = await authPool().getConnection();
  let post;
  try { post = await getPost(connection, id, session?.user.id ?? null); }
  finally { connection.release(); }
  if (!post) notFound();
  const mayEdit = !post.deleted && session?.user.id === post.authorId &&
    Date.now() - new Date(post.createdAt).getTime() < 15 * 60_000;
  return <main>
    <a className="back-link" href="/feed">← Retour aux publications</a>
    <header className="detail-heading"><h1>{post.title}</h1>
      {!post.deleted && <div className="card-meta">{post.authorHandle && <a className="identity" href={`/u/${post.authorHandle}`}>
        <Avatar handle={post.authorHandle} /><span><strong>@{post.authorHandle}</strong>
          <small><time dateTime={new Date(post.createdAt).toISOString()}>{new Date(post.createdAt).toISOString().slice(0, 10)}</time></small></span></a>}
        <span className="tag">{kindLabels[post.kind as Kind] ?? post.kind}</span></div>}
    </header>
    {!post.deleted && <>
      <BookmarkButton kind="post" id={post.id} canSave={!!session?.user.onboarded} />
      <p className="result-summary">{spaceLabels[post.space as Space] ?? post.space}</p>

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

      <p className="detail-body">{post.body}</p>
      <AttachmentPanel kind="post" id={post.id} canEdit={mayEdit && !!session?.user.onboarded} />
      {post.code && <section><h2>Code ({post.codeLanguage})</h2>
        <pre><code>{post.code}</code></pre></section>}
      <ul className="tag-list" aria-label="Mots-clés">{post.keywords.map((keyword) => <li key={keyword}>#{keyword}</li>)}</ul>
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
