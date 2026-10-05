import nodemailer from "nodemailer";

export async function sendAuthMail(
  email: string,
  purpose: "verify" | "reset",
  token: string,
): Promise<void> {
  const host = process.env.KANU_SMTP_HOST;
  const port = Number(process.env.KANU_SMTP_PORT);
  const user = process.env.KANU_SMTP_USER;
  const password = process.env.KANU_SMTP_PASSWORD;
  const from = process.env.KANU_SMTP_FROM;
  const base = process.env.AUTH_URL;
  if (!host || !Number.isInteger(port) || !user ||
      !password || !from || !base) {
    throw new Error("Envoi d'e-mail non configuré.");
  }
  const url = new URL(
    purpose === "verify" ? "/api/auth/verify-email" : "/reset-password",
    base,
  );
  url.searchParams.set("token", token);

  const transport = nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: { user, pass: password },
  });
  try {
    await transport.sendMail({
      from,
      to: email,
      subject: purpose === "verify"
        ? "Confirmer votre adresse Kanu Connect"
        : "Réinitialiser votre mot de passe Kanu Connect",
      text: `Ouvrez ce lien : ${url.toString()}\n\nSi vous n'avez pas fait cette demande, ignorez ce message.`,
    });
  } finally {
    transport.close();
  }
}
