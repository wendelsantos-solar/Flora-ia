BEGIN;
CREATE TABLE IF NOT EXISTS department_schedules (
 tenant_id uuid NOT NULL, department text NOT NULL,
 timezone text NOT NULL CHECK(length(timezone) BETWEEN 1 AND 64),
 days integer[] NOT NULL CHECK(cardinality(days) BETWEEN 1 AND 7 AND days <@ ARRAY[0,1,2,3,4,5,6]),
 opens_at text NOT NULL CHECK(opens_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 closes_at text NOT NULL CHECK(closes_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND closes_at > opens_at),
 closed_destination text, PRIMARY KEY(tenant_id,department),
 FOREIGN KEY(tenant_id,department) REFERENCES departments(tenant_id,code) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,closed_destination) REFERENCES extensions(tenant_id,number)
);
ALTER TABLE department_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_schedules FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname='public' AND tablename='department_schedules' AND policyname='tenant_isolation') THEN
  CREATE POLICY tenant_isolation ON department_schedules USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);
 END IF;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON department_schedules TO flora_app;
ALTER TABLE queue_journal ADD COLUMN IF NOT EXISTS routing_status text;
ALTER TABLE queue_journal DROP CONSTRAINT IF EXISTS queue_journal_kind_check;
ALTER TABLE queue_journal ADD CONSTRAINT queue_journal_kind_check CHECK(kind IN ('ENTERQUEUE','CONNECT','COMPLETEAGENT','COMPLETECALLER','ABANDON','EXITWITHTIMEOUT','EXITEMPTY','BLINDTRANSFER','ATTENDEDTRANSFER','FLORA_CLOSED','FLORA_CONTINGENCY'));
INSERT INTO flora_schema_versions VALUES(5) ON CONFLICT DO NOTHING;
COMMIT;
