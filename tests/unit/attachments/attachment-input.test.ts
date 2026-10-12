import { describe, expect, it } from "vitest";
import { maxAttachmentBytes, parseAttachmentKind, validateAttachment } from "@/modules/attachments/domain/attachment-input";

const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII=", "base64"));
const bytes = (text: string) => new TextEncoder().encode(text);

describe("Fichiers joints", () => {
  it("accepte les types autorisés et nettoie le nom", () => {
    expect(validateAttachment("C:\\images\\capture.PNG", "image/png", png)).toMatchObject({ filename: "capture.PNG", mimeType: "image/png" });
    expect(validateAttachment("guide.txt", "text/plain", bytes("Bonjour\nKanu"))).toMatchObject({ mimeType: "text/plain" });
    expect(validateAttachment("guide.pdf", "application/pdf", bytes("%PDF-1.7\ncontenu\n%%EOF"))).toMatchObject({ mimeType: "application/pdf" });
  });
  it("refuse les types actifs, fausses extensions et MIME incohérents", () => {
    for (const [name, type, data] of [
      ["image.svg", "image/svg+xml", bytes("<svg/>")], ["image.png", "image/png", bytes("<script>test</script>")],
      ["capture.png", "text/html", png], ["test.txt", "text/plain", new Uint8Array([255])],
      ["test.txt", "text/plain", bytes("abc\u0000def")], ["test.exe", "", png],
    ] as const) expect(() => validateAttachment(name, type, data)).toThrow();
  });
  it("refuse les fichiers vides et les fichiers de plus de quatre Mio", () => {
    expect(() => validateAttachment("a.txt", "text/plain", new Uint8Array())).toThrow();
    expect(() => validateAttachment("a.txt", "text/plain", new Uint8Array(maxAttachmentBytes + 1))).toThrow();
  });
  it("réserve les captures de projets aux images", () => {
    expect(validateAttachment("capture.png", "image/png", png, true).mimeType).toBe("image/png");
    expect(() => validateAttachment("a.txt", "text/plain", bytes("texte"), true)).toThrow();
    expect(() => validateAttachment("a.pdf", "application/pdf", bytes("%PDF-1.7\n%%EOF"), true)).toThrow();
  });
  it("refuse les noms vides, longs et les types de contenu inconnus", () => {
    expect(() => validateAttachment("\r\n", "image/png", png)).toThrow();
    expect(() => validateAttachment("a".repeat(161) + ".png", "image/png", png)).toThrow();
    expect(parseAttachmentKind("project")).toBe("project");
    expect(() => parseAttachmentKind("members")).toThrow();
  });
});
