-- Run read-only checks in the new test database's dashboard console.
SELECT version, name, applied_at FROM schema_migrations ORDER BY version;
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
PRAGMA foreign_key_check;
SELECT status, COUNT(*) AS count FROM outbox GROUP BY status;
SELECT status, COUNT(*) AS count FROM notifications GROUP BY status;
