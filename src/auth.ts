import authConfig from "@/auth.config";
import { getDb } from "@/db";
import { D1AuthAdapter } from "@/db/auth-adapter";
import { findUser, hashToken, limitAction } from "@/db/identity";
import { verifyPassword } from "@/lib/password";
import { LoginSchema } from "@/lib/schemas";
import { UserRole } from "@/types/user-role";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth(
  async () => {
    const db = await getDb();
    return {
      ...authConfig,
      adapter: D1AuthAdapter(db),
      pages: { signIn: "/auth/login", error: "/auth/error" },
      session: { strategy: "jwt", maxAge: 86400 },
      providers: [
        ...authConfig.providers,
        Credentials({
          async authorize(credentials) {
            const parsed = LoginSchema.safeParse(credentials);
            if (!parsed.success) return null;
            const { email, password } = parsed.data;
            if (
              !(await limitAction(
                db,
                `login:${await hashToken(email.toLowerCase())}`,
                10,
                900,
              ))
            )
              return null;
            const user = await findUser(db, "email", email);
            if (
              !user ||
              user.disabled ||
              !user.emailVerified ||
              !user.password ||
              !(await verifyPassword(password, user.password))
            )
              return null;
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
            };
          },
        }),
      ],
      callbacks: {
        async signIn({ user }) {
          if (!user.id) return true;
          const row = await findUser(db, "id", user.id);
          return !row?.disabled;
        },
        async jwt({ token, user }) {
          const id = user?.id ?? token.sub;
          if (!id) return null;
          const row = await findUser(db, "id", id);
          if (!row || row.disabled) return null;
          if (!user && token.sessionVersion !== row.session_version)
            return null;
          token.sub = row.id;
          token.sessionVersion = row.session_version;
          token.role = row.role;
          token.name = row.name;
          token.email = row.email;
          token.link = row.link;
          token.picture = row.image;
          token.isOAuth = Boolean(
            await db
              .prepare("SELECT id FROM accounts WHERE userId=? LIMIT 1")
              .bind(id)
              .first(),
          );
          return token;
        },
        async session({ session, token }) {
          Object.assign(session.user, {
            id: token.sub,
            name: token.name,
            email: token.email,
            image: token.picture,
            role: UserRole[token.role as keyof typeof UserRole],
            link: String(token.link ?? ""),
            isOAuth: Boolean(token.isOAuth),
          });
          return session;
        },
      },
    };
  },
);
