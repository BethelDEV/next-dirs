-- In the application, verify your own email account or sign in with your own
-- Google account. Confirm ownership, then replace the placeholder with its
-- users.id in the D1 web Console. A Google login may leave emailVerified NULL.
-- This is a manual first-admin bootstrap, not an application registration path.
UPDATE users
SET role='ADMIN', session_version=session_version+1
WHERE id='REPLACE_WITH_CONFIRMED_ACCOUNT_ID'
  AND disabled=0
  AND (
    emailVerified IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.userId=users.id AND provider='google'
    )
  )
  AND NOT EXISTS (SELECT 1 FROM users WHERE role='ADMIN' AND disabled=0);

SELECT id, name, role, disabled FROM users WHERE role='ADMIN';
-- Sign in again after this change. Subsequent role changes use /admin.
