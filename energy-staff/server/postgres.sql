CREATE SCHEMA IF NOT EXISTS energy_staff_v3;
REVOKE ALL ON SCHEMA energy_staff_v3 FROM PUBLIC,anon,authenticated;
CREATE TABLE energy_staff_v3.es_users (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 email VARCHAR(254) NOT NULL UNIQUE CHECK(email=lower(email)),
 full_name VARCHAR(120) NOT NULL,
 phone VARCHAR(20) NOT NULL,
 password_hash VARCHAR(255) NOT NULL,
 requested_position VARCHAR(40) NOT NULL,
 requested_branch VARCHAR(120) NOT NULL,
 position VARCHAR(40), branch VARCHAR(120),
 role TEXT NOT NULL DEFAULT 'employee' CHECK(role IN ('employee','manager','admin')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','disabled')),
 review_reason VARCHAR(1000),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),reviewed_at TIMESTAMPTZ
);
CREATE INDEX es_users_review ON energy_staff_v3.es_users(status,created_at);
CREATE TABLE energy_staff_v3.es_sessions (
 token_hash CHAR(64) PRIMARY KEY,user_id BIGINT REFERENCES energy_staff_v3.es_users(id) ON DELETE CASCADE,
 csrf CHAR(64) NOT NULL,expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX es_sessions_expiry ON energy_staff_v3.es_sessions(expires_at);
CREATE INDEX es_sessions_user ON energy_staff_v3.es_sessions(user_id);
CREATE TABLE energy_staff_v3.es_limits(limit_key CHAR(64) PRIMARY KEY,attempts INTEGER NOT NULL,resets_at TIMESTAMPTZ NOT NULL);
CREATE TABLE energy_staff_v3.es_state(state_key VARCHAR(40) PRIMARY KEY,payload TEXT NOT NULL,revision BIGINT NOT NULL DEFAULT 0);
CREATE TABLE energy_staff_v3.es_audit(id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id BIGINT,action VARCHAR(60) NOT NULL,subject_id BIGINT,reason VARCHAR(1000),created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX es_audit_actor ON energy_staff_v3.es_audit(actor_id);
INSERT INTO energy_staff_v3.es_state(state_key,payload) VALUES('workspace','{}'),('bootstrap','{}');
REVOKE ALL ON ALL TABLES IN SCHEMA energy_staff_v3 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA energy_staff_v3 FROM PUBLIC,anon,authenticated;
ALTER TABLE energy_staff_v3.es_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_staff_v3.es_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_staff_v3.es_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_staff_v3.es_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_staff_v3.es_audit ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='energy_staff_runtime_v3') THEN
  CREATE ROLE energy_staff_runtime_v3 NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA energy_staff_v3 TO energy_staff_runtime_v3;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA energy_staff_v3 TO energy_staff_runtime_v3;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA energy_staff_v3 TO energy_staff_runtime_v3;
CREATE POLICY runtime_access ON energy_staff_v3.es_users TO energy_staff_runtime_v3 USING(true) WITH CHECK(true);
CREATE POLICY runtime_access ON energy_staff_v3.es_sessions TO energy_staff_runtime_v3 USING(true) WITH CHECK(true);
CREATE POLICY runtime_access ON energy_staff_v3.es_limits TO energy_staff_runtime_v3 USING(true) WITH CHECK(true);
CREATE POLICY runtime_access ON energy_staff_v3.es_state TO energy_staff_runtime_v3 USING(true) WITH CHECK(true);
CREATE POLICY runtime_access ON energy_staff_v3.es_audit TO energy_staff_runtime_v3 USING(true) WITH CHECK(true);
ALTER ROLE energy_staff_runtime_v3 SET search_path=energy_staff_v3,pg_catalog;
ALTER ROLE energy_staff_runtime_v3 SET statement_timeout='15s';
ALTER ROLE energy_staff_runtime_v3 SET idle_in_transaction_session_timeout='20s';
