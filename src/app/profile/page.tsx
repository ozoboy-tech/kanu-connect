import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { authPool } from "@/server/auth/db";
import { getOwnProfile } from "@/server/members/profile-repository";
import ProfileEditor from "./profile-editor";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/profile");
  if (!session.user.onboarded) redirect("/onboarding");
  const connection = await authPool().getConnection();
  try {
    const profile = await getOwnProfile(connection, session.user.id);
    if (!profile) redirect("/onboarding");
    return <ProfileEditor initial={profile} />;
  } finally { connection.release(); }
}