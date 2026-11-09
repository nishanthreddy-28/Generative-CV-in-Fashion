BEGIN;
GRANT CREATE ON SCHEMA app_private TO dd_user_executor,dd_control_executor;
CREATE FUNCTION app_private.update_profile_fields(p_changes jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE item record;previous jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 PERFORM 1 FROM app_private.user_profiles WHERE user_id=app_private.request_subject() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile bootstrap incomplete' USING ERRCODE='55000'; END IF;
 IF p_changes IS NULL OR jsonb_typeof(p_changes)<>'object' THEN RAISE EXCEPTION 'Invalid profile fields' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT * FROM jsonb_each(p_changes) LOOP
  IF item.key NOT IN ('name','style','location','bio') OR jsonb_typeof(item.value)<>'string' OR char_length(item.value #>> '{}')>(CASE WHEN item.key IN ('style','bio') THEN 2000 ELSE 200 END) OR (item.key='name' AND btrim(item.value #>> '{}')='') THEN RAISE EXCEPTION 'Invalid profile fields' USING ERRCODE='22023'; END IF;
 END LOOP;
 previous:=app_private.read_profile()||p_changes;
 UPDATE app_private.user_profiles SET name=btrim(previous->>'name'),style=nullif(btrim(previous->>'style'),''),location=nullif(btrim(previous->>'location'),''),bio=nullif(btrim(previous->>'bio'),''),updated_at=clock_timestamp() WHERE user_id=app_private.request_subject();
END; $$;
ALTER FUNCTION app_private.update_profile_fields(jsonb) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.update_preference_fields(p_changes jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE item record;previous jsonb;
BEGIN
 PERFORM app_private.require_active_account();
 PERFORM 1 FROM app_private.user_preferences WHERE user_id=app_private.request_subject() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Preferences bootstrap incomplete' USING ERRCODE='55000'; END IF;
 IF p_changes IS NULL OR jsonb_typeof(p_changes)<>'object' THEN RAISE EXCEPTION 'Invalid preferences' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT * FROM jsonb_each(p_changes) LOOP
  IF item.key NOT IN ('units','emailNotifications') OR jsonb_typeof(item.value)<>'string' THEN RAISE EXCEPTION 'Invalid preferences' USING ERRCODE='22023'; END IF;
 END LOOP;
 previous:=app_private.read_preferences()||p_changes;
 PERFORM app_private.update_preferences(previous->>'units',previous->>'emailNotifications');
END; $$;
ALTER FUNCTION app_private.update_preference_fields(jsonb) OWNER TO dd_user_executor;
CREATE FUNCTION api.update_profile_fields(p_changes jsonb) RETURNS void LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.update_profile_fields(p_changes); $$;
CREATE FUNCTION api.update_preference_fields(p_changes jsonb) RETURNS void LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.update_preference_fields(p_changes); $$;
REVOKE ALL ON FUNCTION api.update_profile_fields(jsonb),app_private.update_profile_fields(jsonb),api.update_preference_fields(jsonb),app_private.update_preference_fields(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION api.update_profile_fields(jsonb),app_private.update_profile_fields(jsonb),api.update_preference_fields(jsonb),app_private.update_preference_fields(jsonb) TO authenticated;
CREATE FUNCTION app_private.provision_auth_user() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- Supabase Auth has this metadata column; minimal SQL test primitives may not.
 IF to_jsonb(NEW) ? 'raw_user_meta_data' THEN
  PERFORM app_private.bootstrap_user(NEW.id,left(coalesce(to_jsonb(NEW)->'raw_user_meta_data'->>'name',''),200));
 END IF;
 RETURN NEW;
END; $$;
ALTER FUNCTION app_private.provision_auth_user() OWNER TO dd_control_executor;
REVOKE ALL ON FUNCTION app_private.provision_auth_user() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER drapedrop_provision AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION app_private.provision_auth_user();
-- Backfill live identities idempotently, without reactivating disabled/deleting accounts.
DO $$DECLARE subject uuid;BEGIN
 FOR subject IN SELECT id FROM auth.users WHERE NOT EXISTS(SELECT 1 FROM app_private.account_deletion_tombstones WHERE former_subject_id=auth.users.id) LOOP
  PERFORM app_private.bootstrap_user(subject,'');
 END LOOP;
END; $$;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor,dd_control_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
