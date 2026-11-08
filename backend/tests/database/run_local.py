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
        started = False
        try:
            subprocess.run(['initdb','-D',data,'-A','trust','--no-locale','-E','UTF8'],check=True,stdout=subprocess.DEVNULL)
            subprocess.run(['pg_ctl','-D',data,'-l',str(Path(temporary)/'server.log'),'-o',f"-F -k {temporary} -c listen_addresses=",'-w','start'],check=True,stdout=subprocess.DEVNULL)
            started = True
            for path in [ROOT/'backend/tests/database/supabase_test_primitives.sql',
                         *sorted((ROOT/'supabase/migrations').glob('*.sql'))]:
                subprocess.run(['psql','-X','-q','-v','ON_ERROR_STOP=1','-h',temporary,'-d','postgres','-f',str(path)],check=True)
            environment = {**os.environ,'DD_TEST_PG_SOCKET':temporary}
            return subprocess.call([sys.executable,'-m','pytest','-q','tests/test_foundation_database.py',
                                    'tests/test_body_profile_database.py','tests/test_wardrobe_database.py','tests/test_catalog_database.py','tests/test_outfits_database.py','tests/test_outfit_editing_database.py','tests/test_outfit_filtering_database.py'],cwd=ROOT/'backend',env=environment)
        finally:
            if started:
                subprocess.run(['pg_ctl','-D',data,'-m','immediate','-w','stop'],check=True,stdout=subprocess.DEVNULL)


if __name__ == '__main__':
    raise SystemExit(main())
