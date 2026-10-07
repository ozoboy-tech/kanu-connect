import Connections from "../connections";

export default function FollowersPage({ params }: {
  params: Promise<{ handle: string }>;
}) {
  return <Connections params={params} kind="followers" />;
}
