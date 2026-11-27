-- Preferences and feedback reads acquire the account lifecycle lock.
-- Match PostgREST transaction access to this existing locking requirement.
BEGIN;
ALTER FUNCTION app_private.read_personalization_preferences() VOLATILE;
ALTER FUNCTION api.read_personalization_preferences() VOLATILE;
ALTER FUNCTION app_private.list_recommendation_feedback(integer) VOLATILE;
ALTER FUNCTION api.list_recommendation_feedback(integer) VOLATILE;
NOTIFY pgrst, 'reload schema';
COMMIT;
