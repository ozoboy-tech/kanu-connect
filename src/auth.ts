import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import type { NextRequest } from "next/server";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import GitLab from "next-auth/providers/gitlab";
import Google from "next-auth/providers/google";

import {
  allowAuthAttempt,
  authenticateEmail,
  consumeOAuthLinkIntent,
  resolveOAuthMember,
} from "@/server/auth/accounts";
import { authPool } from "@/server/auth/db";
import {
  revokeSession,
  startSession,
  touchSession,
} from "@/server/auth/session-store";

const providers: NextAuthConfig["providers"] = [
  Credentials({
    credentials: {
      email: { type: "email", label: "Adresse e-mail" },
      password: { type: "password", label: "Mot de passe" },
    },
    async authorize(credentials) {
      const email = credentials.email;
      const password = credentials.password;
      if (typeof email !== "string" || typeof password !== "string") {
        return null;
      }
      const connection = await authPool().getConnection();
      try {
        if (!await allowAuthAttempt(connection, "login", email)) return null;
        const publicId = await authenticateEmail(connection, email, password);
        return publicId ? { id: publicId, email: null } : null;
      } finally {
        connection.release();
      }
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google({
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
  }));
}
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(GitHub({
    clientId: process.env.AUTH_GITHUB_ID,
    clientSecret: process.env.AUTH_GITHUB_SECRET,
  }));
}
if (process.env.AUTH_GITLAB_ID && process.env.AUTH_GITLAB_SECRET) {
  providers.push(GitLab({
    clientId: process.env.AUTH_GITLAB_ID,
    clientSecret: process.env.AUTH_GITLAB_SECRET,
  }));
}

export const { handlers, auth, signIn, signOut } = NextAuth((request: NextRequest | undefined) => ({
  providers,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account && user) {
        const connection = await authPool().getConnection();
        try {
          const linkToken = request?.cookies.get("kanu_oauth_link")?.value;
          const linkedId = account.type !== "credentials" && linkToken
            ? await consumeOAuthLinkIntent(
                connection, linkToken, account.provider, account.providerAccountId,
              ) : null;
          const publicId = account.type === "credentials" ? user.id
            : linkedId ?? await resolveOAuthMember(
                connection, account.provider, account.providerAccountId,
              );
          if (!publicId) return null;
          token.memberPublicId = publicId;
          token.sessionSecret = await startSession(connection, publicId);
        } finally {
          connection.release();
        }
      }
      if (typeof token.sessionSecret !== "string") return null;
      const connection = await authPool().getConnection();
      try {
        const state = await touchSession(connection, token.sessionSecret);
        if (!state) return null;
        token.memberPublicId = state.publicId;
        token.onboarded = state.onboarded;
        return token;
      } finally {
        connection.release();
      }
    },
    async session({ session, token }) {
      session.user.id = token.memberPublicId as string;
      session.user.onboarded = token.onboarded === true;
      session.user.email = "";
      session.user.name = null;
      session.user.image = null;
      return session;
    },
  },
  events: {
    async signOut(message) {
      if (!("token" in message) ||
          typeof message.token?.sessionSecret !== "string") return;
      const connection = await authPool().getConnection();
      try {
        await revokeSession(connection, message.token.sessionSecret);
      } finally {
        connection.release();
      }
    },
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
}));
