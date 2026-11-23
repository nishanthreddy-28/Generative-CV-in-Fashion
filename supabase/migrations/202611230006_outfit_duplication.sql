BEGIN;
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
CREATE FUNCTION app_private.duplicate_outfit(p_id uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE original jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 PERFORM 1 FROM app_private.saved_outfits WHERE id=p_id AND owner_id=app_private.request_subject() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Outfit not found' USING ERRCODE='P0002'; END IF;
 original:=app_private.read_outfit(p_id);
 RETURN app_private.create_outfit(left(original->>'name',193)||' (copy)',
  (SELECT jsonb_agg(jsonb_build_object('source',item->>'source','garmentId',item->>'garmentId')) FROM jsonb_array_elements(original->'items') item),
  original->>'description',original->>'occasion');
END; $$;
ALTER FUNCTION app_private.duplicate_outfit(uuid) OWNER TO dd_user_executor;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
CREATE FUNCTION api.duplicate_outfit(p_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.duplicate_outfit(p_id); $$;
REVOKE ALL ON FUNCTION app_private.duplicate_outfit(uuid),api.duplicate_outfit(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.duplicate_outfit(uuid),api.duplicate_outfit(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
