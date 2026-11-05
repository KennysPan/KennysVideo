from pathlib import Path
import hashlib
root = Path(__file__).resolve().parents[1]
version = __import__('json').loads((root/'package.json').read_text(encoding='utf-8'))['version']
files = [root/'dist-windows'/f'KennysVideo-{version}-{suffix}' for suffix in ['x64-setup.exe','x64.exe','source.zip']]
files.append(root/'dist-android'/f'KennysVideo-{version}-android.apk')
(root/'dist-windows'/f'KennysVideo-{version}-SHA256SUMS.txt').write_text(''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in files),encoding='utf-8')
