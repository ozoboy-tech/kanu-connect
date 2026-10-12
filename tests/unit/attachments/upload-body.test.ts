import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { maxUploadBytes } from "@/modules/attachments/domain/attachment-input";
import { uploadBody, UploadTooLarge } from "@/server/attachments/upload-body";
const url = "http://localhost:3000/api/attachments/post/11111111-1111-4111-8111-111111111111";

it("lit un vrai formulaire de fichiers et refuse les champs supplémentaires", async () => {
  const form = new FormData();
  form.append("files", new File(["Bonjour Kanu"], "guide.txt", { type: "text/plain" }));
  expect(await uploadBody(new NextRequest(url, { method: "POST", body: form }), "post"))
    .toMatchObject([{ filename: "guide.txt", mimeType: "text/plain" }]);
  form.append("authorId", "usurpation");
  await expect(uploadBody(new NextRequest(url, { method: "POST", body: form }), "post")).rejects.toThrow();
});
it("bloque une taille annoncée excessive avant lecture", async () => {
  const request = new NextRequest(url, { method: "POST", headers: {
    "content-type": "multipart/form-data; boundary=test", "content-length": String(maxUploadBytes + 1),
  }, body: "test" });
  await expect(uploadBody(request, "post")).rejects.toBeInstanceOf(UploadTooLarge);
});
it("borne aussi le flux lorsque Content-Length est absent", async () => {
  const stream = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new Uint8Array(maxUploadBytes));
    controller.enqueue(new Uint8Array(1));
    controller.close();
  } });
  const request = new NextRequest(url, { method: "POST", headers: { "content-type": "multipart/form-data; boundary=test" },
    body: stream });
  await expect(uploadBody(request, "post")).rejects.toBeInstanceOf(UploadTooLarge);
});
it("refuse un formulaire vide ou plus de trois fichiers", async () => {
  const form = new FormData();
  await expect(uploadBody(new NextRequest(url, { method: "POST", body: form }), "post")).rejects.toThrow();
  for (let index = 0; index < 4; index++) form.append("files", new File(["texte"], `${index}.txt`, { type: "text/plain" }));
  await expect(uploadBody(new NextRequest(url, { method: "POST", body: form }), "post")).rejects.toThrow();
});
