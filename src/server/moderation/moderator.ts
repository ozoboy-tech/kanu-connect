export function isModerator(
  memberId: string | undefined,
): boolean {
  if (!memberId) return false;

  return (process.env.KANU_MODERATOR_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .some((id) => id !== "" && id === memberId);
}
