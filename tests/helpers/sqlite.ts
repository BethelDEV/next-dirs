import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { synthetic } from "./providers";

/** Fast SQLite constraint tests; Workers/D1 compatibility is tested separately. */
export function createDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("../../migrations/0001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const user of [
    synthetic.owner,
    synthetic.stranger,
    synthetic.editor,
    synthetic.admin,
  ]) {
    db.prepare("INSERT INTO users(id,email,role) VALUES(?,?,?)").run(
      user.id,
      user.email,
      user.role,
    );
  }
  return db;
}
