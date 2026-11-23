BEGIN;
ALTER TABLE app_private.wardrobe_images ADD COLUMN garment_id uuid;
ALTER TABLE app_private.wardrobe_images ADD CONSTRAINT wardrobe_gallery_owner_fk FOREIGN KEY(garment_id,owner_id) REFERENCES app_private.wardrobe_garments(id,owner_id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX wardrobe_gallery_order ON app_private.wardrobe_images(owner_id,garment_id,created_at,id) WHERE state='attached';
GRANT UPDATE(garment_id) ON app_private.wardrobe_images TO dd_user_executor;
UPDATE app_private.wardrobe_images i SET garment_id=g.id FROM app_private.wardrobe_garments g WHERE g.image_id=i.id AND g.owner_id=i.owner_id;
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
CREATE FUNCTION app_private.sync_wardrobe_gallery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  UPDATE app_private.wardrobe_images SET garment_id=NULL,state='cleanup_pending' WHERE garment_id=OLD.id AND owner_id=OLD.owner_id;
  RETURN OLD;
 END IF;
 UPDATE app_private.wardrobe_images SET garment_id=NEW.id WHERE id=NEW.image_id AND owner_id=NEW.owner_id;
 RETURN NEW;
END; $$;
ALTER FUNCTION app_private.sync_wardrobe_gallery() OWNER TO dd_user_executor;
REVOKE ALL ON FUNCTION app_private.sync_wardrobe_gallery() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER wardrobe_gallery_sync AFTER INSERT OR UPDATE OF image_id ON app_private.wardrobe_garments FOR EACH ROW EXECUTE FUNCTION app_private.sync_wardrobe_gallery();
CREATE TRIGGER wardrobe_gallery_retire BEFORE DELETE ON app_private.wardrobe_garments FOR EACH ROW EXECUTE FUNCTION app_private.sync_wardrobe_gallery();
CREATE FUNCTION app_private.wardrobe_gallery(p_garment_id uuid,p_operation text DEFAULT 'list',p_image_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE g app_private.wardrobe_garments%ROWTYPE; image_row app_private.wardrobe_images%ROWTYPE; result jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 SELECT * INTO g FROM app_private.wardrobe_garments WHERE id=p_garment_id AND owner_id=app_private.request_subject() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Garment not found' USING ERRCODE='P0002'; END IF;
 IF p_operation NOT IN ('list','attach','primary','remove','info') OR p_operation IS NULL THEN RAISE EXCEPTION 'Invalid gallery operation' USING ERRCODE='22023'; END IF;
 IF p_operation<>'list' THEN
  SELECT * INTO image_row FROM app_private.wardrobe_images WHERE id=p_image_id AND owner_id=g.owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Image not found' USING ERRCODE='P0002'; END IF;
  IF p_operation='attach' THEN
   IF image_row.garment_id=g.id AND image_row.state='attached' THEN NULL; -- Safe replay after a lost attach response.
   ELSIF image_row.state='pending' AND image_row.garment_id IS NULL THEN
    IF (SELECT count(*) FROM app_private.wardrobe_images WHERE garment_id=g.id AND owner_id=g.owner_id AND state='attached')>=8 THEN RAISE EXCEPTION 'At most eight photos' USING ERRCODE='22023'; END IF;
    IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='wardrobe-images' AND name=image_row.object_name AND owner_id::text=g.owner_id::text AND metadata->>'mimetype'='image/jpeg' AND (metadata->>'size')::bigint=image_row.byte_size) THEN RAISE EXCEPTION 'Image upload incomplete' USING ERRCODE='22023'; END IF;
    UPDATE app_private.wardrobe_images SET garment_id=g.id,state='attached' WHERE id=image_row.id AND owner_id=g.owner_id;
   ELSE RAISE EXCEPTION 'Image unavailable' USING ERRCODE='P0002'; END IF;
  ELSE
   IF image_row.garment_id IS DISTINCT FROM g.id OR image_row.state<>'attached' THEN RAISE EXCEPTION 'Image not found' USING ERRCODE='P0002'; END IF;
   IF p_operation='primary' THEN UPDATE app_private.wardrobe_garments SET image_id=image_row.id,updated_at=clock_timestamp() WHERE id=g.id AND owner_id=g.owner_id;
   ELSIF p_operation='remove' THEN
    IF g.image_id=image_row.id THEN RAISE EXCEPTION 'Choose another primary photo first' USING ERRCODE='DD001'; END IF;
    UPDATE app_private.wardrobe_images SET garment_id=NULL,state='cleanup_pending' WHERE id=image_row.id AND owner_id=g.owner_id;
   ELSIF p_operation='info' THEN RETURN jsonb_build_object('id',image_row.id,'object',image_row.object_name,'sha256',image_row.sha256,'byteSize',image_row.byte_size);
   END IF;
  END IF;
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'primary',i.id=(SELECT image_id FROM app_private.wardrobe_garments WHERE id=g.id),'createdAt',i.created_at) ORDER BY i.created_at,i.id),'[]'::jsonb) INTO result FROM app_private.wardrobe_images i WHERE i.garment_id=g.id AND i.owner_id=g.owner_id AND i.state='attached';
 RETURN result;
END; $$;
ALTER FUNCTION app_private.wardrobe_gallery(uuid,text,uuid) OWNER TO dd_user_executor;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
CREATE FUNCTION api.wardrobe_gallery(p_garment_id uuid,p_operation text DEFAULT 'list',p_image_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.wardrobe_gallery(p_garment_id,p_operation,p_image_id); $$;
REVOKE ALL ON FUNCTION app_private.wardrobe_gallery(uuid,text,uuid),api.wardrobe_gallery(uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.wardrobe_gallery(uuid,text,uuid),api.wardrobe_gallery(uuid,text,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
