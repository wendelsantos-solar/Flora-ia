BEGIN;
CREATE TABLE IF NOT EXISTS browser_sessions (
 tenant_id uuid NOT NULL, digest bytea NOT NULL, user_id uuid NOT NULL, expires_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,digest),
 FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id) ON DELETE CASCADE
);
ALTER TABLE browser_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE browser_sessions FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname='public' AND tablename='browser_sessions' AND policyname='tenant_isolation') THEN
 CREATE POLICY tenant_isolation ON browser_sessions USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
 END IF;
END $$;
GRANT SELECT,INSERT,DELETE ON browser_sessions TO flora_app;
INSERT INTO users VALUES ('22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','Identidade de teste sem ramal') ON CONFLICT DO NOTHING;
INSERT INTO flora_schema_versions VALUES (7) ON CONFLICT DO NOTHING;
COMMIT;
