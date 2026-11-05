"""Write the isolated Android update feed from the built APK, never the Windows feed."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'src-tauri/tauri.android.conf.json').read_text(encoding='utf-8'))['version']
name = f'KennysVideo-{version}-android.apk'
apk = root / 'dist-android' / name
digest = hashlib.sha256(apk.read_bytes()).hexdigest()
feed = {
    'tag_name': f'v{version}', 'draft': False, 'prerelease': False,
    'installer_sha256': digest,
    'assets': [{'name': name, 'state': 'uploaded',
                'browser_download_url': f'https://github.com/KennysPan/KennysVideo/releases/download/v{version}/{name}'}]
}
notes = root / 'docs' / f'release-{version}-android.md'
if notes.exists(): feed['body'] = notes.read_text(encoding='utf-8')
(apk.parent / 'android-update.json').write_text(json.dumps(feed, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
mirror = apk.parent / 'gitee'
mirror.mkdir(exist_ok=True)
feed['assets'][0]['browser_download_url'] = f'https://gitee.com/kennysPan/kennys-video/releases/download/v{version}/{name}'
(mirror / 'android-update.json').write_text(json.dumps(feed, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(apk.parent / f'{name}.sha256').write_text(f'{digest}  {name}\n', encoding='utf-8')
print(json.dumps({'file': name, 'bytes': apk.stat().st_size, 'sha256': digest}))
