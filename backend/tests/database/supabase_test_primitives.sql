-- TEST DATABASE ONLY: minimal Supabase interface, not a production Auth/Storage implementation.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE storage.buckets (id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY, owner_id uuid NOT NULL,bucket_id text DEFAULT 'foundation-test',name text,metadata jsonb);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
-- A permissive owner rule is test-only: proves the migration's restrictive gate wins.
CREATE POLICY test_owner ON storage.objects TO authenticated
 USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

-- Exercise inherited project defaults: the migration must explicitly close these.
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
