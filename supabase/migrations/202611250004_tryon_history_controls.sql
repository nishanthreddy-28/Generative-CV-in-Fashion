-- User-owned try-on history deletion; hide before storage cleanup, with retryable tombstones.
BEGIN;
ALTER TABLE app_private.ml_session_results ADD COLUMN deleted_at timestamptz;
CREATE OR REPLACE FUNCTION app_private.read_ml_sessions(p_limit integer DEFAULT 20,p_conversation_id uuid DEFAULT NULL,p_bookmarked boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 IF p_limit NOT BETWEEN 1 AND 100 OR p_limit IS NULL THEN RAISE EXCEPTION 'Invalid limit' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC,x.id DESC),'[]'::jsonb) INTO result FROM (
  SELECT id,conversation_id AS "conversationId",kind,receipt,bookmarked,feedback,created_at
  FROM app_private.ml_session_results WHERE deleted_at IS NULL AND (p_conversation_id IS NULL OR conversation_id=p_conversation_id)
   AND (NOT p_bookmarked OR bookmarked) ORDER BY created_at DESC,id DESC LIMIT p_limit
 ) x;
 RETURN result;
END;$$;

CREATE OR REPLACE FUNCTION app_private.read_ml_session(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE value jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 SELECT jsonb_build_object('id',id,'conversationId',conversation_id,'kind',kind,'receipt',receipt,
  'bookmarked',bookmarked,'feedback',feedback,'created_at',created_at) INTO value
 FROM app_private.ml_session_results WHERE id=p_id AND deleted_at IS NULL;
 IF value IS NULL THEN RAISE EXCEPTION 'Result unavailable' USING ERRCODE='P0002'; END IF;
 RETURN value;
END;$$;

CREATE OR REPLACE FUNCTION app_private.update_ml_session(p_id uuid,p_bookmarked boolean DEFAULT NULL,p_feedback text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM app_private.require_active_account();
 IF p_feedback IS NOT NULL AND p_feedback NOT IN ('like','dislike','') THEN RAISE EXCEPTION 'Invalid feedback' USING ERRCODE='22023'; END IF;
 UPDATE app_private.ml_session_results SET bookmarked=coalesce(p_bookmarked,bookmarked),
  feedback=CASE WHEN p_feedback IS NULL THEN feedback ELSE nullif(p_feedback,'') END WHERE id=p_id AND deleted_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Result unavailable' USING ERRCODE='P0002'; END IF;
END;$$;

GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
CREATE FUNCTION app_private.delete_tryon_session(p_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM app_private.require_active_account();
 UPDATE app_private.ml_session_results SET deleted_at=coalesce(deleted_at,clock_timestamp())
 WHERE id=p_id AND kind='tryon';
 IF NOT FOUND THEN RAISE EXCEPTION 'Result unavailable' USING ERRCODE='P0002'; END IF;
END;$$;
ALTER FUNCTION app_private.delete_tryon_session(uuid) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.read_tryon_sessions(p_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid limit' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC,x.id DESC),'[]'::jsonb) INTO result FROM (
  SELECT id,conversation_id AS "conversationId",kind,receipt,bookmarked,feedback,created_at
  FROM app_private.ml_session_results WHERE kind='tryon' AND deleted_at IS NULL ORDER BY created_at DESC,id DESC LIMIT p_limit
 ) x;
 RETURN result;
END;$$;
ALTER FUNCTION app_private.read_tryon_sessions(integer) OWNER TO dd_user_executor;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
CREATE FUNCTION api.delete_tryon_session(p_id uuid) RETURNS void LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT app_private.delete_tryon_session(p_id);$$;
CREATE FUNCTION api.read_tryon_sessions(p_limit integer DEFAULT 20) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$SELECT app_private.read_tryon_sessions(p_limit);$$;
REVOKE ALL ON FUNCTION app_private.delete_tryon_session(uuid),app_private.read_tryon_sessions(integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.delete_tryon_session(uuid),app_private.read_tryon_sessions(integer) TO authenticated,dd_user_executor;
REVOKE ALL ON FUNCTION api.delete_tryon_session(uuid),api.read_tryon_sessions(integer) FROM PUBLIC,anon,authenticated,service_role,dd_user_executor;
GRANT EXECUTE ON FUNCTION api.delete_tryon_session(uuid),api.read_tryon_sessions(integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
