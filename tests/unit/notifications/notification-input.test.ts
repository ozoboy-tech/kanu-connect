import { expect, it } from "vitest";
import {
  defaultNotificationPreferences,
  parseNotificationFilter,
  parseNotificationPreferences,
} from "@/modules/notifications/domain/notification-input";

it("limite les filtres aux catégories connues", () => {
  expect(parseNotificationFilter(null)).toBe("all");
  expect(parseNotificationFilter("solutions")).toBe("solutions");
  expect(parseNotificationFilter("unread")).toBe("unread");
  expect(() => parseNotificationFilter("other")).toThrow(TypeError);
});

it("accepte uniquement les quatre choix booléens", () => {
  expect(parseNotificationPreferences(defaultNotificationPreferences))
    .toEqual(defaultNotificationPreferences);
  expect(() => parseNotificationPreferences({
    ...defaultNotificationPreferences, memberId: "other",
  })).toThrow(TypeError);
  expect(() => parseNotificationPreferences({
    ...defaultNotificationPreferences, communityEnabled: "false",
  })).toThrow(TypeError);
  expect(() => parseNotificationPreferences({ projectsEnabled: false })).toThrow(TypeError);
});
