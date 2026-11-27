"""Read-only integrity checks after the workspace consolidation."""
import json
import sqlite3
from pathlib import Path

BACKEND=Path(__file__).resolve().parents[1]
PROJECT=BACKEND.parent
ARCHIVE=PROJECT.parent/'FASHN_Archive'

def main():
    assert (PROJECT/'.venv/Scripts/python.exe').is_file()
    for name in ['qwen_tryon.py','workers_tryon.py','fitdit.py']:
        assert not (BACKEND/'app/tryon'/name).exists(), name
    for row in json.loads((ARCHIVE/'WEIGHTS_MANIFEST.json').read_text()):
        assert (ARCHIVE/row['path']).stat().st_size==row['bytes'],row['path']
    databases={}
    for path in (BACKEND/'storage').glob('*.db'):
        with sqlite3.connect(f'{path.as_uri()}?mode=ro',uri=True) as connection:
            assert connection.execute('PRAGMA quick_check').fetchone()[0]=='ok'
            databases[path.name]='ok'
            if path.name=='drapedrop.db':
                images=connection.execute('SELECT image_path,thumb_path FROM items WHERE is_archived=0').fetchall()
                for pair in images:
                    for image in pair: assert (BACKEND/'storage/images'/image).is_file(),'Missing wardrobe image'
    assert not (BACKEND/'storage/tryon-env').exists()
    assert not (BACKEND/'storage/tryon-weights').exists()
    print(json.dumps({'databases':databases,'active_wardrobe_images':'present',
        'archived_weights':'present and sizes match','retired_provider_modules':'absent'},indent=2))

if __name__=='__main__':main()
