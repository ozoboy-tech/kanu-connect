import {
  afterEach,
  expect,
  it,
  vi,
} from "vitest";

import { sendAuthMail } from
  "@/server/auth/mailer";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function localEnv() {
  vi.stubEnv(
    "KANU_DEV_MAIL_TO_CONSOLE",
    "1",
  );
  vi.stubEnv(
    "KANU_DATABASE_NAME",
    "kanuconnectdev",
  );
  vi.stubEnv(
    "AUTH_URL",
    "http://127.0.0.1:3000",
  );
  vi.stubEnv(
    "NODE_ENV",
    "development",
  );
  vi.stubEnv(
    "KANU_SMTP_HOST",
    "",
  );
}

it(
  "affiche le lien de vérification en développement local",
  async () => {
    localEnv();

    const log = vi
      .spyOn(console, "info")
      .mockImplementation(() => {});

    await sendAuthMail(
      "membre@example.test",
      "verify",
      "token-test",
    );

    expect(log).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "http://127.0.0.1:3000/api/auth/verify-email?token=token-test",
      ),
    );
  },
);

it.each([
  [
    "production",
    "kanuconnectdev",
    "http://127.0.0.1:3000",
  ],
  [
    "development",
    "kanuconnecttest",
    "http://127.0.0.1:3000",
  ],
  [
    "development",
    "kanuconnectdev",
    "https://example.test",
  ],
])(
  "refuse le mode console hors du développement local (%s, %s, %s)",
  async (nodeEnv, database, base) => {
    localEnv();

    vi.stubEnv("NODE_ENV", nodeEnv);
    vi.stubEnv(
      "KANU_DATABASE_NAME",
      database,
    );
    vi.stubEnv("AUTH_URL", base);

    const log = vi
      .spyOn(console, "info")
      .mockImplementation(() => {});

    await expect(
      sendAuthMail(
        "membre@example.test",
        "verify",
        "token-test",
      ),
    ).rejects.toThrow(
      "Envoi d'e-mail non configuré.",
    );

    expect(log).not.toHaveBeenCalled();
  },
);