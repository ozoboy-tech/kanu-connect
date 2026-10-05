import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { validPostId } from "@/modules/posts/domain/post-input";
import { authPool } from "@/server/auth/db";
import { getPost } from "@/server/posts/post-repository";
import PostForm from "../../post-form";

export default async function EditPostPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!validPostId(id)) notFound();
  const session = await auth();
  if (!session?.user.id) redirect("/api/auth/signin");
  const connection = await authPool().getConnection();
  let post;
  try { post = await getPost(connection, id); }
  finally { connection.release(); }
  if (!post || post.deleted) notFound();
  if (post.authorId !== session.user.id ||
      Date.now() - new Date(post.createdAt).getTime() >= 15 * 60_000) {
    redirect(`/posts/${id}`);
  }
  return <main><h1>Modifier la publication</h1><PostForm initial={post} /></main>;
}
