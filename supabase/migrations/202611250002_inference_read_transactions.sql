-- These reads call require_active_account(), which takes a lifecycle FOR SHARE
-- lock. PostgREST must run the RPC in a read/write transaction even though the
-- result itself is read-only. Keep the lock and all existing access controls.
BEGIN;
ALTER FUNCTION app_private.read_pose_analysis(uuid) VOLATILE;
ALTER FUNCTION api.read_pose_analysis(uuid) VOLATILE;
ALTER FUNCTION app_private.read_ml_sessions(integer,uuid,boolean) VOLATILE;
ALTER FUNCTION api.read_ml_sessions(integer,uuid,boolean) VOLATILE;
ALTER FUNCTION app_private.read_ml_session(uuid) VOLATILE;
ALTER FUNCTION api.read_ml_session(uuid) VOLATILE;
NOTIFY pgrst, 'reload schema';
COMMIT;
