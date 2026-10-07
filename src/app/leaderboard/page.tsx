import { authPool } from "@/server/auth/db";
import { listLeaderboard } from "@/server/reputation/reputation-repository";

export default async function LeaderboardPage({
  searchParams,
}: { searchParams: Promise<{ period?: string }> }) {
  const period = (await searchParams).period === "week" ? "week" : "all";
  const connection = await authPool().getConnection();
  try {
    const ranking = await listLeaderboard(connection, period);
    return <main>
      <h1>Classement</h1>
      <nav><a href="/leaderboard">Général</a> · <a href="/leaderboard?period=week">7 derniers jours</a></nav>
      <p>{period === "week" ? "Points obtenus sur 7 jours glissants" : "Points depuis le début"}</p>
      <ol>{ranking.map((member) => <li key={member.handle}>
        <a href={`/u/${member.handle}`}>@{member.handle}</a> — {member.points} points,
        {" "}{member.votes} votes reçus

      </li>)}</ol>
    </main>;
  } finally { connection.release(); }
}
