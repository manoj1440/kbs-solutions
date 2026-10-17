-- Dry run (SELECT only): users that web Playwright runs created in kbs_dev before e2e moved to a disposable DB
-- (test/e2e-isolated.sh). Nothing here deletes; decide on cleanup separately — users have sessions, audit rows,
-- reporting links and onboarding profiles, and the audit log is append-only by design.
-- Usage: docker exec -i kbs-test-pg psql -U kbs -d kbs_dev < apps/web/test/e2e-users-in-dev.sql
WITH e2e_managers AS (
  SELECT id FROM "User"
  WHERE role = 'MANAGER' AND "fullName" IN ('E2E Session Manager', 'E2E Advisors Manager', 'E2E Calling Manager')
),
e2e_users AS (
  SELECT id FROM e2e_managers
  UNION
  -- role-routing.spec self-registers an Advisor with a 95xxxxxxxx mobile and never completes onboarding
  SELECT id FROM "User"
  WHERE role = 'ADVISOR' AND coalesce("fullName", '') = '' AND status = 'PENDING_ONBOARDING' AND mobile LIKE '+9195%'
  UNION
  SELECT id FROM "User" WHERE "fullName" IN ('E2E Telecaller')
)
SELECT u.role, coalesce(nullif(u."fullName", ''), '(onboarding)') AS name, count(*) AS users,
       min(u."createdAt")::date AS first_seen, max(u."createdAt")::date AS last_seen
FROM "User" u JOIN e2e_users e ON e.id = u.id
GROUP BY 1, 2 ORDER BY 3 DESC;
