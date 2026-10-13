"use client";

import { useEffect, useState } from "react";

export default function CommunityBanner() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try { setHidden(window.localStorage.getItem("kanu-banner-hidden") === "true"); }
    catch { /* La bannière reste fermable si le stockage est désactivé. */ }
  }, []);
  if (hidden) return null;
  return <section className="community-banner" aria-label="Bienvenue dans la communauté">
    <div className="banner-copy"><p className="eyebrow">Une communauté de développeurs africains</p>
      <h2>Poser. <em>Aider.</em> Grandir.</h2>
      <p>Des réponses concrètes, une entraide réelle, des projets à construire ensemble.</p>
    </div>
    <button type="button" className="close-banner" aria-label="Masquer la bannière" onClick={() => {
      try { window.localStorage.setItem("kanu-banner-hidden", "true"); } catch { /* Fermeture locale. */ }
      setHidden(true);
      document.getElementById("help-heading")?.focus();
    }}>×</button>
  </section>;
}
