-- REVIEW PACKAGE ONLY: apply AFTER all 15 migrations AND REGISTRATION_STORAGE.sql.
-- Never run remotely without explicit exact-package approval. Existing files unchanged.
BEGIN;
CREATE ROLE dd_registration_executor NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
DO $$BEGIN EXECUTE pg_catalog.format('GRANT dd_registration_executor TO %I',current_user); END;$$;
GRANT USAGE ON SCHEMA app_private TO dd_registration_executor;
GRANT CREATE ON SCHEMA app_private TO dd_registration_executor,dd_control_executor,dd_control_reader;
ALTER TABLE app_private.registration_challenges ADD COLUMN email_address text NOT NULL
 CHECK (length(email_address) BETWEEN 3 AND 254 AND email_address=lower(email_address) AND position('@' IN email_address)>1);
ALTER TABLE app_private.account_lifecycle DROP CONSTRAINT account_lifecycle_state_check;
ALTER TABLE app_private.account_lifecycle ADD CONSTRAINT account_lifecycle_state_check
 CHECK(state IN ('pending_verification','active','disabled','deleting'));
GRANT SELECT,INSERT ON app_private.registration_challenges TO dd_registration_executor;
GRANT UPDATE(user_id,state,session_binding_hash,link_hash,otp_mac,link_verified_at,otp_verified_at,
 finalization_started_at,auth_confirmed_at,completed_at,invalid_attempts,superseded_at)
 ON app_private.registration_challenges TO dd_registration_executor;
GRANT SELECT,INSERT,DELETE ON app_private.registration_rate_windows TO dd_registration_executor;
GRANT UPDATE(attempts) ON app_private.registration_rate_windows TO dd_registration_executor;
GRANT SELECT,INSERT ON app_private.registration_receipts TO dd_registration_executor;
GRANT SELECT ON app_private.registration_receipts,app_private.registration_challenges TO dd_control_reader;
-- Check authoritative email status for the caller only. No Auth row is returned.
CREATE FUNCTION app_private.current_verified_email_matches(p_email text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
  SELECT 1 FROM auth.users
  WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL AND lower(email) = p_email
 );
$$;
REVOKE ALL ON FUNCTION app_private.current_verified_email_matches(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.current_verified_email_matches(text) TO dd_control_reader;
GRANT SELECT ON app_private.account_lifecycle,app_private.account_deletion_tombstones TO dd_registration_executor;
GRANT UPDATE(state,state_changed_at) ON app_private.account_lifecycle TO dd_registration_executor;
CREATE POLICY registration_control ON app_private.registration_challenges FOR ALL TO dd_registration_executor USING(true) WITH CHECK(true);
CREATE POLICY registration_control ON app_private.registration_rate_windows FOR ALL TO dd_registration_executor USING(true) WITH CHECK(true);
CREATE POLICY registration_control ON app_private.registration_receipts FOR SELECT TO dd_registration_executor USING(true);
CREATE POLICY registration_insert ON app_private.registration_receipts FOR INSERT TO dd_registration_executor WITH CHECK(true);
CREATE POLICY receipt_read ON app_private.registration_receipts FOR SELECT TO dd_control_reader USING(true);
CREATE POLICY challenge_read ON app_private.registration_challenges FOR SELECT TO dd_control_reader USING(true);
CREATE POLICY registration_read ON app_private.account_lifecycle FOR SELECT TO dd_registration_executor USING(true);
CREATE POLICY registration_activate ON app_private.account_lifecycle FOR UPDATE TO dd_registration_executor
 USING(state='pending_verification') WITH CHECK(state='active');
CREATE POLICY registration_tombstone_read ON app_private.account_deletion_tombstones FOR SELECT TO dd_registration_executor USING(true);

-- One atomic counter per operation/scope/MAC; caller supplies only trusted configuration.
CREATE FUNCTION app_private.registration_rate(p_scope text,p_key text,p_limit integer) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE started timestamptz:=date_trunc('hour',clock_timestamp()); hits integer;
BEGIN
 IF p_scope NOT IN ('address','session','network') OR p_key !~ '^[a-f0-9]{64}$' OR p_limit NOT BETWEEN 1 AND 1000 THEN RETURN false; END IF;
 INSERT INTO app_private.registration_rate_windows(scope,key_mac,window_started_at,window_ends_at,attempts)
 VALUES(p_scope,decode(p_key,'hex'),started,started+interval '1 hour',1)
 ON CONFLICT(scope,key_mac,window_started_at) DO UPDATE SET attempts=least(app_private.registration_rate_windows.attempts+1,1001)
 RETURNING attempts INTO hits;
 RETURN hits<=p_limit;
END;$$;

CREATE FUNCTION app_private.registration_issue(p_attempt uuid,p_email text,p_email_mac text,
 p_session text,p_link text,p_otp text,p_previous uuid DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE previous app_private.registration_challenges; issued timestamptz;
BEGIN
 IF p_email_mac !~ '^[a-f0-9]{64}$' OR p_session !~ '^[a-f0-9]{64}$' OR p_link !~ '^[a-f0-9]{64}$' OR p_otp !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
 -- Fresh starts never reserve the email or replace another browser's challenge.
 IF p_previous IS NOT NULL THEN
  SELECT * INTO previous FROM app_private.registration_challenges WHERE id=p_previous FOR UPDATE;
  IF NOT FOUND OR previous.state NOT IN ('pending','locked','expired')
   OR previous.email_address IS DISTINCT FROM p_email
   OR previous.email_binding_mac IS DISTINCT FROM decode(p_email_mac,'hex')
   OR previous.session_binding_hash IS DISTINCT FROM decode(p_session,'hex')
   OR previous.issued_at>clock_timestamp()-interval '60 seconds' THEN RETURN false; END IF;
  UPDATE app_private.registration_challenges SET state='superseded',superseded_at=clock_timestamp(),
   link_hash=NULL,otp_mac=NULL,session_binding_hash=NULL WHERE id=p_previous;
 END IF;
 issued:=clock_timestamp();
 INSERT INTO app_private.registration_challenges(id,email_address,email_binding_mac,session_binding_hash,link_hash,otp_mac,issued_at,expires_at)
 VALUES(p_attempt,p_email,decode(p_email_mac,'hex'),decode(p_session,'hex'),decode(p_link,'hex'),decode(p_otp,'hex'),issued,issued+interval '10 minutes');
 RETURN true;
END;$$;

CREATE FUNCTION app_private.registration_lookup(p_attempt uuid,p_session text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE c app_private.registration_challenges;
BEGIN
 IF p_session !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
 SELECT * INTO c FROM app_private.registration_challenges WHERE id=p_attempt AND session_binding_hash=decode(p_session,'hex');
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('subject',c.user_id,'email',c.email_address,'state',CASE WHEN c.state='pending' AND c.expires_at<=clock_timestamp() THEN 'expired' WHEN c.state='finalizing' AND c.finalization_started_at<clock_timestamp()-interval '24 hours' THEN 'expired' ELSE c.state END,
  'canFinalize',c.state='finalizing' AND c.finalization_started_at>=clock_timestamp()-interval '24 hours',
  'link',encode(c.link_hash,'hex'),'otp',encode(c.otp_mac,'hex'),'linkVerified',c.link_verified_at IS NOT NULL);
END;$$;

CREATE FUNCTION app_private.registration_prove(p_attempt uuid,p_session text,p_kind text,p_expected text,p_valid boolean) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE c app_private.registration_challenges; moment timestamptz;
BEGIN
 IF p_session !~ '^[a-f0-9]{64}$' OR p_expected !~ '^[a-f0-9]{64}$' OR p_kind NOT IN ('link','otp') THEN RETURN false; END IF;
 SELECT * INTO c FROM app_private.registration_challenges WHERE id=p_attempt AND session_binding_hash=decode(p_session,'hex') FOR UPDATE;
 IF NOT FOUND OR c.state<>'pending' THEN RETURN false; END IF;
 moment:=clock_timestamp();
 IF c.expires_at<=moment THEN UPDATE app_private.registration_challenges SET state='expired',link_hash=NULL,otp_mac=NULL WHERE id=c.id; RETURN false; END IF;
 IF c.invalid_attempts>=5 THEN RETURN false; END IF;
 IF (p_kind='link' AND c.link_hash IS DISTINCT FROM decode(p_expected,'hex')) OR (p_kind='otp' AND c.otp_mac IS DISTINCT FROM decode(p_expected,'hex')) THEN RETURN false; END IF;
 IF p_valid IS NOT TRUE THEN
  UPDATE app_private.registration_challenges SET invalid_attempts=invalid_attempts+1,state=CASE WHEN invalid_attempts+1>=5 THEN 'locked' ELSE state END WHERE id=c.id;
  RETURN false;
 END IF;
 IF p_kind='link' THEN
  -- Idempotent link confirmation; GET never calls this function.
  UPDATE app_private.registration_challenges SET link_verified_at=coalesce(link_verified_at,moment) WHERE id=c.id;
 ELSE
  IF c.link_verified_at IS NULL THEN RETURN false; END IF;
  UPDATE app_private.registration_challenges SET otp_verified_at=moment,finalization_started_at=moment,state='finalizing' WHERE id=c.id;
 END IF;
 RETURN true;
END;$$;

-- Auth admin create sets trusted app metadata, then confirms email inside its creation
-- transaction. Never write managed Auth rows from application SQL.
CREATE FUNCTION app_private.registration_activate_auth_user() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE marker text; challenge app_private.registration_challenges; moment timestamptz;
BEGIN
 marker:=NEW.raw_app_meta_data->>'dd_registration_attempt';
 IF marker IS NULL OR NEW.email_confirmed_at IS NULL THEN RETURN NEW; END IF;
 IF marker !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
  RAISE EXCEPTION 'Invalid registration attempt' USING ERRCODE='42501';
 END IF;
 SELECT * INTO challenge FROM app_private.registration_challenges WHERE id=marker::uuid FOR UPDATE;
 IF FOUND AND challenge.state='complete' AND challenge.user_id=NEW.id
  AND challenge.email_address=lower(NEW.email) THEN RETURN NEW; END IF;
 moment:=clock_timestamp();
 IF NOT FOUND OR challenge.state<>'finalizing' OR challenge.email_address IS DISTINCT FROM lower(NEW.email)
  OR challenge.finalization_started_at< moment-interval '24 hours'
  OR EXISTS(SELECT 1 FROM app_private.account_deletion_tombstones WHERE former_subject_id=NEW.id) THEN
  RAISE EXCEPTION 'Registration proofs unavailable' USING ERRCODE='42501';
 END IF;
 UPDATE app_private.account_lifecycle SET state='active',state_changed_at=moment
 WHERE user_id=NEW.id AND state='pending_verification';
 IF NOT FOUND THEN RAISE EXCEPTION 'Registration cannot activate this account' USING ERRCODE='42501'; END IF;
 UPDATE app_private.registration_challenges SET state='complete',user_id=NEW.id,
  auth_confirmed_at=moment,completed_at=moment,link_hash=NULL,otp_mac=NULL WHERE id=challenge.id;
 INSERT INTO app_private.registration_receipts(user_id,challenge_id,method,verified_at)
 VALUES(NEW.id,challenge.id,'dual_email',moment);
 RETURN NEW;
END;$$;
ALTER FUNCTION app_private.registration_activate_auth_user() OWNER TO dd_registration_executor;
REVOKE ALL ON FUNCTION app_private.registration_activate_auth_user() FROM PUBLIC,anon,authenticated,service_role;
-- INSERT handles providers that confirm on creation. UPDATE handles GoTrue's separate
-- confirmation statement. The z-prefix runs after drapedrop_provision on INSERT.
CREATE TRIGGER zz_drapedrop_registration_activate AFTER INSERT OR UPDATE OF email_confirmed_at
 ON auth.users FOR EACH ROW EXECUTE FUNCTION app_private.registration_activate_auth_user();

CREATE FUNCTION app_private.registration_expire() RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE affected integer;
BEGIN
 WITH batch AS(SELECT id FROM app_private.registration_challenges WHERE state='pending' AND expires_at<clock_timestamp() ORDER BY expires_at,id LIMIT 100 FOR UPDATE SKIP LOCKED)
 UPDATE app_private.registration_challenges SET state='expired',link_hash=NULL,otp_mac=NULL WHERE id IN(SELECT id FROM batch);
 GET DIAGNOSTICS affected=ROW_COUNT;
 -- Keep successful proof evidence and unfinished finalization; retention is not silently decided.
 WITH batch AS(SELECT scope,key_mac,window_started_at FROM app_private.registration_rate_windows WHERE window_ends_at<clock_timestamp()-interval '1 hour' LIMIT 1000)
 DELETE FROM app_private.registration_rate_windows w USING batch b WHERE (w.scope,w.key_mac,w.window_started_at)=(b.scope,b.key_mac,b.window_started_at);
 RETURN affected;
END;$$;

-- No existing confirmed identity gets a fabricated receipt or automatic dual-proof exemption.
CREATE OR REPLACE FUNCTION app_private.current_account_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT app_private.request_subject() IS NOT NULL AND EXISTS(
 SELECT 1 FROM app_private.account_lifecycle l JOIN app_private.registration_receipts r ON r.user_id=l.user_id
 JOIN app_private.registration_challenges c ON (c.id,c.user_id)=(r.challenge_id,r.user_id)
 WHERE l.user_id=app_private.request_subject() AND l.state='active' AND c.state='complete'
 AND app_private.current_verified_email_matches(c.email_address)
 ) AND NOT EXISTS(SELECT 1 FROM app_private.account_deletion_tombstones WHERE former_subject_id=app_private.request_subject());
$$;
CREATE OR REPLACE FUNCTION app_private.require_active_account() RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM app_private.account_lifecycle WHERE user_id=app_private.request_subject() FOR SHARE;
 IF NOT app_private.current_account_active() THEN RAISE EXCEPTION 'Account access denied' USING ERRCODE='42501'; END IF;
END;$$;
-- Replace bootstrap's activation default, preserving all existing data and all other safeguards.
CREATE OR REPLACE FUNCTION app_private.bootstrap_user(p_user_id uuid, p_name text DEFAULT '') RETURNS void
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
 INSERT INTO app_private.account_lifecycle(user_id,state) VALUES(p_user_id,'pending_verification') ON CONFLICT DO NOTHING;
 INSERT INTO app_private.user_profiles(user_id,name) VALUES(p_user_id,btrim(p_name)) ON CONFLICT DO NOTHING;
 INSERT INTO app_private.body_profiles(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 INSERT INTO app_private.user_preferences(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 -- Idempotent: never reactivates a disabled/deleting subject or overwrites edited values.
END;
$fn$;

-- Explicit wrapper ACLs; no client can issue challenges, forge receipts or activate itself.
ALTER FUNCTION app_private.registration_rate(text,text,integer) OWNER TO dd_registration_executor;
CREATE FUNCTION api.registration_rate(p_scope text,p_key text,p_limit integer) RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.registration_rate(p_scope,p_key,p_limit); $$;
REVOKE ALL ON FUNCTION api.registration_rate(text,text,integer),app_private.registration_rate(text,text,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.registration_rate(text,text,integer),app_private.registration_rate(text,text,integer) TO service_role;
ALTER FUNCTION app_private.registration_issue(uuid,text,text,text,text,text,uuid) OWNER TO dd_registration_executor;
CREATE FUNCTION api.registration_issue(p_attempt uuid,p_email text,p_email_mac text,p_session text,p_link text,p_otp text,p_previous uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.registration_issue(p_attempt,p_email,p_email_mac,p_session,p_link,p_otp,p_previous); $$;
REVOKE ALL ON FUNCTION api.registration_issue(uuid,text,text,text,text,text,uuid),app_private.registration_issue(uuid,text,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.registration_issue(uuid,text,text,text,text,text,uuid),app_private.registration_issue(uuid,text,text,text,text,text,uuid) TO service_role;
ALTER FUNCTION app_private.registration_lookup(uuid,text) OWNER TO dd_registration_executor;
CREATE FUNCTION api.registration_lookup(p_attempt uuid,p_session text) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.registration_lookup(p_attempt,p_session); $$;
REVOKE ALL ON FUNCTION api.registration_lookup(uuid,text),app_private.registration_lookup(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.registration_lookup(uuid,text),app_private.registration_lookup(uuid,text) TO service_role;
ALTER FUNCTION app_private.registration_prove(uuid,text,text,text,boolean) OWNER TO dd_registration_executor;
CREATE FUNCTION api.registration_prove(p_attempt uuid,p_session text,p_kind text,p_expected text,p_valid boolean) RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.registration_prove(p_attempt,p_session,p_kind,p_expected,p_valid); $$;
REVOKE ALL ON FUNCTION api.registration_prove(uuid,text,text,text,boolean),app_private.registration_prove(uuid,text,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.registration_prove(uuid,text,text,text,boolean),app_private.registration_prove(uuid,text,text,text,boolean) TO service_role;
ALTER FUNCTION app_private.registration_expire() OWNER TO dd_registration_executor;
CREATE FUNCTION api.registration_expire() RETURNS integer LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.registration_expire(); $$;
REVOKE ALL ON FUNCTION api.registration_expire(),app_private.registration_expire() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.registration_expire(),app_private.registration_expire() TO service_role;
REVOKE CREATE ON SCHEMA app_private FROM dd_registration_executor,dd_control_reader,dd_control_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
