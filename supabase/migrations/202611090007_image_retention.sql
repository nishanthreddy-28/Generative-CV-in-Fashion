-- Trusted, bounded reconciliation; metadata survives input-object expiration.
BEGIN;
-- Invoker API wrappers require private-schema lookup, not private table access.
GRANT USAGE ON SCHEMA app_private TO service_role;
GRANT CREATE ON SCHEMA app_private TO dd_control_executor;
DO $$DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['wardrobe_images','catalog_images','tryon_images'] LOOP
  EXECUTE format('GRANT SELECT,UPDATE(state) ON app_private.%I TO dd_control_executor',t);
  EXECUTE format('CREATE POLICY trusted_retention ON app_private.%I TO dd_control_executor USING(true) WITH CHECK(true)',t);
 END LOOP;
END;$$;
GRANT SELECT ON app_private.wardrobe_garments,app_private.catalog_garments,app_private.tryon_jobs TO dd_control_executor;
CREATE POLICY retention_references ON app_private.wardrobe_garments FOR SELECT TO dd_control_executor USING(true);
CREATE POLICY retention_references ON app_private.catalog_garments FOR SELECT TO dd_control_executor USING(true);
CREATE POLICY retention_jobs ON app_private.tryon_jobs TO dd_control_executor USING(true) WITH CHECK(true);
GRANT UPDATE(status,failure_code,finished_at,updated_at) ON app_private.tryon_jobs TO dd_control_executor;
CREATE POLICY retention_objects ON storage.objects FOR SELECT TO dd_control_executor
 USING(bucket_id IN ('wardrobe-images','catalog-images','tryon-inputs'));
CREATE INDEX wardrobe_retention ON app_private.wardrobe_images(state,created_at,id) WHERE state IN ('pending','cleanup_pending');
CREATE INDEX catalog_retention ON app_private.catalog_images(state,created_at,id) WHERE state IN ('pending','cleanup_pending');
CREATE INDEX tryon_input_expiry ON app_private.tryon_jobs(consent_at,id) WHERE status='queued';
CREATE INDEX tryon_retention ON app_private.tryon_images(state,created_at,id) WHERE state<>'removed';
CREATE FUNCTION app_private.image_cleanup_manifest(p_pending_hours integer DEFAULT 1,p_input_hours integer DEFAULT 24) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t text; result jsonb; selected_job app_private.tryon_jobs%ROWTYPE;
BEGIN
 IF p_pending_hours IS NULL OR p_pending_hours NOT BETWEEN 1 AND 168 OR p_input_hours IS NULL OR p_input_hours NOT BETWEEN 1 AND 168 THEN
  RAISE EXCEPTION 'Invalid retention window' USING ERRCODE='22023'; END IF;
 -- Lock job before image, matching cancellation. Active processing is never expired here.
 FOR selected_job IN SELECT * FROM app_private.tryon_jobs WHERE status='queued' AND consent_at<clock_timestamp()-make_interval(hours=>p_input_hours)
  ORDER BY consent_at,id LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
  UPDATE app_private.tryon_jobs SET status='failed',failure_code='INPUT_EXPIRED',finished_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=selected_job.id;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['wardrobe_images','catalog_images','tryon_images'] LOOP
  -- Locks serialize pending -> attached transitions with cleanup. No client can attach cleanup_pending.
  EXECUTE format('UPDATE app_private.%1$I SET state=''cleanup_pending'' WHERE id IN
   (SELECT id FROM app_private.%1$I WHERE state=''pending'' AND created_at<clock_timestamp()-make_interval(hours=>$1)
    ORDER BY created_at,id LIMIT 100 FOR UPDATE SKIP LOCKED)',t) USING p_pending_hours;
 END LOOP;
 UPDATE app_private.tryon_images i SET state='cleanup_pending' WHERE i.id IN (
  SELECT x.id FROM app_private.tryon_images x WHERE x.state='attached' AND x.purpose='input'
  AND EXISTS(SELECT 1 FROM app_private.tryon_jobs j WHERE j.input_image_id=x.id AND j.status IN ('completed','failed')
   AND (j.failure_code IN ('CANCELLED','INPUT_EXPIRED') OR j.consent_at<clock_timestamp()-make_interval(hours=>p_input_hours)))
  AND NOT EXISTS(SELECT 1 FROM app_private.tryon_jobs j WHERE (j.input_image_id=x.id OR j.output_image_id=x.id) AND j.status IN ('queued','processing'))
  ORDER BY x.created_at,x.id LIMIT 100 FOR UPDATE OF x SKIP LOCKED);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'bucket',bucket,'object',object_name)),'[]') INTO result FROM (
  SELECT * FROM (
   SELECT i.id,'wardrobe-images' AS bucket,i.object_name,i.created_at FROM app_private.wardrobe_images i WHERE state='cleanup_pending'
    AND NOT EXISTS(SELECT 1 FROM app_private.wardrobe_garments g WHERE g.image_id=i.id)
   UNION ALL SELECT i.id,'catalog-images',i.object_name,i.created_at FROM app_private.catalog_images i WHERE state='cleanup_pending'
    AND NOT EXISTS(SELECT 1 FROM app_private.catalog_garments g WHERE g.image_id=i.id)
   UNION ALL SELECT i.id,'tryon-inputs',i.object_name,i.created_at FROM app_private.tryon_images i WHERE state='cleanup_pending' AND purpose='input'
    AND NOT EXISTS(SELECT 1 FROM app_private.tryon_jobs j WHERE (j.input_image_id=i.id OR j.output_image_id=i.id) AND j.status IN ('queued','processing'))
  ) candidates ORDER BY created_at,id,bucket LIMIT 100
 ) bounded;
 RETURN result;
END;$$;
ALTER FUNCTION app_private.image_cleanup_manifest(integer,integer) OWNER TO dd_control_executor;
CREATE FUNCTION app_private.finish_image_cleanup(p_bucket text,p_id uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t text; path text; active_reference boolean;
BEGIN
 t:=CASE p_bucket WHEN 'wardrobe-images' THEN 'wardrobe_images' WHEN 'catalog-images' THEN 'catalog_images' WHEN 'tryon-inputs' THEN 'tryon_images' END;
 IF t IS NULL THEN RAISE EXCEPTION 'Invalid cleanup bucket' USING ERRCODE='22023'; END IF;
 EXECUTE format('SELECT object_name FROM app_private.%I WHERE id=$1 AND state=''cleanup_pending'' FOR UPDATE',t) INTO path USING p_id;
 IF path IS NULL THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=p_bucket AND name=path) THEN RETURN false; END IF;
 IF t='wardrobe_images' THEN SELECT EXISTS(SELECT 1 FROM app_private.wardrobe_garments WHERE image_id=p_id) INTO active_reference;
 ELSIF t='catalog_images' THEN SELECT EXISTS(SELECT 1 FROM app_private.catalog_garments WHERE image_id=p_id) INTO active_reference;
 ELSE SELECT EXISTS(SELECT 1 FROM app_private.tryon_jobs WHERE (input_image_id=p_id OR output_image_id=p_id) AND status IN ('queued','processing')) INTO active_reference; END IF;
 IF active_reference THEN RETURN false; END IF;
 EXECUTE format('UPDATE app_private.%I SET state=''removed'' WHERE id=$1',t) USING p_id;
 RETURN true;
END;$$;
ALTER FUNCTION app_private.finish_image_cleanup(text,uuid) OWNER TO dd_control_executor;
CREATE FUNCTION api.image_cleanup_manifest(p_pending_hours integer DEFAULT 1,p_input_hours integer DEFAULT 24) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.image_cleanup_manifest(p_pending_hours,p_input_hours); $$;
CREATE FUNCTION api.finish_image_cleanup(p_bucket text,p_id uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.finish_image_cleanup(p_bucket,p_id); $$;
DO $$DECLARE f regprocedure; BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('api','app_private') AND p.proname IN ('image_cleanup_manifest','finish_image_cleanup') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role,dd_lifecycle_operator',f);
 END LOOP;
END;$$;
REVOKE CREATE ON SCHEMA app_private FROM dd_control_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
