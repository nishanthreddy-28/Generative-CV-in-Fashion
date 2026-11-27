"""Synchronize temporary cloud URLs after a VM/tunnel restart; run on the VM.

No cloud credentials or database secrets are stored here. Quick Tunnels remain
testing infrastructure: the public website URL itself changes after restart.
"""
from pathlib import Path
import json
import os
import re
import shutil
import subprocess
import time

from dotenv import dotenv_values

ROOT = Path('/opt/drape-drop')


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def tunnel_url(unit):
    for _ in range(45):
        log = run(['journalctl', '-b', '-u', unit, '-o', 'cat', '--no-pager'],
                  capture_output=True, text=True).stdout
        urls = re.findall(r'https://[a-z0-9-]+\.trycloudflare\.com', log)
        if urls:
            return urls[-1]
        time.sleep(2)
    raise RuntimeError(f'No temporary URL available for {unit}')


def update_env(path, changes):
    values = dotenv_values(path)
    values.update(changes)
    # JSON strings are valid quoted dotenv values, including the JSON CORS list.
    path.write_text(''.join(k + '=' + json.dumps(v) + '\n'
                            for k, v in values.items() if v is not None))
    os.chmod(path, 0o600)
    run(['chown', 'drapedrop:drapedrop', str(path)])


def main():
    urls = {key: tunnel_url('drape-' + key + '-tunnel')
            for key in ('api', 'web', 'expo')}
    old_path = ROOT / 'deployment-urls.json'
    old = json.loads(old_path.read_text()) if old_path.exists() else {}
    update_env(ROOT / 'api/.env', {
        'API_CORS_ORIGINS': json.dumps([urls['web'], 'http://localhost:8081'])})
    update_env(ROOT / 'mobile/.env', {'EXPO_PUBLIC_API_URL': urls['api']})
    dropin = Path('/etc/systemd/system/drape-expo.service.d')
    dropin.mkdir(exist_ok=True)
    (dropin / 'public-url.conf').write_text(
        '[Service]\nEnvironment=EXPO_PACKAGER_PROXY_URL=' + urls['expo'] + '\n')
    run(['systemctl', 'daemon-reload'])
    run(['systemctl', 'restart', 'drape-api', 'drape-expo'])
    if old.get('api') != urls['api'] or not (ROOT / 'web/_expo').exists():
        run(['runuser', '-u', 'drapedrop', '--', 'env', 'CI=1',
             'PATH=/opt/drape-drop/node/bin:/usr/bin:/bin',
             '/opt/drape-drop/node/bin/node', 'node_modules/expo/bin/cli',
             'export', '--platform', 'web', '--output-dir', str(ROOT / 'cache/web-build')],
            cwd=ROOT / 'mobile')
        shutil.copytree(ROOT / 'cache/web-build', ROOT / 'web', dirs_exist_ok=True)
    phone = ROOT / 'web/phone'
    phone.mkdir(exist_ok=True)
    expo_link = urls['expo'].replace('https://', 'exps://', 1)
    run(['/usr/bin/python3', '-c',
         'import qrcode,sys; qrcode.make(sys.argv[1]).save(sys.argv[2])',
         expo_link, str(phone / 'expo-qr.png')])
    (phone / 'index.html').write_text('''<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Drape &amp; Drop — Phone testing</title>
<style>body{font:18px system-ui;max-width:540px;margin:40px auto;padding:20px;background:#f7f5f0;color:#25231f}a{color:#533e28}img{width:280px;max-width:100%;height:auto}code{overflow-wrap:anywhere}</style>
<h1>Drape &amp; Drop</h1><p>Android testing</p>
<ol><li>Install Expo Go from the Google Play Store.</li><li>Open Expo Go and scan this QR code, or tap the link below on your phone.</li><li>Sign in with your existing Drape &amp; Drop account.</li></ol>
<img src="expo-qr.png" alt="QR code to open Drape and Drop in Expo Go">
<p><a href="''' + expo_link + '''">Open in Expo Go</a></p>
<p><code>''' + expo_link + '''</code></p>
<p><a href="/">Open the website instead</a></p>
<p>This is a temporary testing address. It changes when the tunnel restarts. An installed release build is a separate delivery step.</p></html>''')
    run(['chmod', '-R', 'a+rX', str(ROOT / 'web')])
    old_path.write_text(json.dumps(urls, indent=2) + '\n')
    os.chmod(old_path, 0o644)
    print(json.dumps(urls))


if __name__ == '__main__':
    main()
