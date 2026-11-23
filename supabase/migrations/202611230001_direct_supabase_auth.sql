-- Direct Auth admission. Preserve historical link-and-code receipts and preview approvals.
BEGIN;

ALTER TABLE app_private.registration_receipts
 ALTER COLUMN challenge_id DROP NOT NULL,
 ADD COLUMN verified_email text,
 DROP CONSTRAINT registration_receipts_method_check,
 ADD CONSTRAINT registration_receipts_proof_check CHECK (
   (method = 'dual_email' AND challenge_id IS NOT NULL AND verified_email IS NULL)
   OR (method IN ('supabase_email','supabase_google','supabase_apple')
       AND challenge_id IS NULL AND verified_email IS NOT NULL
       AND length(verified_email) BETWEEN 3 AND 254
       AND verified_email = lower(verified_email) AND position('@' IN verified_email) > 1)
 );

-- The migration operator reads managed identities, as in the existing Auth
-- readers. The caller cannot supply a public RPC or write identity rows.
CREATE FUNCTION app_private.has_verified_oauth_identity(p_user uuid, p_email text, p_provider text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_provider IN ('google','apple') AND EXISTS (
   SELECT 1 FROM auth.identities
   WHERE user_id = p_user AND provider = p_provider
     AND lower(identity_data->>'email') = p_email
     AND identity_data->>'email_verified' = 'true'
 );
$$;
REVOKE ALL ON FUNCTION app_private.has_verified_oauth_identity(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.has_verified_oauth_identity(uuid,text,text) TO dd_registration_executor;

GRANT CREATE ON SCHEMA app_private TO dd_registration_executor;
CREATE FUNCTION app_private.activate_direct_auth_user()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE
 provider_name text := NEW.raw_app_meta_data->>'provider';
 verified_address text := lower(NEW.email);
 receipt_method text;
BEGIN
 -- Trusted Auth row values only. Custom user metadata is deliberately ignored.
 IF NEW.email_confirmed_at IS NULL OR NEW.deleted_at IS NOT NULL OR NEW.is_anonymous IS DISTINCT FROM false
    OR NEW.banned_until > statement_timestamp() OR verified_address IS NULL
    OR length(verified_address) NOT BETWEEN 3 AND 254 OR position('@' IN verified_address) <= 1
    OR NEW.raw_app_meta_data->>'dd_registration_attempt' IS NOT NULL THEN
  RETURN NEW;
 END IF;
 IF TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NOT NULL THEN RETURN NEW; END IF;

 IF provider_name = 'email' THEN
  -- Auth consumes a previously issued confirmation token in the same write
  -- that confirms the email. A fresh autoconfirmed signup has no pending proof.
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF OLD.confirmation_sent_at IS NULL OR nullif(OLD.confirmation_token, '') IS NULL
     OR nullif(NEW.confirmation_token, '') IS NOT NULL
     OR lower(OLD.email) IS DISTINCT FROM verified_address THEN
   RETURN NEW;
  END IF;
  receipt_method := 'supabase_email';
 ELSIF provider_name IN ('google','apple')
       AND app_private.has_verified_oauth_identity(NEW.id, verified_address, provider_name) THEN
  receipt_method := 'supabase_' || provider_name;
 ELSE
  RETURN NEW;
 END IF;

 IF EXISTS (SELECT 1 FROM app_private.account_deletion_tombstones WHERE former_subject_id=NEW.id) THEN
  RETURN NEW;
 END IF;
 -- Reuse the existing executor policy. Only pending accounts may transition.
 UPDATE app_private.account_lifecycle SET state='active',state_changed_at=statement_timestamp()
  WHERE user_id=NEW.id AND state='pending_verification';
 IF FOUND THEN
  INSERT INTO app_private.registration_receipts(user_id,method,verified_at,verified_email)
   VALUES(NEW.id,receipt_method,NEW.email_confirmed_at,verified_address);
 END IF;
 RETURN NEW;
END;
$$;
ALTER FUNCTION app_private.activate_direct_auth_user() OWNER TO dd_registration_executor;
REVOKE CREATE ON SCHEMA app_private FROM dd_registration_executor;
REVOKE ALL ON FUNCTION app_private.activate_direct_auth_user() FROM PUBLIC,anon,authenticated,service_role;
-- The prefix places this after drapedrop_provision and the legacy receipt trigger.
CREATE TRIGGER zz_direct_auth_activate AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
 FOR EACH ROW EXECUTE FUNCTION app_private.activate_direct_auth_user();

CREATE OR REPLACE FUNCTION app_private.current_account_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT app_private.request_subject() IS NOT NULL
 AND app_private.current_identity_confirmed()
 AND EXISTS(SELECT 1 FROM app_private.account_lifecycle WHERE user_id=app_private.request_subject() AND state='active')
 AND NOT EXISTS(SELECT 1 FROM app_private.account_deletion_tombstones WHERE former_subject_id=app_private.request_subject())
 AND (
  EXISTS(SELECT 1 FROM app_private.registration_receipts r
   LEFT JOIN app_private.registration_challenges c ON(c.id,c.user_id)=(r.challenge_id,r.user_id)
   WHERE r.user_id=app_private.request_subject() AND (
    (r.method='dual_email' AND c.state='complete' AND app_private.current_verified_email_matches(c.email_address))
    OR (r.method IN ('supabase_email','supabase_google','supabase_apple')
        AND app_private.current_verified_email_matches(r.verified_email))
   ))
  OR EXISTS(SELECT 1 FROM app_private.development_preview_access WHERE user_id=app_private.request_subject()
    AND expires_at>statement_timestamp())
 );
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
