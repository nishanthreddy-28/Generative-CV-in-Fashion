-- Owner-scoped exact normalized-image warning. No hosted changes.
BEGIN;
CREATE INDEX wardrobe_image_owner_hash ON app_private.wardrobe_images(owner_id,sha256);
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
CREATE FUNCTION app_private.create_wardrobe_checked(p_changes jsonb,p_image_id uuid,p_allow_duplicate boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE subject uuid; digest text;
BEGIN
 PERFORM app_private.require_active_account();
 subject := app_private.request_subject();
 IF p_allow_duplicate IS NULL THEN RAISE EXCEPTION 'Invalid duplicate confirmation' USING ERRCODE='22023'; END IF;
 SELECT sha256 INTO digest FROM app_private.wardrobe_images WHERE id=p_image_id AND owner_id=subject;
 IF NOT FOUND THEN RAISE EXCEPTION 'Image not found' USING ERRCODE='P0002'; END IF;
 -- Serialize the warning check and insert for this user's matching uploads.
 PERFORM pg_advisory_xact_lock(hashtextextended(subject::text || digest,0));
 IF NOT p_allow_duplicate AND EXISTS (
  SELECT 1 FROM app_private.wardrobe_garments g JOIN app_private.wardrobe_images i
   ON i.id=g.image_id AND i.owner_id=g.owner_id
  WHERE g.owner_id=subject AND i.sha256=digest
 ) THEN RAISE EXCEPTION 'Matching wardrobe photo already exists' USING ERRCODE='DD001'; END IF;
 RETURN app_private.write_wardrobe(p_changes,NULL,p_image_id);
END; $$;
ALTER FUNCTION app_private.create_wardrobe_checked(jsonb,uuid,boolean) OWNER TO dd_user_executor;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
CREATE FUNCTION api.create_wardrobe_checked(p_changes jsonb,p_image_id uuid,p_allow_duplicate boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.create_wardrobe_checked(p_changes,p_image_id,p_allow_duplicate); $$;
REVOKE ALL ON FUNCTION app_private.create_wardrobe_checked(jsonb,uuid,boolean),api.create_wardrobe_checked(jsonb,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.create_wardrobe_checked(jsonb,uuid,boolean),api.create_wardrobe_checked(jsonb,uuid,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
