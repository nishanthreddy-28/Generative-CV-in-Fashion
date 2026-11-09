-- DRAFT FOR APPROVAL. Outside supabase/migrations and never auto-applied.
-- Storage preparation only. No public API or registration activation grant.
-- Requires the reviewed application foundation, including dd_owner.
BEGIN;

CREATE TABLE app_private.registration_challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 email_binding_mac bytea NOT NULL CHECK (octet_length(email_binding_mac) = 32),
 session_binding_hash bytea CHECK (octet_length(session_binding_hash) = 32),
 link_hash bytea CHECK (octet_length(link_hash) = 32),
 otp_mac bytea CHECK (octet_length(otp_mac) = 32),
 state text NOT NULL DEFAULT 'pending'
  CHECK (state IN ('pending','finalizing','complete','expired','superseded','locked')),
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 link_verified_at timestamptz,
 otp_verified_at timestamptz,
 finalization_started_at timestamptz,
 auth_confirmed_at timestamptz,
 completed_at timestamptz,
 invalid_attempts integer NOT NULL DEFAULT 0 CHECK (invalid_attempts BETWEEN 0 AND 5),
 superseded_at timestamptz,
 UNIQUE (id,user_id),
 CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '10 minutes'),
 CHECK (state NOT IN ('pending','finalizing') OR
  (session_binding_hash IS NOT NULL AND link_hash IS NOT NULL AND otp_mac IS NOT NULL)),
 CHECK (link_verified_at IS NULL OR
  link_verified_at BETWEEN issued_at AND expires_at),
 CHECK (otp_verified_at IS NULL OR
  (link_verified_at IS NOT NULL AND otp_verified_at >= link_verified_at AND otp_verified_at <= expires_at)),
 CHECK (state NOT IN ('finalizing','complete') OR
  (otp_verified_at IS NOT NULL AND finalization_started_at IS NOT NULL
   AND finalization_started_at >= otp_verified_at)),
 CHECK ((state = 'complete') = (user_id IS NOT NULL)),
 CHECK (state <> 'complete' OR
  (auth_confirmed_at IS NOT NULL AND completed_at IS NOT NULL
   AND auth_confirmed_at >= otp_verified_at AND completed_at >= auth_confirmed_at)),
 CHECK ((state = 'superseded') = (superseded_at IS NOT NULL)),
 CHECK (superseded_at IS NULL OR superseded_at >= issued_at),
 CHECK (state <> 'locked' OR invalid_attempts = 5)
);

CREATE INDEX registration_expiry_scan
 ON app_private.registration_challenges(expires_at,id)
 WHERE state = 'pending';

CREATE TABLE app_private.registration_receipts (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 challenge_id uuid NOT NULL UNIQUE,
 method text NOT NULL CHECK (method = 'dual_email'),
 verified_at timestamptz NOT NULL,
 FOREIGN KEY (challenge_id,user_id)
  REFERENCES app_private.registration_challenges(id,user_id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
);

-- Trusted operational data keyed by HMAC, not a parallel customer identity.
-- The backend must atomically UPSERT/check these rows in proof/resend transactions.
CREATE TABLE app_private.registration_rate_windows (
 scope text NOT NULL CHECK (scope IN ('address','session','network')),
 key_mac bytea NOT NULL CHECK (octet_length(key_mac) = 32),
 window_started_at timestamptz NOT NULL,
 window_ends_at timestamptz NOT NULL,
 attempts integer NOT NULL CHECK (attempts >= 0),
 PRIMARY KEY (scope,key_mac,window_started_at),
 CHECK (window_ends_at > window_started_at)
);
CREATE INDEX registration_rate_expiry
 ON app_private.registration_rate_windows(window_ends_at);

ALTER TABLE app_private.registration_challenges OWNER TO dd_owner;
ALTER TABLE app_private.registration_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.registration_challenges FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.registration_challenges FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE app_private.registration_receipts OWNER TO dd_owner;
ALTER TABLE app_private.registration_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.registration_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.registration_receipts FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE app_private.registration_rate_windows OWNER TO dd_owner;
ALTER TABLE app_private.registration_rate_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.registration_rate_windows FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.registration_rate_windows FROM PUBLIC,anon,authenticated,service_role;

-- No permissive policies or executor grants until the trusted protocol is reviewed.
-- Forced RLS denies dd_owner access too. Auth users are not activated by these tables.
-- No change to auth.users, current_account_active(), or production configuration.
COMMIT;
