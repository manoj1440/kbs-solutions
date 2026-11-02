-- Payouts without rates (user decision): an entitlement is "card activated", priced later by Admin on the request.
ALTER TABLE "PayoutEntitlement" ALTER COLUMN "ruleId" DROP NOT NULL;
ALTER TABLE "PayoutEntitlement" ALTER COLUMN "ruleVersion" DROP NOT NULL;
ALTER TABLE "PayoutEntitlement" ALTER COLUMN "rateId" DROP NOT NULL;
ALTER TABLE "PayoutEntitlement" ALTER COLUMN "amountInr" SET DEFAULT 0;
