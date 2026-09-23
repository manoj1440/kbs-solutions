-- F-903: production database roles (run once as the database owner after `prisma migrate deploy`).
-- The API connects as kbs_app, which is NOT the table owner, so it cannot DISABLE TRIGGER, ALTER/DROP the
-- bank-status guard, or TRUNCATE. It keeps DML on every table; bank-status rows still pass the INV-01 trigger,
-- which only accepts writes from a transaction that ran set_config('kbs.mis_apply','on',true).
-- Replace the password via your secret manager; never commit a real one.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kbs_app') THEN
    CREATE ROLE kbs_app LOGIN PASSWORD 'change-me-in-secret-manager';
  END IF;
END
$$;

-- GRANT CONNECT ON DATABASE <your_db> TO kbs_app;   -- run with the real database name
GRANT USAGE ON SCHEMA public TO kbs_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kbs_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kbs_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kbs_app;

-- Append-only ledgers: the API never deletes bank status history or audit trails (INV-01, INV-07, REQ-24 §24.3).
REVOKE DELETE ON "BankStatusHistory", "BankStatusSnapshot", "AuditLog", "SensitiveAccessLog", "PayoutEntitlementEvent" FROM kbs_app;
REVOKE UPDATE ON "BankStatusHistory", "AuditLog", "SensitiveAccessLog", "PayoutEntitlementEvent" FROM kbs_app;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM kbs_app;
