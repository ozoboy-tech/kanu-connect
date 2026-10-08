import nodemailer from "nodemailer";

export async function sendAuthMail(
  email: string,
  purpose: "verify" | "reset",
  token: string,
): Promise<void> {
  const base = process.env.AUTH_URL;

  if (!base) {
    throw new Error("Envoi d'e-mail non configuré.");
  }

  const url = new URL(
    purpose === "verify"
      ? "/api/auth/verify-email"
      : "/reset-password",
    base,
  );
  url.searchParams.set("token", token);

  if (
    process.env.KANU_DEV_MAIL_TO_CONSOLE === "1" &&
    process.env.KANU_DATABASE_NAME === "kanuconnectdev" &&
    process.env.NODE_ENV === "development" &&
    new URL(base).origin === "http://127.0.0.1:3000"
  ) {
    console.info(
      `Lien local ${
        purpose === "verify"
          ? "de vérification"
          : "de réinitialisation"
      } pour ${email} :\n${url.toString()}`,
    );
    return;
  }

  const host = process.env.KANU_SMTP_HOST;
  const port = Number(process.env.KANU_SMTP_PORT);
  const user = process.env.KANU_SMTP_USER;
  const password = process.env.KANU_SMTP_PASSWORD;
  const from = process.env.KANU_SMTP_FROM;

  if (
    !host ||
    !Number.isInteger(port) ||
    !user ||
    !password ||
    !from
  ) {
    throw new Error("Envoi d'e-mail non configuré.");
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass: password,
    },
  });

  try {
    await transport.sendMail({
      from,
      to: email,
      subject: purpose === "verify"
        ? "Confirmer votre adresse Kanu Connect"
        : "Réinitialiser votre mot de passe Kanu Connect",
      text:
        `Ouvrez ce lien : ${url.toString()}\n\n` +
        "Si vous n'avez pas fait cette demande, ignorez ce message.",
    });
  } finally {
    transport.close();
  }
}