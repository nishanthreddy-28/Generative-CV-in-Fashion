-- Trusted, expiring admission for existing verified development accounts.
-- Registration receipts continue to mean independent link-and-code verification.
BEGIN;
CREATE TABLE app_private.development_preview_access (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 approved_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 expires_at timestamptz NOT NULL,
 purpose text NOT NULL DEFAULT 'android_review' CHECK (purpose='android_review'),
 CHECK (expires_at>approved_at AND expires_at<=approved_at+interval '7 days')
);
ALTER TABLE app_private.development_preview_access OWNER TO dd_owner;
ALTER TABLE app_private.development_preview_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.development_preview_access FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.development_preview_access FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON app_private.development_preview_access TO dd_control_reader;
CREATE POLICY trusted_preview_read ON app_private.development_preview_access FOR SELECT TO dd_control_reader USING(true);

-- Owned by the trusted migration operator. Return only the caller's eligibility.
CREATE FUNCTION app_private.current_identity_confirmed() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid()
  AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL
  AND (banned_until IS NULL OR banned_until<=statement_timestamp()));
$$;
REVOKE ALL ON FUNCTION app_private.current_identity_confirmed() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.current_identity_confirmed() TO dd_control_reader;

CREATE FUNCTION app_private.approve_development_preview(p_subject uuid) RETURNS timestamptz
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE expiration timestamptz:=transaction_timestamp()+interval '7 days';
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_subject::text,0));
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_subject AND email_confirmed_at IS NOT NULL
   AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=statement_timestamp()))
  OR NOT EXISTS(SELECT 1 FROM app_private.account_lifecycle WHERE user_id=p_subject AND state='active')
  OR EXISTS(SELECT 1 FROM app_private.account_deletion_tombstones WHERE former_subject_id=p_subject) THEN
  RAISE EXCEPTION 'Verified active development account required' USING ERRCODE='42501';
 END IF;
 INSERT INTO app_private.development_preview_access(user_id,expires_at) VALUES(p_subject,expiration)
 ON CONFLICT(user_id) DO NOTHING;
 SELECT expires_at INTO expiration FROM app_private.development_preview_access WHERE user_id=p_subject;
 RETURN expiration;
END;$$;
REVOKE ALL ON FUNCTION app_private.approve_development_preview(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.approve_development_preview(uuid) TO dd_lifecycle_operator;

CREATE OR REPLACE FUNCTION app_private.current_account_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT app_private.request_subject() IS NOT NULL
 AND app_private.current_identity_confirmed()
 AND EXISTS(SELECT 1 FROM app_private.account_lifecycle WHERE user_id=app_private.request_subject() AND state='active')
 AND NOT EXISTS(SELECT 1 FROM app_private.account_deletion_tombstones WHERE former_subject_id=app_private.request_subject())
 AND (
  EXISTS(SELECT 1 FROM app_private.registration_receipts r
   JOIN app_private.registration_challenges c ON(c.id,c.user_id)=(r.challenge_id,r.user_id)
   WHERE r.user_id=app_private.request_subject() AND c.state='complete'
   AND app_private.current_verified_email_matches(c.email_address))
  OR EXISTS(SELECT 1 FROM app_private.development_preview_access WHERE user_id=app_private.request_subject()
    AND expires_at>statement_timestamp())
 );
$$;
ALTER FUNCTION app_private.current_account_active() OWNER TO dd_control_reader;
NOTIFY pgrst,'reload schema';
COMMIT;
