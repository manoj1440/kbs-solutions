-- F-903 / INV-01: database-level protection of bank-reported status. Writes to BankStatusSnapshot and
-- BankStatusHistory are rejected unless the transaction has set kbs.mis_apply = 'on' (SET LOCAL / set_config(..., true)),
-- which only the MIS apply service does (misApplyTransaction in @kbs/db). This backs up the Prisma-extension guard
-- so raw SQL, ad-hoc scripts or a future code path cannot silently change bank values.

CREATE OR REPLACE FUNCTION kbs_guard_bank_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('kbs.mis_apply', true), '') <> 'on' THEN
    RAISE EXCEPTION 'INV-01: % on "%" is only allowed inside the MIS apply transaction (kbs.mis_apply)', TG_OP, TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS "BankStatusSnapshot_mis_apply_only" ON "BankStatusSnapshot";
CREATE TRIGGER "BankStatusSnapshot_mis_apply_only" BEFORE INSERT OR UPDATE OR DELETE ON "BankStatusSnapshot"
  FOR EACH ROW EXECUTE FUNCTION kbs_guard_bank_status();

DROP TRIGGER IF EXISTS "BankStatusHistory_mis_apply_only" ON "BankStatusHistory";
CREATE TRIGGER "BankStatusHistory_mis_apply_only" BEFORE INSERT OR UPDATE OR DELETE ON "BankStatusHistory"
  FOR EACH ROW EXECUTE FUNCTION kbs_guard_bank_status();
