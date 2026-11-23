"""Validate reviewed Workflow 01 SQL on disposable local PostgreSQL only.

Uses synthetic identities, an isolated Unix socket and temporary backup files.
No hosted Supabase connection, credential or mutation is used.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import uuid

root = Path(__file__).resolve().parents[2]

def command(args, **kwargs):
    return subprocess.run(args, check=True, text=True, capture_output=True, **kwargs)

with tempfile.TemporaryDirectory(prefix="dd-approval-", dir="/tmp") as temporary:
    data = str(Path(temporary) / "data")
    command(["initdb", "-D", data, "-A", "trust", "--no-locale", "-E", "UTF8"])
    command(["pg_ctl", "-D", data, "-l", str(Path(temporary) / "server.log"),
             "-o", f"-F -k {temporary} -c listen_addresses=", "-w", "start"])
    try:
        base = ["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", temporary]
        def sql(statement, database="postgres"):
            return command([*base, "-d", database, "-At", "-c", statement]).stdout.strip()
        def file(path, database="postgres"):
            command([*base, "-d", database, "-f", str(path)])

        file(root / "backend/tests/database/supabase_test_primitives.sql")
        users = [str(uuid.uuid4()), str(uuid.uuid4())]
        sql("INSERT INTO auth.users(id) VALUES " + ",".join(f"('{u}')" for u in users))
        for migration in sorted((root / "supabase/migrations").glob("*.sql")):
            file(migration)
        assert sql("SELECT count(*) FROM auth.users") == "2"
        assert sql("SELECT count(*) FROM app_private.user_profiles") == "2"
        assert all(sql(f"SELECT count(*) FROM auth.users WHERE id='{u}'") == "1" for u in users)
        print("All 15 migrations parsed/applied. Existing local Auth UUIDs preserved and profiles backfilled.", flush=True)

        metadata = sql("""
          SELECT json_build_object(
            'tables',(SELECT json_agg(json_build_object(
              'table',c.relname,'rls',c.relrowsecurity,'forced',c.relforcerowsecurity,
              'columns',(SELECT json_agg(a.attname ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
              'constraints',(SELECT json_agg(pg_get_constraintdef(k.oid)) FROM pg_constraint k WHERE k.conrelid=c.oid),
              'indexes',(SELECT json_agg(indexdef) FROM pg_indexes i WHERE i.schemaname='app_private' AND i.tablename=c.relname),
              'policies',(SELECT json_agg(json_build_object('name',policyname,'roles',roles,'command',cmd,'using',qual,'check',with_check)) FROM pg_policies p WHERE p.schemaname='app_private' AND p.tablename=c.relname)
            ) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app_private' AND c.relkind='r'),
            'grants',(SELECT json_agg(json_build_object('table',table_name,'grantee',grantee,'privilege',privilege_type)) FROM information_schema.table_privileges WHERE table_schema='app_private'),
            'column_grants',(SELECT json_agg(json_build_object('table',table_name,'column',column_name,'grantee',grantee,'privilege',privilege_type)) FROM information_schema.column_privileges WHERE table_schema='app_private'),
            'storage_policies',(SELECT json_agg(json_build_object('name',policyname,'roles',roles,'command',cmd,'using',qual,'check',with_check)) FROM pg_policies WHERE schemaname='storage'),
            'functions',(SELECT json_agg(json_build_object('schema',n.nspname,'name',p.proname,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('api','app_private'))
          )
        """)
        parsed = json.loads(metadata)
        assert len(parsed["tables"]) == 18
        assert all(t["rls"] and t["forced"] for t in parsed["tables"])
        assert all(not f["anon_execute"] for f in parsed["functions"])
        Path("/tmp/dd-approval-foundation-metadata.json").write_text(json.dumps(parsed, indent=2))
        print("18 tables have forced RLS. Anonymous execution on all application functions denied.", flush=True)

        dump = Path(temporary) / "synthetic.dump"
        command(["pg_dump", "-h", temporary, "-d", "postgres", "-Fc", "-f", str(dump)])
        sql("CREATE DATABASE restored")
        command(["pg_restore", "-h", temporary, "-d", "restored", "--exit-on-error", str(dump)])
        assert sql("SELECT count(*) FROM auth.users", "restored") == "2"
        assert sql("SELECT count(*) FROM app_private.user_profiles", "restored") == "2"
        print("Synthetic full-database dump/restore passed in a second local database. Hosted recovery not certified.", flush=True)

        file(root / "docs/workflows/sql/WORKFLOW_01_REGISTRATION_STORAGE.sql")
        subject = users[0]
        challenge = str(uuid.uuid4())
        sql(f"""INSERT INTO app_private.registration_challenges(
          id,user_id,email_binding_mac,session_binding_hash,link_hash,otp_mac,expires_at
        ) VALUES('{challenge}','{subject}',decode(repeat('11',32),'hex'),
          decode(repeat('22',32),'hex'),decode(repeat('33',32),'hex'),decode(repeat('44',32),'hex'),
          clock_timestamp()+interval '9 minutes')""")
        for table in ("registration_challenges", "registration_receipts", "registration_rate_windows"):
            for role in ("anon", "authenticated", "service_role", "dd_user_executor", "dd_owner"):
                result = subprocess.run([*base, "-d", "postgres", "-c",
                    f"SET ROLE {role}; SELECT * FROM app_private.{table}"],
                    text=True, capture_output=True)
                # The owner has SQL privileges, but forced RLS hides every row.
                if role == "dd_owner":
                    assert result.returncode == 0 and "(0 rows)" in result.stdout
                else:
                    assert result.returncode != 0
        invalid = [
            f"UPDATE app_private.registration_challenges SET expires_at=issued_at+interval '11 minutes' WHERE id='{challenge}'",
            f"UPDATE app_private.registration_challenges SET invalid_attempts=6 WHERE id='{challenge}'",
            f"UPDATE app_private.registration_challenges SET state='complete' WHERE id='{challenge}'",
            f"UPDATE app_private.registration_challenges SET otp_verified_at=clock_timestamp() WHERE id='{challenge}'",
        ]
        for statement in invalid:
            result = subprocess.run([*base,"-d","postgres","-c",statement],text=True,capture_output=True)
            assert result.returncode != 0
        duplicate = subprocess.run([*base, "-d", "postgres", "-c",
            f"""INSERT INTO app_private.registration_challenges(
              user_id,email_binding_mac,session_binding_hash,link_hash,otp_mac,expires_at
            ) SELECT user_id,email_binding_mac,session_binding_hash,link_hash,otp_mac,expires_at
              FROM app_private.registration_challenges WHERE id='{challenge}'"""],
            text=True, capture_output=True)
        assert duplicate.returncode != 0
        sql(f"""WITH instant AS MATERIALIZED (SELECT clock_timestamp() AS at)
          UPDATE app_private.registration_challenges SET state='complete',
            link_verified_at=instant.at,otp_verified_at=instant.at,
            finalization_started_at=instant.at,auth_confirmed_at=instant.at,
            completed_at=instant.at FROM instant WHERE id='{challenge}'""")
        wrong_owner = subprocess.run([*base, "-d", "postgres", "-c",
            f"""INSERT INTO app_private.registration_receipts
              VALUES('{users[1]}','{challenge}','dual_email',clock_timestamp())"""],
            text=True, capture_output=True)
        assert wrong_owner.returncode != 0
        sql(f"""INSERT INTO app_private.registration_receipts
          VALUES('{subject}','{challenge}','dual_email',clock_timestamp())""")
        sql(f"DELETE FROM auth.users WHERE id='{subject}'")
        assert sql("SELECT count(*) FROM app_private.registration_challenges") == "0"
        assert sql("SELECT count(*) FROM app_private.registration_receipts") == "0"
        print("Draft registration storage SQL passed expiry, attempt, ordered-proof, completion, grants/RLS and Auth cascade checks.", flush=True)
    finally:
        command(["pg_ctl", "-D", data, "-m", "immediate", "-w", "stop"])
