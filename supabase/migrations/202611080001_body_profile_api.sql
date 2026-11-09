-- Body editor API extension. Apply only after separate deployment approval.
-- Uses the existing table, owner policies and lifecycle locks; no service-role path.
BEGIN;

GRANT SELECT ON app_private.body_profiles TO dd_user_executor;
GRANT UPDATE (units,height,chest,waist,hips,inseam,body_shape,skin_tone,undertone,fit,updated_at)
 ON app_private.body_profiles TO dd_user_executor;
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;

CREATE FUNCTION app_private.read_body_profile() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE result jsonb;
BEGIN
 IF NOT app_private.current_account_active() THEN
  RAISE EXCEPTION 'Account access denied' USING ERRCODE = '42501';
 END IF;
 SELECT jsonb_build_object(
  'units',coalesce(units,''),'height',height,'chest',chest,'waist',waist,'hips',hips,'inseam',inseam,
  'bodyShape',coalesce(body_shape,''),'skinTone',coalesce(skin_tone,''),
  'undertone',coalesce(undertone,''),'fit',coalesce(fit,'')) INTO result
 FROM app_private.body_profiles WHERE user_id = app_private.request_subject();
 IF result IS NULL THEN
  RAISE EXCEPTION 'Body profile not found' USING ERRCODE = 'P0002';
 END IF;
 RETURN result;
END;
$fn$;
ALTER FUNCTION app_private.read_body_profile() OWNER TO dd_user_executor;

CREATE FUNCTION app_private.update_body_profile(p_changes jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
 previous app_private.body_profiles%ROWTYPE;
 field_name text;
 field_value jsonb;
 measurement numeric;
 next_units text;
BEGIN
 PERFORM app_private.require_active_account();
 IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' THEN
  RAISE EXCEPTION 'Invalid body fields' USING ERRCODE = '22023';
 END IF;
 -- Validate inside SQL as well: direct Data API RPC calls bypass FastAPI.
 FOR field_name,field_value IN SELECT key,value FROM jsonb_each(p_changes) LOOP
  IF field_name NOT IN ('units','height','chest','waist','hips','inseam','bodyShape','skinTone','undertone','fit') THEN
   RAISE EXCEPTION 'Invalid body fields' USING ERRCODE = '22023';
  END IF;
  IF field_name IN ('height','chest','waist','hips','inseam') THEN
   IF field_value <> 'null'::jsonb THEN
    IF jsonb_typeof(field_value) <> 'number' THEN
     RAISE EXCEPTION 'Invalid measurement' USING ERRCODE = '22023';
    END IF;
    measurement := (field_value #>> '{}')::numeric;
    IF measurement < 1 OR measurement > 300 OR measurement <> trunc(measurement,4) THEN
     RAISE EXCEPTION 'Invalid measurement' USING ERRCODE = '22023';
    END IF;
   END IF;
  ELSE
   IF field_value <> 'null'::jsonb AND jsonb_typeof(field_value) <> 'string' THEN
    RAISE EXCEPTION 'Invalid body fields' USING ERRCODE = '22023';
   END IF;
   IF char_length(field_value #>> '{}') > 200 THEN
    RAISE EXCEPTION 'Invalid body fields' USING ERRCODE = '22023';
   END IF;
   IF field_name = 'units' AND field_value <> 'null'::jsonb AND (field_value #>> '{}') NOT IN ('cm','in') THEN
    RAISE EXCEPTION 'Invalid body units' USING ERRCODE = '22023';
   END IF;
   IF field_name = 'undertone' AND field_value <> 'null'::jsonb AND (field_value #>> '{}') NOT IN ('','Warm','Cool','Neutral','Not sure') THEN
    RAISE EXCEPTION 'Invalid body undertone' USING ERRCODE = '22023';
   END IF;
   IF field_name = 'fit' AND field_value <> 'null'::jsonb AND (field_value #>> '{}') NOT IN ('','Fitted','Regular','Relaxed','Oversized') THEN
    RAISE EXCEPTION 'Invalid body fit' USING ERRCODE = '22023';
   END IF;
  END IF;
 END LOOP;

 -- Serialize partial updates before inspecting existing values or replacing units.
 SELECT * INTO previous FROM app_private.body_profiles WHERE user_id = app_private.request_subject() FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Body profile not found' USING ERRCODE = 'P0002';
 END IF;
 IF p_changes = '{}'::jsonb THEN RETURN; END IF;
 next_units := CASE WHEN p_changes ? 'units' THEN p_changes->>'units' ELSE previous.units END;
 IF previous.units IS DISTINCT FROM next_units THEN
  -- No implicit conversion or reinterpretation of omitted measurements.
  IF (previous.height IS NOT NULL AND NOT (p_changes ? 'height'))
   OR (previous.chest IS NOT NULL AND NOT (p_changes ? 'chest'))
   OR (previous.waist IS NOT NULL AND NOT (p_changes ? 'waist'))
   OR (previous.hips IS NOT NULL AND NOT (p_changes ? 'hips'))
   OR (previous.inseam IS NOT NULL AND NOT (p_changes ? 'inseam')) THEN
   RAISE EXCEPTION 'Unit changes must explicitly replace or clear existing measurements' USING ERRCODE = '22023';
  END IF;
 END IF;
 UPDATE app_private.body_profiles SET
  units = next_units,
  height = CASE WHEN p_changes ? 'height' THEN (p_changes->>'height')::numeric ELSE previous.height END,
  chest = CASE WHEN p_changes ? 'chest' THEN (p_changes->>'chest')::numeric ELSE previous.chest END,
  waist = CASE WHEN p_changes ? 'waist' THEN (p_changes->>'waist')::numeric ELSE previous.waist END,
  hips = CASE WHEN p_changes ? 'hips' THEN (p_changes->>'hips')::numeric ELSE previous.hips END,
  inseam = CASE WHEN p_changes ? 'inseam' THEN (p_changes->>'inseam')::numeric ELSE previous.inseam END,
  body_shape = CASE WHEN p_changes ? 'bodyShape' THEN nullif(btrim(p_changes->>'bodyShape'),'') ELSE previous.body_shape END,
  skin_tone = CASE WHEN p_changes ? 'skinTone' THEN nullif(btrim(p_changes->>'skinTone'),'') ELSE previous.skin_tone END,
  undertone = CASE WHEN p_changes ? 'undertone' THEN nullif(p_changes->>'undertone','') ELSE previous.undertone END,
  fit = CASE WHEN p_changes ? 'fit' THEN nullif(p_changes->>'fit','') ELSE previous.fit END,
  updated_at = transaction_timestamp()
 WHERE user_id = app_private.request_subject();
END;
$fn$;
ALTER FUNCTION app_private.update_body_profile(jsonb) OWNER TO dd_user_executor;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;

CREATE FUNCTION api.read_body_profile() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
 SELECT app_private.read_body_profile();
$fn$;
CREATE FUNCTION api.update_body_profile(p_changes jsonb) RETURNS void
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $fn$
 SELECT app_private.update_body_profile(p_changes);
$fn$;
REVOKE ALL ON FUNCTION app_private.read_body_profile(),app_private.update_body_profile(jsonb),
 api.read_body_profile(),api.update_body_profile(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.read_body_profile(),app_private.update_body_profile(jsonb),
 api.read_body_profile(),api.update_body_profile(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
