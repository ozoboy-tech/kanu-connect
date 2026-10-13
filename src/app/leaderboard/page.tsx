import { auth } from "@/auth";
import { authPool } from "@/server/auth/db";
import { listLeaderboard } from "@/server/reputation/reputation-repository";
import { Avatar, EmptyState, PageHeading } from "@/app/components/ui";

export default async function LeaderboardPage({ searchParams }: {
  searchParams: Promise<{ period?: string }>;
}) {
  const period = (await searchParams).period === "week" ? "week" : "all";
  const session = await auth();
  const connection = await authPool().getConnection();
  try {
    const ranking = await listLeaderboard(connection, period, session?.user.id ?? null);
    const visible = ranking.map((member, index) => ({ ...member, rank: index + 1 }));
    return <main><PageHeading title="Classement" description="Les contributions utiles font grandir la communauté." />
      <nav className="tabs" aria-label="Période du classement">
        <a href="/leaderboard" aria-current={period === "all" ? "page" : undefined}>Général</a>
        <a href="/leaderboard?period=week" aria-current={period === "week" ? "page" : undefined}>7 derniers jours</a></nav>
      <p className="result-summary">{period === "week" ? "Points obtenus sur 7 jours glissants" : "Points depuis le début"}</p>
      {!visible.length && <EmptyState title="Le classement attend vos premières contributions." />}
      <ol className="rank-list">{visible.map((member) => <li key={member.handle} className="ranking-card">
        <span className="rank-number" aria-label={`Rang ${member.rank}`}>{member.rank}</span>
        <a href={`/u/${member.handle}`} className="identity"><Avatar handle={member.handle} />
          <span><strong>@{member.handle}</strong><small>{member.votes} votes reçus</small></span></a>
        <strong className="rank-score">{member.points} pts</strong>
      </li>)}</ol>
    </main>;
  } finally { connection.release(); }
}
