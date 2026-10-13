import { describe, expect, it } from "vitest";
import { mobileNavigationArea, navigationArea } from "@/shared/ui/navigation";

describe("Navigation de Kanu", () => {
  it("garde l'accueil actif sur le fil et les publications", () => {
    expect(navigationArea("/")).toBe("home");
    expect(navigationArea("/feed")).toBe("home");
    expect(navigationArea("/posts/123")).toBe("home");
  });
  it("distingue la création et la modification des contenus", () => {
    expect(navigationArea("/create")).toBe("create");
    expect(navigationArea("/posts/new")).toBe("create");
    expect(navigationArea("/projects/new")).toBe("create");
    expect(navigationArea("/posts/123/edit")).toBe("create");
    expect(navigationArea("/projects/123/edit")).toBe("create");
    expect(navigationArea("/projects/123/discussion")).toBe("projects");
  });
  it("rattache les écrans secondaires aux cinq destinations mobiles", () => {
    for (const path of ["/projects", "/opportunities", "/leaderboard"]) {
      expect(mobileNavigationArea(path)).toBe("explore");
    }
    for (const path of ["/profile", "/u/awa/activity", "/saved", "/account", "/preferences", "/admin"]) {
      expect(mobileNavigationArea(path)).toBe("profile");
    }
    expect(mobileNavigationArea("/notifications")).toBe("notifications");
  });
  it("ne confond pas des préfixes voisins avec une destination", () => {
    expect(navigationArea("/profile-other")).toBeNull();
    expect(navigationArea("/notifications-other")).toBeNull();
    expect(navigationArea("/unknown")).toBeNull();
  });
});
