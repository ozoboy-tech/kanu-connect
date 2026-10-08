import { expect, it } from "vitest";
import { extractMentionedHandles } from "@/modules/notifications/domain/notification-input";

it("repère les pseudos et retire les doublons sans tenir compte de la casse", () => {
  expect(extractMentionedHandles("Bonjour @Alice, (@bob_2) et @ALICE !"))
    .toEqual(["alice", "bob_2"]);
});

it("ignore les e-mails, les pseudos courts et les pseudos trop longs", () => {
  expect(
    extractMentionedHandles(
      `alice@example.test @ab @${"x".repeat(31)} é@alice @Kelvin @ſam`,
    ),
  ).toEqual([]);
});

it("accepte trente caractères sans conserver un morceau de pseudo invalide", () => {
  expect(extractMentionedHandles(`@${"x".repeat(30)} @aliçe`))
    .toEqual(["x".repeat(30)]);
});

it("limite chaque contenu à vingt pseudos distincts à notifier", () => {
  const text = Array.from(
    { length: 25 },
    (_, index) => `@user_${index}`,
  ).join(" ");

  expect(extractMentionedHandles(text)).toHaveLength(20);
});
