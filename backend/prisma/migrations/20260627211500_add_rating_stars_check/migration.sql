-- Enforce the 1–5 rating contract at the database level (defense-in-depth; the
-- API already validates via zod). Prisma doesn't model CHECK constraints, so this
-- is a hand-written forward migration.
ALTER TABLE "rating" ADD CONSTRAINT "rating_stars_range" CHECK ("stars" >= 1 AND "stars" <= 5);
