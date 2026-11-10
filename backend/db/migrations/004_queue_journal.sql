BEGIN;
CREATE TABLE IF NOT EXISTS queue_journal (
 tenant_id uuid NOT NULL REFERENCES tenants, event_key text NOT NULL, queue text NOT NULL,
 department text, asterisk_unique_id text NOT NULL, agent text,
 kind text NOT NULL CHECK(kind IN ('ENTERQUEUE','CONNECT','COMPLETEAGENT','COMPLETECALLER','ABANDON','EXITWITHTIMEOUT','EXITEMPTY','BLINDTRANSFER','ATTENDEDTRANSFER')),
 occurred_at timestamptz NOT NULL, wait_seconds integer CHECK(wait_seconds>=0), talk_seconds integer CHECK(talk_seconds>=0),
 PRIMARY KEY(tenant_id,event_key)
);
CREATE INDEX IF NOT EXISTS queue_journal_call ON queue_journal(tenant_id,asterisk_unique_id,occurred_at);
CREATE INDEX IF NOT EXISTS queue_journal_metrics ON queue_journal(tenant_id,occurred_at,kind);
ALTER TABLE queue_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_journal FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname='public' AND tablename='queue_journal' AND policyname='tenant_isolation') THEN
  CREATE POLICY tenant_isolation ON queue_journal USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);
 END IF;
END $$;
GRANT SELECT,INSERT ON queue_journal TO flora_app;
INSERT INTO flora_schema_versions VALUES(4) ON CONFLICT DO NOTHING;
COMMIT;
