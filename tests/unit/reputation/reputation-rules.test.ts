import { expect, it } from "vitest";
import { ACTION_POINTS, badgesForPoints } from
  "@/modules/reputation/domain/reputation-rules";

it("fixe le barème des activités", () => {
expect(ACTION_POINTS).toEqual({ post: 5, comment: 2, project: 8, follow: 1, streak: 5 });
});

it.each([
  [0, []], [9, []], [10, ["Premiers pas"]],
  [49, ["Premiers pas"]],
  [50, ["Premiers pas", "Contributeur"]],
  [200, ["Premiers pas", "Contributeur", "Pilier de Kanu"]],
])("attribue automatiquement les badges au seuil %i", (points, badges) => {
  expect(badgesForPoints(points)).toEqual(badges);
});
