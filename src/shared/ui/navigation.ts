export type NavigationArea = "home" | "explore" | "create" | "notifications" |
  "profile" | "projects" | "opportunities" | "saved" | "leaderboard" |
  "preferences" | "account" | "moderation" | "admin";

export function navigationArea(pathname: string): NavigationArea | null {
  if (pathname === "/" || pathname === "/feed") return "home";
  if (pathname === "/create" || pathname === "/posts/new" || pathname === "/projects/new" ||
      /^\/(posts|projects)\/[^/]+\/edit\/?$/u.test(pathname)) return "create";
  if (pathname.startsWith("/posts/")) return "home";
  if (pathname.startsWith("/u/") || pathname === "/profile" ||
      pathname === "/onboarding" || pathname === "/welcome") return "profile";
  const sections = ["explore", "notifications", "projects", "opportunities", "saved",
    "leaderboard", "preferences", "account", "moderation", "admin"] as const;
  return sections.find((area) => pathname === `/${area}` || pathname.startsWith(`/${area}/`)) ?? null;
}

export function mobileNavigationArea(pathname: string): NavigationArea | null {
  const area = navigationArea(pathname);
  if (area === "projects" || area === "opportunities" || area === "leaderboard") return "explore";
  if (area === "saved" || area === "preferences" || area === "account" ||
      area === "moderation" || area === "admin") return "profile";
  return area;
}
