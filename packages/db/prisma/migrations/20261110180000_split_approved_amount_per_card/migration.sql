-- Rate-free payouts: Admin's approved amount lives on the request. Dashboards and ledgers total per card, so the amount is
-- split across the request's active cards (paise-exact, remainder to the first cards). New approvals do this in the API;
-- this back-fills requests Admin approved before that existed. Cards of requests without an Admin approval stay at 0.
WITH priced AS (
  SELECT i."id" AS item_id, i."entitlementId" AS entitlement_id,
         (r."totalAmountInr" * 100)::bigint AS paise,
         COUNT(*) OVER (PARTITION BY r."id") AS n,
         ROW_NUMBER() OVER (PARTITION BY r."id" ORDER BY i."entitlementId") AS rn
  FROM "PayoutRequest" r
  JOIN "PayoutRequestItem" i ON i."requestId" = r."id" AND i."active" = true
  WHERE r."state" IN ('APPROVED', 'PAYMENT_RECORDED_PENDING_PROOF', 'PAID', 'ON_HOLD')
    AND r."totalAmountInr" > 0
    AND EXISTS (SELECT 1 FROM "PayoutApproval" a WHERE a."requestId" = r."id" AND a."approverRole" = 'ADMIN' AND a."decision" = 'APPROVED')
    AND NOT EXISTS (SELECT 1 FROM "PayoutRequestItem" x JOIN "PayoutEntitlement" e ON e."id" = x."entitlementId" WHERE x."requestId" = r."id" AND x."active" = true AND e."amountInr" > 0)
), shares AS (
  SELECT item_id, entitlement_id, ((paise / n) + CASE WHEN rn <= (paise % n) THEN 1 ELSE 0 END)::numeric / 100 AS share FROM priced
), upd_items AS (
  UPDATE "PayoutRequestItem" i SET "amountSnapshotInr" = s.share FROM shares s WHERE i."id" = s.item_id RETURNING 1
)
UPDATE "PayoutEntitlement" e SET "amountInr" = s.share FROM shares s WHERE e."id" = s.entitlement_id;
