"""WeShopAI primary, explicit upper-body-only IDM-VTON failure fallback."""
import json
import tempfile
from pathlib import Path
from PIL import Image
from app.tryon.common import HostedTryOnError


def run_manifest(plan, progress=lambda message: None):
    from app.tryon import weshop as weshop_tryon
    from app.tryon import idm as idm_tryon
    manifest = Path(plan['person']).parent / 'manifest.json'
    requested = json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else dict(plan)
    requested.setdefault('warnings', [])
    requested['attempts'] = []
    garments = [dict(g, path=g.get('prepared_path', g['path']), rotation=0 if g.get('prepared_path') else g.get('rotation', 0)) for g in plan['garments']]
    eligible = len(garments) == 1 and garments[0]['category'] == 'tops'
    failures = []
    for provider, generate in [('weshop', weshop_tryon.run_manifest)] + ([('idm', idm_tryon.run_manifest)] if eligible else []):
        if provider == 'idm':
            progress('WeShopAI did not complete. Trying IDM-VTON backup for the selected top.')
            requested['warnings'].append('WeShopAI failed; this preview uses the IDM-VTON upper-body research demo.')
        try:
            generate(dict(plan, garments=garments))
            if not Path(plan['output']).is_file():
                raise HostedTryOnError('The provider returned no saved preview')
            requested['attempts'].append({'provider': provider, 'status': 'completed'})
            requested['actual_provider'] = provider
            manifest.write_text(json.dumps(requested), encoding='utf-8')
            return provider
        except HostedTryOnError as exc:
            failures.append(f'{provider}: {exc}')
            requested['attempts'].append({'provider': provider, 'status': 'failed', 'message': str(exc)[:500]})
            manifest.write_text(json.dumps(requested), encoding='utf-8')
    suffix = '' if eligible else ' IDM-VTON backup supports one top only; no fallback was attempted for this garment type.'
    raise HostedTryOnError('Hosted try-on did not complete. ' + ' '.join(failures) + suffix)


def infer(person, garments):
    """Portable cloud adapter with the same fallback and provider audit trail."""
    with tempfile.TemporaryDirectory(prefix='drapedrop-tryon-') as tmp:
        root = Path(tmp)
        person.save(root / 'person.png')
        plan = {'person': str(root / 'person.png'), 'output': str(root / 'result.png'),
                'provider': 'weshop', 'item_ids': [], 'warnings': [], 'garments': []}
        for index, (image, category) in enumerate(garments):
            path = root / f'garment-{index}.png'
            image.save(path)
            plan['garments'].append({'path': str(path), 'category': category})
        (root / 'manifest.json').write_text(json.dumps(plan), encoding='utf-8')
        run_manifest(plan)
        audit = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
        with Image.open(plan['output']) as source:
            result = source.convert('RGB')
        result.info['tryon_provider'] = audit['actual_provider']
        result.info['tryon_attempts'] = audit['attempts']
        result.info['tryon_warnings'] = audit['warnings']
        return result
