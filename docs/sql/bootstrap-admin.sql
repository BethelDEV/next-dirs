-- Register and verify your own account first. Replace this placeholder with
-- that account's ID from the dashboard users table. Never change registration.
UPDATE users
SET role='ADMIN', session_version=session_version+1
WHERE id='REPLACE_WITH_VERIFIED_ACCOUNT_ID'
  AND emailVerified IS NOT NULL AND disabled=0
  AND NOT EXISTS (SELECT 1 FROM users WHERE role='ADMIN' AND disabled=0);

SELECT id, name, role, disabled FROM users WHERE role='ADMIN';
-- Sign in again after this change. Subsequent role changes use /admin.
