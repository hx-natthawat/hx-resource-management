ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_rank_uq" UNIQUE ("tenant_id", "rank") DEFERRABLE INITIALLY DEFERRED;
