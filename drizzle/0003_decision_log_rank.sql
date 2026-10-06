ALTER TYPE "public"."decision_kind" ADD VALUE 'rank';--> statement-breakpoint
DROP INDEX "projects_tenant_rank_uq";--> statement-breakpoint
ALTER TABLE "decisions" ALTER COLUMN "person_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ALTER COLUMN "weeks" SET DEFAULT '{}';--> statement-breakpoint
CREATE INDEX "projects_tenant_rank_idx" ON "projects" USING btree ("tenant_id","rank");