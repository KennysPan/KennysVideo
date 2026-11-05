"""Root-only Debian setup. Never reads SMTP authorization codes from CLI arguments."""
import argparse
import os
import pwd
import secrets
import shutil
import subprocess
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--certificate-zip', required=True)
parser.add_argument('--sender', required=True)
parser.add_argument('--recipient', required=True)
args = parser.parse_args()
if os.getuid() != 0:
    raise SystemExit('Run as root')
for mailbox in (args.sender, args.recipient):
    if '\n' in mailbox or '\r' in mailbox or '@' not in mailbox:
        raise SystemExit('Invalid mailbox')
root = Path(__file__).resolve().parent
if root != Path('/opt/kennysvideo-feedback'):
    raise SystemExit('Install source under /opt/kennysvideo-feedback first')
try:
    pwd.getpwnam('kennysvideo-feedback')
except KeyError:
    subprocess.run(['useradd', '--system', '--home-dir', '/var/lib/kennysvideo-feedback', '--shell', '/usr/sbin/nologin', 'kennysvideo-feedback'], check=True)
tls = Path('/etc/kennysvideo-feedback/tls')
tls.mkdir(parents=True, exist_ok=True, mode=0o700)
os.chmod(tls.parent, 0o700)
os.chmod(tls, 0o700)
with zipfile.ZipFile(args.certificate_zip) as archive:
    for source, target in [('www.kennyspan.xyz.pem', 'fullchain.pem'), ('www.kennyspan.xyz.key', 'private.key')]:
        destination = tls / target
        if destination.exists():
            raise SystemExit('Certificate already exists; review renewal separately')
        with destination.open('xb') as handle:
            os.chmod(destination, 0o600)
            handle.write(archive.read(source))
env = Path('/etc/kennysvideo-feedback.env')
if not env.exists():
    with env.open('x') as handle:
        os.chmod(env, 0o600)
        handle.write(f'SMTP_HOST=smtp.qq.com\nSMTP_PORT=465\nSMTP_USER={args.sender}\nSMTP_PASSWORD=\nFEEDBACK_TO={args.recipient}\nIP_HASH_KEY={secrets.token_hex(32)}\nFEEDBACK_DB=/var/lib/kennysvideo-feedback/feedback.sqlite3\nALLOWED_ORIGINS=http://tauri.localhost,https://tauri.localhost,https://www.kennyspan.xyz\nIP_LIMIT=5\nDAILY_LIMIT=100\n')
for unit in ('kennysvideo-feedback.service', 'kennysvideo-feedback-worker.service'):
    destination = Path('/etc/systemd/system') / unit
    if destination.exists():
        raise SystemExit('Systemd unit already exists; review upgrade separately')
    shutil.copyfile(root / unit, destination)
    os.chmod(destination, 0o644)
site = Path('/etc/nginx/sites-available/kennysvideo-feedback')
if site.exists():
    raise SystemExit('Nginx site already exists; do not overwrite')
shutil.copyfile(root / 'nginx.conf', site)
Path('/etc/nginx/sites-enabled/kennysvideo-feedback').symlink_to(site)
subprocess.run(['nginx', '-t'], check=True)
subprocess.run(['systemctl', 'daemon-reload'], check=True)
subprocess.run(['systemctl', 'enable', '--now', 'kennysvideo-feedback'], check=True)
subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
print('HTTPS and API installed. SMTP is deliberately unconfigured. Set SMTP_PASSWORD on server, then restart API and enable worker.')
