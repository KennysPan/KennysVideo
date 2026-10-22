"""Package an explicit source allowlist; exclude build caches and diagnostic downloads."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
version = __import__('json').loads((root / 'package.json').read_text(encoding='utf-8'))['version']
folders = ['public', 'src-tauri/src', 'src-tauri/icons', 'src-tauri/capabilities', 'tests', 'docs', '.cargo', 'server/feedback']
files = ['package.json', 'package-lock.json', 'README.md', 'readme.md', 'BUILDING.md', 'LICENSE', 'NOTICE', '.gitignore',
         'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock', 'src-tauri/build.rs', 'src-tauri/tauri.conf.json',
         'src-tauri/tauri.windows.conf.json', 'src-tauri/tauri.preview.conf.json', 'src-tauri/installer-template.nsi']
paths = [root / name for name in files]
for name in folders:
    paths.extend(p for p in (root / name).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.name != '.env' and not p.name.endswith(('.sqlite3', '.pem', '.key', '.sqlite3-journal', '.sqlite3-wal', '.sqlite3-shm')))
destination = root / 'dist-windows' / f'KennysVideo-{version}-source.zip'
with ZipFile(destination, 'w', ZIP_DEFLATED) as output:
    for p in sorted(set(paths)):
        if p.exists():
            output.write(p, f'KennysVideo-{version}/{p.relative_to(root).as_posix()}')
print(destination)
