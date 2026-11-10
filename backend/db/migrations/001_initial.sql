CREATE TABLE tenants (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants, name text NOT NULL, UNIQUE(tenant_id,id));
CREATE TABLE extensions (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants,
 user_id uuid NOT NULL, number text NOT NULL CHECK(number ~ '^[0-9]{3}$'),
 registered boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant_id,user_id) REFERENCES users(tenant_id,id), UNIQUE(tenant_id,number), UNIQUE(tenant_id,id)
);
CREATE TABLE call_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants,
 asterisk_linked_id text NOT NULL, source text NOT NULL, destination text NOT NULL,
 state text NOT NULL CHECK(state IN ('created','ringing','answered','completed','failed','interrupted')),
 started_at timestamptz NOT NULL, answered_at timestamptz, ended_at timestamptz,
 UNIQUE(tenant_id,asterisk_linked_id), UNIQUE(tenant_id,id)
);
CREATE TABLE call_legs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 call_id uuid NOT NULL, asterisk_unique_id text NOT NULL, channel text NOT NULL,
 started_at timestamptz NOT NULL, ended_at timestamptz,
 FOREIGN KEY(tenant_id,call_id) REFERENCES call_sessions(tenant_id,id), UNIQUE(tenant_id,asterisk_unique_id)
);
CREATE TABLE call_events (
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tenants, call_id uuid,
 event_key text NOT NULL UNIQUE, type text NOT NULL, occurred_at timestamptz NOT NULL,
 data jsonb NOT NULL DEFAULT '{}',
 FOREIGN KEY(tenant_id,call_id) REFERENCES call_sessions(tenant_id,id)
);
CREATE TABLE audit_entries (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants,
 actor_id uuid, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON call_sessions(tenant_id,started_at DESC);
CREATE INDEX ON call_events(tenant_id,sequence);
CREATE INDEX ON call_legs(tenant_id,call_id);
INSERT INTO tenants VALUES ('11111111-1111-4111-8111-111111111111','Empresa de desenvolvimento'),('22222222-2222-4222-8222-222222222222','Tenant de teste de isolamento');
INSERT INTO users VALUES
 ('11111111-1111-4111-8111-111111111201','11111111-1111-4111-8111-111111111111','Operador 201'),
 ('11111111-1111-4111-8111-111111111202','11111111-1111-4111-8111-111111111111','Operador 202');
INSERT INTO extensions(id,tenant_id,user_id,number) SELECT id,tenant_id,id,right(id::text,3) FROM users;
-- Every application transaction sets app.tenant_id locally. Application role is not an owner or superuser.
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['tenants','users','extensions','call_sessions','call_legs','call_events','audit_entries'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (%I = nullif(current_setting(''app.tenant_id'', true),'''')::uuid) WITH CHECK (%I = nullif(current_setting(''app.tenant_id'', true),'''')::uuid)',tab,CASE WHEN tab='tenants' THEN 'id' ELSE 'tenant_id' END,CASE WHEN tab='tenants' THEN 'id' ELSE 'tenant_id' END);
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA public TO flora_app;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO flora_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO flora_app;
