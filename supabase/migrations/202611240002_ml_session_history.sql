-- Session-bound inference history. No privileged/background execution.
BEGIN;
CREATE TABLE app_private.ml_session_results(
 id uuid PRIMARY KEY,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('stylist','tryon')),
 receipt text NOT NULL CHECK(length(receipt) BETWEEN 1 AND 131072),
 bookmarked boolean NOT NULL DEFAULT false,
 feedback text CHECK(feedback IN ('like','dislike')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,owner_id)
);
ALTER TABLE app_private.ml_session_results OWNER TO dd_owner;
ALTER TABLE app_private.ml_session_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.ml_session_results FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.ml_session_results FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON app_private.ml_session_results TO dd_user_executor;
CREATE POLICY ml_results_owner ON app_private.ml_session_results TO dd_user_executor
 USING(owner_id=(SELECT app_private.request_subject()) AND (SELECT app_private.current_account_active()))
 WITH CHECK(owner_id=(SELECT app_private.request_subject()) AND (SELECT app_private.current_account_active()));
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
CREATE FUNCTION app_private.save_ml_session(p_id uuid,p_conversation_id uuid,p_kind text,p_receipt text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM app_private.require_active_account();
 INSERT INTO app_private.ml_session_results(id,owner_id,conversation_id,kind,receipt)
 VALUES(p_id,app_private.request_subject(),p_conversation_id,p_kind,p_receipt);
 RETURN jsonb_build_object('id',p_id);
END;$$;
ALTER FUNCTION app_private.save_ml_session(uuid,uuid,text,text) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.read_ml_sessions(p_limit integer DEFAULT 20,p_conversation_id uuid DEFAULT NULL,p_bookmarked boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 IF p_limit NOT BETWEEN 1 AND 100 OR p_limit IS NULL THEN RAISE EXCEPTION 'Invalid limit' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC,x.id DESC),'[]'::jsonb) INTO result FROM (
  SELECT id,conversation_id AS "conversationId",kind,receipt,bookmarked,feedback,created_at
  FROM app_private.ml_session_results WHERE (p_conversation_id IS NULL OR conversation_id=p_conversation_id)
   AND (NOT p_bookmarked OR bookmarked) ORDER BY created_at DESC,id DESC LIMIT p_limit
 ) x;
 RETURN result;
END;$$;
ALTER FUNCTION app_private.read_ml_sessions(integer,uuid,boolean) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.update_ml_session(p_id uuid,p_bookmarked boolean DEFAULT NULL,p_feedback text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM app_private.require_active_account();
 IF p_feedback IS NOT NULL AND p_feedback NOT IN ('like','dislike','') THEN RAISE EXCEPTION 'Invalid feedback' USING ERRCODE='22023'; END IF;
 UPDATE app_private.ml_session_results SET bookmarked=coalesce(p_bookmarked,bookmarked),
  feedback=CASE WHEN p_feedback IS NULL THEN feedback ELSE nullif(p_feedback,'') END WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Result unavailable' USING ERRCODE='P0002'; END IF;
END;$$;
ALTER FUNCTION app_private.update_ml_session(uuid,boolean,text) OWNER TO dd_user_executor;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
CREATE FUNCTION api.save_ml_session(p_id uuid,p_conversation_id uuid,p_kind text,p_receipt text) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT app_private.save_ml_session(p_id,p_conversation_id,p_kind,p_receipt);$$;
CREATE FUNCTION api.read_ml_sessions(p_limit integer DEFAULT 20,p_conversation_id uuid DEFAULT NULL,p_bookmarked boolean DEFAULT false) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$SELECT app_private.read_ml_sessions(p_limit,p_conversation_id,p_bookmarked);$$;
CREATE FUNCTION api.update_ml_session(p_id uuid,p_bookmarked boolean DEFAULT NULL,p_feedback text DEFAULT NULL) RETURNS void
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT app_private.update_ml_session(p_id,p_bookmarked,p_feedback);$$;
REVOKE ALL ON FUNCTION app_private.save_ml_session(uuid,uuid,text,text),app_private.read_ml_sessions(integer,uuid,boolean),app_private.update_ml_session(uuid,boolean,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.save_ml_session(uuid,uuid,text,text),app_private.read_ml_sessions(integer,uuid,boolean),app_private.update_ml_session(uuid,boolean,text) TO authenticated,dd_user_executor;
REVOKE ALL ON FUNCTION api.save_ml_session(uuid,uuid,text,text),api.read_ml_sessions(integer,uuid,boolean),api.update_ml_session(uuid,boolean,text)
 FROM PUBLIC,anon,authenticated,service_role,dd_user_executor;
GRANT EXECUTE ON FUNCTION api.save_ml_session(uuid,uuid,text,text),api.read_ml_sessions(integer,uuid,boolean),api.update_ml_session(uuid,boolean,text) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('ml-session-images','ml-session-images',false,10485760,ARRAY['image/jpeg']) ON CONFLICT(id) DO NOTHING;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='ml-session-images' AND NOT public AND file_size_limit=10485760 AND allowed_mime_types=ARRAY['image/jpeg']) THEN
  RAISE EXCEPTION 'Existing ML image bucket requires review'; END IF;
END;$$;
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
CREATE FUNCTION app_private.read_ml_session(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE value jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 SELECT jsonb_build_object('id',id,'conversationId',conversation_id,'kind',kind,'receipt',receipt,
  'bookmarked',bookmarked,'feedback',feedback,'created_at',created_at) INTO value
 FROM app_private.ml_session_results WHERE id=p_id;
 IF value IS NULL THEN RAISE EXCEPTION 'Result unavailable' USING ERRCODE='P0002'; END IF;
 RETURN value;
END;$$;
ALTER FUNCTION app_private.read_ml_session(uuid) OWNER TO dd_user_executor;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
CREATE FUNCTION api.read_ml_session(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$SELECT app_private.read_ml_session(p_id);$$;
REVOKE ALL ON FUNCTION app_private.read_ml_session(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.read_ml_session(uuid) TO authenticated,dd_user_executor;
REVOKE ALL ON FUNCTION api.read_ml_session(uuid) FROM PUBLIC,anon,authenticated,service_role,dd_user_executor;
GRANT EXECUTE ON FUNCTION api.read_ml_session(uuid) TO authenticated;
CREATE POLICY ml_session_objects ON storage.objects FOR ALL TO authenticated
 USING(bucket_id='ml-session-images' AND owner_id::text=app_private.request_subject()::text
  AND split_part(name,'/',1)=app_private.request_subject()::text AND app_private.current_account_active())
 WITH CHECK(bucket_id='ml-session-images' AND owner_id::text=app_private.request_subject()::text
  AND split_part(name,'/',1)=app_private.request_subject()::text AND app_private.current_account_active()
  AND name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.jpg$');
CREATE POLICY ml_session_read_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id<>'ml-session-images' OR (owner_id::text=app_private.request_subject()::text
  AND split_part(name,'/',1)=app_private.request_subject()::text AND app_private.current_account_active()));
CREATE POLICY ml_session_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'ml-session-images' OR (owner_id::text=app_private.request_subject()::text
  AND split_part(name,'/',1)=app_private.request_subject()::text AND app_private.current_account_active()
  AND name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.jpg$'));
CREATE POLICY ml_session_delete_boundary ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id<>'ml-session-images' OR (owner_id::text=app_private.request_subject()::text
  AND split_part(name,'/',1)=app_private.request_subject()::text AND app_private.current_account_active()));
CREATE POLICY ml_session_no_overwrite ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id<>'ml-session-images') WITH CHECK(bucket_id<>'ml-session-images');
CREATE POLICY ml_session_deletion_objects ON storage.objects FOR SELECT TO dd_control_executor
 USING(bucket_id='ml-session-images' AND EXISTS(SELECT 1 FROM app_private.deletion_tasks t
  WHERE t.subject_id::text=split_part(name,'/',1) AND t.phase<>'complete'));
CREATE OR REPLACE FUNCTION app_private.deletion_manifest(p_subject uuid,p_lease uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM 1 FROM app_private.deletion_tasks WHERE subject_id=p_subject AND lease=p_lease AND lease_until>clock_timestamp() AND phase<>'complete' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid cleanup lease' USING ERRCODE='42501'; END IF;
 UPDATE app_private.deletion_tasks SET phase='storage',lease_until=clock_timestamp()+interval '5 minutes' WHERE subject_id=p_subject;
 UPDATE app_private.account_deletion_tombstones SET cleanup_stage='purging' WHERE former_subject_id=p_subject;
 SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'object',name)),'[]'::jsonb) INTO result FROM (
  SELECT bucket_id,name FROM storage.objects WHERE bucket_id IN ('wardrobe-images','tryon-inputs','onboarding-body-images','ml-session-images')
   AND split_part(name,'/',1)=p_subject::text ORDER BY bucket_id,name LIMIT 100
 ) objects;
 RETURN result;
END;$$;
CREATE OR REPLACE FUNCTION app_private.prepare_auth_deletion(p_subject uuid,p_lease uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM app_private.deletion_tasks WHERE subject_id=p_subject AND lease=p_lease AND lease_until>clock_timestamp() AND phase<>'complete' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid cleanup lease' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id IN ('wardrobe-images','tryon-inputs','onboarding-body-images','ml-session-images') AND split_part(name,'/',1)=p_subject::text) THEN RETURN false; END IF;
 DELETE FROM app_private.saved_outfits WHERE owner_id=p_subject;
 UPDATE app_private.deletion_tasks SET phase='auth',lease_until=clock_timestamp()+interval '5 minutes' WHERE subject_id=p_subject;
 RETURN true;
END;$$;
COMMIT;
