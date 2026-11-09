-- Additive outfit editing. No hosted execution implied.
BEGIN;
ALTER TABLE app_private.outfit_items ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE app_private.outfit_items ADD CONSTRAINT outfit_items_id_key UNIQUE(id);
ALTER TABLE app_private.saved_outfits ADD COLUMN updated_at timestamptz NOT NULL DEFAULT transaction_timestamp();
GRANT UPDATE(name,description,occasion,updated_at) ON app_private.saved_outfits TO dd_user_executor;
GRANT DELETE ON app_private.outfit_items TO dd_user_executor;
CREATE POLICY outfit_owner_update ON app_private.saved_outfits FOR UPDATE TO dd_user_executor
 USING(owner_id=app_private.request_subject() AND app_private.current_account_active())
 WITH CHECK(owner_id=app_private.request_subject() AND app_private.current_account_active());
CREATE POLICY outfit_item_owner_delete ON app_private.outfit_items FOR DELETE TO dd_user_executor
 USING(owner_id=app_private.request_subject() AND app_private.current_account_active());
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
CREATE OR REPLACE FUNCTION app_private.outfit_record(p_row app_private.saved_outfits) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',p_row.id,'name',p_row.name,'description',p_row.description,'occasion',p_row.occasion,
 'garmentIds',coalesce(jsonb_agg(i.wardrobe_garment_id ORDER BY i.position) FILTER(WHERE i.wardrobe_garment_id IS NOT NULL),'[]'::jsonb),
 'items',coalesce(jsonb_agg(jsonb_build_object('id',i.id,'source',CASE WHEN i.wardrobe_garment_id IS NOT NULL THEN 'wardrobe' ELSE 'catalog' END,
 'garmentId',coalesce(i.wardrobe_garment_id,i.catalog_garment_id)) ORDER BY i.position) FILTER(WHERE i.outfit_id IS NOT NULL),'[]'::jsonb))
 FROM app_private.outfit_items i WHERE i.outfit_id=p_row.id AND i.owner_id=p_row.owner_id;
$$;
ALTER FUNCTION app_private.outfit_record(app_private.saved_outfits) OWNER TO dd_user_executor;


CREATE FUNCTION app_private.validate_outfit_items(p_items jsonb,p_outfit_id uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE item jsonb; target uuid; source text;
BEGIN
 PERFORM app_private.require_active_account();
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
   PERFORM 1 FROM app_private.wardrobe_garments WHERE id=target AND owner_id=app_private.request_subject() FOR SHARE;
  ELSE
   IF p_outfit_id IS NULL OR NOT EXISTS(SELECT 1 FROM app_private.outfit_items WHERE outfit_id=p_outfit_id AND owner_id=app_private.request_subject() AND catalog_garment_id=target) THEN
    PERFORM app_private.lock_outfit_catalog_item(target);
   END IF;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Garment unavailable' USING ERRCODE='P0002'; END IF;
 END LOOP;
END; $$;
ALTER FUNCTION app_private.validate_outfit_items(jsonb,uuid) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.update_outfit(p_id uuid,p_changes jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE key text; value jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 PERFORM 1 FROM app_private.saved_outfits WHERE id=p_id AND owner_id=app_private.request_subject() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Outfit not found' USING ERRCODE='P0002'; END IF;
 IF p_changes IS NULL OR jsonb_typeof(p_changes)<>'object' THEN RAISE EXCEPTION 'Invalid outfit fields' USING ERRCODE='22023'; END IF;
 FOR key,value IN SELECT * FROM jsonb_each(p_changes) LOOP
  IF key NOT IN ('name','description','occasion') OR jsonb_typeof(value)<>'string' OR char_length(value #>> '{}')>(CASE WHEN key='description' THEN 2000 ELSE 200 END)
   OR (key='name' AND btrim(value #>> '{}')='') THEN RAISE EXCEPTION 'Invalid outfit fields' USING ERRCODE='22023'; END IF;
 END LOOP;
 UPDATE app_private.saved_outfits SET name=CASE WHEN p_changes ? 'name' THEN btrim(p_changes->>'name') ELSE name END,
 description=CASE WHEN p_changes ? 'description' THEN p_changes->>'description' ELSE description END,
 occasion=CASE WHEN p_changes ? 'occasion' THEN p_changes->>'occasion' ELSE occasion END,updated_at=transaction_timestamp()
 WHERE id=p_id AND owner_id=app_private.request_subject();
END; $$;
ALTER FUNCTION app_private.update_outfit(uuid,jsonb) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.manage_outfit_items(p_id uuid,p_operation text,p_items jsonb DEFAULT NULL,p_item_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE refs jsonb; previous jsonb; item jsonb; ordinal bigint; retained uuid; outfit app_private.saved_outfits%ROWTYPE;
BEGIN
 PERFORM app_private.require_active_account();
 SELECT * INTO outfit FROM app_private.saved_outfits WHERE id=p_id AND owner_id=app_private.request_subject() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Outfit not found' USING ERRCODE='P0002'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'source',CASE WHEN wardrobe_garment_id IS NOT NULL THEN 'wardrobe' ELSE 'catalog' END,
 'garmentId',coalesce(wardrobe_garment_id,catalog_garment_id)) ORDER BY position),'[]'::jsonb) INTO previous
 FROM app_private.outfit_items WHERE outfit_id=p_id AND owner_id=app_private.request_subject();
 SELECT coalesce(jsonb_agg(e-'id' ORDER BY n),'[]'::jsonb) INTO refs FROM jsonb_array_elements(previous) WITH ORDINALITY AS x(e,n);
 IF p_operation='replace' AND p_item_id IS NULL THEN refs:=p_items;
 ELSIF p_operation='add' AND p_item_id IS NULL THEN
  IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)<>1 THEN RAISE EXCEPTION 'One item required' USING ERRCODE='22023'; END IF;
  refs:=refs||p_items;
 ELSIF p_operation='remove' AND p_items IS NULL AND p_item_id IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(previous) e WHERE (e->>'id')::uuid=p_item_id) THEN
   RAISE EXCEPTION 'Outfit item not found' USING ERRCODE='P0002'; END IF;
  SELECT coalesce(jsonb_agg(e-'id' ORDER BY n),'[]'::jsonb) INTO refs FROM jsonb_array_elements(previous) WITH ORDINALITY AS x(e,n) WHERE (e->>'id')::uuid<>p_item_id;
 ELSE RAISE EXCEPTION 'Invalid item operation' USING ERRCODE='22023'; END IF;
 -- Check the entire final aggregate before changing any association. Parent lock serializes edits.
 PERFORM app_private.validate_outfit_items(refs,p_id);
 DELETE FROM app_private.outfit_items WHERE outfit_id=p_id AND owner_id=app_private.request_subject();
 FOR item,ordinal IN SELECT value,ordinality FROM jsonb_array_elements(refs) WITH ORDINALITY LOOP
  SELECT (e->>'id')::uuid INTO retained FROM jsonb_array_elements(previous) e
   WHERE e->>'source'=item->>'source' AND (e->>'garmentId')::uuid=(item->>'garmentId')::uuid;
  INSERT INTO app_private.outfit_items(id,outfit_id,owner_id,position,wardrobe_garment_id,catalog_garment_id)
   VALUES(coalesce(retained,gen_random_uuid()),p_id,app_private.request_subject(),ordinal-1,
    CASE WHEN item->>'source'='wardrobe' THEN (item->>'garmentId')::uuid END,
    CASE WHEN item->>'source'='catalog' THEN (item->>'garmentId')::uuid END);
 END LOOP;
 UPDATE app_private.saved_outfits SET updated_at=transaction_timestamp() WHERE id=p_id AND owner_id=app_private.request_subject();
 RETURN app_private.outfit_record(outfit);
END; $$;
ALTER FUNCTION app_private.manage_outfit_items(uuid,text,jsonb,uuid) OWNER TO dd_user_executor;

CREATE FUNCTION api.update_outfit(p_id uuid,p_changes jsonb) RETURNS void
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.update_outfit(p_id,p_changes); $$;
CREATE FUNCTION api.manage_outfit_items(p_id uuid,p_operation text,p_items jsonb DEFAULT NULL,p_item_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.manage_outfit_items(p_id,p_operation,p_items,p_item_id); $$;
DO $permissions$
DECLARE func regprocedure;
BEGIN
 FOR func IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('api','app_private') AND p.proname IN ('validate_outfit_items','update_outfit','manage_outfit_items') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',func);
  IF func::text NOT LIKE '%validate_outfit_items(%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',func); END IF;
 END LOOP;
END; $permissions$;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
