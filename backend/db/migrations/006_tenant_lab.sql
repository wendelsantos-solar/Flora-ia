BEGIN;
CREATE TABLE IF NOT EXISTS department_supervisors (
 tenant_id uuid NOT NULL, department text NOT NULL, user_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,department,user_id),
 FOREIGN KEY(tenant_id,department) REFERENCES departments(tenant_id,code) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id) ON DELETE CASCADE
);
ALTER TABLE department_supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_supervisors FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname='public' AND tablename='department_supervisors' AND policyname='tenant_isolation') THEN
  CREATE POLICY tenant_isolation ON department_supervisors USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
 END IF;
END $$;
GRANT SELECT,INSERT,DELETE ON department_supervisors TO flora_app;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM flora_schema_versions WHERE version=6) THEN
  INSERT INTO tenants VALUES('33333333-3333-4333-8333-333333333333','Empresa fictícia Horizonte');
  INSERT INTO users VALUES
   ('33333333-3333-4333-8333-333333333211','33333333-3333-4333-8333-333333333333','Operador 211'),
   ('33333333-3333-4333-8333-333333333212','33333333-3333-4333-8333-333333333333','Operador 212'),
   ('33333333-3333-4333-8333-333333333213','33333333-3333-4333-8333-333333333333','Operador 213');
  INSERT INTO extensions(id,tenant_id,user_id,number)
   SELECT id,tenant_id,id,right(id::text,3) FROM users WHERE tenant_id='33333333-3333-4333-8333-333333333333';
  INSERT INTO departments VALUES
   ('33333333-3333-4333-8333-333333333333','recepcao','Recepção Horizonte'),
   ('33333333-3333-4333-8333-333333333333','operacao','Operação Horizonte');
  INSERT INTO queues VALUES ('33333333-3333-4333-8333-333333333333','301','recepcao','rrmemory',8,30,NULL);
  INSERT INTO queue_members(tenant_id,queue,extension) VALUES ('33333333-3333-4333-8333-333333333333','301','212');
  INSERT INTO department_supervisors SELECT tenant_id,code,'11111111-1111-4111-8111-111111111203'
   FROM departments WHERE tenant_id='11111111-1111-4111-8111-111111111111' AND code='recepcao';
  INSERT INTO department_supervisors VALUES ('33333333-3333-4333-8333-333333333333','recepcao','33333333-3333-4333-8333-333333333213');
  INSERT INTO flora_schema_versions VALUES (6);
 END IF;
END $$;
CREATE OR REPLACE FUNCTION flora_call_visible(t uuid,c uuid,role_name text,extension_number text,viewer text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
 SELECT CASE WHEN role_name IN ('','admin') THEN true ELSE EXISTS(
  SELECT 1 FROM call_sessions cs WHERE cs.tenant_id=t AND cs.id=c AND (
   (role_name='operator' AND extension_number<>'' AND (
    cs.source=extension_number OR cs.destination=extension_number OR EXISTS(
     SELECT 1 FROM call_legs l WHERE l.tenant_id=t AND l.call_id=c AND l.channel LIKE 'PJSIP/'||extension_number||'-%'
    )
   )) OR (role_name='supervisor' AND EXISTS(
    SELECT 1 FROM department_supervisors d WHERE d.tenant_id=t AND d.user_id=nullif(viewer,'')::uuid AND d.department=(
     SELECT q.department FROM queue_journal q WHERE q.tenant_id=t AND q.department IS NOT NULL AND (
      q.asterisk_unique_id=cs.asterisk_linked_id OR q.asterisk_unique_id IN
       (SELECT l.asterisk_unique_id FROM call_legs l WHERE l.tenant_id=t AND l.call_id=c)
     ) ORDER BY q.occurred_at,q.event_key LIMIT 1
    )
   ))
  )
 ) END
$$;
REVOKE ALL ON FUNCTION flora_call_visible(uuid,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION flora_call_visible(uuid,uuid,text,text,text) TO flora_app;
COMMIT;
