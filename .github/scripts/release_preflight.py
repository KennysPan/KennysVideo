"""Reject mismatched versions before allocating runners or accessing secrets."""
import json
import os
import re
from pathlib import Path

root = Path(__file__).resolve().parents[2]
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
assert re.fullmatch(r'\d+\.\d+\.\d+', version), 'Invalid release version'
for name in ['tauri.conf.json', 'tauri.android.conf.json']:
    assert json.loads((root / 'src-tauri' / name).read_text(encoding='utf-8'))['version'] == version, name
assert re.search(r'^version = "' + re.escape(version) + '"$', (root / 'src-tauri/Cargo.toml').read_text(encoding='utf-8'), re.M)
if os.environ.get('GITHUB_REF_TYPE') == 'tag':
    assert os.environ['GITHUB_REF_NAME'] == 'v' + version, 'Tag/package version mismatch'
for suffix in ['', '-windows', '-android']:
    assert (root / 'docs' / f'release-{version}{suffix}.md').is_file(), 'Missing release notes'
print(f'Release versions and notes verified: {version}')
