import { expect, it } from "vitest";
import { parseAdminAction } from "@/server/accounts/admin-repository";
import { visibleToViewerSql } from "@/server/members/block-repository";

it("n'accepte que des actions motivées et des rôles explicitement prévus", () => {
  expect(parseAdminAction({ action: "role", role: "moderator", reason: "  Équipe Kanu  " }))
    .toEqual({ action: "role", role: "moderator", reason: "Équipe Kanu" });
  expect(parseAdminAction({ action: "suspend", reason: "Abus confirmé" }))
    .toEqual({ action: "suspend", reason: "Abus confirmé" });
  expect(() => parseAdminAction({ action: "role", role: "superuser",
    reason: "Équipe Kanu" })).toThrow(TypeError);
  expect(() => parseAdminAction({ action: "restore", reason: "a" })).toThrow(TypeError);
  expect(() => parseAdminAction({ action: "delete", reason: "Motif valable" }))
    .toThrow(TypeError);
});

it("filtre les relations de blocage dans les deux directions avec des paramètres", () => {
  const sql = visibleToViewerSql("p.member_id");
  expect(sql).toContain("block_record.blocker_id = viewer.id");
  expect(sql).toContain("block_record.blocked_id = viewer.id");
  expect(sql).toContain("viewer.public_id = ?");
  expect(sql).toContain("p.member_id");
});
