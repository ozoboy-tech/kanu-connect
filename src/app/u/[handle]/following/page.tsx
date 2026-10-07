import Connections from "../connections";

export default function FollowingPage({ params }: {
  params: Promise<{ handle: string }>;
}) {
  return <Connections params={params} kind="following" />;
}
