"""Run on the server to configure a PBKDF2 password without command-line secrets."""
import getpass
import os
import tempfile
from pathlib import Path
from admin import password_hash


def main():
    if hasattr(os, 'geteuid') and os.geteuid() != 0:
        raise SystemExit('Run as root')
    first = getpass.getpass('New admin password (at least 6 characters): ')
    second = getpass.getpass('Repeat password: ')
    if len(first) < 6 or len(first) > 256 or not first.strip() or first != second:
        raise SystemExit('Passwords must match and contain 6–256 characters')
    path = Path('/etc/kennysvideo-feedback.env')
    lines = [line for line in path.read_text().splitlines() if not line.startswith(('ADMIN_PASSWORD_HASH=', 'ADMIN_ORIGIN='))]
    lines += ['ADMIN_PASSWORD_HASH=' + password_hash(first), 'ADMIN_ORIGIN=https://www.kennyspan.xyz']
    fd, name = tempfile.mkstemp(dir=path.parent, prefix='.kennysvideo-admin-')
    try:
        with os.fdopen(fd, 'w') as output:
            os.chmod(name, 0o600)
            output.write('\n'.join(lines) + '\n')
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)
    # Revoke all existing sessions after a password change.
    import sqlite3
    settings = dict(line.split('=', 1) for line in lines if line and not line.startswith('#') and '=' in line)
    with sqlite3.connect(settings.get('FEEDBACK_DB', '/var/lib/kennysvideo-feedback/feedback.sqlite3')) as db:
        if db.execute("SELECT 1 FROM sqlite_master WHERE name='admin_sessions'").fetchone():
            db.execute('DELETE FROM admin_sessions')
        if db.execute("SELECT 1 FROM sqlite_master WHERE name='admin_settings'").fetchone():
            db.execute("DELETE FROM admin_settings WHERE key='password_hash'")
    print('Admin hash saved; restart kennysvideo-feedback. No password was printed.')


if __name__ == '__main__':
    main()
