-- Private, versioned onboarding. Reviewing a version does not promote a body profile.
BEGIN;

CREATE TABLE app_private.body_profile_versions (
 id uuid PRIMARY KEY,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 object_name text GENERATED ALWAYS AS (owner_id::text || '/' || id::text || '.jpg') STORED UNIQUE,
 sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 10485760),
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','ready','reviewed','cleanup_pending','removed')),
 confirmed_values jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 reviewed_at timestamptz,
 CHECK ((state IN ('reviewed','cleanup_pending','removed') AND confirmed_values IS NOT NULL AND reviewed_at IS NOT NULL)
     OR (state IN ('pending','ready','cleanup_pending','removed') AND confirmed_values IS NULL AND reviewed_at IS NULL))
);
ALTER TABLE app_private.body_profile_versions OWNER TO dd_owner;
ALTER TABLE app_private.body_profile_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.body_profile_versions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.body_profile_versions FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA storage TO dd_user_executor;
GRANT SELECT ON storage.buckets,storage.objects TO dd_user_executor;
GRANT SELECT, INSERT (id,owner_id,sha256,byte_size), UPDATE (state,confirmed_values,reviewed_at)
 ON app_private.body_profile_versions TO dd_user_executor;
GRANT SELECT, UPDATE (state) ON app_private.body_profile_versions TO dd_control_executor;
CREATE POLICY body_version_owner ON app_private.body_profile_versions TO dd_user_executor
 USING (owner_id=(SELECT app_private.request_subject()) AND (SELECT app_private.current_account_active()))
 WITH CHECK (owner_id=(SELECT app_private.request_subject()) AND (SELECT app_private.current_account_active()));
CREATE POLICY body_version_retention ON app_private.body_profile_versions TO dd_control_executor
 USING (state IN ('pending','cleanup_pending','removed')) WITH CHECK (state IN ('cleanup_pending','removed'));
CREATE UNIQUE INDEX body_version_single_draft ON app_private.body_profile_versions(owner_id) WHERE state IN ('pending','ready');
CREATE INDEX body_version_latest ON app_private.body_profile_versions(owner_id,reviewed_at DESC,id) WHERE state='reviewed';
CREATE INDEX body_version_retention_idx ON app_private.body_profile_versions(state,created_at,id) WHERE state IN ('pending','cleanup_pending');
ALTER TABLE app_private.body_profiles ADD COLUMN image_version_id uuid;
ALTER TABLE app_private.body_profiles ADD CONSTRAINT body_profile_image_version_fk
 FOREIGN KEY(image_version_id) REFERENCES app_private.body_profile_versions(id) ON DELETE SET NULL;
GRANT UPDATE (image_version_id) ON app_private.body_profiles TO dd_user_executor;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES ('onboarding-body-images','onboarding-body-images',false,10485760,ARRAY['image/jpeg'])
 ON CONFLICT (id) DO NOTHING;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='onboarding-body-images' AND NOT public
                 AND file_size_limit=10485760 AND allowed_mime_types=ARRAY['image/jpeg']) THEN
  RAISE EXCEPTION 'Existing onboarding bucket requires review';
 END IF;
END;
$$;
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
CREATE FUNCTION app_private.onboarding_storage_allowed(p_name text,p_upload boolean) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE image_state text;
BEGIN
 IF NOT app_private.current_account_active() THEN RETURN false; END IF;
 IF p_upload THEN
  PERFORM app_private.require_active_account();
  SELECT state INTO image_state FROM app_private.body_profile_versions WHERE object_name=p_name FOR SHARE;
  RETURN coalesce(image_state='pending',false);
 END IF;
 SELECT state INTO image_state FROM app_private.body_profile_versions WHERE object_name=p_name;
 RETURN coalesce(image_state IN ('pending','ready','reviewed'),false);
END;
$$;
ALTER FUNCTION app_private.onboarding_storage_allowed(text,boolean) OWNER TO dd_user_executor;
REVOKE ALL ON FUNCTION app_private.onboarding_storage_allowed(text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.onboarding_storage_allowed(text,boolean) TO authenticated,dd_user_executor;

CREATE POLICY onboarding_objects_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
 bucket_id='onboarding-body-images' AND owner_id::text=app_private.request_subject()::text
 AND app_private.onboarding_storage_allowed(name,true));
CREATE POLICY onboarding_objects_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
 bucket_id<>'onboarding-body-images' OR (owner_id::text=app_private.request_subject()::text AND app_private.onboarding_storage_allowed(name,true)));
CREATE POLICY onboarding_objects_read ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id='onboarding-body-images' AND owner_id::text=app_private.request_subject()::text
 AND app_private.onboarding_storage_allowed(name,false));
CREATE POLICY onboarding_objects_internal_read ON storage.objects FOR SELECT TO dd_user_executor USING (
 bucket_id='onboarding-body-images' AND owner_id::text=app_private.request_subject()::text
 AND app_private.onboarding_storage_allowed(name,false));
CREATE POLICY onboarding_objects_read_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING (
 bucket_id<>'onboarding-body-images' OR (owner_id::text=app_private.request_subject()::text AND app_private.onboarding_storage_allowed(name,false)));
CREATE POLICY onboarding_objects_immutable ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (bucket_id<>'onboarding-body-images') WITH CHECK (bucket_id<>'onboarding-body-images');
CREATE POLICY onboarding_objects_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING (bucket_id<>'onboarding-body-images');
CREATE POLICY onboarding_objects_worker ON storage.objects FOR SELECT TO dd_control_executor
 USING (bucket_id='onboarding-body-images');

CREATE FUNCTION app_private.onboarding_record(p_row app_private.body_profile_versions) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',p_row.id,'state',p_row.state,'createdAt',p_row.created_at,
  'reviewedAt',p_row.reviewed_at,'confirmedValues',p_row.confirmed_values)
$$;
REVOKE ALL ON FUNCTION app_private.onboarding_record(app_private.body_profile_versions) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.onboarding_record(app_private.body_profile_versions) TO dd_user_executor;

CREATE FUNCTION app_private.onboarding_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT app_private.current_account_active() THEN RAISE EXCEPTION 'Account access denied' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
  'processingAvailable',false,
  'draft',(SELECT app_private.onboarding_record(v) FROM app_private.body_profile_versions v WHERE state IN ('pending','ready')),
  'reviewed',(SELECT app_private.onboarding_record(v) FROM app_private.body_profile_versions v
            WHERE state='reviewed' ORDER BY reviewed_at DESC,id DESC LIMIT 1));
END;
$$;
ALTER FUNCTION app_private.onboarding_status() OWNER TO dd_user_executor;

CREATE FUNCTION app_private.onboarding_image(p_id uuid,p_sha256 text DEFAULT NULL,p_byte_size integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v app_private.body_profile_versions%ROWTYPE; present boolean;
BEGIN
 PERFORM app_private.require_active_account();
 IF p_sha256 IS NOT NULL AND p_byte_size IS NOT NULL THEN
  INSERT INTO app_private.body_profile_versions(id,owner_id,sha256,byte_size)
   VALUES (p_id,app_private.request_subject(),p_sha256,p_byte_size) ON CONFLICT DO NOTHING;
 END IF;
 SELECT * INTO v FROM app_private.body_profile_versions WHERE id=p_id AND state IN ('pending','ready','reviewed') FOR SHARE;
 IF NOT FOUND THEN
  IF EXISTS (SELECT 1 FROM app_private.body_profile_versions WHERE state IN ('pending','ready')) AND p_sha256 IS NOT NULL THEN
   RAISE EXCEPTION 'A photo draft already exists' USING ERRCODE='DD001';
  END IF;
  RAISE EXCEPTION 'Body photo not found' USING ERRCODE='P0002';
 END IF;
 IF p_sha256 IS NOT NULL AND (v.sha256 IS DISTINCT FROM p_sha256 OR v.byte_size IS DISTINCT FROM p_byte_size) THEN
  RAISE EXCEPTION 'This draft belongs to another photo' USING ERRCODE='DD001';
 END IF;
 IF p_sha256 IS NULL AND v.state='pending' THEN
  RAISE EXCEPTION 'Body photo not ready' USING ERRCODE='P0002';
 END IF;
 present := EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='onboarding-body-images'
  AND name=v.object_name AND owner_id::text=v.owner_id::text
  AND metadata->>'size'=v.byte_size::text AND metadata->>'mimetype'='image/jpeg');
 RETURN jsonb_build_object('id',v.id,'object',v.object_name,'sha256',v.sha256,'byteSize',v.byte_size,
  'present',present,'version',app_private.onboarding_record(v));
END;
$$;
ALTER FUNCTION app_private.onboarding_image(uuid,text,integer) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.finish_onboarding_upload(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v app_private.body_profile_versions%ROWTYPE;
BEGIN
 PERFORM app_private.require_active_account();
 SELECT * INTO v FROM app_private.body_profile_versions WHERE id=p_id AND state IN ('pending','ready','reviewed') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Body photo not found' USING ERRCODE='P0002'; END IF;
 IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='onboarding-body-images'
  AND name=v.object_name AND owner_id::text=v.owner_id::text
  AND metadata->>'size'=v.byte_size::text AND metadata->>'mimetype'='image/jpeg') THEN
  RAISE EXCEPTION 'Body photo upload is incomplete' USING ERRCODE='DD001';
 END IF;
 IF v.state='pending' THEN
  UPDATE app_private.body_profile_versions SET state='ready' WHERE id=p_id RETURNING * INTO v;
 END IF;
 RETURN app_private.onboarding_record(v);
END;
$$;
ALTER FUNCTION app_private.finish_onboarding_upload(uuid) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.review_onboarding(p_id uuid,p_values jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v app_private.body_profile_versions%ROWTYPE; previous app_private.body_profiles%ROWTYPE;
 field text; json_value jsonb; measure numeric;
BEGIN
 PERFORM app_private.require_active_account();
 SELECT * INTO v FROM app_private.body_profile_versions WHERE id=p_id AND state IN ('pending','ready','reviewed') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Body photo not found' USING ERRCODE='P0002'; END IF;
 IF v.state='reviewed' AND v.confirmed_values=p_values THEN RETURN app_private.onboarding_record(v); END IF;
 IF v.state<>'ready' THEN RAISE EXCEPTION 'Body photo cannot be reviewed' USING ERRCODE='DD001'; END IF;
 IF jsonb_typeof(p_values) IS DISTINCT FROM 'object'
 OR jsonb_typeof(p_values->'name') IS DISTINCT FROM 'string'
 OR length(btrim(p_values->>'name')) NOT BETWEEN 1 AND 200
 OR coalesce(p_values->>'units','') NOT IN ('cm','in') THEN
  RAISE EXCEPTION 'Invalid onboarding details' USING ERRCODE='22023';
 END IF;
 FOR field,json_value IN SELECT entry.key,entry.value FROM jsonb_each(p_values) AS entry(key,value) LOOP
  IF field IN ('height','chest','waist','hips','inseam') THEN
   IF json_value='null'::jsonb THEN CONTINUE; END IF;
   IF jsonb_typeof(json_value)<>'number' THEN RAISE EXCEPTION 'Invalid measurement' USING ERRCODE='22023'; END IF;
   measure := (json_value #>> '{}')::numeric;
   IF measure NOT BETWEEN 1 AND 300 OR measure<>trunc(measure,4) THEN
    RAISE EXCEPTION 'Invalid measurement' USING ERRCODE='22023';
   END IF;
  ELSIF field NOT IN ('name','location','units') OR jsonb_typeof(json_value)<>'string' OR length(json_value #>> '{}')>200 THEN
   RAISE EXCEPTION 'Invalid onboarding details' USING ERRCODE='22023';
  END IF;
 END LOOP;
 IF (p_values ? 'location' AND char_length(p_values->>'location')>200) THEN
  RAISE EXCEPTION 'Invalid location' USING ERRCODE='22023';
 END IF;
 SELECT * INTO previous FROM app_private.body_profiles WHERE user_id=app_private.request_subject() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Body profile bootstrap incomplete' USING ERRCODE='55000'; END IF;
 IF previous.units IS DISTINCT FROM p_values->>'units' AND (
   (previous.height IS NOT NULL AND NOT (p_values ? 'height')) OR
   (previous.chest IS NOT NULL AND NOT (p_values ? 'chest')) OR
   (previous.waist IS NOT NULL AND NOT (p_values ? 'waist')) OR
   (previous.hips IS NOT NULL AND NOT (p_values ? 'hips')) OR
   (previous.inseam IS NOT NULL AND NOT (p_values ? 'inseam'))) THEN
  RAISE EXCEPTION 'Unit changes must explicitly replace or clear existing measurements' USING ERRCODE='22023';
 END IF;
 -- Persist the user's confirmed values to the application profile tables in the
 -- same transaction as the version review. The image remains a versioned private
 -- object; no generated measurements are asserted while MediaPipe is absent.
 UPDATE app_private.user_profiles SET name=btrim(p_values->>'name'),
  location=nullif(btrim(p_values->>'location'),''),updated_at=clock_timestamp()
  WHERE user_id=app_private.request_subject();
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile bootstrap incomplete' USING ERRCODE='55000'; END IF;
 UPDATE app_private.body_profiles SET
  units=p_values->>'units',
  height=CASE WHEN p_values ? 'height' THEN (p_values->>'height')::numeric ELSE height END,
  chest=CASE WHEN p_values ? 'chest' THEN (p_values->>'chest')::numeric ELSE chest END,
  waist=CASE WHEN p_values ? 'waist' THEN (p_values->>'waist')::numeric ELSE waist END,
  hips=CASE WHEN p_values ? 'hips' THEN (p_values->>'hips')::numeric ELSE hips END,
  inseam=CASE WHEN p_values ? 'inseam' THEN (p_values->>'inseam')::numeric ELSE inseam END,
  image_version_id=p_id,updated_at=clock_timestamp()
  WHERE user_id=app_private.request_subject();
 IF NOT FOUND THEN RAISE EXCEPTION 'Body profile bootstrap incomplete' USING ERRCODE='55000'; END IF;
 -- Retire the formerly active reviewed version only after the current pointer
 -- moves; the image worker can remove it without deleting its minimal review evidence.
 UPDATE app_private.body_profile_versions SET state='cleanup_pending'
  WHERE id=previous.image_version_id AND id<>p_id AND state='reviewed';
 UPDATE app_private.body_profile_versions SET state='reviewed',confirmed_values=p_values,reviewed_at=clock_timestamp()
  WHERE id=p_id RETURNING * INTO v;
 RETURN app_private.onboarding_record(v);
END;
$$;
ALTER FUNCTION app_private.review_onboarding(uuid,jsonb) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.discard_onboarding(p_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM app_private.require_active_account();
 UPDATE app_private.body_profile_versions SET state='cleanup_pending' WHERE id=p_id AND state IN ('pending','ready');
 IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM app_private.body_profile_versions
   WHERE id=p_id AND state IN ('cleanup_pending','removed')) THEN
  RAISE EXCEPTION 'Body photo draft not found' USING ERRCODE='P0002';
 END IF;
END;
$$;
ALTER FUNCTION app_private.discard_onboarding(uuid) OWNER TO dd_user_executor;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;

CREATE FUNCTION api.onboarding_status() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.onboarding_status();
$$;
CREATE FUNCTION api.onboarding_image(p_id uuid,p_sha256 text DEFAULT NULL,p_byte_size integer DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.onboarding_image(p_id,p_sha256,p_byte_size);
$$;
CREATE FUNCTION api.finish_onboarding_upload(p_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.finish_onboarding_upload(p_id);
$$;
CREATE FUNCTION api.review_onboarding(p_id uuid,p_values jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.review_onboarding(p_id,p_values);
$$;
CREATE FUNCTION api.discard_onboarding(p_id uuid) RETURNS void LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.discard_onboarding(p_id);
$$;
DO $$
DECLARE f regprocedure;
BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='app_private' AND p.proname IN
   ('onboarding_status','onboarding_image','finish_onboarding_upload','review_onboarding','discard_onboarding') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated,dd_user_executor',f);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='api' AND p.proname IN
   ('onboarding_status','onboarding_image','finish_onboarding_upload','review_onboarding','discard_onboarding') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,service_role,dd_user_executor',f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f);
 END LOOP;
END;
$$;

-- Only the trusted image reconciler can clean abandoned uploads. Reviewed image
-- versions stay private and retrievable by their owner until replacement or deletion.
GRANT CREATE ON SCHEMA app_private TO dd_control_executor;
GRANT SELECT,UPDATE(state) ON app_private.body_profile_versions TO dd_control_executor;
CREATE POLICY onboarding_version_retention ON app_private.body_profile_versions TO dd_control_executor
 USING(state IN ('pending','cleanup_pending','removed')) WITH CHECK(state IN ('cleanup_pending','removed'));
GRANT USAGE ON SCHEMA storage TO dd_control_executor;
GRANT SELECT ON storage.objects TO dd_control_executor;
CREATE OR REPLACE FUNCTION app_private.image_cleanup_manifest(p_pending_hours integer DEFAULT 1,p_input_hours integer DEFAULT 24) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t text; result jsonb; selected_job app_private.tryon_jobs%ROWTYPE;
BEGIN
 IF p_pending_hours IS NULL OR p_pending_hours NOT BETWEEN 1 AND 168 OR p_input_hours IS NULL OR p_input_hours NOT BETWEEN 1 AND 168 THEN
  RAISE EXCEPTION 'Invalid retention window' USING ERRCODE='22023'; END IF;
 FOR selected_job IN SELECT * FROM app_private.tryon_jobs WHERE status='queued' AND consent_at<clock_timestamp()-make_interval(hours=>p_input_hours)
  ORDER BY consent_at,id LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
  UPDATE app_private.tryon_jobs SET status='failed',failure_code='INPUT_EXPIRED',finished_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=selected_job.id;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['wardrobe_images','catalog_images','tryon_images'] LOOP
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
 UPDATE app_private.body_profile_versions SET state='cleanup_pending'
  WHERE state='pending' AND created_at<clock_timestamp()-make_interval(hours=>p_pending_hours);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'bucket',bucket,'object',object_name)),'[]'::jsonb) INTO result FROM (
  SELECT id,bucket,object_name,created_at FROM (
   SELECT i.id,'wardrobe-images'::text bucket,i.object_name,i.created_at FROM app_private.wardrobe_images i WHERE i.state='cleanup_pending'
    AND NOT EXISTS(SELECT 1 FROM app_private.wardrobe_garments g WHERE g.image_id=i.id)
   UNION ALL SELECT i.id,'catalog-images',i.object_name,i.created_at FROM app_private.catalog_images i WHERE i.state='cleanup_pending'
    AND NOT EXISTS(SELECT 1 FROM app_private.catalog_garments g WHERE g.image_id=i.id)
   UNION ALL SELECT i.id,'tryon-inputs',i.object_name,i.created_at FROM app_private.tryon_images i WHERE i.state='cleanup_pending' AND i.purpose='input'
    AND NOT EXISTS(SELECT 1 FROM app_private.tryon_jobs j WHERE (j.input_image_id=i.id OR j.output_image_id=i.id) AND j.status IN ('queued','processing'))
   UNION ALL SELECT i.id,'onboarding-body-images',i.object_name,i.created_at FROM app_private.body_profile_versions i WHERE i.state='cleanup_pending'
    AND NOT EXISTS(SELECT 1 FROM app_private.body_profiles p WHERE p.image_version_id=i.id)
  ) candidates ORDER BY created_at,id,bucket LIMIT 100
 ) bounded;
 RETURN result;
END;$$;
ALTER FUNCTION app_private.image_cleanup_manifest(integer,integer) OWNER TO dd_control_executor;
CREATE OR REPLACE FUNCTION app_private.finish_image_cleanup(p_bucket text,p_id uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t text; path text; active_reference boolean;
BEGIN
 IF p_bucket='onboarding-body-images' THEN
  SELECT object_name INTO path FROM app_private.body_profile_versions WHERE id=p_id AND state='cleanup_pending' FOR UPDATE;
  IF path IS NULL OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=p_bucket AND name=path)
   OR EXISTS(SELECT 1 FROM app_private.body_profiles WHERE image_version_id=p_id) THEN RETURN false; END IF;
  UPDATE app_private.body_profile_versions SET state='removed' WHERE id=p_id;
  RETURN true;
 END IF;
 t:=CASE p_bucket WHEN 'wardrobe-images' THEN 'wardrobe_images' WHEN 'catalog-images' THEN 'catalog_images' WHEN 'tryon-inputs' THEN 'tryon_images' END;
 IF t IS NULL THEN RAISE EXCEPTION 'Invalid cleanup bucket' USING ERRCODE='22023'; END IF;
 EXECUTE format('SELECT object_name FROM app_private.%I WHERE id=$1 AND state=''cleanup_pending'' FOR UPDATE',t) INTO path USING p_id;
 IF path IS NULL OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=p_bucket AND name=path) THEN RETURN false; END IF;
 IF t='wardrobe_images' THEN SELECT EXISTS(SELECT 1 FROM app_private.wardrobe_garments WHERE image_id=p_id) INTO active_reference;
 ELSIF t='catalog_images' THEN SELECT EXISTS(SELECT 1 FROM app_private.catalog_garments WHERE image_id=p_id) INTO active_reference;
 ELSE SELECT EXISTS(SELECT 1 FROM app_private.tryon_jobs WHERE (input_image_id=p_id OR output_image_id=p_id) AND status IN ('queued','processing')) INTO active_reference; END IF;
 IF active_reference THEN RETURN false; END IF;
 EXECUTE format('UPDATE app_private.%I SET state=''removed'' WHERE id=$1',t) USING p_id;
 RETURN true;
END;$$;
CREATE OR REPLACE FUNCTION app_private.deletion_manifest(p_subject uuid,p_lease uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM 1 FROM app_private.deletion_tasks WHERE subject_id=p_subject AND lease=p_lease AND lease_until>clock_timestamp() AND phase<>'complete' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid cleanup lease' USING ERRCODE='42501'; END IF;
 UPDATE app_private.deletion_tasks SET phase='storage',lease_until=clock_timestamp()+interval '5 minutes' WHERE subject_id=p_subject;
 UPDATE app_private.account_deletion_tombstones SET cleanup_stage='purging' WHERE former_subject_id=p_subject;
 SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'object',name)),'[]'::jsonb) INTO result FROM (
  SELECT bucket_id,name FROM storage.objects WHERE bucket_id IN ('wardrobe-images','tryon-inputs','onboarding-body-images')
   AND split_part(name,'/',1)=p_subject::text ORDER BY bucket_id,name LIMIT 100
 ) objects;
 RETURN result;
END;$$;
ALTER FUNCTION app_private.deletion_manifest(uuid,uuid) OWNER TO dd_control_executor;
CREATE OR REPLACE FUNCTION app_private.prepare_auth_deletion(p_subject uuid,p_lease uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM app_private.deletion_tasks WHERE subject_id=p_subject AND lease=p_lease AND lease_until>clock_timestamp() AND phase<>'complete' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid cleanup lease' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id IN ('wardrobe-images','tryon-inputs','onboarding-body-images') AND split_part(name,'/',1)=p_subject::text) THEN RETURN false; END IF;
 DELETE FROM app_private.saved_outfits WHERE owner_id=p_subject;
 UPDATE app_private.deletion_tasks SET phase='auth',lease_until=clock_timestamp()+interval '5 minutes' WHERE subject_id=p_subject;
 RETURN true;
END;$$;
ALTER FUNCTION app_private.prepare_auth_deletion(uuid,uuid) OWNER TO dd_control_executor;
GRANT CREATE ON SCHEMA app_private TO dd_control_executor;
GRANT SELECT ON app_private.deletion_tasks TO dd_control_executor;
CREATE POLICY onboarding_deletion_objects ON storage.objects FOR SELECT TO dd_control_executor
 USING(bucket_id='onboarding-body-images' AND EXISTS(SELECT 1 FROM app_private.deletion_tasks t
  WHERE t.subject_id::text=split_part(name,'/',1) AND t.phase<>'complete'));
GRANT EXECUTE ON FUNCTION app_private.deletion_manifest(uuid,uuid),app_private.prepare_auth_deletion(uuid,uuid)
 TO service_role,dd_lifecycle_operator;
REVOKE CREATE ON SCHEMA app_private FROM dd_control_executor;
ALTER FUNCTION app_private.image_cleanup_manifest(integer,integer) OWNER TO dd_control_executor;
ALTER FUNCTION app_private.finish_image_cleanup(text,uuid) OWNER TO dd_control_executor;
REVOKE CREATE ON SCHEMA app_private FROM dd_control_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
