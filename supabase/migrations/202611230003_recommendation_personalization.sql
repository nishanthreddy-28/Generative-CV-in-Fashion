-- Structured personalization and owner-scoped recommendation feedback.
-- Additive local migration; do not apply to hosted Supabase without review.
BEGIN;

ALTER TABLE app_private.user_preferences
 ADD COLUMN style_tags text[] NOT NULL DEFAULT '{}',
 ADD COLUMN color_tags text[] NOT NULL DEFAULT '{}',
 ADD COLUMN preferred_occasions text[] NOT NULL DEFAULT '{}',
 ADD COLUMN catalog_budget_min numeric(10,2),
 ADD COLUMN catalog_budget_max numeric(10,2),
 ADD CONSTRAINT style_tags_count CHECK (cardinality(style_tags) <= 20),
 ADD CONSTRAINT color_tags_count CHECK (cardinality(color_tags) <= 20),
 ADD CONSTRAINT preferred_occasions_count CHECK (cardinality(preferred_occasions) <= 5),
 ADD CONSTRAINT catalog_budget_min_range CHECK (catalog_budget_min IS NULL OR catalog_budget_min BETWEEN 0 AND 1000000),
 ADD CONSTRAINT catalog_budget_max_range CHECK (catalog_budget_max IS NULL OR catalog_budget_max BETWEEN 0 AND 1000000),
 ADD CONSTRAINT catalog_budget_range CHECK (catalog_budget_min IS NULL OR catalog_budget_max IS NULL OR catalog_budget_min <= catalog_budget_max);
GRANT UPDATE(style_tags,color_tags,preferred_occasions,catalog_budget_min,catalog_budget_max)
 ON app_private.user_preferences TO dd_user_executor;
ALTER TABLE app_private.recommendation_requests
 ADD COLUMN personalization_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD CONSTRAINT recommendation_personalization_snapshot_object CHECK (jsonb_typeof(personalization_snapshot)='object');
GRANT INSERT(owner_id,occasion,preferences,wardrobe_only,result_limit,personalization_snapshot)
 ON app_private.recommendation_requests TO dd_user_executor;

CREATE TABLE app_private.recommendation_feedback (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 recommendation_id uuid NOT NULL,
 sentiment text NOT NULL CHECK (sentiment IN ('like','dislike')),
 reason_code text NOT NULL CHECK (reason_code IN (
  'matches_style','color_pairing','occasion_match','already_owned',
  'not_my_style','color_mismatch','wrong_occasion','not_relevant','other')),
 note varchar(1000) NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 FOREIGN KEY (recommendation_id,owner_id)
  REFERENCES app_private.recommendation_results(id,owner_id) ON DELETE CASCADE,
 UNIQUE(owner_id,recommendation_id)
);
CREATE INDEX recommendation_feedback_owner_recent
 ON app_private.recommendation_feedback(owner_id,updated_at DESC,recommendation_id DESC);
ALTER TABLE app_private.recommendation_feedback OWNER TO dd_owner;
ALTER TABLE app_private.recommendation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.recommendation_feedback FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.recommendation_feedback FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON app_private.recommendation_feedback TO dd_user_executor;
CREATE POLICY recommendation_feedback_owner ON app_private.recommendation_feedback TO dd_user_executor
 USING(owner_id=app_private.request_subject() AND app_private.current_account_active())
 WITH CHECK(owner_id=app_private.request_subject() AND app_private.current_account_active());

GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
CREATE FUNCTION app_private.read_personalization_preferences() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE pref app_private.user_preferences%ROWTYPE; fit_value text;
BEGIN
 PERFORM app_private.require_active_account();
 SELECT * INTO pref FROM app_private.user_preferences WHERE user_id=app_private.request_subject();
 IF NOT FOUND THEN RAISE EXCEPTION 'Preferences are not initialized' USING ERRCODE='55000'; END IF;
 SELECT fit INTO fit_value FROM app_private.body_profiles WHERE user_id=app_private.request_subject();
 RETURN jsonb_build_object('styleTags',to_jsonb(pref.style_tags),'colorTags',to_jsonb(pref.color_tags),
  'preferredFit',fit_value,'preferredOccasions',to_jsonb(pref.preferred_occasions),
  'budgetMin',pref.catalog_budget_min,'budgetMax',pref.catalog_budget_max,'currency','INR');
END;
$$;
ALTER FUNCTION app_private.read_personalization_preferences() OWNER TO dd_user_executor;

CREATE FUNCTION app_private.update_personalization_preferences(p_changes jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE key text; item jsonb; item_text text; arr text[]; seen text[]; min_value numeric; max_value numeric;
BEGIN
 PERFORM app_private.require_active_account();
 IF jsonb_typeof(p_changes) IS DISTINCT FROM 'object' OR p_changes='{}'::jsonb THEN
  RAISE EXCEPTION 'Invalid preference changes' USING ERRCODE='22023';
 END IF;
 FOR key,item IN SELECT entry.key,entry.value FROM jsonb_each(p_changes) AS entry(key,value) LOOP
  IF key IN ('styleTags','colorTags') THEN
   IF jsonb_typeof(item)<>'array' OR jsonb_array_length(item)>20 THEN RAISE EXCEPTION 'Invalid preference tags' USING ERRCODE='22023'; END IF;
   arr:='{}'; seen:='{}';
   FOR item_text IN SELECT value #>> '{}' FROM jsonb_array_elements(item) AS value LOOP
    IF item_text IS NULL OR btrim(item_text)='' OR char_length(btrim(item_text))>40
      OR lower(btrim(item_text))=ANY(seen) THEN RAISE EXCEPTION 'Invalid preference tags' USING ERRCODE='22023'; END IF;
    arr:=array_append(arr,btrim(item_text)); seen:=array_append(seen,lower(btrim(item_text)));
   END LOOP;
  ELSIF key='preferredOccasions' THEN
   IF jsonb_typeof(item)<>'array' OR jsonb_array_length(item)>5 THEN RAISE EXCEPTION 'Invalid preferred occasions' USING ERRCODE='22023'; END IF;
   arr:='{}'; seen:='{}';
   FOR item_text IN SELECT value #>> '{}' FROM jsonb_array_elements(item) AS value LOOP
    IF item_text NOT IN ('Everyday','Work','Evening','Weekend','Special occasion') OR item_text=ANY(seen) THEN
      RAISE EXCEPTION 'Invalid preferred occasions' USING ERRCODE='22023';
    END IF;
    arr:=array_append(arr,item_text); seen:=array_append(seen,item_text);
   END LOOP;
  ELSIF key='preferredFit' THEN
   IF jsonb_typeof(item) NOT IN ('string','null') OR (jsonb_typeof(item)='string' AND item #>> '{}' NOT IN ('Fitted','Regular','Relaxed','Oversized')) THEN
    RAISE EXCEPTION 'Invalid fit preference' USING ERRCODE='22023';
   END IF;
  ELSIF key IN ('budgetMin','budgetMax') THEN
   IF jsonb_typeof(item) NOT IN ('number','null') OR (jsonb_typeof(item)='number' AND
    ((item #>> '{}')::numeric NOT BETWEEN 0 AND 1000000 OR scale((item #>> '{}')::numeric)>2)) THEN
    RAISE EXCEPTION 'Invalid catalog budget' USING ERRCODE='22023';
   END IF;
  ELSE
   RAISE EXCEPTION 'Unknown personalization field' USING ERRCODE='22023';
  END IF;
 END LOOP;
 SELECT catalog_budget_min,catalog_budget_max INTO min_value,max_value
  FROM app_private.user_preferences WHERE user_id=app_private.request_subject() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Preferences are not initialized' USING ERRCODE='55000'; END IF;
 IF p_changes ? 'budgetMin' THEN min_value:=CASE WHEN jsonb_typeof(p_changes->'budgetMin')='null' THEN NULL ELSE (p_changes->>'budgetMin')::numeric END; END IF;
 IF p_changes ? 'budgetMax' THEN max_value:=CASE WHEN jsonb_typeof(p_changes->'budgetMax')='null' THEN NULL ELSE (p_changes->>'budgetMax')::numeric END; END IF;
 IF min_value IS NOT NULL AND max_value IS NOT NULL AND min_value>max_value THEN
  RAISE EXCEPTION 'Minimum budget must not exceed maximum budget' USING ERRCODE='22023';
 END IF;
 UPDATE app_private.user_preferences SET
  style_tags=CASE WHEN p_changes ? 'styleTags' THEN ARRAY(SELECT value #>> '{}' FROM jsonb_array_elements(p_changes->'styleTags') WITH ORDINALITY x(value,n) ORDER BY n) ELSE style_tags END,
  color_tags=CASE WHEN p_changes ? 'colorTags' THEN ARRAY(SELECT value #>> '{}' FROM jsonb_array_elements(p_changes->'colorTags') WITH ORDINALITY x(value,n) ORDER BY n) ELSE color_tags END,
  preferred_occasions=CASE WHEN p_changes ? 'preferredOccasions' THEN ARRAY(SELECT value #>> '{}' FROM jsonb_array_elements(p_changes->'preferredOccasions') WITH ORDINALITY x(value,n) ORDER BY n) ELSE preferred_occasions END,
  catalog_budget_min=min_value,catalog_budget_max=max_value,updated_at=clock_timestamp()
 WHERE user_id=app_private.request_subject();
 IF p_changes ? 'preferredFit' THEN
  UPDATE app_private.body_profiles SET fit=CASE WHEN jsonb_typeof(p_changes->'preferredFit')='null' THEN NULL ELSE p_changes->>'preferredFit' END,
   updated_at=clock_timestamp() WHERE user_id=app_private.request_subject();
  IF NOT FOUND THEN RAISE EXCEPTION 'Body profile bootstrap incomplete' USING ERRCODE='55000'; END IF;
 END IF;
 RETURN app_private.read_personalization_preferences();
END;
$$;
ALTER FUNCTION app_private.update_personalization_preferences(jsonb) OWNER TO dd_user_executor;

CREATE FUNCTION api.read_personalization_preferences() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.read_personalization_preferences();
$$;
CREATE FUNCTION api.update_personalization_preferences(p_changes jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.update_personalization_preferences(p_changes);
$$;

CREATE FUNCTION app_private.recommendation_feedback_record(p_row app_private.recommendation_feedback) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',p_row.id,'recommendationId',p_row.recommendation_id,'sentiment',p_row.sentiment,
  'reasonCode',p_row.reason_code,'note',p_row.note,'createdAt',p_row.created_at,'updatedAt',p_row.updated_at)
$$;
ALTER FUNCTION app_private.recommendation_feedback_record(app_private.recommendation_feedback) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.upsert_recommendation_feedback(p_id uuid,p_sentiment text,p_reason_code text,p_note text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE row app_private.recommendation_feedback%ROWTYPE;
BEGIN
 PERFORM app_private.require_active_account();
 IF p_id IS NULL OR p_sentiment NOT IN ('like','dislike') OR p_reason_code NOT IN (
  'matches_style','color_pairing','occasion_match','already_owned','not_my_style','color_mismatch','wrong_occasion','not_relevant','other')
  OR p_note IS NULL OR char_length(p_note)>1000 THEN
  RAISE EXCEPTION 'Invalid recommendation feedback' USING ERRCODE='22023';
 END IF;
 INSERT INTO app_private.recommendation_feedback(owner_id,recommendation_id,sentiment,reason_code,note)
 VALUES(app_private.request_subject(),p_id,p_sentiment,p_reason_code,btrim(p_note))
 ON CONFLICT(owner_id,recommendation_id) DO UPDATE SET sentiment=excluded.sentiment,reason_code=excluded.reason_code,
  note=excluded.note,updated_at=clock_timestamp() RETURNING * INTO row;
 RETURN app_private.recommendation_feedback_record(row);
END;
$$;
ALTER FUNCTION app_private.upsert_recommendation_feedback(uuid,text,text,text) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.list_recommendation_feedback(p_limit integer DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid feedback limit' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(app_private.recommendation_feedback_record(f) ORDER BY f.updated_at DESC,f.recommendation_id DESC),'[]'::jsonb)
 INTO result FROM (SELECT * FROM app_private.recommendation_feedback WHERE owner_id=app_private.request_subject()
  ORDER BY updated_at DESC,recommendation_id DESC LIMIT p_limit) f;
 RETURN jsonb_build_object('items',result);
END;
$$;
ALTER FUNCTION app_private.list_recommendation_feedback(integer) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.delete_recommendation_feedback(p_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM app_private.require_active_account();
 DELETE FROM app_private.recommendation_feedback WHERE owner_id=app_private.request_subject() AND recommendation_id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Feedback not found' USING ERRCODE='P0002'; END IF;
END;
$$;
ALTER FUNCTION app_private.delete_recommendation_feedback(uuid) OWNER TO dd_user_executor;
CREATE FUNCTION api.upsert_recommendation_feedback(p_id uuid,p_sentiment text,p_reason_code text,p_note text DEFAULT '') RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.upsert_recommendation_feedback(p_id,p_sentiment,p_reason_code,p_note); $$;
CREATE FUNCTION api.list_recommendation_feedback(p_limit integer DEFAULT 50) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.list_recommendation_feedback(p_limit); $$;
CREATE FUNCTION api.delete_recommendation_feedback(p_id uuid) RETURNS void
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.delete_recommendation_feedback(p_id); $$;

-- Keep the public recommendation request shape unchanged. The deterministic
-- engine reads saved preferences within the same authenticated user transaction.
CREATE OR REPLACE FUNCTION app_private.generate_recommendations(p_occasion text,p_preferences text DEFAULT '',p_wardrobe_only boolean DEFAULT true,p_limit integer DEFAULT 5) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE run app_private.recommendation_requests%ROWTYPE; result jsonb; style_text text;
 style_tags_value text[]; color_tags_value text[]; preferred_occasions_value text[];
 budget_min_value numeric; budget_max_value numeric; fit_value text;
BEGIN
 PERFORM app_private.require_active_account();
 IF p_occasion IS NULL OR p_occasion NOT IN ('Everyday','Work','Evening','Weekend','Special occasion') OR p_preferences IS NULL OR char_length(p_preferences)>2000
  OR p_wardrobe_only IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Invalid recommendation request' USING ERRCODE='22023'; END IF;
 SELECT coalesce(style,'') INTO style_text FROM app_private.user_profiles WHERE user_id=app_private.request_subject();
 SELECT style_tags,color_tags,preferred_occasions,catalog_budget_min,catalog_budget_max INTO
  style_tags_value,color_tags_value,preferred_occasions_value,budget_min_value,budget_max_value
  FROM app_private.user_preferences WHERE user_id=app_private.request_subject();
 SELECT fit INTO fit_value FROM app_private.body_profiles WHERE user_id=app_private.request_subject();
 IF style_tags_value IS NULL THEN RAISE EXCEPTION 'Preferences are not initialized' USING ERRCODE='55000'; END IF;
 INSERT INTO app_private.recommendation_requests(owner_id,occasion,preferences,wardrobe_only,result_limit,personalization_snapshot)
 VALUES(app_private.request_subject(),p_occasion,p_preferences,p_wardrobe_only,p_limit,jsonb_build_object(
  'styleTags',to_jsonb(style_tags_value),'colorTags',to_jsonb(color_tags_value),
  'preferredFit',fit_value,'preferredOccasions',to_jsonb(preferred_occasions_value),
  'budgetMin',budget_min_value,'budgetMax',budget_max_value,'currency','INR')) RETURNING * INTO run;
 WITH wardrobe AS MATERIALIZED (
  SELECT id,name,category,coalesce(color,'') color,coalesce(brand,'') brand,coalesce(material,'') material,'wardrobe'::text source
  FROM app_private.wardrobe_garments WHERE owner_id=app_private.request_subject() AND category IN ('Tops','Bottoms','Dresses','Shoes') ORDER BY created_at DESC,id DESC LIMIT 40
 ), catalog AS MATERIALIZED (
  SELECT id,name,category,coalesce(color,'') color,coalesce(brand,'') brand,coalesce(material,'') material,'catalog'::text source
  FROM app_private.catalog_garments WHERE NOT p_wardrobe_only AND active AND category IN ('Tops','Bottoms','Dresses','Shoes')
   AND (budget_min_value IS NULL OR price IS NOT NULL AND price>=budget_min_value)
   AND (budget_max_value IS NULL OR price IS NOT NULL AND price<=budget_max_value)
  ORDER BY created_at DESC,id DESC LIMIT 40
 ), candidates AS MATERIALIZED (SELECT * FROM wardrobe UNION ALL SELECT * FROM catalog),
 tokens AS MATERIALIZED (
  SELECT DISTINCT word FROM regexp_split_to_table(lower(coalesce(style_text,'')||' '||array_to_string(style_tags_value,' ')||' '||array_to_string(color_tags_value,' ')||' '||p_preferences),'[^[:alnum:]]+') word
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
   (((p_occasion IN ('Evening','Special occasion') AND a.category='Dresses') OR (p_occasion IN ('Everyday','Weekend') AND a.category='Tops'))
    OR p_occasion=ANY(preferred_occasions_value)) occasion_match
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
   CASE WHEN occasion_match THEN 'This pair matches a preferred or supported occasion rule (+5).' END,
   CASE WHEN source='wardrobe' OR second_source='wardrobe' THEN 'Prioritises pieces already in your wardrobe (+'||(CASE WHEN source='wardrobe' THEN 2 ELSE 0 END+CASE WHEN second_source='wardrobe' THEN 2 ELSE 0 END)::text||').' END
  ],NULL) FROM ranked;
 SELECT coalesce(jsonb_agg(app_private.recommendation_record(r,run) ORDER BY rank),'[]'::jsonb) INTO result
 FROM app_private.recommendation_results r WHERE request_id=run.id AND owner_id=app_private.request_subject() AND app_private.recommendation_visible(r.items);
 RETURN jsonb_build_object('items',result,'nextCursor',NULL);
END; $$;

REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
DO $$ DECLARE f regprocedure;
BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='app_private' AND p.proname IN ('read_personalization_preferences','update_personalization_preferences',
   'recommendation_feedback_record','upsert_recommendation_feedback','list_recommendation_feedback','delete_recommendation_feedback') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated,dd_user_executor',f);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='api' AND p.proname IN ('read_personalization_preferences','update_personalization_preferences',
   'upsert_recommendation_feedback','list_recommendation_feedback','delete_recommendation_feedback') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,service_role,dd_user_executor',f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f);
 END LOOP;
END; $$;

NOTIFY pgrst,'reload schema';
COMMIT;
