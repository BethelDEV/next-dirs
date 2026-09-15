import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";
import { findUser } from "./identity";
import type { UserRow } from "./models";

function adapterUser(row: UserRow | null): AdapterUser | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    emailVerified: row.emailVerified ? new Date(row.emailVerified) : null,
  };
}

/** JWT sessions; adapter implements only persisted user/OAuth operations. */
export function D1AuthAdapter(db: D1Database): Adapter {
  return {
    async createUser(user) {
      const id = crypto.randomUUID();
      await db
        .prepare(
          "INSERT INTO users(id,name,email,emailVerified,image) VALUES(?,?,?,?,?)",
        )
        .bind(
          id,
          user.name ?? "",
          user.email.toLowerCase(),
          user.emailVerified?.toISOString() ?? null,
          user.image ?? null,
        )
        .run();
      return adapterUser(await findUser(db, "id", id));
    },
    async getUser(id) {
      return adapterUser(await findUser(db, "id", id));
    },
    async getUserByEmail(email) {
      return adapterUser(await findUser(db, "email", email));
    },
    async getUserByAccount({ provider, providerAccountId }) {
      return adapterUser(
        await db
          .prepare(
            "SELECT users.* FROM users JOIN accounts ON accounts.userId=users.id WHERE provider=? AND providerAccountId=?",
          )
          .bind(provider, providerAccountId)
          .first<UserRow>(),
      );
    },
    async updateUser(user) {
      const current = await findUser(db, "id", user.id);
      if (!current) throw new Error("Account not found");
      await db
        .prepare(
          "UPDATE users SET name=?,email=?,emailVerified=?,image=? WHERE id=?",
        )
        .bind(
          user.name ?? current.name,
          user.email?.toLowerCase() ?? current.email,
          user.emailVerified === undefined
            ? current.emailVerified
            : (user.emailVerified?.toISOString() ?? null),
          user.image === undefined ? current.image : user.image,
          user.id,
        )
        .run();
      return adapterUser(await findUser(db, "id", user.id));
    },
    async linkAccount(account: AdapterAccount) {
      await db
        .prepare(
          "INSERT INTO accounts(id,userId,type,provider,providerAccountId,refresh_token,access_token,expires_at,token_type,scope,id_token,session_state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          account.userId,
          account.type,
          account.provider,
          account.providerAccountId,
          account.refresh_token ?? null,
          account.access_token ?? null,
          account.expires_at ?? null,
          account.token_type ?? null,
          account.scope ?? null,
          account.id_token ?? null,
          typeof account.session_state === "string"
            ? account.session_state
            : null,
        )
        .run();
      return account;
    },
    async unlinkAccount({ provider, providerAccountId }) {
      await db
        .prepare(
          "DELETE FROM accounts WHERE provider=? AND providerAccountId=?",
        )
        .bind(provider, providerAccountId)
        .run();
    },
  };
}
