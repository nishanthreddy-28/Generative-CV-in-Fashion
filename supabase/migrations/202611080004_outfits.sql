-- Owner-scoped manual outfit aggregates. Local source only; no hosted application.
BEGIN;
CREATE TABLE app_private.saved_outfits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 name varchar(200) NOT NULL CHECK (btrim(name)<>''),
 description varchar(2000) NOT NULL DEFAULT '',
 occasion varchar(200) NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 UNIQUE(id,owner_id)
);
CREATE TABLE app_private.outfit_items (
 outfit_id uuid NOT NULL,
 owner_id uuid NOT NULL,
 position integer NOT NULL CHECK(position BETWEEN 0 AND 99),
 wardrobe_garment_id uuid,
 catalog_garment_id uuid,
 PRIMARY KEY(outfit_id,position),
 FOREIGN KEY(outfit_id,owner_id) REFERENCES app_private.saved_outfits(id,owner_id) ON DELETE CASCADE,
 FOREIGN KEY(wardrobe_garment_id,owner_id) REFERENCES app_private.wardrobe_garments(id,owner_id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE,
 FOREIGN KEY(catalog_garment_id) REFERENCES app_private.catalog_garments(id) ON DELETE NO ACTION,
 CHECK(num_nonnulls(wardrobe_garment_id,catalog_garment_id)=1),
 UNIQUE(outfit_id,wardrobe_garment_id),
 UNIQUE(outfit_id,catalog_garment_id)
);
CREATE INDEX outfit_owner_newest ON app_private.saved_outfits(owner_id,created_at DESC,id DESC);
CREATE INDEX outfit_item_owner ON app_private.outfit_items(owner_id,outfit_id);
CREATE INDEX outfit_item_wardrobe ON app_private.outfit_items(wardrobe_garment_id,owner_id) WHERE wardrobe_garment_id IS NOT NULL;
CREATE INDEX outfit_item_catalog ON app_private.outfit_items(catalog_garment_id) WHERE catalog_garment_id IS NOT NULL;
ALTER TABLE app_private.saved_outfits OWNER TO dd_owner;
ALTER TABLE app_private.outfit_items OWNER TO dd_owner;
ALTER TABLE app_private.saved_outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.saved_outfits FORCE ROW LEVEL SECURITY;
ALTER TABLE app_private.outfit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.outfit_items FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.saved_outfits,app_private.outfit_items FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON app_private.saved_outfits,app_private.outfit_items TO dd_user_executor;
CREATE POLICY outfit_owner_read ON app_private.saved_outfits FOR SELECT TO dd_user_executor
 USING(owner_id=(SELECT auth.uid()) AND (SELECT app_private.current_account_active()));
CREATE POLICY outfit_owner_insert ON app_private.saved_outfits FOR INSERT TO dd_user_executor
 WITH CHECK(owner_id=(SELECT auth.uid()) AND (SELECT app_private.current_account_active()));
CREATE POLICY outfit_item_owner_read ON app_private.outfit_items FOR SELECT TO dd_user_executor
 USING(owner_id=(SELECT auth.uid()) AND (SELECT app_private.current_account_active()));
CREATE POLICY outfit_item_owner_insert ON app_private.outfit_items FOR INSERT TO dd_user_executor
 WITH CHECK(owner_id=(SELECT auth.uid()) AND (SELECT app_private.current_account_active()));
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;

CREATE FUNCTION app_private.outfit_record(p_row app_private.saved_outfits) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',p_row.id,'name',p_row.name,'description',p_row.description,'occasion',p_row.occasion,
 'garmentIds',coalesce(jsonb_agg(i.wardrobe_garment_id ORDER BY i.position) FILTER(WHERE i.wardrobe_garment_id IS NOT NULL),'[]'::jsonb),
 'items',coalesce(jsonb_agg(jsonb_build_object('source',CASE WHEN i.wardrobe_garment_id IS NOT NULL THEN 'wardrobe' ELSE 'catalog' END,
 'garmentId',coalesce(i.wardrobe_garment_id,i.catalog_garment_id)) ORDER BY i.position) FILTER(WHERE i.outfit_id IS NOT NULL),'[]'::jsonb))
 FROM app_private.outfit_items i WHERE i.outfit_id=p_row.id AND i.owner_id=p_row.owner_id;
$$;
ALTER FUNCTION app_private.outfit_record(app_private.saved_outfits) OWNER TO dd_user_executor;

-- Ordinary readers must lock active catalog references without acquiring catalog mutation rights.
-- Reuse the existing read-only control role, with a column grant for row locking only.
GRANT SELECT ON app_private.catalog_garments TO dd_control_reader;
GRANT UPDATE(id) ON app_private.catalog_garments TO dd_control_reader;
CREATE POLICY outfit_catalog_reference_read ON app_private.catalog_garments FOR SELECT TO dd_control_reader
 USING(active AND app_private.current_account_active());
CREATE POLICY outfit_catalog_reference_lock ON app_private.catalog_garments FOR UPDATE TO dd_control_reader
 USING(active AND app_private.current_account_active()) WITH CHECK(false);
GRANT CREATE ON SCHEMA app_private TO dd_control_reader;
CREATE FUNCTION app_private.lock_outfit_catalog_item(p_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM app_private.require_active_account();
 PERFORM 1 FROM app_private.catalog_garments WHERE id=p_id AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Garment unavailable' USING ERRCODE='P0002'; END IF;
END; $$;
ALTER FUNCTION app_private.lock_outfit_catalog_item(uuid) OWNER TO dd_control_reader;
REVOKE ALL ON FUNCTION app_private.lock_outfit_catalog_item(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.lock_outfit_catalog_item(uuid) TO dd_user_executor;
REVOKE CREATE ON SCHEMA app_private FROM dd_control_reader;

CREATE FUNCTION app_private.create_outfit(p_name text,p_items jsonb,p_description text DEFAULT '',p_occasion text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE item jsonb; target uuid; source text; outfit app_private.saved_outfits%ROWTYPE; ordinal bigint;
BEGIN
 PERFORM app_private.require_active_account();
 IF p_name IS NULL OR btrim(p_name)='' OR char_length(p_name)>200 OR p_description IS NULL OR char_length(p_description)>2000
  OR p_occasion IS NULL OR char_length(p_occasion)>200 THEN RAISE EXCEPTION 'Invalid outfit fields' USING ERRCODE='22023'; END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' THEN RAISE EXCEPTION 'Invalid outfit items' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_items) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Select 2 to 100 items' USING ERRCODE='22023'; END IF;
 -- Validate every item before casting IDs or acquiring locks. No client owner/source ambiguity.
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  IF jsonb_typeof(item)<>'object' OR NOT(item ? 'source' AND item ? 'garmentId')
   OR (item-'source'-'garmentId')<>'{}'::jsonb OR jsonb_typeof(item->'source')<>'string'
   OR item->>'source' NOT IN ('wardrobe','catalog') OR jsonb_typeof(item->'garmentId')<>'string' THEN
   RAISE EXCEPTION 'Invalid outfit item' USING ERRCODE='22023'; END IF;
  BEGIN target:=(item->>'garmentId')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Invalid garment ID' USING ERRCODE='22023'; END;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i GROUP BY i->>'source',(i->>'garmentId')::uuid HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Duplicate outfit item' USING ERRCODE='22023'; END IF;
 -- Deterministic lock ordering prevents delete/deactivation racing validation and insertion.
 -- RLS still controls private source rows; catalog locks use the read-only helper above.
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'source',(value->>'garmentId')::uuid LOOP
  target:=(item->>'garmentId')::uuid; source:=item->>'source';
  IF source='wardrobe' THEN
   PERFORM 1 FROM app_private.wardrobe_garments WHERE id=target AND owner_id=auth.uid() FOR SHARE;
  ELSE
   PERFORM app_private.lock_outfit_catalog_item(target);
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Garment unavailable' USING ERRCODE='P0002'; END IF;
 END LOOP;
 INSERT INTO app_private.saved_outfits(owner_id,name,description,occasion)
  VALUES(auth.uid(),btrim(p_name),p_description,p_occasion) RETURNING * INTO outfit;
 FOR item,ordinal IN SELECT value,ordinality FROM jsonb_array_elements(p_items) WITH ORDINALITY LOOP
  INSERT INTO app_private.outfit_items(outfit_id,owner_id,position,wardrobe_garment_id,catalog_garment_id)
   VALUES(outfit.id,auth.uid(),ordinal-1,CASE WHEN item->>'source'='wardrobe' THEN (item->>'garmentId')::uuid END,
    CASE WHEN item->>'source'='catalog' THEN (item->>'garmentId')::uuid END);
 END LOOP;
 RETURN app_private.outfit_record(outfit);
END; $$;
ALTER FUNCTION app_private.create_outfit(text,jsonb,text,text) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.read_outfit(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE outfit app_private.saved_outfits%ROWTYPE;
BEGIN
 IF NOT app_private.current_account_active() THEN RAISE EXCEPTION 'Account access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO outfit FROM app_private.saved_outfits WHERE id=p_id AND owner_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Outfit not found' USING ERRCODE='P0002'; END IF;
 RETURN app_private.outfit_record(outfit);
END; $$;
ALTER FUNCTION app_private.read_outfit(uuid) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.list_outfits(p_limit integer DEFAULT 24,p_cursor jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE outfit app_private.saved_outfits%ROWTYPE; items jsonb:='[]'::jsonb; next_position jsonb; count_rows integer:=0;
BEGIN
 IF NOT app_private.current_account_active() THEN RAISE EXCEPTION 'Account access denied' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid limit' USING ERRCODE='22023'; END IF;
 IF p_cursor IS NOT NULL THEN
  IF jsonb_typeof(p_cursor)<>'object' OR NOT(p_cursor ? 'id' AND p_cursor ? 'createdAt') OR (p_cursor-'id'-'createdAt')<>'{}'::jsonb
   OR jsonb_typeof(p_cursor->'id')<>'string' OR jsonb_typeof(p_cursor->'createdAt')<>'string' THEN
   RAISE EXCEPTION 'Invalid cursor' USING ERRCODE='22023'; END IF;
  BEGIN PERFORM (p_cursor->>'id')::uuid,(p_cursor->>'createdAt')::timestamptz;
  EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
   RAISE EXCEPTION 'Invalid cursor' USING ERRCODE='22023'; END;
 END IF;
 FOR outfit IN SELECT * FROM app_private.saved_outfits WHERE owner_id=auth.uid()
  AND (p_cursor IS NULL OR (created_at,id)<((p_cursor->>'createdAt')::timestamptz,(p_cursor->>'id')::uuid))
  ORDER BY created_at DESC,id DESC LIMIT p_limit+1
 LOOP
  count_rows:=count_rows+1;
  IF count_rows>p_limit THEN RETURN jsonb_build_object('items',items,'nextCursor',next_position); END IF;
  items:=items||jsonb_build_array(app_private.outfit_record(outfit));
  next_position:=jsonb_build_object('id',outfit.id,'createdAt',outfit.created_at);
 END LOOP;
 RETURN jsonb_build_object('items',items,'nextCursor',NULL);
END; $$;
ALTER FUNCTION app_private.list_outfits(integer,jsonb) OWNER TO dd_user_executor;

CREATE FUNCTION api.create_outfit(p_name text,p_items jsonb,p_description text DEFAULT '',p_occasion text DEFAULT '') RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.create_outfit(p_name,p_items,p_description,p_occasion); $$;
CREATE FUNCTION api.read_outfit(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.read_outfit(p_id); $$;
CREATE FUNCTION api.list_outfits(p_limit integer DEFAULT 24,p_cursor jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.list_outfits(p_limit,p_cursor); $$;
DO $permissions$
DECLARE func regprocedure;
BEGIN
 FOR func IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('api','app_private') AND p.proname IN ('outfit_record','create_outfit','read_outfit','list_outfits') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',func);
  IF func::text NOT LIKE '%outfit_record(%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',func); END IF;
 END LOOP;
END; $permissions$;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
