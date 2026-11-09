-- Deterministic recommendation history. Local migration source, not hosted execution.
BEGIN;
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
CREATE FUNCTION app_private.valid_recommendation_items(p_items jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE item jsonb;
BEGIN
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)<>2 THEN RETURN false; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  IF jsonb_typeof(item)<>'object' OR NOT(item ?& ARRAY['source','garmentId','name','category','color'])
   OR (item-'source'-'garmentId'-'name'-'category'-'color')<>'{}'::jsonb
   OR jsonb_typeof(item->'source')<>'string' OR item->>'source' NOT IN ('wardrobe','catalog')
   OR jsonb_typeof(item->'garmentId')<>'string' OR jsonb_typeof(item->'name')<>'string' OR btrim(item->>'name')='' OR char_length(item->>'name')>200
   OR jsonb_typeof(item->'category')<>'string' OR item->>'category' NOT IN ('Tops','Bottoms','Dresses','Shoes')
   OR jsonb_typeof(item->'color')<>'string' OR char_length(item->>'color')>200 THEN RETURN false; END IF;
  BEGIN PERFORM (item->>'garmentId')::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
 END LOOP;
 RETURN (p_items->0->>'category'='Tops' AND p_items->1->>'category'='Bottoms') OR
        (p_items->0->>'category'='Dresses' AND p_items->1->>'category'='Shoes');
END; $$;
ALTER FUNCTION app_private.valid_recommendation_items(jsonb) OWNER TO dd_user_executor;
REVOKE ALL ON FUNCTION app_private.valid_recommendation_items(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE app_private.recommendation_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 occasion text NOT NULL CHECK(occasion IN ('Everyday','Work','Evening','Weekend','Special occasion')),
 preferences varchar(2000) NOT NULL DEFAULT '',
 wardrobe_only boolean NOT NULL,
 result_limit integer NOT NULL CHECK(result_limit BETWEEN 1 AND 10),
 engine_version text NOT NULL DEFAULT 'rules-v1' CHECK(engine_version='rules-v1'),
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 UNIQUE(id,owner_id)
);
CREATE TABLE app_private.recommendation_results (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL,
 owner_id uuid NOT NULL,
 rank integer NOT NULL CHECK(rank BETWEEN 1 AND 10),
 items jsonb NOT NULL CHECK(app_private.valid_recommendation_items(items)),
 score integer NOT NULL CHECK(score BETWEEN 0 AND 100),
 reasons text[] NOT NULL CHECK(cardinality(reasons) BETWEEN 1 AND 6),
 FOREIGN KEY(request_id,owner_id) REFERENCES app_private.recommendation_requests(id,owner_id) ON DELETE CASCADE,
 UNIQUE(request_id,rank)
);
CREATE INDEX recommendation_owner_recent ON app_private.recommendation_requests(owner_id,created_at DESC,id DESC);
CREATE INDEX recommendation_result_owner ON app_private.recommendation_results(owner_id,request_id,rank);
ALTER TABLE app_private.recommendation_requests OWNER TO dd_owner;
ALTER TABLE app_private.recommendation_results OWNER TO dd_owner;
ALTER TABLE app_private.recommendation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.recommendation_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE app_private.recommendation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.recommendation_results FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.recommendation_requests,app_private.recommendation_results FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON app_private.recommendation_requests,app_private.recommendation_results TO dd_user_executor;
CREATE POLICY own_active ON app_private.recommendation_requests TO dd_user_executor
 USING(owner_id=app_private.request_subject() AND app_private.current_account_active()) WITH CHECK(owner_id=app_private.request_subject() AND app_private.current_account_active());
CREATE POLICY own_active ON app_private.recommendation_results TO dd_user_executor
 USING(owner_id=app_private.request_subject() AND app_private.current_account_active()) WITH CHECK(owner_id=app_private.request_subject() AND app_private.current_account_active());

-- Snapshots are historical descriptions, not garment copies or durable authorization.
-- Revalidate every referenced garment on each response, including immediately after generation.
CREATE FUNCTION app_private.recommendation_visible(p_items jsonb) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT app_private.current_account_active() AND NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements(p_items) item WHERE NOT (
   (item->>'source'='wardrobe' AND EXISTS(SELECT 1 FROM app_private.wardrobe_garments WHERE id=(item->>'garmentId')::uuid AND owner_id=app_private.request_subject())) OR
   (item->>'source'='catalog' AND EXISTS(SELECT 1 FROM app_private.catalog_garments WHERE id=(item->>'garmentId')::uuid AND active))
  ));
$$;
ALTER FUNCTION app_private.recommendation_visible(jsonb) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.recommendation_record(p_result app_private.recommendation_results,p_request app_private.recommendation_requests) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',p_result.id,'requestId',p_request.id,'name',p_request.occasion||' look '||p_result.rank,
 'description',array_to_string(p_result.reasons,' '),'occasion',p_request.occasion,'items',p_result.items,
 'garmentIds',coalesce((SELECT jsonb_agg(item->'garmentId' ORDER BY n) FROM jsonb_array_elements(p_result.items) WITH ORDINALITY x(item,n) WHERE item->>'source'='wardrobe'),'[]'::jsonb),
 'score',p_result.score,'reasons',to_jsonb(p_result.reasons),'engineVersion',p_request.engine_version,'generatedAt',p_request.created_at);
$$;
ALTER FUNCTION app_private.recommendation_record(app_private.recommendation_results,app_private.recommendation_requests) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.generate_recommendations(p_occasion text,p_preferences text DEFAULT '',p_wardrobe_only boolean DEFAULT true,p_limit integer DEFAULT 5) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE run app_private.recommendation_requests%ROWTYPE; result jsonb; style_text text;
BEGIN
 PERFORM app_private.require_active_account();
 IF p_occasion IS NULL OR p_occasion NOT IN ('Everyday','Work','Evening','Weekend','Special occasion') OR p_preferences IS NULL OR char_length(p_preferences)>2000
  OR p_wardrobe_only IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Invalid recommendation request' USING ERRCODE='22023'; END IF;
 SELECT coalesce(style,'') INTO style_text FROM app_private.user_profiles WHERE user_id=app_private.request_subject();
 INSERT INTO app_private.recommendation_requests(owner_id,occasion,preferences,wardrobe_only,result_limit)
 VALUES(app_private.request_subject(),p_occasion,p_preferences,p_wardrobe_only,p_limit) RETURNING * INTO run;
 WITH wardrobe AS MATERIALIZED (
  SELECT id,name,category,coalesce(color,'') color,coalesce(brand,'') brand,coalesce(material,'') material,'wardrobe'::text source
  FROM app_private.wardrobe_garments WHERE owner_id=app_private.request_subject() AND category IN ('Tops','Bottoms','Dresses','Shoes') ORDER BY created_at DESC,id DESC LIMIT 40
 ), catalog AS MATERIALIZED (
  SELECT id,name,category,coalesce(color,'') color,coalesce(brand,'') brand,coalesce(material,'') material,'catalog'::text source
  FROM app_private.catalog_garments WHERE NOT p_wardrobe_only AND active AND category IN ('Tops','Bottoms','Dresses','Shoes') ORDER BY created_at DESC,id DESC LIMIT 40
 ), candidates AS MATERIALIZED (SELECT * FROM wardrobe UNION ALL SELECT * FROM catalog),
 tokens AS MATERIALIZED (
  SELECT DISTINCT word FROM regexp_split_to_table(lower(coalesce(style_text,'')||' '||p_preferences),'[^[:alnum:]]+') word
  WHERE char_length(word) BETWEEN 3 AND 32 ORDER BY word LIMIT 20
 ), previous AS MATERIALIZED (
  SELECT id FROM app_private.saved_outfits WHERE owner_id=app_private.request_subject() AND lower(btrim(occasion))=lower(p_occasion) ORDER BY created_at DESC,id DESC LIMIT 50
 ), previous_categories AS MATERIALIZED (
  SELECT DISTINCT i.outfit_id,coalesce(w.category,c.category) category FROM app_private.outfit_items i JOIN previous o ON o.id=i.outfit_id
  LEFT JOIN app_private.wardrobe_garments w ON w.id=i.wardrobe_garment_id AND w.owner_id=i.owner_id
  LEFT JOIN app_private.catalog_garments c ON c.id=i.catalog_garment_id AND c.active WHERE i.owner_id=app_private.request_subject()
 ), pairs AS (
  SELECT a.*,b.id second_id,b.name second_name,b.category second_category,b.color second_color,b.source second_source,
   (lower(btrim(a.color))<>'' AND lower(btrim(b.color))<>'' AND (lower(btrim(a.color))=lower(btrim(b.color)) OR
    lower(btrim(a.color)) IN ('black','white','grey','gray','beige','navy','cream','ivory','denim') OR
    lower(btrim(b.color)) IN ('black','white','grey','gray','beige','navy','cream','ivory','denim'))) palette,
   EXISTS(SELECT 1 FROM tokens WHERE strpos(lower(a.name||' '||a.color||' '||a.brand||' '||a.material),word)>0) pref_a,
   EXISTS(SELECT 1 FROM tokens WHERE strpos(lower(b.name||' '||b.color||' '||b.brand||' '||b.material),word)>0) pref_b,
   EXISTS(SELECT 1 FROM previous_categories x JOIN previous_categories y ON y.outfit_id=x.outfit_id WHERE x.category=a.category AND y.category=b.category) familiar,
   ((p_occasion IN ('Evening','Special occasion') AND a.category='Dresses') OR (p_occasion IN ('Everyday','Weekend') AND a.category='Tops')) occasion_match
  FROM candidates a JOIN candidates b ON (a.category='Tops' AND b.category='Bottoms') OR (a.category='Dresses' AND b.category='Shoes')
 ), scored AS (
  SELECT *,60+CASE WHEN palette THEN 10 ELSE 0 END+CASE WHEN pref_a THEN 5 ELSE 0 END+CASE WHEN pref_b THEN 5 ELSE 0 END+
   CASE WHEN familiar THEN 5 ELSE 0 END+CASE WHEN occasion_match THEN 5 ELSE 0 END+
   CASE WHEN source='wardrobe' THEN 2 ELSE 0 END+CASE WHEN second_source='wardrobe' THEN 2 ELSE 0 END score
  FROM pairs
 ), ranked AS (
  SELECT *,row_number() OVER(ORDER BY score DESC,source,id,second_source,second_id) rank FROM scored
  ORDER BY score DESC,source,id,second_source,second_id LIMIT p_limit
 )
 INSERT INTO app_private.recommendation_results(request_id,owner_id,rank,items,score,reasons)
 SELECT run.id,app_private.request_subject(),rank,jsonb_build_array(
  jsonb_build_object('source',source,'garmentId',id,'name',name,'category',category,'color',color),
  jsonb_build_object('source',second_source,'garmentId',second_id,'name',second_name,'category',second_category,'color',second_color)),score,
  array_remove(ARRAY[
   CASE WHEN category='Tops' THEN 'Pairs a top with bottoms (+60).' ELSE 'Pairs a dress with shoes (+60).' END,
   CASE WHEN palette THEN 'Matching colours or a neutral colour earn a palette bonus (+10).' END,
   CASE WHEN pref_a OR pref_b THEN 'Garment text matches your style or request preferences (+'||(CASE WHEN pref_a THEN 5 ELSE 0 END+CASE WHEN pref_b THEN 5 ELSE 0 END)::text||').' END,
   CASE WHEN familiar THEN 'You saved this category pair for the same occasion (+5).' END,
   CASE WHEN occasion_match THEN 'This category pair matches the explicit occasion rule (+5).' END,
   CASE WHEN source='wardrobe' OR second_source='wardrobe' THEN 'Prioritises pieces already in your wardrobe (+'||(CASE WHEN source='wardrobe' THEN 2 ELSE 0 END+CASE WHEN second_source='wardrobe' THEN 2 ELSE 0 END)::text||').' END
  ],NULL) FROM ranked;
 SELECT coalesce(jsonb_agg(app_private.recommendation_record(r,run) ORDER BY rank),'[]'::jsonb) INTO result
 FROM app_private.recommendation_results r WHERE request_id=run.id AND owner_id=app_private.request_subject() AND app_private.recommendation_visible(r.items);
 RETURN jsonb_build_object('items',result,'nextCursor',NULL);
END; $$;
ALTER FUNCTION app_private.generate_recommendations(text,text,boolean,integer) OWNER TO dd_user_executor;

CREATE FUNCTION app_private.recent_recommendations(p_limit integer DEFAULT 10) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT app_private.current_account_active() THEN RAISE EXCEPTION 'Account access denied' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid history limit' USING ERRCODE='22023'; END IF;
 -- Bound history examination as well as returned rows. Old invisible results are not scanned indefinitely.
 SELECT coalesce(jsonb_agg(record ORDER BY created_at DESC,request_id DESC,rank),'[]'::jsonb) INTO result FROM (
  SELECT app_private.recommendation_record(r,q) record,q.created_at,q.id request_id,r.rank
  FROM (SELECT * FROM app_private.recommendation_requests WHERE owner_id=app_private.request_subject() ORDER BY created_at DESC,id DESC LIMIT 20) q
  JOIN app_private.recommendation_results r ON r.request_id=q.id AND r.owner_id=q.owner_id
  WHERE app_private.recommendation_visible(r.items) ORDER BY q.created_at DESC,q.id DESC,r.rank LIMIT p_limit
 ) recent;
 RETURN jsonb_build_object('items',result,'nextCursor',NULL);
END; $$;
ALTER FUNCTION app_private.recent_recommendations(integer) OWNER TO dd_user_executor;
CREATE FUNCTION api.generate_recommendations(p_occasion text,p_preferences text DEFAULT '',p_wardrobe_only boolean DEFAULT true,p_limit integer DEFAULT 5) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.generate_recommendations(p_occasion,p_preferences,p_wardrobe_only,p_limit); $$;
CREATE FUNCTION api.recent_recommendations(p_limit integer DEFAULT 10) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.recent_recommendations(p_limit); $$;
DO $permissions$
DECLARE func regprocedure;
BEGIN
 FOR func IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('api','app_private') AND p.proname IN ('generate_recommendations','recent_recommendations','recommendation_record','recommendation_visible') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',func);
  IF func::text LIKE '%generate_recommendations(%' OR func::text LIKE '%recent_recommendations(%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',func); END IF;
 END LOOP;
END; $permissions$;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
