import {
  notFound,
  redirect,
} from "next/navigation";

import { auth } from "@/auth";
import { authPool } from "@/server/auth/db";
import { isModerator } from
  "@/server/moderation/moderator";
import { listModerationQueue } from
  "@/server/moderation/moderation-repository";
import ModerationQueue from "./moderation-queue";

export default async function ModerationPage() {
  const session = await auth();

  if (!session?.user.id) {
    redirect("/api/auth/signin");
  }

  if (!isModerator(session.user.id)) {
    notFound();
  }

  const connection = await authPool().getConnection();

  try {
    const items = await listModerationQueue(
      connection,
      session.user.id,
    );

    return <main>
      <p><a href="/">Accueil</a></p>
      <h1>Modération</h1>
      <p>
        Signalements récents, limités aux
        50 derniers contenus.
      </p>
      <ModerationQueue items={items} />
    </main>;
  } finally {
    connection.release();
  }
}
