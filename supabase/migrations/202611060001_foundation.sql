-- Drape & Drop foundation v0.2.0. Apply once via reviewed migrations.
-- No catalog/wardrobe/images/jobs or destructive account-deletion endpoint.
BEGIN;

CREATE ROLE dd_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE dd_user_executor NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE dd_control_reader NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE dd_control_executor NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE dd_lifecycle_operator NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
-- Migration operator only; never grant these roles to authenticated/anon/authenticator.
DO $migration$
BEGIN
 EXECUTE pg_catalog.format('GRANT dd_owner, dd_user_executor, dd_control_reader, dd_control_executor, dd_lifecycle_operator TO %I', current_user);
END;
$migration$;

CREATE SCHEMA app_private AUTHORIZATION dd_owner;
CREATE SCHEMA api AUTHORIZATION dd_owner;
REVOKE ALL ON SCHEMA app_private, api FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA api, app_private TO authenticated;
GRANT USAGE ON SCHEMA app_private TO dd_user_executor, dd_control_reader, dd_control_executor, dd_lifecycle_operator;
GRANT USAGE ON SCHEMA auth TO dd_user_executor, dd_control_reader, dd_control_executor;
GRANT EXECUTE ON FUNCTION auth.uid() TO dd_user_executor, dd_control_reader, dd_control_executor;
-- Temporary CREATE permits assigning function ownership; revoked before COMMIT.
GRANT CREATE ON SCHEMA app_private TO dd_user_executor, dd_control_reader, dd_control_executor;

CREATE TABLE app_private.user_profiles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 name varchar(200) NOT NULL,
 style varchar(2000), location varchar(200), bio varchar(2000),
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE app_private.body_profiles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 units text CHECK (units IN ('cm','in')),
 height numeric(10,4) CHECK (height BETWEEN 1 AND 300),
 chest numeric(10,4) CHECK (chest BETWEEN 1 AND 300),
 waist numeric(10,4) CHECK (waist BETWEEN 1 AND 300),
 hips numeric(10,4) CHECK (hips BETWEEN 1 AND 300),
 inseam numeric(10,4) CHECK (inseam BETWEEN 1 AND 300),
 body_shape varchar(200), skin_tone varchar(200),
 undertone text CHECK (undertone IN ('Warm','Cool','Neutral','Not sure')),
 fit text CHECK (fit IN ('Fitted','Regular','Relaxed','Oversized')),
 updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 CONSTRAINT measurements_have_units CHECK (units IS NOT NULL OR
  (height IS NULL AND chest IS NULL AND waist IS NULL AND hips IS NULL AND inseam IS NULL))
);
CREATE TABLE app_private.user_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 units text CHECK (units IN ('cm','in')),
 email_notifications boolean,
 updated_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE app_private.account_lifecycle (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 state text NOT NULL CHECK (state IN ('active','disabled','deleting')),
 state_changed_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE app_private.account_deletion_tombstones (
 former_subject_id uuid PRIMARY KEY, -- deliberately no live Auth FK
 deletion_started_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 cleanup_stage text NOT NULL CHECK (cleanup_stage IN ('denying','purging','auth_removed','complete')),
 auth_deleted_at timestamptz,
 cleanup_completed_at timestamptz,
 CHECK (auth_deleted_at IS NULL OR auth_deleted_at >= deletion_started_at),
 CHECK (cleanup_completed_at IS NULL OR cleanup_completed_at >= deletion_started_at),
 CHECK (cleanup_stage NOT IN ('auth_removed','complete') OR auth_deleted_at IS NOT NULL),
 CHECK (cleanup_stage <> 'complete' OR cleanup_completed_at IS NOT NULL)
);
CREATE TABLE app_private.administrator_memberships (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 permission text NOT NULL CHECK (permission = 'catalog_manage'),
 granted_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 PRIMARY KEY (user_id, permission)
);

ALTER TABLE app_private.user_profiles OWNER TO dd_owner;
ALTER TABLE app_private.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.user_profiles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.user_profiles FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE app_private.body_profiles OWNER TO dd_owner;
ALTER TABLE app_private.body_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.body_profiles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.body_profiles FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE app_private.user_preferences OWNER TO dd_owner;
ALTER TABLE app_private.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.user_preferences FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.user_preferences FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE app_private.account_lifecycle OWNER TO dd_owner;
ALTER TABLE app_private.account_lifecycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.account_lifecycle FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.account_lifecycle FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE app_private.account_deletion_tombstones OWNER TO dd_owner;
ALTER TABLE app_private.account_deletion_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.account_deletion_tombstones FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.account_deletion_tombstones FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE app_private.administrator_memberships OWNER TO dd_owner;
ALTER TABLE app_private.administrator_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.administrator_memberships FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.administrator_memberships FROM PUBLIC, anon, authenticated, service_role;

-- Restrict per-schema defaults; these do not negate a creator's global defaults.
-- All current objects are explicitly reset as well; audit every later migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA api, app_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA api, app_private REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE dd_owner IN SCHEMA api, app_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE dd_owner IN SCHEMA api, app_private REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE dd_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON app_private.account_lifecycle, app_private.account_deletion_tombstones,
 app_private.administrator_memberships TO dd_control_reader;
-- Required only for SELECT FOR SHARE inside require_active_account. The lock policy
-- allows row visibility for locking but rejects every actual UPDATE result.
GRANT UPDATE (user_id) ON app_private.account_lifecycle TO dd_control_reader;
CREATE POLICY control_read ON app_private.account_lifecycle FOR SELECT TO dd_control_reader USING (true);
CREATE POLICY control_read ON app_private.account_deletion_tombstones FOR SELECT TO dd_control_reader USING (true);
CREATE POLICY control_read ON app_private.administrator_memberships FOR SELECT TO dd_control_reader USING (true);

CREATE POLICY control_lock ON app_private.account_lifecycle FOR UPDATE TO dd_control_reader
 USING (true) WITH CHECK (false);

CREATE FUNCTION app_private.current_account_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM app_private.account_lifecycle l WHERE l.user_id = auth.uid() AND l.state = 'active'
 ) AND NOT EXISTS (
  SELECT 1 FROM app_private.account_deletion_tombstones t WHERE t.former_subject_id = auth.uid()
 );
$fn$;
ALTER FUNCTION app_private.current_account_active() OWNER TO dd_control_reader;

CREATE FUNCTION app_private.current_catalog_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
 SELECT app_private.current_account_active() AND EXISTS (
  SELECT 1 FROM app_private.administrator_memberships m
  WHERE m.user_id = auth.uid() AND m.permission = 'catalog_manage'
 );
$fn$;
ALTER FUNCTION app_private.current_catalog_admin() OWNER TO dd_control_reader;

-- Locks eligibility until the user transaction completes. A concurrent disable/delete
-- obtains the conflicting row lock and cannot race into a later accepted mutation.
CREATE FUNCTION app_private.require_active_account() RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE account_state text;
BEGIN
 SELECT state INTO account_state FROM app_private.account_lifecycle
 WHERE user_id = auth.uid() FOR SHARE;
 IF auth.uid() IS NULL OR account_state IS DISTINCT FROM 'active'
  OR EXISTS (SELECT 1 FROM app_private.account_deletion_tombstones WHERE former_subject_id = auth.uid()) THEN
  RAISE EXCEPTION 'Account access denied' USING ERRCODE = '42501';
 END IF;
END;
$fn$;
ALTER FUNCTION app_private.require_active_account() OWNER TO dd_control_reader;
GRANT EXECUTE ON FUNCTION app_private.current_account_active(), app_private.current_catalog_admin()
 TO authenticated, dd_user_executor, dd_control_reader;
GRANT EXECUTE ON FUNCTION app_private.require_active_account() TO dd_user_executor;

GRANT SELECT ON app_private.user_profiles, app_private.user_preferences TO dd_user_executor;
GRANT UPDATE (name,style,location,bio,updated_at) ON app_private.user_profiles TO dd_user_executor;
GRANT UPDATE (units,email_notifications,updated_at) ON app_private.user_preferences TO dd_user_executor;
CREATE POLICY own_active_select ON app_private.user_profiles FOR SELECT TO dd_user_executor
 USING (user_id = (SELECT auth.uid()) AND (SELECT app_private.current_account_active()));
CREATE POLICY own_active_update ON app_private.user_profiles FOR UPDATE TO dd_user_executor
 USING (user_id = (SELECT auth.uid()) AND (SELECT app_private.current_account_active()))
 WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT app_private.current_account_active()));
CREATE POLICY own_active_select ON app_private.body_profiles FOR SELECT TO dd_user_executor
 USING (user_id = (SELECT auth.uid()) AND (SELECT app_private.current_account_active()));
CREATE POLICY own_active_update ON app_private.body_profiles FOR UPDATE TO dd_user_executor
 USING (user_id = (SELECT auth.uid()) AND (SELECT app_private.current_account_active()))
 WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT app_private.current_account_active()));
CREATE POLICY own_active_select ON app_private.user_preferences FOR SELECT TO dd_user_executor
 USING (user_id = (SELECT auth.uid()) AND (SELECT app_private.current_account_active()));
CREATE POLICY own_active_update ON app_private.user_preferences FOR UPDATE TO dd_user_executor
 USING (user_id = (SELECT auth.uid()) AND (SELECT app_private.current_account_active()))
 WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT app_private.current_account_active()));

-- No body read/write operation yet: unit conversion/precision semantics await review.
CREATE FUNCTION app_private.read_profile() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE result jsonb;
BEGIN
 IF NOT app_private.current_account_active() THEN
  RAISE EXCEPTION 'Account access denied' USING ERRCODE = '42501';
 END IF;
 SELECT jsonb_build_object('name',name,'style',coalesce(style,''),
  'location',coalesce(location,''),'bio',coalesce(bio,'')) INTO result
 FROM app_private.user_profiles WHERE user_id = auth.uid();
 IF result IS NULL THEN RAISE EXCEPTION 'Profile bootstrap incomplete' USING ERRCODE = '55000'; END IF;
 RETURN result;
END;
$fn$;
ALTER FUNCTION app_private.read_profile() OWNER TO dd_user_executor;

CREATE FUNCTION app_private.update_profile(p_name text, p_style text, p_location text, p_bio text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
 PERFORM app_private.require_active_account();
 IF p_name IS NULL OR btrim(p_name) = '' OR char_length(p_name) > 200
  OR char_length(p_style) > 2000 OR char_length(p_location) > 200 OR char_length(p_bio) > 2000 THEN
  RAISE EXCEPTION 'Invalid profile fields' USING ERRCODE = '22023';
 END IF;
 UPDATE app_private.user_profiles SET name = btrim(p_name), style = nullif(btrim(p_style),''),
  location = nullif(btrim(p_location),''), bio = nullif(btrim(p_bio),''), updated_at = transaction_timestamp()
 WHERE user_id = auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile bootstrap incomplete' USING ERRCODE = '55000'; END IF;
END;
$fn$;
ALTER FUNCTION app_private.update_profile(text,text,text,text) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.read_preferences() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE result jsonb;
BEGIN
 IF NOT app_private.current_account_active() THEN
  RAISE EXCEPTION 'Account access denied' USING ERRCODE = '42501';
 END IF;
 SELECT jsonb_build_object('units',coalesce(units,''),'emailNotifications',
  CASE email_notifications WHEN true THEN 'Enabled' WHEN false THEN 'Disabled' ELSE '' END)
 INTO result FROM app_private.user_preferences WHERE user_id = auth.uid();
 IF result IS NULL THEN RAISE EXCEPTION 'Preferences bootstrap incomplete' USING ERRCODE = '55000'; END IF;
 RETURN result;
END;
$fn$;
ALTER FUNCTION app_private.read_preferences() OWNER TO dd_user_executor;

CREATE FUNCTION app_private.update_preferences(p_units text, p_email_notifications text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
 PERFORM app_private.require_active_account();
 IF p_units IS NOT NULL AND p_units NOT IN ('','cm','in') OR
  p_email_notifications IS NOT NULL AND p_email_notifications NOT IN ('','Enabled','Disabled') THEN
  RAISE EXCEPTION 'Invalid preferences' USING ERRCODE = '22023';
 END IF;
 UPDATE app_private.user_preferences SET units = nullif(p_units,''), email_notifications =
  CASE p_email_notifications WHEN 'Enabled' THEN true WHEN 'Disabled' THEN false ELSE NULL END,
  updated_at = transaction_timestamp() WHERE user_id = auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Preferences bootstrap incomplete' USING ERRCODE = '55000'; END IF;
END;
$fn$;
ALTER FUNCTION app_private.update_preferences(text,text) OWNER TO dd_user_executor;

-- Trusted provisioning/lifecycle authority. No grant to ordinary application roles.
GRANT SELECT, INSERT ON app_private.user_profiles, app_private.body_profiles, app_private.user_preferences TO dd_control_executor;
GRANT SELECT, INSERT, UPDATE ON app_private.account_lifecycle, app_private.account_deletion_tombstones,
 app_private.administrator_memberships TO dd_control_executor;
GRANT DELETE ON app_private.administrator_memberships TO dd_control_executor;
CREATE POLICY bootstrap_select ON app_private.user_profiles FOR SELECT TO dd_control_executor USING (true);
CREATE POLICY bootstrap_insert ON app_private.user_profiles FOR INSERT TO dd_control_executor WITH CHECK (true);
CREATE POLICY bootstrap_select ON app_private.body_profiles FOR SELECT TO dd_control_executor USING (true);
CREATE POLICY bootstrap_insert ON app_private.body_profiles FOR INSERT TO dd_control_executor WITH CHECK (true);
CREATE POLICY bootstrap_select ON app_private.user_preferences FOR SELECT TO dd_control_executor USING (true);
CREATE POLICY bootstrap_insert ON app_private.user_preferences FOR INSERT TO dd_control_executor WITH CHECK (true);
CREATE POLICY trusted_control ON app_private.account_lifecycle FOR ALL TO dd_control_executor USING (true) WITH CHECK (true);
CREATE POLICY trusted_control ON app_private.account_deletion_tombstones FOR ALL TO dd_control_executor USING (true) WITH CHECK (true);
CREATE POLICY trusted_control ON app_private.administrator_memberships FOR ALL TO dd_control_executor USING (true) WITH CHECK (true);

CREATE FUNCTION app_private.bootstrap_user(p_user_id uuid, p_name text DEFAULT '') RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
 -- Serializes bootstrap with other trusted operations for this subject.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 IF EXISTS (SELECT 1 FROM app_private.account_deletion_tombstones WHERE former_subject_id = p_user_id) THEN
  RAISE EXCEPTION 'Deletion evidence prevents bootstrap' USING ERRCODE = '42501';
 END IF;
 IF p_name IS NULL OR char_length(p_name) > 200 THEN
  RAISE EXCEPTION 'Invalid bootstrap name' USING ERRCODE = '22023';
 END IF;
 INSERT INTO app_private.account_lifecycle(user_id,state) VALUES(p_user_id,'active') ON CONFLICT DO NOTHING;
 INSERT INTO app_private.user_profiles(user_id,name) VALUES(p_user_id,btrim(p_name)) ON CONFLICT DO NOTHING;
 INSERT INTO app_private.body_profiles(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 INSERT INTO app_private.user_preferences(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 -- Idempotent: never reactivates a disabled/deleting subject or overwrites edited values.
END;
$fn$;
ALTER FUNCTION app_private.bootstrap_user(uuid,text) OWNER TO dd_control_executor;

CREATE FUNCTION app_private.set_account_state(p_user_id uuid, p_state text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE previous text;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 SELECT state INTO previous FROM app_private.account_lifecycle WHERE user_id = p_user_id FOR UPDATE;
 IF previous IS NULL OR previous = 'deleting' OR p_state IS NULL OR p_state NOT IN ('active','disabled')
  OR EXISTS (SELECT 1 FROM app_private.account_deletion_tombstones WHERE former_subject_id = p_user_id) THEN
  RAISE EXCEPTION 'Invalid lifecycle transition' USING ERRCODE = '22023';
 END IF;
 UPDATE app_private.account_lifecycle SET state = p_state, state_changed_at = transaction_timestamp() WHERE user_id = p_user_id;
END;
$fn$;
ALTER FUNCTION app_private.set_account_state(uuid,text) OWNER TO dd_control_executor;

CREATE FUNCTION app_private.begin_account_deletion(p_user_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 UPDATE app_private.account_lifecycle SET state = 'deleting', state_changed_at = transaction_timestamp()
 WHERE user_id = p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown account' USING ERRCODE = '22023'; END IF;
 INSERT INTO app_private.account_deletion_tombstones(former_subject_id,cleanup_stage)
 VALUES(p_user_id,'denying') ON CONFLICT DO NOTHING;
END;
$fn$;
ALTER FUNCTION app_private.begin_account_deletion(uuid) OWNER TO dd_control_executor;

CREATE FUNCTION app_private.set_catalog_membership(p_user_id uuid, p_granted boolean) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE account_state text;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 SELECT state INTO account_state FROM app_private.account_lifecycle WHERE user_id = p_user_id FOR UPDATE;
 IF p_granted IS NULL OR account_state IS NULL OR (p_granted AND account_state <> 'active') THEN
  RAISE EXCEPTION 'Invalid membership transition' USING ERRCODE = '22023';
 END IF;
 IF p_granted THEN
  INSERT INTO app_private.administrator_memberships(user_id,permission) VALUES(p_user_id,'catalog_manage') ON CONFLICT DO NOTHING;
 ELSE
  DELETE FROM app_private.administrator_memberships WHERE user_id = p_user_id AND permission = 'catalog_manage';
 END IF;
END;
$fn$;
ALTER FUNCTION app_private.set_catalog_membership(uuid,boolean) OWNER TO dd_control_executor;

GRANT EXECUTE ON FUNCTION app_private.bootstrap_user(uuid,text), app_private.set_account_state(uuid,text),
 app_private.begin_account_deletion(uuid), app_private.set_catalog_membership(uuid,boolean) TO dd_lifecycle_operator;

-- Exposed wrappers are invoker functions. Private implementations execute with a
-- dedicated non-owner, non-BYPASSRLS role and retain auth.uid() from the user JWT.
CREATE FUNCTION api.account_access() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
 SELECT jsonb_build_object('userId',auth.uid(),'active',app_private.current_account_active(),
  'isCatalogAdmin',app_private.current_catalog_admin());
$fn$;
CREATE FUNCTION api.read_profile() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
 SELECT app_private.read_profile();
$fn$;
CREATE FUNCTION api.update_profile(p_name text,p_style text,p_location text,p_bio text) RETURNS void
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $fn$
 SELECT app_private.update_profile(p_name,p_style,p_location,p_bio);
$fn$;
CREATE FUNCTION api.read_preferences() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
 SELECT app_private.read_preferences();
$fn$;
CREATE FUNCTION api.update_preferences(p_units text,p_email_notifications text) RETURNS void
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $fn$
 SELECT app_private.update_preferences(p_units,p_email_notifications);
$fn$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA api FROM PUBLIC, anon, authenticated, service_role;
-- Reset ambient Supabase default grants before restoring the exact user allowlist.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.current_account_active(), app_private.current_catalog_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.read_profile(),app_private.update_profile(text,text,text,text),
 app_private.read_preferences(),app_private.update_preferences(text,text) TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA api TO authenticated;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor, dd_control_reader, dd_control_executor;

-- Restrictive policy adds lifecycle denial to EVERY otherwise permitted authenticated
-- Storage operation. It grants no object access on its own and creates no buckets.
CREATE POLICY dd_active_account_required ON storage.objects AS RESTRICTIVE
 FOR ALL TO authenticated
 USING ((SELECT app_private.current_account_active()))
 WITH CHECK ((SELECT app_private.current_account_active()));

NOTIFY pgrst, 'reload schema';
COMMIT;
