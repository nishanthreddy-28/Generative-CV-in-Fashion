-- Read-only hosted verification evidence. Run only against the selected development
-- project using a trusted database inspection identity. No user records/secrets read.
BEGIN TRANSACTION READ ONLY;

SELECT current_database() AS database_name, current_user AS inspection_role,
       current_setting('server_version') AS postgres_version;

SELECT nspname AS schema_name, pg_get_userbyid(nspowner) AS schema_owner, nspacl
FROM pg_namespace WHERE nspname IN ('api','app_private');

SELECT rolname, rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
FROM pg_roles WHERE rolname LIKE 'dd\_%' ESCAPE '\' ORDER BY rolname;

SELECT member.rolname AS member_role, granted.rolname AS granted_role, m.admin_option
FROM pg_auth_members m
JOIN pg_roles member ON member.oid=m.member
JOIN pg_roles granted ON granted.oid=m.roleid
WHERE member.rolname LIKE 'dd\_%' ESCAPE '\'
   OR granted.rolname LIKE 'dd\_%' ESCAPE '\'
ORDER BY member_role, granted_role;

-- Include indirect membership; direct grant inspection alone is insufficient.
SELECT caller.rolname AS caller, executor.rolname AS protected_role,
       pg_has_role(caller.oid,executor.oid,'MEMBER') AS can_assume_role
FROM pg_roles caller CROSS JOIN pg_roles executor
WHERE caller.rolname IN ('anon','authenticated','authenticator','service_role')
  AND executor.rolname LIKE 'dd\_%' ESCAPE '\'
ORDER BY caller, protected_role;

SELECT n.nspname AS schema_name, c.relname AS table_name,
       pg_get_userbyid(c.relowner) AS table_owner,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced, c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='app_private' AND c.relkind='r' ORDER BY c.relname;

SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_schema IN ('api','app_private') ORDER BY table_name,grantee,privilege_type;

SELECT grantee, table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema='app_private' ORDER BY table_name,grantee,column_name,privilege_type;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='app_private' OR (schemaname='storage' AND tablename='objects')
ORDER BY schemaname,tablename,policyname;

SELECT n.nspname AS schema_name, p.oid::regprocedure AS function_signature,
       pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS security_definer,
       p.proconfig AS function_settings, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('api','app_private') ORDER BY n.nspname,p.oid::regprocedure::text;

SELECT caller.rolname AS caller, p.oid::regprocedure AS function_signature,
       has_function_privilege(caller.oid,p.oid,'EXECUTE') AS executable
FROM pg_roles caller CROSS JOIN pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE caller.rolname IN ('anon','authenticated','service_role')
  AND n.nspname IN ('api','app_private')
ORDER BY caller.rolname,p.oid::regprocedure::text;

SELECT pg_get_userbyid(d.defaclrole) AS creator_role,
       CASE WHEN d.defaclnamespace=0 THEN '(global)' ELSE n.nspname END AS schema_name,
       d.defaclobjtype AS object_type, d.defaclacl AS privileges
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
WHERE n.nspname IN ('api','app_private') OR d.defaclnamespace=0
ORDER BY creator_role,schema_name,object_type;

-- Catalog structure/constraints only; do not select private application row values.
SELECT c.conrelid::regclass AS table_name, c.conname,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
WHERE n.nspname='app_private' ORDER BY c.conrelid::regclass::text,c.conname;

SELECT c.relname AS storage_relation, c.relrowsecurity AS rls_enabled,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='storage' AND c.relname IN ('objects','buckets');

-- Bucket configuration only: no object paths, images, tokens or personal metadata.
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id;

ROLLBACK;
