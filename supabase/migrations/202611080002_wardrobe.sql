-- Wardrobe-only schema and private image policies. No hosted application here.
BEGIN;
CREATE TABLE app_private.wardrobe_images (
 id uuid PRIMARY KEY,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 object_name text GENERATED ALWAYS AS (owner_id::text || '/' || id::text || '.jpg') STORED UNIQUE,
 sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 10485760),
 state text NOT NULL CHECK (state IN ('pending','attached','cleanup_pending','removed')),
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 UNIQUE(id,owner_id)
);
CREATE TABLE app_private.wardrobe_garments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 name varchar(200) NOT NULL CHECK (btrim(name) <> ''),
 category text NOT NULL CHECK (category IN ('Tops','Bottoms','Outerwear','Dresses','Shoes','Accessories')),
 color varchar(200), brand varchar(200), size varchar(200), material varchar(200), notes varchar(2000),
 image_id uuid NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 UNIQUE(id,owner_id),
 FOREIGN KEY(image_id,owner_id) REFERENCES app_private.wardrobe_images(id,owner_id) ON DELETE NO ACTION
);
CREATE INDEX wardrobe_owner_newest ON app_private.wardrobe_garments(owner_id,created_at DESC,id DESC);
CREATE INDEX wardrobe_owner_name ON app_private.wardrobe_garments(owner_id,name COLLATE "C",id);
CREATE INDEX wardrobe_image_cleanup ON app_private.wardrobe_images(owner_id,state,created_at);
ALTER TABLE app_private.wardrobe_images OWNER TO dd_owner;
ALTER TABLE app_private.wardrobe_garments OWNER TO dd_owner;
ALTER TABLE app_private.wardrobe_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.wardrobe_images FORCE ROW LEVEL SECURITY;
ALTER TABLE app_private.wardrobe_garments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.wardrobe_garments FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.wardrobe_images,app_private.wardrobe_garments FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,DELETE ON app_private.wardrobe_garments TO dd_user_executor;
GRANT UPDATE(name,category,color,brand,size,material,notes,image_id,updated_at) ON app_private.wardrobe_garments TO dd_user_executor;
GRANT SELECT,INSERT ON app_private.wardrobe_images TO dd_user_executor;
GRANT UPDATE(state) ON app_private.wardrobe_images TO dd_user_executor;
CREATE POLICY own_active ON app_private.wardrobe_images TO dd_user_executor
 USING(owner_id=(SELECT auth.uid()) AND (SELECT app_private.current_account_active()))
 WITH CHECK(owner_id=(SELECT auth.uid()) AND (SELECT app_private.current_account_active()));
CREATE POLICY own_active ON app_private.wardrobe_garments TO dd_user_executor
 USING(owner_id=(SELECT auth.uid()) AND (SELECT app_private.current_account_active()))
 WITH CHECK(owner_id=(SELECT auth.uid()) AND (SELECT app_private.current_account_active()));
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
GRANT USAGE ON SCHEMA storage TO dd_user_executor;
GRANT SELECT ON storage.objects TO dd_user_executor;
CREATE POLICY wardrobe_executor_objects ON storage.objects FOR SELECT TO dd_user_executor
 USING(bucket_id='wardrobe-images' AND owner_id::text=auth.uid()::text AND app_private.current_account_active());

-- A collision with a public/incompatible bucket must fail, never silently weaken it.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('wardrobe-images','wardrobe-images',false,10485760,ARRAY['image/jpeg']) ON CONFLICT(id) DO NOTHING;
DO $bucket$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='wardrobe-images' AND NOT public
  AND file_size_limit=10485760 AND allowed_mime_types=ARRAY['image/jpeg']) THEN
  RAISE EXCEPTION 'Existing wardrobe bucket requires review';
 END IF;
END;
$bucket$;

CREATE FUNCTION app_private.wardrobe_storage_allowed(p_name text,p_operation text) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE image_state text;
BEGIN
 IF NOT app_private.current_account_active() THEN RETURN false; END IF;
 -- Serialize insertion metadata with attach/retire transitions; no overwrite policy.
 SELECT state INTO image_state FROM app_private.wardrobe_images
  WHERE owner_id=auth.uid() AND object_name=p_name FOR SHARE;
 RETURN CASE p_operation WHEN 'insert' THEN image_state='pending'
  WHEN 'read' THEN image_state IN ('pending','attached','cleanup_pending')
  WHEN 'delete' THEN image_state='cleanup_pending' ELSE false END;
END;
$fn$;
ALTER FUNCTION app_private.wardrobe_storage_allowed(text,text) OWNER TO dd_user_executor;
CREATE POLICY wardrobe_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='wardrobe-images' AND app_private.wardrobe_storage_allowed(name,'insert'));
CREATE POLICY wardrobe_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='wardrobe-images' AND app_private.wardrobe_storage_allowed(name,'read'));
CREATE POLICY wardrobe_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='wardrobe-images' AND app_private.wardrobe_storage_allowed(name,'delete'));
CREATE POLICY wardrobe_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'wardrobe-images' OR app_private.wardrobe_storage_allowed(name,'insert'));
CREATE POLICY wardrobe_read_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id<>'wardrobe-images' OR app_private.wardrobe_storage_allowed(name,'read'));
CREATE POLICY wardrobe_delete_boundary ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id<>'wardrobe-images' OR app_private.wardrobe_storage_allowed(name,'delete'));
CREATE POLICY wardrobe_no_overwrite ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id<>'wardrobe-images') WITH CHECK(bucket_id<>'wardrobe-images');

CREATE FUNCTION app_private.reserve_wardrobe_image(p_id uuid,p_sha256 text,p_byte_size integer) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE result jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 INSERT INTO app_private.wardrobe_images(id,owner_id,sha256,byte_size,state)
  VALUES(p_id,auth.uid(),p_sha256,p_byte_size,'pending');
 SELECT jsonb_build_object('id',id,'object',object_name,'sha256',sha256,'byteSize',byte_size)
  INTO result FROM app_private.wardrobe_images WHERE id=p_id AND owner_id=auth.uid();
 RETURN result;
END;
$fn$;
ALTER FUNCTION app_private.reserve_wardrobe_image(uuid,text,integer) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.wardrobe_record(p_row app_private.wardrobe_garments) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $fn$
 SELECT jsonb_build_object('id',p_row.id,'name',p_row.name,'category',p_row.category,
 'color',coalesce(p_row.color,''),'brand',coalesce(p_row.brand,''),'size',coalesce(p_row.size,''),
 'material',coalesce(p_row.material,''),'notes',coalesce(p_row.notes,''),
 'imageUrl','/wardrobe/'||p_row.id::text||'/image');
$fn$;
ALTER FUNCTION app_private.wardrobe_record(app_private.wardrobe_garments) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.read_wardrobe(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE garment app_private.wardrobe_garments%ROWTYPE;
BEGIN
 IF NOT app_private.current_account_active() THEN RAISE EXCEPTION 'Account access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO garment FROM app_private.wardrobe_garments WHERE id=p_id AND owner_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Garment not found' USING ERRCODE='P0002'; END IF;
 RETURN app_private.wardrobe_record(garment);
END;
$fn$;
ALTER FUNCTION app_private.read_wardrobe(uuid) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.write_wardrobe(p_changes jsonb,p_id uuid DEFAULT NULL,p_image_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE garment app_private.wardrobe_garments%ROWTYPE; image app_private.wardrobe_images%ROWTYPE;
 key text; value jsonb; old_image uuid;
BEGIN
 PERFORM app_private.require_active_account();
 IF p_changes IS NULL OR jsonb_typeof(p_changes)<>'object' THEN RAISE EXCEPTION 'Invalid garment fields' USING ERRCODE='22023'; END IF;
 FOR key,value IN SELECT * FROM jsonb_each(p_changes) LOOP
  IF key NOT IN ('name','category','color','brand','size','material','notes') OR jsonb_typeof(value)<>'string'
   OR char_length(value #>> '{}')>(CASE WHEN key='notes' THEN 2000 ELSE 200 END) THEN
   RAISE EXCEPTION 'Invalid garment fields' USING ERRCODE='22023';
  END IF;
 END LOOP;
 IF p_changes ? 'name' AND btrim(p_changes->>'name')='' THEN RAISE EXCEPTION 'Invalid garment name' USING ERRCODE='22023'; END IF;
 IF p_changes ? 'category' AND p_changes->>'category' NOT IN ('Tops','Bottoms','Outerwear','Dresses','Shoes','Accessories') THEN
  RAISE EXCEPTION 'Invalid garment category' USING ERRCODE='22023'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO garment FROM app_private.wardrobe_garments WHERE id=p_id AND owner_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Garment not found' USING ERRCODE='P0002'; END IF;
  old_image:=garment.image_id;
 ELSE
  IF NOT (p_changes ? 'name' AND p_changes ? 'category') OR p_image_id IS NULL THEN
   RAISE EXCEPTION 'Name, category and image required' USING ERRCODE='22023'; END IF;
 END IF;
 IF p_image_id IS NOT NULL THEN
  SELECT * INTO image FROM app_private.wardrobe_images WHERE id=p_image_id AND owner_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR image.state<>'pending' THEN RAISE EXCEPTION 'Image not found' USING ERRCODE='P0002'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='wardrobe-images' AND name=image.object_name
   AND owner_id::text=auth.uid()::text AND metadata->>'mimetype'='image/jpeg'
   AND (metadata->>'size')::bigint=image.byte_size) THEN
   RAISE EXCEPTION 'Image upload incomplete' USING ERRCODE='22023'; END IF;
 END IF;
 IF p_id IS NULL THEN
  INSERT INTO app_private.wardrobe_garments(owner_id,name,category,color,brand,size,material,notes,image_id)
   VALUES(auth.uid(),btrim(p_changes->>'name'),p_changes->>'category',nullif(btrim(p_changes->>'color'),''),
    nullif(btrim(p_changes->>'brand'),''),nullif(btrim(p_changes->>'size'),''),nullif(btrim(p_changes->>'material'),''),
    nullif(btrim(p_changes->>'notes'),''),p_image_id) RETURNING * INTO garment;
 ELSE
  UPDATE app_private.wardrobe_garments SET
   name=CASE WHEN p_changes ? 'name' THEN btrim(p_changes->>'name') ELSE name END,
   category=CASE WHEN p_changes ? 'category' THEN p_changes->>'category' ELSE category END,
   color=CASE WHEN p_changes ? 'color' THEN nullif(btrim(p_changes->>'color'),'') ELSE color END,
   brand=CASE WHEN p_changes ? 'brand' THEN nullif(btrim(p_changes->>'brand'),'') ELSE brand END,
   size=CASE WHEN p_changes ? 'size' THEN nullif(btrim(p_changes->>'size'),'') ELSE size END,
   material=CASE WHEN p_changes ? 'material' THEN nullif(btrim(p_changes->>'material'),'') ELSE material END,
   notes=CASE WHEN p_changes ? 'notes' THEN nullif(btrim(p_changes->>'notes'),'') ELSE notes END,
   image_id=coalesce(p_image_id,image_id),updated_at=transaction_timestamp()
   WHERE id=p_id AND owner_id=auth.uid() RETURNING * INTO garment;
 END IF;
 IF p_image_id IS NOT NULL THEN
  UPDATE app_private.wardrobe_images SET state='attached' WHERE id=p_image_id AND owner_id=auth.uid();
  IF old_image IS NOT NULL THEN UPDATE app_private.wardrobe_images SET state='cleanup_pending' WHERE id=old_image AND owner_id=auth.uid(); END IF;
 END IF;
 RETURN app_private.wardrobe_record(garment);
END;
$fn$;
ALTER FUNCTION app_private.write_wardrobe(jsonb,uuid,uuid) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.delete_wardrobe(p_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE image uuid;
BEGIN
 PERFORM app_private.require_active_account();
 DELETE FROM app_private.wardrobe_garments WHERE id=p_id AND owner_id=auth.uid() RETURNING image_id INTO image;
 IF NOT FOUND THEN RAISE EXCEPTION 'Garment not found' USING ERRCODE='P0002'; END IF;
 UPDATE app_private.wardrobe_images SET state='cleanup_pending' WHERE id=image AND owner_id=auth.uid();
END;
$fn$;
ALTER FUNCTION app_private.delete_wardrobe(uuid) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.list_wardrobe(p_search text DEFAULT '',p_category text DEFAULT '',p_sort text DEFAULT 'newest',p_limit integer DEFAULT 24,p_cursor jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE garment app_private.wardrobe_garments%ROWTYPE; items jsonb:='[]'::jsonb; cursor_value jsonb; count_rows integer:=0;
BEGIN
 IF NOT app_private.current_account_active() THEN RAISE EXCEPTION 'Account access denied' USING ERRCODE='42501'; END IF;
 IF p_search IS NULL OR char_length(p_search)>200 OR p_category IS NULL OR p_category NOT IN ('','Tops','Bottoms','Outerwear','Dresses','Shoes','Accessories')
  OR p_sort IS NULL OR p_sort NOT IN ('newest','name') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'Invalid collection query' USING ERRCODE='22023'; END IF;
 IF p_cursor IS NOT NULL AND (jsonb_typeof(p_cursor)<>'object' OR NOT(p_cursor ? 'id' AND p_cursor ? 'value')) THEN
  RAISE EXCEPTION 'Invalid cursor' USING ERRCODE='22023'; END IF;
 FOR garment IN
  SELECT g.* FROM app_private.wardrobe_garments g WHERE owner_id=auth.uid()
   AND (p_category='' OR category=p_category)
   AND (p_search='' OR strpos(lower(name||' '||coalesce(brand,'')),lower(btrim(p_search)))>0)
   AND (p_cursor IS NULL OR CASE WHEN p_sort='name' THEN
    (name COLLATE "C",id)>((p_cursor->>'value') COLLATE "C",(p_cursor->>'id')::uuid)
    ELSE (created_at,id)<((p_cursor->>'value')::timestamptz,(p_cursor->>'id')::uuid) END)
  ORDER BY CASE WHEN p_sort='name' THEN name END COLLATE "C" ASC,
   CASE WHEN p_sort='newest' THEN created_at END DESC,
   CASE WHEN p_sort='name' THEN id END ASC,CASE WHEN p_sort='newest' THEN id END DESC LIMIT p_limit+1
 LOOP
  count_rows:=count_rows+1;
  IF count_rows>p_limit THEN RETURN jsonb_build_object('items',items,'nextCursor',cursor_value); END IF;
  items:=items||jsonb_build_array(app_private.wardrobe_record(garment));
  cursor_value:=jsonb_build_object('id',garment.id,'value',CASE WHEN p_sort='name' THEN garment.name ELSE garment.created_at::text END);
 END LOOP;
 RETURN jsonb_build_object('items',items,'nextCursor',NULL);
END;
$fn$;
ALTER FUNCTION app_private.list_wardrobe(text,text,text,integer,jsonb) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.wardrobe_image_info(p_garment_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE result jsonb;
BEGIN
 PERFORM app_private.read_wardrobe(p_garment_id);
 SELECT jsonb_build_object('id',i.id,'object',i.object_name,'sha256',i.sha256,'byteSize',i.byte_size) INTO result
 FROM app_private.wardrobe_images i JOIN app_private.wardrobe_garments g ON g.image_id=i.id AND g.owner_id=i.owner_id
 WHERE g.id=p_garment_id AND g.owner_id=auth.uid() AND i.state='attached';
 IF result IS NULL THEN RAISE EXCEPTION 'Image association unavailable' USING ERRCODE='55000'; END IF;
 RETURN result;
END;
$fn$;
ALTER FUNCTION app_private.wardrobe_image_info(uuid) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.abandon_wardrobe_image(p_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 PERFORM app_private.require_active_account();
 UPDATE app_private.wardrobe_images SET state='cleanup_pending'
 WHERE id=p_id AND owner_id=auth.uid() AND state='pending';
END;
$fn$;
ALTER FUNCTION app_private.abandon_wardrobe_image(uuid) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.wardrobe_image_cleanup(p_finished uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE result jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 IF p_finished IS NOT NULL THEN
  PERFORM 1 FROM app_private.wardrobe_images WHERE id=p_finished AND owner_id=auth.uid() AND state='cleanup_pending' FOR UPDATE;
  IF FOUND AND NOT EXISTS(SELECT 1 FROM storage.objects o JOIN app_private.wardrobe_images i ON o.name=i.object_name
   WHERE i.id=p_finished AND i.owner_id=auth.uid() AND o.bucket_id='wardrobe-images') THEN
   UPDATE app_private.wardrobe_images SET state='removed' WHERE id=p_finished AND owner_id=auth.uid();
  END IF;
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'object',object_name)),'[]'::jsonb) INTO result FROM (
  SELECT id,object_name FROM app_private.wardrobe_images WHERE owner_id=auth.uid() AND state='cleanup_pending' ORDER BY created_at,id LIMIT 10
 ) pending;
 RETURN result;
END;
$fn$;
ALTER FUNCTION app_private.wardrobe_image_cleanup(uuid) OWNER TO dd_user_executor;

CREATE FUNCTION api.reserve_wardrobe_image(p_id uuid,p_sha256 text,p_byte_size integer) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.reserve_wardrobe_image(p_id,p_sha256,p_byte_size); $$;
CREATE FUNCTION api.read_wardrobe(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.read_wardrobe(p_id); $$;
CREATE FUNCTION api.write_wardrobe(p_changes jsonb,p_id uuid DEFAULT NULL,p_image_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.write_wardrobe(p_changes,p_id,p_image_id); $$;
CREATE FUNCTION api.delete_wardrobe(p_id uuid) RETURNS void
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.delete_wardrobe(p_id); $$;
CREATE FUNCTION api.list_wardrobe(p_search text DEFAULT '',p_category text DEFAULT '',p_sort text DEFAULT 'newest',p_limit integer DEFAULT 24,p_cursor jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.list_wardrobe(p_search,p_category,p_sort,p_limit,p_cursor); $$;
CREATE FUNCTION api.wardrobe_image_info(p_garment_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.wardrobe_image_info(p_garment_id); $$;
CREATE FUNCTION api.abandon_wardrobe_image(p_id uuid) RETURNS void
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.abandon_wardrobe_image(p_id); $$;
CREATE FUNCTION api.wardrobe_image_cleanup(p_finished uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.wardrobe_image_cleanup(p_finished); $$;

DO $permissions$
DECLARE func regprocedure;
BEGIN
 FOR func IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('api','app_private') AND p.proname IN ('reserve_wardrobe_image','read_wardrobe','write_wardrobe',
   'delete_wardrobe','list_wardrobe','wardrobe_image_info','abandon_wardrobe_image','wardrobe_image_cleanup','wardrobe_storage_allowed','wardrobe_record')
 LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',func);
  IF func::text NOT LIKE '%wardrobe_record(%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',func); END IF;
 END LOOP;
END;
$permissions$;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
