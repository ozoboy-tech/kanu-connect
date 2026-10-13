import { redirect } from "next/navigation";

import { auth } from "@/auth";
import PostForm from "../post-form";
import { PageHeading } from "@/app/components/ui";

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
    <a className="back-link" href="/create">← Choisir un autre contenu</a>
    <PageHeading title={query.kind === "opportunity" ? "Partager une opportunité" : "Nouvelle publication"}
      description="Partage ton expérience ou demande un coup de main à la communauté." />
    <PostForm startAsOpportunity={query.kind === "opportunity"} />
  </main>;
}