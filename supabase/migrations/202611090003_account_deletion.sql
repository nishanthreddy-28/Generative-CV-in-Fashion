-- Deny-first user deletion requests and a separate trusted cleanup worker protocol.
BEGIN;
CREATE TABLE app_private.deletion_tasks (
 subject_id uuid PRIMARY KEY,
 requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 phase text NOT NULL DEFAULT 'pending' CHECK(phase IN ('pending','storage','auth','complete')),
 lease uuid,
 lease_until timestamptz,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 last_error text CHECK(last_error IN ('DEPENDENCY_UNAVAILABLE','CLEANUP_FAILED')),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE app_private.deletion_tasks OWNER TO dd_owner;
ALTER TABLE app_private.deletion_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.deletion_tasks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.deletion_tasks FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON app_private.deletion_tasks TO dd_control_executor;
CREATE POLICY trusted_cleanup ON app_private.deletion_tasks TO dd_control_executor USING(true) WITH CHECK(true);
GRANT CREATE ON SCHEMA app_private TO dd_control_executor;
GRANT USAGE ON SCHEMA api TO service_role,dd_lifecycle_operator;
GRANT USAGE ON SCHEMA auth,storage TO dd_control_executor;
GRANT EXECUTE ON FUNCTION auth.uid() TO dd_control_executor;
GRANT SELECT ON storage.objects TO dd_control_executor;
CREATE POLICY deletion_manifest ON storage.objects FOR SELECT TO dd_control_executor
 USING(bucket_id IN ('wardrobe-images','tryon-inputs') AND EXISTS(SELECT 1 FROM app_private.deletion_tasks t WHERE t.subject_id::text=split_part(name,'/',1) AND t.phase<>'complete'));
GRANT SELECT,DELETE ON app_private.saved_outfits TO dd_control_executor;
CREATE POLICY deletion_outfits ON app_private.saved_outfits FOR SELECT TO dd_control_executor USING(EXISTS(SELECT 1 FROM app_private.deletion_tasks WHERE subject_id=owner_id));
CREATE POLICY deletion_outfits_delete ON app_private.saved_outfits FOR DELETE TO dd_control_executor USING(EXISTS(SELECT 1 FROM app_private.deletion_tasks WHERE subject_id=owner_id));

CREATE FUNCTION app_private.request_account_deletion(p_confirmation text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE subject uuid:=auth.uid();claims jsonb;entry jsonb;fresh boolean:=false;state text;
BEGIN
 IF subject IS NULL OR p_confirmation IS DISTINCT FROM 'DELETE' THEN RAISE EXCEPTION 'Confirmation required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(subject::text,0));
 SELECT l.state INTO state FROM app_private.account_lifecycle l WHERE l.user_id=subject FOR UPDATE;
 IF state='deleting' AND EXISTS(SELECT 1 FROM app_private.deletion_tasks WHERE subject_id=subject) THEN
  RETURN jsonb_build_object('status','deleting','message','Deletion request accepted; private data access is disabled.'); END IF;
 IF state IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Account access denied' USING ERRCODE='42501'; END IF;
 claims:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
 IF jsonb_typeof(claims->'amr')='array' THEN
  FOR entry IN SELECT value FROM jsonb_array_elements(claims->'amr') LOOP
   IF entry->>'method' IN ('password','oauth') AND jsonb_typeof(entry->'timestamp')='number' THEN
    IF (entry->>'timestamp')::numeric BETWEEN extract(epoch FROM clock_timestamp())-300 AND extract(epoch FROM clock_timestamp())+15 THEN fresh:=true; END IF;
   END IF;
  END LOOP;
 END IF;
 IF NOT fresh THEN RAISE EXCEPTION 'Recent sign-in required' USING ERRCODE='DD002'; END IF;
 PERFORM app_private.begin_account_deletion(subject);
 INSERT INTO app_private.deletion_tasks(subject_id) VALUES(subject) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('status','deleting','message','Deletion request accepted; private data access is disabled.');
END; $$;
ALTER FUNCTION app_private.request_account_deletion(text) OWNER TO dd_control_executor;

CREATE FUNCTION app_private.account_deletion_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE task app_private.deletion_tasks%ROWTYPE;
BEGIN
 SELECT * INTO task FROM app_private.deletion_tasks WHERE subject_id=auth.uid();
 IF NOT FOUND THEN RETURN jsonb_build_object('status','not_requested','retryable',false); END IF;
 RETURN jsonb_build_object('status',CASE WHEN task.phase='complete' THEN 'complete' ELSE 'deleting' END,
  'retryable',task.last_error IS NOT NULL,'message',CASE WHEN task.phase='complete' THEN 'Account and private data deletion completed.' ELSE 'Private data access is disabled. Cleanup is queued or in progress.' END);
END; $$;
ALTER FUNCTION app_private.account_deletion_status() OWNER TO dd_control_executor;

CREATE FUNCTION app_private.claim_deletion() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE task app_private.deletion_tasks%ROWTYPE;token uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO task FROM app_private.deletion_tasks WHERE phase<>'complete' AND (lease_until IS NULL OR lease_until<clock_timestamp())
 ORDER BY requested_at,subject_id FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE app_private.deletion_tasks SET lease=token,lease_until=clock_timestamp()+interval '5 minutes',attempts=attempts+1,updated_at=clock_timestamp() WHERE subject_id=task.subject_id;
 RETURN jsonb_build_object('subject',task.subject_id,'lease',token,'phase',task.phase);
END; $$;
ALTER FUNCTION app_private.claim_deletion() OWNER TO dd_control_executor;
CREATE FUNCTION app_private.deletion_manifest(p_subject uuid,p_lease uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM 1 FROM app_private.deletion_tasks WHERE subject_id=p_subject AND lease=p_lease AND lease_until>clock_timestamp() AND phase<>'complete' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid cleanup lease' USING ERRCODE='42501'; END IF;
 UPDATE app_private.deletion_tasks SET phase='storage',lease_until=clock_timestamp()+interval '5 minutes' WHERE subject_id=p_subject;
 UPDATE app_private.account_deletion_tombstones SET cleanup_stage='purging' WHERE former_subject_id=p_subject;
 SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'object',name)),'[]'::jsonb) INTO result FROM (
  SELECT bucket_id,name FROM storage.objects WHERE bucket_id IN ('wardrobe-images','tryon-inputs') AND split_part(name,'/',1)=p_subject::text ORDER BY bucket_id,name LIMIT 100
 ) objects;
 RETURN result;
END; $$;
ALTER FUNCTION app_private.deletion_manifest(uuid,uuid) OWNER TO dd_control_executor;
CREATE FUNCTION app_private.prepare_auth_deletion(p_subject uuid,p_lease uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM app_private.deletion_tasks WHERE subject_id=p_subject AND lease=p_lease AND lease_until>clock_timestamp() AND phase<>'complete' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid cleanup lease' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id IN ('wardrobe-images','tryon-inputs') AND split_part(name,'/',1)=p_subject::text) THEN RETURN false; END IF;
 -- Remove owned outfit references before Auth cascades wardrobe/image/job records.
 DELETE FROM app_private.saved_outfits WHERE owner_id=p_subject;
 UPDATE app_private.deletion_tasks SET phase='auth',lease_until=clock_timestamp()+interval '5 minutes' WHERE subject_id=p_subject;
 RETURN true;
END; $$;
ALTER FUNCTION app_private.prepare_auth_deletion(uuid,uuid) OWNER TO dd_control_executor;
CREATE FUNCTION app_private.finish_deletion(p_subject uuid,p_lease uuid,p_success boolean) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM app_private.deletion_tasks WHERE subject_id=p_subject AND lease=p_lease AND lease_until>clock_timestamp() AND phase<>'complete' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid cleanup lease' USING ERRCODE='42501'; END IF;
 IF p_success THEN
  IF EXISTS(SELECT 1 FROM auth.users WHERE id=p_subject) OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id IN ('wardrobe-images','tryon-inputs') AND split_part(name,'/',1)=p_subject::text) THEN
   RAISE EXCEPTION 'Cleanup incomplete' USING ERRCODE='22023'; END IF;
  UPDATE app_private.account_deletion_tombstones SET cleanup_stage='complete',auth_deleted_at=clock_timestamp(),cleanup_completed_at=clock_timestamp() WHERE former_subject_id=p_subject;
  UPDATE app_private.deletion_tasks SET phase='complete',last_error=NULL,lease=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE subject_id=p_subject;
 ELSE
  UPDATE app_private.deletion_tasks SET last_error='CLEANUP_FAILED',lease=NULL,lease_until=clock_timestamp()+interval '1 minute',updated_at=clock_timestamp() WHERE subject_id=p_subject;
 END IF;
END; $$;
ALTER FUNCTION app_private.finish_deletion(uuid,uuid,boolean) OWNER TO dd_control_executor;
GRANT SELECT ON auth.users TO dd_control_executor;
-- Defer both new input and existing wardrobe source constraints during Auth cascade deletion.
ALTER TABLE app_private.tryon_jobs DROP CONSTRAINT tryon_jobs_input_image_id_owner_id_fkey;
ALTER TABLE app_private.tryon_jobs ADD CONSTRAINT tryon_jobs_input_image_id_owner_id_fkey FOREIGN KEY(input_image_id,owner_id) REFERENCES app_private.tryon_images(id,owner_id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION api.request_account_deletion(p_confirmation text) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.request_account_deletion(p_confirmation); $$;
REVOKE ALL ON FUNCTION api.request_account_deletion(text),app_private.request_account_deletion(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.request_account_deletion(text),app_private.request_account_deletion(text) TO authenticated;

CREATE FUNCTION api.account_deletion_status() RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.account_deletion_status(); $$;
REVOKE ALL ON FUNCTION api.account_deletion_status(),app_private.account_deletion_status() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.account_deletion_status(),app_private.account_deletion_status() TO authenticated;

CREATE FUNCTION api.claim_deletion() RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.claim_deletion(); $$;
REVOKE ALL ON FUNCTION api.claim_deletion(),app_private.claim_deletion() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.claim_deletion(),app_private.claim_deletion() TO service_role,dd_lifecycle_operator;

CREATE FUNCTION api.deletion_manifest(p_subject uuid,p_lease uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.deletion_manifest(p_subject,p_lease); $$;
REVOKE ALL ON FUNCTION api.deletion_manifest(uuid,uuid),app_private.deletion_manifest(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.deletion_manifest(uuid,uuid),app_private.deletion_manifest(uuid,uuid) TO service_role,dd_lifecycle_operator;

CREATE FUNCTION api.prepare_auth_deletion(p_subject uuid,p_lease uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.prepare_auth_deletion(p_subject,p_lease); $$;
REVOKE ALL ON FUNCTION api.prepare_auth_deletion(uuid,uuid),app_private.prepare_auth_deletion(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.prepare_auth_deletion(uuid,uuid),app_private.prepare_auth_deletion(uuid,uuid) TO service_role,dd_lifecycle_operator;

CREATE FUNCTION api.finish_deletion(p_subject uuid,p_lease uuid,p_success boolean) RETURNS void LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.finish_deletion(p_subject,p_lease,p_success); $$;
REVOKE ALL ON FUNCTION api.finish_deletion(uuid,uuid,boolean),app_private.finish_deletion(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.finish_deletion(uuid,uuid,boolean),app_private.finish_deletion(uuid,uuid,boolean) TO service_role,dd_lifecycle_operator;
REVOKE CREATE ON SCHEMA app_private FROM dd_control_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
