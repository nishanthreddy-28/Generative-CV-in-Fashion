BEGIN;
CREATE TABLE app_private.prepared_garments(garment_id uuid PRIMARY KEY REFERENCES app_private.wardrobe_garments(id) ON DELETE CASCADE,owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,receipt text NOT NULL CHECK(length(receipt)<16384));
ALTER TABLE app_private.prepared_garments OWNER TO dd_owner;
ALTER TABLE app_private.prepared_garments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.prepared_garments FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.prepared_garments FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON app_private.prepared_garments TO dd_user_executor;
CREATE POLICY prepared_owner ON app_private.prepared_garments TO dd_user_executor USING(owner_id=app_private.request_subject() AND app_private.current_account_active()) WITH CHECK(owner_id=app_private.request_subject() AND app_private.current_account_active());
GRANT CREATE ON SCHEMA app_private TO dd_user_executor;
CREATE FUNCTION app_private.save_prepared_garment(p_id uuid,p_receipt text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
PERFORM app_private.require_active_account();PERFORM 1 FROM app_private.wardrobe_garments WHERE id=p_id FOR SHARE;
IF NOT FOUND THEN RAISE EXCEPTION 'Garment unavailable' USING ERRCODE='P0002';END IF;
INSERT INTO app_private.prepared_garments VALUES(p_id,app_private.request_subject(),p_receipt) ON CONFLICT(garment_id) DO UPDATE SET receipt=excluded.receipt;END;$$;
ALTER FUNCTION app_private.save_prepared_garment(uuid,text) OWNER TO dd_user_executor;
CREATE FUNCTION app_private.read_prepared_garment(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN PERFORM app_private.require_active_account();RETURN(SELECT jsonb_build_object('receipt',receipt) FROM app_private.prepared_garments WHERE garment_id=p_id);END;$$;
ALTER FUNCTION app_private.read_prepared_garment(uuid) OWNER TO dd_user_executor;
REVOKE CREATE ON SCHEMA app_private FROM dd_user_executor;
CREATE FUNCTION api.save_prepared_garment(p_id uuid,p_receipt text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.save_prepared_garment(p_id,p_receipt);$$;
CREATE FUNCTION api.read_prepared_garment(p_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.read_prepared_garment(p_id);$$;
REVOKE ALL ON FUNCTION app_private.save_prepared_garment(uuid,text),app_private.read_prepared_garment(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.save_prepared_garment(uuid,text),app_private.read_prepared_garment(uuid) TO authenticated,dd_user_executor;
REVOKE ALL ON FUNCTION api.save_prepared_garment(uuid,text),api.read_prepared_garment(uuid) FROM PUBLIC,anon,authenticated,service_role,dd_user_executor;
GRANT EXECUTE ON FUNCTION api.save_prepared_garment(uuid,text),api.read_prepared_garment(uuid) TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('wardrobe-derived','wardrobe-derived',false,10485760,ARRAY['image/jpeg','image/webp']);
CREATE POLICY derived_objects ON storage.objects FOR ALL TO authenticated USING(bucket_id='wardrobe-derived' AND owner_id::text=app_private.request_subject()::text AND split_part(name,'/',1)=app_private.request_subject()::text AND app_private.current_account_active()) WITH CHECK(bucket_id='wardrobe-derived' AND owner_id::text=app_private.request_subject()::text AND split_part(name,'/',1)=app_private.request_subject()::text AND app_private.current_account_active());
CREATE POLICY derived_select_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'wardrobe-derived' OR (owner_id::text=app_private.request_subject()::text AND split_part(name,'/',1)=app_private.request_subject()::text AND app_private.current_account_active()));
CREATE POLICY derived_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'wardrobe-derived' OR (owner_id::text=app_private.request_subject()::text AND split_part(name,'/',1)=app_private.request_subject()::text AND app_private.current_account_active()));
CREATE POLICY derived_delete_boundary ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'wardrobe-derived' OR (owner_id::text=app_private.request_subject()::text AND split_part(name,'/',1)=app_private.request_subject()::text AND app_private.current_account_active()));
CREATE POLICY derived_immutable ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'wardrobe-derived') WITH CHECK(bucket_id<>'wardrobe-derived');
CREATE POLICY derived_deletion ON storage.objects FOR SELECT TO dd_control_executor USING(bucket_id='wardrobe-derived' AND EXISTS(SELECT 1 FROM app_private.deletion_tasks WHERE subject_id::text=split_part(name,'/',1) AND phase<>'complete'));
CREATE OR REPLACE FUNCTION app_private.deletion_manifest(p_subject uuid,p_lease uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM 1 FROM app_private.deletion_tasks WHERE subject_id=p_subject AND lease=p_lease AND lease_until>clock_timestamp() AND phase<>'complete' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid cleanup lease' USING ERRCODE='42501'; END IF;
 UPDATE app_private.deletion_tasks SET phase='storage',lease_until=clock_timestamp()+interval '5 minutes' WHERE subject_id=p_subject;
 UPDATE app_private.account_deletion_tombstones SET cleanup_stage='purging' WHERE former_subject_id=p_subject;
 SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'object',name)),'[]'::jsonb) INTO result FROM (
  SELECT bucket_id,name FROM storage.objects WHERE bucket_id IN ('wardrobe-images','tryon-inputs','onboarding-body-images','ml-session-images','wardrobe-derived')
   AND split_part(name,'/',1)=p_subject::text ORDER BY bucket_id,name LIMIT 100
 ) objects;
 RETURN result;
END;$$;
CREATE OR REPLACE FUNCTION app_private.prepare_auth_deletion(p_subject uuid,p_lease uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM app_private.deletion_tasks WHERE subject_id=p_subject AND lease=p_lease AND lease_until>clock_timestamp() AND phase<>'complete' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid cleanup lease' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id IN ('wardrobe-images','tryon-inputs','onboarding-body-images','ml-session-images','wardrobe-derived') AND split_part(name,'/',1)=p_subject::text) THEN RETURN false; END IF;
 DELETE FROM app_private.saved_outfits WHERE owner_id=p_subject;
 UPDATE app_private.deletion_tasks SET phase='auth',lease_until=clock_timestamp()+interval '5 minutes' WHERE subject_id=p_subject;
 RETURN true;
END;$$;
COMMIT;
