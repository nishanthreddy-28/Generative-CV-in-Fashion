-- Confirmed photo observations are separate from manual circumferences.
-- Receipts are opaque, signed by the application API, and verified again on read.
BEGIN;
CREATE TABLE app_private.pose_analyses (
 image_id uuid PRIMARY KEY REFERENCES app_private.body_profile_versions(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 receipt text NOT NULL CHECK(length(receipt) BETWEEN 1 AND 16384),
 reviewed jsonb NOT NULL CHECK(jsonb_typeof(reviewed)='object'),
 body_height numeric,
 body_units text,
 confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE app_private.pose_analyses OWNER TO dd_owner;
ALTER TABLE app_private.pose_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.pose_analyses FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.pose_analyses FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON app_private.pose_analyses TO dd_user_executor;
CREATE POLICY pose_owner ON app_private.pose_analyses TO dd_user_executor
 USING(owner_id=(SELECT app_private.request_subject()) AND (SELECT app_private.current_account_active()))
 WITH CHECK(owner_id=(SELECT app_private.request_subject()) AND (SELECT app_private.current_account_active()));
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
CREATE FUNCTION app_private.save_pose_analysis(p_image_id uuid,p_receipt text,p_reviewed jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE field text; value jsonb; profile app_private.body_profiles%ROWTYPE;
BEGIN
 PERFORM app_private.require_active_account();
 PERFORM 1 FROM app_private.body_profile_versions WHERE id=p_image_id AND state IN ('ready','reviewed') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Photo unavailable' USING ERRCODE='P0002'; END IF;
 IF NOT coalesce((app_private.onboarding_image(p_image_id)->>'present')::boolean,false) THEN
  RAISE EXCEPTION 'Photo unavailable' USING ERRCODE='P0002'; END IF;
 IF p_receipt IS NULL OR length(p_receipt) NOT BETWEEN 1 AND 16384 OR p_reviewed IS NULL
  OR jsonb_typeof(p_reviewed)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(p_reviewed))<>4 THEN
  RAISE EXCEPTION 'Invalid analysis confirmation' USING ERRCODE='22023'; END IF;
 FOR field,value IN SELECT * FROM jsonb_each(p_reviewed) LOOP
  IF jsonb_typeof(value)<>'number' THEN RAISE EXCEPTION 'Invalid observation' USING ERRCODE='22023'; END IF;
  IF field='shoulder_hip_ratio' THEN
   IF (value#>>'{}')::numeric NOT BETWEEN 0.300001 AND 3.999999 THEN RAISE EXCEPTION 'Invalid ratio' USING ERRCODE='22023'; END IF;
  ELSIF field='shoulder_landmark_span_cm' THEN
   IF (value#>>'{}')::numeric<=5 OR (value#>>'{}')::numeric>=110 THEN RAISE EXCEPTION 'Invalid span' USING ERRCODE='22023'; END IF;
  ELSIF field='clothed_waist_front_width_cm' THEN
   IF (value#>>'{}')::numeric<=5 OR (value#>>'{}')::numeric>=150 THEN RAISE EXCEPTION 'Invalid width' USING ERRCODE='22023'; END IF;
  ELSIF field='torso_landmark_length_cm' THEN
   IF (value#>>'{}')::numeric<=5 OR (value#>>'{}')::numeric>=120 THEN RAISE EXCEPTION 'Invalid length' USING ERRCODE='22023'; END IF;
  ELSE RAISE EXCEPTION 'Invalid observation field' USING ERRCODE='22023';
  END IF;
 END LOOP;
 SELECT * INTO profile FROM app_private.body_profiles WHERE user_id=app_private.request_subject() FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable' USING ERRCODE='P0002'; END IF;
 INSERT INTO app_private.pose_analyses(image_id,owner_id,receipt,reviewed,body_height,body_units)
 VALUES(p_image_id,app_private.request_subject(),p_receipt,p_reviewed,profile.height,profile.units)
 ON CONFLICT(image_id) DO UPDATE SET receipt=excluded.receipt,reviewed=excluded.reviewed,
  body_height=excluded.body_height,body_units=excluded.body_units,confirmed_at=clock_timestamp();
 RETURN jsonb_build_object('saved',true);
END;$$;
ALTER FUNCTION app_private.save_pose_analysis(uuid,text,jsonb) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.read_pose_analysis(p_image_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 SELECT jsonb_build_object('imageId',a.image_id,'receipt',a.receipt,'reviewed',a.reviewed,'confirmedAt',a.confirmed_at)
 INTO result FROM app_private.pose_analyses a JOIN app_private.body_profile_versions v ON v.id=a.image_id
 JOIN app_private.body_profiles p ON p.user_id=a.owner_id
 WHERE a.image_id=p_image_id AND v.state IN ('ready','reviewed')
 AND p.height IS NOT DISTINCT FROM a.body_height AND p.units IS NOT DISTINCT FROM a.body_units;
 RETURN result;
END;$$;
ALTER FUNCTION app_private.read_pose_analysis(uuid) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.invalidate_pose_analysis() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.height IS DISTINCT FROM OLD.height OR NEW.units IS DISTINCT FROM OLD.units THEN
  DELETE FROM app_private.pose_analyses WHERE owner_id=NEW.user_id;
 END IF;
 RETURN NEW;
END;$$;
ALTER FUNCTION app_private.invalidate_pose_analysis() OWNER TO dd_user_executor;
CREATE TRIGGER body_height_invalidates_pose AFTER UPDATE OF height,units ON app_private.body_profiles
 FOR EACH ROW EXECUTE FUNCTION app_private.invalidate_pose_analysis();
REVOKE ALL ON FUNCTION app_private.invalidate_pose_analysis() FROM PUBLIC,anon,authenticated,service_role;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
CREATE FUNCTION api.save_pose_analysis(p_image_id uuid,p_receipt text,p_reviewed jsonb) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.save_pose_analysis(p_image_id,p_receipt,p_reviewed);
$$;
CREATE FUNCTION api.read_pose_analysis(p_image_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.read_pose_analysis(p_image_id);
$$;
REVOKE ALL ON FUNCTION app_private.save_pose_analysis(uuid,text,jsonb),app_private.read_pose_analysis(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.save_pose_analysis(uuid,text,jsonb),app_private.read_pose_analysis(uuid)
 TO authenticated,dd_user_executor;
REVOKE ALL ON FUNCTION api.save_pose_analysis(uuid,text,jsonb),api.read_pose_analysis(uuid)
 FROM PUBLIC,anon,authenticated,service_role,dd_user_executor;
GRANT EXECUTE ON FUNCTION api.save_pose_analysis(uuid,text,jsonb),api.read_pose_analysis(uuid) TO authenticated;
COMMIT;
