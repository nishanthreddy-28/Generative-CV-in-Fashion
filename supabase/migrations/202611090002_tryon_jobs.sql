-- Private try-on infrastructure only. No inference worker or fabricated output.
BEGIN;
CREATE TABLE app_private.tryon_images (
 id uuid PRIMARY KEY,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 object_name text GENERATED ALWAYS AS (owner_id::text || '/' || id::text || '.jpg') STORED UNIQUE,
 sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 10485760),
 state text NOT NULL CHECK (state IN ('pending','attached','cleanup_pending','removed')),
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 UNIQUE(id,owner_id)
);

ALTER TABLE app_private.tryon_images ADD COLUMN purpose text NOT NULL DEFAULT 'input' CHECK(purpose IN ('input','output'));
ALTER TABLE app_private.tryon_images OWNER TO dd_owner;
ALTER TABLE app_private.tryon_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.tryon_images FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.tryon_images FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON app_private.tryon_images TO dd_user_executor;
GRANT UPDATE(state) ON app_private.tryon_images TO dd_user_executor;
CREATE POLICY own_active ON app_private.tryon_images TO dd_user_executor
 USING(owner_id=app_private.request_subject() AND app_private.current_account_active()) WITH CHECK(owner_id=app_private.request_subject() AND app_private.current_account_active());
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
CREATE POLICY tryon_executor_objects ON storage.objects FOR SELECT TO dd_user_executor
 USING(bucket_id='tryon-inputs' AND owner_id::text=app_private.request_subject()::text AND app_private.current_account_active());
-- A collision with a public/incompatible bucket must fail, never silently weaken it.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('tryon-inputs','tryon-inputs',false,10485760,ARRAY['image/jpeg']) ON CONFLICT(id) DO NOTHING;
DO $bucket$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='tryon-inputs' AND NOT public
  AND file_size_limit=10485760 AND allowed_mime_types=ARRAY['image/jpeg']) THEN
  RAISE EXCEPTION 'Existing try-on bucket requires review';
 END IF;
END;
$bucket$;

CREATE FUNCTION app_private.tryon_storage_allowed(p_name text,p_operation text) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE image_state text;
BEGIN
 IF NOT app_private.current_account_active() THEN RETURN false; END IF;
 -- Serialize insertion metadata with attach/retire transitions; no overwrite policy.
 SELECT state INTO image_state FROM app_private.tryon_images
  WHERE owner_id=app_private.request_subject() AND object_name=p_name FOR SHARE;
 RETURN CASE p_operation WHEN 'insert' THEN image_state='pending'
  WHEN 'read' THEN image_state IN ('pending','attached','cleanup_pending')
  WHEN 'delete' THEN image_state='cleanup_pending' ELSE false END;
END;
$fn$;
ALTER FUNCTION app_private.tryon_storage_allowed(text,text) OWNER TO dd_user_executor;
CREATE POLICY tryon_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='tryon-inputs' AND app_private.tryon_storage_allowed(name,'insert'));
CREATE POLICY tryon_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='tryon-inputs' AND app_private.tryon_storage_allowed(name,'read'));
CREATE POLICY tryon_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='tryon-inputs' AND app_private.tryon_storage_allowed(name,'delete'));
CREATE POLICY tryon_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'tryon-inputs' OR app_private.tryon_storage_allowed(name,'insert'));
CREATE POLICY tryon_read_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id<>'tryon-inputs' OR app_private.tryon_storage_allowed(name,'read'));
CREATE POLICY tryon_delete_boundary ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id<>'tryon-inputs' OR app_private.tryon_storage_allowed(name,'delete'));
CREATE POLICY tryon_no_overwrite ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id<>'tryon-inputs') WITH CHECK(bucket_id<>'tryon-inputs');

CREATE FUNCTION app_private.reserve_tryon_image(p_id uuid,p_sha256 text,p_byte_size integer) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE result jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 INSERT INTO app_private.tryon_images(id,owner_id,sha256,byte_size,state)
  VALUES(p_id,app_private.request_subject(),p_sha256,p_byte_size,'pending');
 SELECT jsonb_build_object('id',id,'object',object_name,'sha256',sha256,'byteSize',byte_size)
  INTO result FROM app_private.tryon_images WHERE id=p_id AND owner_id=app_private.request_subject();
 RETURN result;
END;
$fn$;
ALTER FUNCTION app_private.reserve_tryon_image(uuid,text,integer) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.abandon_tryon_image(p_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 PERFORM app_private.require_active_account();
 UPDATE app_private.tryon_images SET state='cleanup_pending'
 WHERE id=p_id AND owner_id=app_private.request_subject() AND state='pending';
END;
$fn$;
ALTER FUNCTION app_private.abandon_tryon_image(uuid) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.tryon_image_cleanup(p_finished uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE result jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 IF p_finished IS NOT NULL THEN
  PERFORM 1 FROM app_private.tryon_images WHERE id=p_finished AND owner_id=app_private.request_subject() AND state='cleanup_pending' FOR UPDATE;
  IF FOUND AND NOT EXISTS(SELECT 1 FROM storage.objects o JOIN app_private.tryon_images i ON o.name=i.object_name
   WHERE i.id=p_finished AND i.owner_id=app_private.request_subject() AND o.bucket_id='tryon-inputs') THEN
   UPDATE app_private.tryon_images SET state='removed' WHERE id=p_finished AND owner_id=app_private.request_subject();
  END IF;
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'object',object_name)),'[]'::jsonb) INTO result FROM (
  SELECT id,object_name FROM app_private.tryon_images WHERE owner_id=app_private.request_subject() AND state='cleanup_pending' ORDER BY created_at,id LIMIT 10
 ) pending;
 RETURN result;
END;
$fn$;
ALTER FUNCTION app_private.tryon_image_cleanup(uuid) OWNER TO dd_user_executor;


CREATE TABLE app_private.tryon_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','completed','failed')),
 garment_source text NOT NULL CHECK(garment_source IN ('wardrobe','catalog')),
 original_garment_id uuid NOT NULL,
 wardrobe_garment_id uuid,
 catalog_garment_id uuid,
 input_image_id uuid NOT NULL UNIQUE,
 output_image_id uuid,
 consent_version text NOT NULL CHECK(consent_version='photo-consent-v1'),
 consent_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 finished_at timestamptz,
 failure_code text CHECK(failure_code IN ('CANCELLED','WORKER_FAILED','INPUT_EXPIRED')),
 FOREIGN KEY(wardrobe_garment_id,owner_id) REFERENCES app_private.wardrobe_garments(id,owner_id) ON DELETE SET NULL(wardrobe_garment_id),
 FOREIGN KEY(catalog_garment_id) REFERENCES app_private.catalog_garments(id) ON DELETE SET NULL(catalog_garment_id),
 FOREIGN KEY(input_image_id,owner_id) REFERENCES app_private.tryon_images(id,owner_id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE,
 FOREIGN KEY(output_image_id,owner_id) REFERENCES app_private.tryon_images(id,owner_id),
 CHECK((garment_source='wardrobe' AND catalog_garment_id IS NULL AND (wardrobe_garment_id IS NULL OR wardrobe_garment_id=original_garment_id)) OR
       (garment_source='catalog' AND wardrobe_garment_id IS NULL AND (catalog_garment_id IS NULL OR catalog_garment_id=original_garment_id))),
 CHECK((status IN ('queued','processing') AND finished_at IS NULL AND failure_code IS NULL AND output_image_id IS NULL) OR
       (status='failed' AND finished_at IS NOT NULL AND failure_code IS NOT NULL AND output_image_id IS NULL) OR
       (status='completed' AND finished_at IS NOT NULL AND failure_code IS NULL AND output_image_id IS NOT NULL))
);
CREATE INDEX tryon_owner_recent ON app_private.tryon_jobs(owner_id,created_at DESC,id DESC);
CREATE INDEX tryon_queue ON app_private.tryon_jobs(status,created_at,id) WHERE status='queued';
CREATE INDEX tryon_wardrobe_reference ON app_private.tryon_jobs(wardrobe_garment_id,owner_id) WHERE wardrobe_garment_id IS NOT NULL;
CREATE INDEX tryon_catalog_reference ON app_private.tryon_jobs(catalog_garment_id) WHERE catalog_garment_id IS NOT NULL;
CREATE INDEX tryon_image_cleanup ON app_private.tryon_images(owner_id,state,created_at);
ALTER TABLE app_private.tryon_jobs OWNER TO dd_owner;
ALTER TABLE app_private.tryon_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.tryon_jobs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.tryon_jobs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON app_private.tryon_jobs TO dd_user_executor;
GRANT UPDATE(status,updated_at,finished_at,failure_code) ON app_private.tryon_jobs TO dd_user_executor;
CREATE POLICY own_active ON app_private.tryon_jobs TO dd_user_executor
 USING(owner_id=app_private.request_subject() AND app_private.current_account_active()) WITH CHECK(owner_id=app_private.request_subject() AND app_private.current_account_active());

CREATE FUNCTION app_private.tryon_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'queued' OR NEW.wardrobe_garment_id IS NULL AND NEW.catalog_garment_id IS NULL THEN
   RAISE EXCEPTION 'Invalid initial job' USING ERRCODE='23514'; END IF;
 ELSE
  IF (NEW.id,NEW.owner_id,NEW.original_garment_id,NEW.garment_source,NEW.input_image_id,NEW.consent_version,NEW.consent_at,NEW.created_at)
   IS DISTINCT FROM (OLD.id,OLD.owner_id,OLD.original_garment_id,OLD.garment_source,OLD.input_image_id,OLD.consent_version,OLD.consent_at,OLD.created_at) THEN
   RAISE EXCEPTION 'Immutable job identity' USING ERRCODE='23514'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    OLD.status='queued' AND NEW.status IN ('processing','failed') OR OLD.status='processing' AND NEW.status IN ('completed','failed')) THEN
   RAISE EXCEPTION 'Invalid job transition' USING ERRCODE='23514'; END IF;
  -- Ordinary execution can only cancel queued jobs; no client can start/fake inference.
  IF current_user='dd_user_executor' AND NEW.status IS DISTINCT FROM OLD.status AND NOT
   (OLD.status='queued' AND NEW.status='failed' AND NEW.failure_code='CANCELLED') THEN
   RAISE EXCEPTION 'Worker authority unavailable' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM app_private.tryon_images WHERE id=NEW.input_image_id AND owner_id=NEW.owner_id AND purpose='input' AND state='attached') THEN
  RAISE EXCEPTION 'Invalid input association' USING ERRCODE='23514'; END IF;
 IF NEW.status='completed' AND NOT EXISTS(SELECT 1 FROM app_private.tryon_images WHERE id=NEW.output_image_id AND owner_id=NEW.owner_id AND purpose='output' AND state='attached') THEN
  RAISE EXCEPTION 'Validated output required' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
ALTER FUNCTION app_private.tryon_transition() OWNER TO dd_user_executor;
REVOKE ALL ON FUNCTION app_private.tryon_transition() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER tryon_transition BEFORE INSERT OR UPDATE ON app_private.tryon_jobs FOR EACH ROW EXECUTE FUNCTION app_private.tryon_transition();

CREATE FUNCTION app_private.tryon_record(p_row app_private.tryon_jobs) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',p_row.id,'status',p_row.status,'garmentId',p_row.original_garment_id,'source',p_row.garment_source,
 'createdAt',p_row.created_at,'updatedAt',p_row.updated_at,'finishedAt',p_row.finished_at,
 'consentVersion',p_row.consent_version,'consentAt',p_row.consent_at,'failureCode',p_row.failure_code,
 'error',CASE p_row.failure_code WHEN 'CANCELLED' THEN 'Cancelled by you.' WHEN 'WORKER_FAILED' THEN 'Processing failed.' WHEN 'INPUT_EXPIRED' THEN 'Input photo expired.' END,
 'workerAvailable',false,'workerMessage','No inference worker is configured. Queued jobs will not produce an image.',
 'canCancel',p_row.status='queued',
 'inputAvailable',EXISTS(SELECT 1 FROM app_private.tryon_images WHERE id=p_row.input_image_id AND owner_id=p_row.owner_id AND state='attached'),
 'inputUrl','/try-on/jobs/'||p_row.id::text||'/input');
$$;
ALTER FUNCTION app_private.tryon_record(app_private.tryon_jobs) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.submit_tryon(p_garment_id uuid,p_source text,p_image_id uuid,p_consent boolean) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE image app_private.tryon_images%ROWTYPE; job app_private.tryon_jobs%ROWTYPE;
BEGIN
 PERFORM app_private.require_active_account();
 IF p_consent IS DISTINCT FROM true OR p_source IS NULL OR p_source NOT IN ('wardrobe','catalog') THEN RAISE EXCEPTION 'Explicit consent and valid source required' USING ERRCODE='22023'; END IF;
 IF p_source='wardrobe' THEN
  PERFORM 1 FROM app_private.wardrobe_garments WHERE id=p_garment_id AND owner_id=app_private.request_subject() FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Garment not found' USING ERRCODE='P0002'; END IF;
 ELSE PERFORM app_private.lock_outfit_catalog_item(p_garment_id);
 END IF;
 SELECT * INTO image FROM app_private.tryon_images WHERE id=p_image_id AND owner_id=app_private.request_subject() AND purpose='input' AND state='pending' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Input photo not found' USING ERRCODE='P0002'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='tryon-inputs' AND name=image.object_name AND owner_id::text=app_private.request_subject()::text
  AND metadata->>'mimetype'='image/jpeg' AND (metadata->>'size')::bigint=image.byte_size) THEN
  RAISE EXCEPTION 'Input upload incomplete' USING ERRCODE='22023'; END IF;
 UPDATE app_private.tryon_images SET state='attached' WHERE id=p_image_id AND owner_id=app_private.request_subject();
 INSERT INTO app_private.tryon_jobs(owner_id,garment_source,original_garment_id,wardrobe_garment_id,catalog_garment_id,input_image_id,consent_version)
 VALUES(app_private.request_subject(),p_source,p_garment_id,CASE WHEN p_source='wardrobe' THEN p_garment_id END,CASE WHEN p_source='catalog' THEN p_garment_id END,p_image_id,'photo-consent-v1') RETURNING * INTO job;
 RETURN app_private.tryon_record(job);
END; $$;
ALTER FUNCTION app_private.submit_tryon(uuid,text,uuid,boolean) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.read_tryon(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE job app_private.tryon_jobs%ROWTYPE;
BEGIN
 IF NOT app_private.current_account_active() THEN RAISE EXCEPTION 'Account access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO job FROM app_private.tryon_jobs WHERE id=p_id AND owner_id=app_private.request_subject();
 IF NOT FOUND THEN RAISE EXCEPTION 'Job not found' USING ERRCODE='P0002'; END IF;
 RETURN app_private.tryon_record(job);
END; $$;
ALTER FUNCTION app_private.read_tryon(uuid) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.cancel_tryon(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE job app_private.tryon_jobs%ROWTYPE;
BEGIN
 PERFORM app_private.require_active_account();
 SELECT * INTO job FROM app_private.tryon_jobs WHERE id=p_id AND owner_id=app_private.request_subject() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job not found' USING ERRCODE='P0002'; END IF;
 IF job.status='failed' AND job.failure_code='CANCELLED' THEN RETURN app_private.tryon_record(job); END IF;
 IF job.status<>'queued' THEN RAISE EXCEPTION 'Job cannot be cancelled' USING ERRCODE='DD001'; END IF;
 UPDATE app_private.tryon_jobs SET status='failed',failure_code='CANCELLED',finished_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=p_id AND owner_id=app_private.request_subject() RETURNING * INTO job;
 UPDATE app_private.tryon_images SET state='cleanup_pending' WHERE id=job.input_image_id AND owner_id=app_private.request_subject();
 RETURN app_private.tryon_record(job);
END; $$;
ALTER FUNCTION app_private.cancel_tryon(uuid) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.tryon_input_info(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM app_private.read_tryon(p_id);
 SELECT jsonb_build_object('id',i.id,'object',i.object_name,'sha256',i.sha256,'byteSize',i.byte_size) INTO result
 FROM app_private.tryon_images i JOIN app_private.tryon_jobs j ON j.input_image_id=i.id AND j.owner_id=i.owner_id
 WHERE j.id=p_id AND j.owner_id=app_private.request_subject() AND i.state='attached';
 IF result IS NULL THEN RAISE EXCEPTION 'Input photo unavailable' USING ERRCODE='P0002'; END IF;
 RETURN result;
END; $$;
ALTER FUNCTION app_private.tryon_input_info(uuid) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.list_tryon(p_limit integer DEFAULT 24,p_cursor jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE job app_private.tryon_jobs%ROWTYPE; items jsonb:='[]'::jsonb; position jsonb; count_rows integer:=0;
BEGIN
 IF NOT app_private.current_account_active() THEN RAISE EXCEPTION 'Account access denied' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid job limit' USING ERRCODE='22023'; END IF;
 IF p_cursor IS NOT NULL THEN
  IF jsonb_typeof(p_cursor)<>'object' OR NOT(p_cursor ? 'id' AND p_cursor ? 'createdAt') OR (p_cursor-'id'-'createdAt')<>'{}'::jsonb
   OR jsonb_typeof(p_cursor->'id')<>'string' OR jsonb_typeof(p_cursor->'createdAt')<>'string' THEN RAISE EXCEPTION 'Invalid job cursor' USING ERRCODE='22023'; END IF;
  BEGIN PERFORM (p_cursor->>'id')::uuid;
   IF NOT isfinite((p_cursor->>'createdAt')::timestamptz) THEN RAISE EXCEPTION 'Invalid timestamp' USING ERRCODE='22023'; END IF;
  EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'Invalid job cursor' USING ERRCODE='22023'; END;
 END IF;
 FOR job IN SELECT * FROM app_private.tryon_jobs WHERE owner_id=app_private.request_subject()
 AND(p_cursor IS NULL OR (created_at,id)<((p_cursor->>'createdAt')::timestamptz,(p_cursor->>'id')::uuid)) ORDER BY created_at DESC,id DESC LIMIT p_limit+1 LOOP
  count_rows:=count_rows+1;
  IF count_rows>p_limit THEN RETURN jsonb_build_object('items',items,'nextCursor',position); END IF;
  items:=items||jsonb_build_array(app_private.tryon_record(job));position:=jsonb_build_object('id',job.id,'createdAt',job.created_at);
 END LOOP;
 RETURN jsonb_build_object('items',items,'nextCursor',NULL);
END; $$;
ALTER FUNCTION app_private.list_tryon(integer,jsonb) OWNER TO dd_user_executor;

CREATE FUNCTION api.reserve_tryon_image(p_id uuid,p_sha256 text,p_byte_size integer) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.reserve_tryon_image(p_id,p_sha256,p_byte_size); $$;

CREATE FUNCTION api.abandon_tryon_image(p_id uuid) RETURNS void
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.abandon_tryon_image(p_id); $$;

CREATE FUNCTION api.tryon_image_cleanup(p_finished uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.tryon_image_cleanup(p_finished); $$;

CREATE FUNCTION api.submit_tryon(p_garment_id uuid,p_source text,p_image_id uuid,p_consent boolean) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.submit_tryon(p_garment_id,p_source,p_image_id,p_consent); $$;

CREATE FUNCTION api.read_tryon(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.read_tryon(p_id); $$;

CREATE FUNCTION api.cancel_tryon(p_id uuid) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.cancel_tryon(p_id); $$;

CREATE FUNCTION api.tryon_input_info(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.tryon_input_info(p_id); $$;

CREATE FUNCTION api.list_tryon(p_limit integer DEFAULT 24,p_cursor jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.list_tryon(p_limit,p_cursor); $$;
DO $permissions$
DECLARE func regprocedure;
BEGIN
 FOR func IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('api','app_private') AND p.proname IN ('reserve_tryon_image','abandon_tryon_image','tryon_image_cleanup','submit_tryon','read_tryon','cancel_tryon','tryon_input_info','list_tryon','tryon_storage_allowed','tryon_record') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',func);
  IF func::text NOT LIKE '%tryon_record(%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',func); END IF;
 END LOOP;
END; $permissions$;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
