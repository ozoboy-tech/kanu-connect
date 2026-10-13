"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { mobileNavigationArea, navigationArea, type NavigationArea } from "@/shared/ui/navigation";
import Icon, { type IconName } from "./ui-icon";
import { Avatar } from "./ui";

type Item = { id: NavigationArea; href: string; label: string; icon: IconName };
const primary: Item[] = [
  { id: "home", href: "/", label: "Accueil", icon: "home" },
  { id: "explore", href: "/explore?kind=posts", label: "Explorer", icon: "explore" },
  { id: "saved", href: "/saved", label: "Enregistrements", icon: "saved" },
  { id: "notifications", href: "/notifications", label: "Notifications", icon: "notifications" },
];
const community: Item[] = [
  { id: "projects", href: "/projects", label: "Projets", icon: "projects" },
  { id: "opportunities", href: "/opportunities", label: "Opportunités", icon: "opportunities" },
  { id: "leaderboard", href: "/leaderboard", label: "Classement", icon: "leaderboard" },
];
const personal: Item[] = [
  { id: "profile", href: "/profile", label: "Mon profil", icon: "profile" },
  { id: "preferences", href: "/preferences", label: "Préférences", icon: "preferences" },
  { id: "account", href: "/account", label: "Mon compte", icon: "account" },
];

export default function AppNavigation({ authenticated, handle, initialUnreadCount, role }: {
  authenticated: boolean; handle: string | null; initialUnreadCount: number;
  role: "member" | "moderator" | "admin" | null;
}) {
  const pathname = usePathname();
  const area = navigationArea(pathname);
  const mobileArea = mobileNavigationArea(pathname);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  useEffect(() => {
    function update(event: Event) {
      const count: unknown = (event as CustomEvent<unknown>).detail;
      if (typeof count === "number" && Number.isSafeInteger(count) && count >= 0) setUnreadCount(count);
    }
    window.addEventListener("kanu:notifications-changed", update);
    return () => window.removeEventListener("kanu:notifications-changed", update);
  }, []);

  const badge = <>{unreadCount > 0 && <span className="notification-count"
    aria-label={`${unreadCount} non lues`}>{unreadCount > 99 ? "99+" : unreadCount}</span>}</>;
  const navLink = (item: Item) => <a key={item.id} href={item.href}
    className={`nav-link${area === item.id ? " is-active" : ""}`}
    aria-current={area === item.id ? "page" : undefined}>
    <Icon name={item.icon} /><span>{item.label}</span>{item.id === "notifications" && badge}
  </a>;
  const mobileItems: Item[] = [primary[0], primary[1],
    { id: "create", href: "/create", label: "Créer", icon: "create" }, primary[3], personal[0]];
  return <>
    <a className="skip-link" href="#main-content">Aller au contenu</a>
    <header className="topbar">
      <a href="/" className="brand" aria-label="Kanu Connect, accueil">
        <span className="brand-mark" aria-hidden="true">K</span>
        <span><strong>Kanu Connect</strong><small>Créer. Connecter. Avancer.</small></span>
      </a>
      <form className="global-search" action="/explore" method="get" role="search">
        <Icon name="explore" /><input type="hidden" name="kind" value="posts" />
        <input type="search" name="q" maxLength={120} aria-label="Rechercher dans les publications"
          placeholder="Une question, une idée…" /><button type="submit" aria-label="Lancer la recherche">→</button>
      </form>
      <div className="topbar-actions">
        <a className="button header-create" href="/create"><Icon name="create" />Publier</a>
        {authenticated ? <>
          <a className="notification-shortcut" href="/notifications" aria-label={`Notifications, ${unreadCount} non lues`}>
            <Icon name="notifications" />{badge}</a>
          <a href="/profile" aria-label="Mon profil"><Avatar handle={handle ?? "K"} /></a>
        </> : <a className="button button-secondary" href="/api/auth/signin">Connexion</a>}
        <details className="mobile-menu"><summary aria-label="Ouvrir le menu"><Icon name="menu" /></summary>
          <nav className="mobile-menu-panel" aria-label="Autres destinations">
            {community.map(navLink)}{navLink(primary[2])}
            {authenticated && <>{personal.map(navLink)}
              {(role === "moderator" || role === "admin") && navLink({ id: "moderation", href: "/moderation", label: "Modération", icon: "moderation" })}
              {role === "admin" && navLink({ id: "admin", href: "/admin", label: "Administration", icon: "admin" })}
              <a className="nav-link" href="/api/auth/signout">Se déconnecter</a></>}
          </nav>
        </details>
      </div>
    </header>
    <aside className="sidebar" aria-label="Navigation principale">
      <nav>{primary.map(navLink)}</nav>
      <p className="nav-group-label">Communauté</p><nav aria-label="Communauté">{community.map(navLink)}</nav>
      {authenticated && <>
        <p className="nav-group-label">Mon espace</p><nav aria-label="Mon espace">{personal.map(navLink)}
          {(role === "moderator" || role === "admin") && navLink({ id: "moderation", href: "/moderation", label: "Modération", icon: "moderation" })}
          {role === "admin" && navLink({ id: "admin", href: "/admin", label: "Administration", icon: "admin" })}
        </nav>
      </>}
      <div className="sidebar-footer">
        {authenticated ? <><a href="/profile" className="identity"><Avatar handle={handle ?? "K"} />
          <span><strong>{handle ? `@${handle}` : "Mon compte"}</strong><small>Plus loin ensemble.</small></span></a>
          <a className="text-link" href="/api/auth/signout">Se déconnecter</a></>
          : <><p>Apprends, partage et construis avec la communauté.</p>
            <a className="button" href="/register">Rejoindre Kanu</a></>}
      </div>
    </aside>
    <nav className="mobile-nav" aria-label="Navigation mobile">
      {mobileItems.map((item) => <a key={item.id} href={item.href}
        className={`mobile-nav-item${item.id === "create" ? " mobile-create" : ""}${mobileArea === item.id ? " is-active" : ""}`}
        aria-current={mobileArea === item.id ? "page" : undefined}>
        <span><Icon name={item.icon} />{item.id === "notifications" && badge}</span>
        <small>{item.id === "profile" ? "Profil" : item.label}</small>
      </a>)}
    </nav>
  </>;
}
