import { cache } from "react";
import { auth } from "@/auth";
import { authPool } from "@/server/auth/db";
import { getOwnProfile } from "@/server/members/profile-repository";
import { roleOf } from "@/server/moderation/moderator";
import { countUnreadNotifications } from "@/server/notifications/notification-repository";
import { getDiscoveryPreferences } from "@/server/discovery/preferences-repository";
import { getReputation } from "@/server/reputation/reputation-repository";
import { getPublicStreak } from "@/server/streaks/streak-repository";

// Réutilisé par le layout et l'accueil pendant une même requête.
export const getViewerSummary = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const connection = await authPool().getConnection();
  try {
    const profile = await getOwnProfile(connection, session.user.id);
    const preferences = await getDiscoveryPreferences(connection, session.user.id);
    const role = await roleOf(connection, session.user.id);
    const unreadCount = await countUnreadNotifications(connection, session.user.id);
    const reputation = profile ? await getReputation(connection, profile.handle) : null;
    const streak = profile ? await getPublicStreak(connection, profile.handle) : null;
    return {
      id: session.user.id, onboarded: session.user.onboarded,
      handle: profile?.handle ?? null, photoUrl: profile?.photoUrl ?? null,
      role, unreadCount, preferences, reputation, streak,
    };
  } finally { connection.release(); }
});
