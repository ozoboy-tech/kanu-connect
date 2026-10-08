import { redirect } from "next/navigation";

import { auth } from "@/auth";
import PostForm from "../post-form";

export default async function NewPostPage({ searchParams }: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const query = await searchParams;
  const destination = query.kind === "opportunity"
    ? "/posts/new?kind=opportunity"
    : "/posts/new";

  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(destination)}`);
  }

  if (!session.user.onboarded) redirect("/onboarding");

  return <main>
    <h1>Nouvelle publication</h1>
    <PostForm startAsOpportunity={query.kind === "opportunity"} />
  </main>;
}
