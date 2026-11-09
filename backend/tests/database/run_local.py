"""Create a fresh temporary PostgreSQL cluster, apply migration, run isolation tests, stop.

Requires initdb, pg_ctl and psql on PATH. Uses a Unix socket only, no hosted database.
Execute with backend/.venv/bin/python backend/tests/database/run_local.py.
"""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[3]


def main():
    for binary in ('initdb','pg_ctl','psql'):
        if not shutil.which(binary):
            raise SystemExit(f'{binary} is required; install PostgreSQL development tools first.')
    with tempfile.TemporaryDirectory(prefix='dd-pg-', dir='/tmp') as temporary:
        data = str(Path(temporary) / 'data')
        candidate = '--hosted-candidate' in sys.argv
        migrations = ROOT / 'supabase/migrations'
        registration = migrations
        if candidate:
            migrations = registration = Path(temporary) / 'hosted-candidate'
            subprocess.run([sys.executable, str(ROOT / 'supabase/verification/prepare_hosted_candidate.py'),
                            str(migrations)], check=True)
        started = False
        try:
            subprocess.run(['initdb','-D',data,'-A','trust','--no-locale','-E','UTF8'],check=True,stdout=subprocess.DEVNULL)
            subprocess.run(['pg_ctl','-D',data,'-l',str(Path(temporary)/'server.log'),'-o',f"-F -k {temporary} -c listen_addresses=",'-w','start'],check=True,stdout=subprocess.DEVNULL)
            started = True
            ordered_migrations = sorted(migrations.glob('[0-9]*.sql'))
            foundation_migrations = [path for path in ordered_migrations if path.name < '202611090008']
            later_migrations = [path for path in ordered_migrations if path.name >= '202611090008']
            for path in [ROOT/'backend/tests/database/supabase_test_primitives.sql', *foundation_migrations]:
                subprocess.run(['psql','-X','-q','-v','ON_ERROR_STOP=1','-h',temporary,'-d','postgres','-f',str(path)],check=True)
            environment = {**os.environ,'DD_TEST_PG_SOCKET':temporary,'DD_TEST_HOSTED_CANDIDATE':'1'}
            if candidate:
                environment['DD_TEST_HOSTED_CANDIDATE']='1'
            result = subprocess.call([sys.executable,'-m','pytest','-q','tests/test_foundation_database.py',
                                    'tests/test_body_profile_database.py','tests/test_wardrobe_database.py','tests/test_catalog_database.py','tests/test_outfits_database.py','tests/test_outfit_editing_database.py','tests/test_outfit_filtering_database.py','tests/test_recommendations_database.py','tests/test_saved_recommendations_database.py','tests/test_tryon_database.py','tests/test_completion_database.py'],cwd=ROOT/'backend',env=environment)
            if result or ('--registration' not in sys.argv and not candidate):
                return result
            # Extend only the disposable Auth interface; never alter managed hosted Auth.
            subprocess.run(['psql','-X','-q','-v','ON_ERROR_STOP=1','-h',temporary,'-d','postgres','-c',
                "ALTER TABLE auth.users ADD COLUMN email text, ADD COLUMN email_confirmed_at timestamptz, ADD COLUMN raw_user_meta_data jsonb DEFAULT '{}', ADD COLUMN raw_app_meta_data jsonb DEFAULT '{}', ADD COLUMN deleted_at timestamptz, ADD COLUMN banned_until timestamptz; CREATE UNIQUE INDEX local_auth_email_unique ON auth.users(lower(email)); ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;"
                ],check=True)
            for name in ['202611090008_registration_storage.sql','202611090009_registration_protocol.sql']:
                subprocess.run(['psql','-X','-q','-v','ON_ERROR_STOP=1','-h',temporary,'-d','postgres','-f',str(registration/name)],check=True)
            for path in later_migrations:
                if path.name not in ['202611090008_registration_storage.sql','202611090009_registration_protocol.sql']:
                    subprocess.run(['psql','-X','-q','-v','ON_ERROR_STOP=1','-h',temporary,'-d','postgres','-f',str(path)],check=True)
            environment['DD_TEST_REGISTRATION_PROTOCOL']='1'
            return subprocess.call([sys.executable,'-m','pytest','-q','tests/test_registration_database.py'],cwd=ROOT/'backend',env=environment)
        finally:
            if started:
                subprocess.run(['pg_ctl','-D',data,'-m','immediate','-w','stop'],check=True,stdout=subprocess.DEVNULL)


if __name__ == '__main__':
    raise SystemExit(main())
