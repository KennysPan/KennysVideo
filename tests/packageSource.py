"""Package an explicit source allowlist; exclude build caches and diagnostic downloads."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--output', help='Optional output path; use a preview path instead of replacing a published source archive')
parser.add_argument('--platform', choices=['windows', 'android'], default='windows')
args = parser.parse_args()

root = Path(__file__).resolve().parents[1]
version = __import__('json').loads((root / 'package.json').read_text(encoding='utf-8'))['version']
if args.platform == 'android':
    version = __import__('json').loads((root / 'src-tauri/tauri.android.conf.json').read_text(encoding='utf-8'))['version']
folders = ['public', 'src-tauri/src', 'src-tauri/icons', 'src-tauri/capabilities', 'src-tauri/gen/android', 'scripts', 'tests', 'docs', '.cargo', '.github/workflows', '.github/scripts', 'server/feedback']
files = ['package.json', 'package-lock.json', 'readme.md', 'BUILDING.md', 'LICENSE', 'NOTICE', '.gitignore',
         'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock', 'src-tauri/build.rs', 'src-tauri/tauri.conf.json',
         'src-tauri/tauri.windows.conf.json', 'src-tauri/tauri.android.conf.json', 'src-tauri/tauri.preview.conf.json', 'src-tauri/installer-template.nsi']
paths = [root / name for name in files]
for name in folders:
    paths.extend(p for p in (root / name).rglob('*') if p.is_file()
                 and not set(p.relative_to(root).parts) & {'__pycache__', 'build', '.gradle', '.kotlin', '.tauri', '.idea', '.cxx', '.externalNativeBuild', 'jniLibs'}
                 and p.name not in {'.env', 'local.properties', 'key.properties', 'tauri.properties', 'tauri.settings.gradle', 'tauri.build.gradle.kts'}
                 and not p.name.endswith(('.sqlite3', '.pem', '.key', '.sqlite3-journal', '.sqlite3-wal', '.sqlite3-shm', '.jks', '.keystore')))
destination = root / args.output if args.output else root / 'dist-windows' / f'KennysVideo-{version}-source.zip'
destination.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(destination, 'w', ZIP_DEFLATED) as output:
    for p in sorted(set(paths)):
        if p.exists():
            output.write(p, f'KennysVideo-{version}/{p.relative_to(root).as_posix()}')
print(destination)
