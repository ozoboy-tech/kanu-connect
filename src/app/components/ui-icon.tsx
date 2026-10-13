export type IconName = "home" | "explore" | "create" | "notifications" | "profile" |
  "projects" | "opportunities" | "saved" | "leaderboard" | "preferences" |
  "account" | "moderation" | "admin" | "flame" | "menu";

const iconPaths: Record<IconName, string> = {
  home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  explore: "M21 21l-5-5M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  create: "M12 5v14M5 12h14",
  notifications: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  profile: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  projects: "M3 7V5h7l2 3h9v13H3ZM3 12h18",
  opportunities: "M3 7h18v14H3ZM8 7V3h8v4M3 13h18M10 13v3h4v-3",
  saved: "M5 3h14v18l-7-5-7 5Z",
  leaderboard: "M8 3h8v8a4 4 0 0 1-8 0ZM8 5H3v3a4 4 0 0 0 5 4M16 5h5v3a4 4 0 0 1-5 4M12 15v6M8 21h8",
  preferences: "M4 7h16M4 17h16M8 4v6M16 14v6",
  account: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7ZM9 12l2 2 4-4",
  moderation: "M4 21V3h16l-3 5 3 5H4",
  admin: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7ZM12 8v5M12 16h.01",
  flame: "M12 3c2 3 1 5 1 7 2-1 3-2 3-4 3 3 4 6 4 9a8 8 0 0 1-16 0c0-4 3-7 8-12Z",
  menu: "M4 6h16M4 12h16M4 18h16",
};

export default function Icon({ name }: { name: IconName }) {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={iconPaths[name]} fill={name === "flame" ? "currentColor" : "none"} />
    {name === "flame" && <path d="M12 12c1 2 3 3 3 5a3 3 0 0 1-6 0c0-2 2-3 3-5Z" fill="#fff" stroke="none" />}
  </svg>;
}
