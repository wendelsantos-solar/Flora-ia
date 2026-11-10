BEGIN;
CREATE TABLE IF NOT EXISTS sip_lab_policies (
 tenant_id uuid PRIMARY KEY REFERENCES tenants,
 enabled boolean NOT NULL,
 trunk_enabled boolean NOT NULL,
 allowed text[] NOT NULL,
 blocked text[] NOT NULL,
 lines text[] NOT NULL,
 tenant_limit integer NOT NULL CHECK (tenant_limit BETWEEN 1 AND 10),
 trunk_limit integer NOT NULL CHECK (trunk_limit BETWEEN 1 AND 10),
 line_limit integer NOT NULL CHECK (line_limit BETWEEN 1 AND 10),
 attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 60),
 seconds integer NOT NULL CHECK (seconds BETWEEN 1 AND 120),
 inbound_did text NOT NULL DEFAULT '8800000000' CHECK (inbound_did ~ '^880[0-9]{7}$'),
 inbound_target text NOT NULL
);
ALTER TABLE sip_lab_policies ADD COLUMN IF NOT EXISTS inbound_did text NOT NULL DEFAULT '8800000000' CHECK (inbound_did ~ '^880[0-9]{7}$');
CREATE TABLE IF NOT EXISTS sip_lab_calls (
 tenant_id uuid NOT NULL REFERENCES tenants,
 call_id text NOT NULL,
 direction text NOT NULL CHECK (direction IN ('in','out')),
 trunk text NOT NULL DEFAULT 'simulator',
 origin text NOT NULL,
 destination text NOT NULL,
 category text NOT NULL,
 policy jsonb,
 decision text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz,
 ended_at timestamptz,
 result text,
 talk_seconds integer CHECK (talk_seconds >= 0),
 provider_billable_seconds integer CHECK (provider_billable_seconds >= 0),
 provider_record_id text,
 PRIMARY KEY (tenant_id,call_id),
 UNIQUE (tenant_id,trunk,provider_record_id)
);
CREATE INDEX IF NOT EXISTS sip_lab_calls_window ON sip_lab_calls(tenant_id,created_at);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['sip_lab_policies','sip_lab_calls'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname='public' AND tablename=tab AND policyname='tenant_isolation') THEN
   EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',tab);
  END IF;
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON sip_lab_policies,sip_lab_calls TO flora_app;
INSERT INTO flora_schema_versions VALUES (8) ON CONFLICT DO NOTHING;
COMMIT;
