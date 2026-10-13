import {
  notFound,
  redirect,
} from "next/navigation";

import { auth } from "@/auth";
import { authPool } from "@/server/auth/db";
import { canModerate } from
  "@/server/moderation/moderator";
import { listModerationQueue } from
  "@/server/moderation/moderation-repository";
import ModerationQueue from "./moderation-queue";

export default async function ModerationPage() {
  const session = await auth();

  if (!session?.user.id) {
    redirect("/api/auth/signin");
  }

  const connection = await authPool().getConnection();

  try {
    if (!await canModerate(connection, session.user.id)) notFound();
    const items = await listModerationQueue(
      connection,
      session.user.id,
    );

    return <main>
      <p><a href="/">Accueil</a></p>
      <h1>Modération</h1>
      <p>
        Signalements récents, limités aux
        50 derniers contenus. Les modérateurs masquent provisoirement ;
        les administrateurs prennent la décision finale.
      </p>
      <ModerationQueue items={items} />
    </main>;
  } finally {
    connection.release();
  }
}
