BEGIN;
CREATE TABLE IF NOT EXISTS departments (
 tenant_id uuid NOT NULL REFERENCES tenants, code text NOT NULL CHECK (code ~ '^[a-z][a-z0-9-]{0,31}$'),
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
 PRIMARY KEY(tenant_id,code)
);
CREATE TABLE IF NOT EXISTS queues (
 tenant_id uuid NOT NULL, number text NOT NULL CHECK (number ~ '^3[0-9]{2}$'),
 department text NOT NULL, strategy text NOT NULL CHECK (strategy IN ('ringall','rrmemory','fewestcalls')),
 ring_seconds integer NOT NULL CHECK (ring_seconds BETWEEN 3 AND 30),
 wait_seconds integer NOT NULL CHECK (wait_seconds BETWEEN ring_seconds AND 180),
 fallback text, PRIMARY KEY(tenant_id,number), UNIQUE(tenant_id,department),
 FOREIGN KEY(tenant_id,department) REFERENCES departments(tenant_id,code),
 FOREIGN KEY(tenant_id,fallback) REFERENCES extensions(tenant_id,number)
);
CREATE TABLE IF NOT EXISTS queue_members (
 tenant_id uuid NOT NULL, queue text NOT NULL, extension text NOT NULL,
 joined boolean NOT NULL DEFAULT false, paused boolean NOT NULL DEFAULT false,
 PRIMARY KEY(tenant_id,queue,extension),
 FOREIGN KEY(tenant_id,queue) REFERENCES queues(tenant_id,number) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,extension) REFERENCES extensions(tenant_id,number)
);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['departments','queues','queue_members'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname='public' AND tablename=tab AND policyname='tenant_isolation') THEN
   EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',tab);
  END IF;
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON departments,queues,queue_members TO flora_app;
ALTER TABLE audit_entries ADD COLUMN IF NOT EXISTS target text;
ALTER TABLE audit_entries ADD COLUMN IF NOT EXISTS correlation_id text;
CREATE TABLE IF NOT EXISTS flora_schema_versions (version integer PRIMARY KEY);
INSERT INTO departments SELECT tenant::uuid,code,name FROM (VALUES
 ('11111111-1111-4111-8111-111111111111','recepcao','Recepção'),
 ('11111111-1111-4111-8111-111111111111','enfermagem','Enfermagem'),
 ('11111111-1111-4111-8111-111111111111','coordenacao','Coordenação'),
 ('11111111-1111-4111-8111-111111111111','administrativo','Administrativo')
) AS seed(tenant,code,name) WHERE NOT EXISTS(SELECT FROM flora_schema_versions WHERE version=2)
ON CONFLICT DO NOTHING;
INSERT INTO flora_schema_versions VALUES(2) ON CONFLICT DO NOTHING;
COMMIT;
