import { redirect } from "next/navigation";

import { auth } from "@/auth";
import PostForm from "../post-form";

export default async function NewPostPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/posts/new");
  if (!session.user.onboarded) redirect("/onboarding");
  return <main><h1>Nouvelle publication</h1><PostForm /></main>;
}
