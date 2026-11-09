"""Copy canonical migrations and their hashes into a new local verification directory.

The managed-Auth compatibility fixes are now in the canonical migrations.
This command performs no database or network operations.
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def prepare(output: Path) -> None:
    output.mkdir(parents=True, exist_ok=False)
    manifest = []
    for source in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
        content = source.read_bytes()
        (output / source.name).write_bytes(content)
        manifest.append({'file': source.name, 'sha256': hashlib.sha256(content).hexdigest()})
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path, help='New local verification directory')
    prepare(parser.parse_args().output)
