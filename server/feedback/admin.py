"""Same-origin, session-protected feedback moderation; no public report data."""
import hashlib
import hmac
import json
import secrets
import time
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import parse_qs

PREFIX = '/feedback-admin'
CATEGORIES = {'unreviewed', 'actionable', 'spam', 'abuse', 'duplicate', 'other'}


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 600000).hex()
    return f'pbkdf2_sha256$600000${salt}${digest}'


def verify_password(password, encoded):
    try:
        algorithm, iterations, salt, digest = encoded.split('$')
        if algorithm != 'pbkdf2_sha256' or int(iterations) != 600000:
            return False
        actual = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), int(iterations)).hex()
        return hmac.compare_digest(actual, digest)
    except (ValueError, TypeError):
        return False


def initialize(db):
    db.executescript('''
        CREATE TABLE IF NOT EXISTS admin_sessions (
            token_hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS admin_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS admin_logins (ip_hash TEXT NOT NULL, created REAL NOT NULL);
        CREATE INDEX IF NOT EXISTS admin_logins_ip ON admin_logins(ip_hash, created);
        CREATE TABLE IF NOT EXISTS device_bans (
            id TEXT PRIMARY KEY, device_hash TEXT UNIQUE NOT NULL, until REAL NOT NULL,
            reason TEXT NOT NULL, created REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS admin_audit (
            id INTEGER PRIMARY KEY, created REAL NOT NULL, action TEXT NOT NULL,
            target TEXT NOT NULL, detail TEXT NOT NULL);
    ''')


def current_password_hash(service, db):
    row = db.execute("SELECT value FROM admin_settings WHERE key='password_hash'").fetchone()
    return row['value'] if row else service.config.get('ADMIN_PASSWORD_HASH', '')


def purge(db, now):
    db.execute('DELETE FROM admin_sessions WHERE expires<?', (now,))
    db.execute('DELETE FROM admin_logins WHERE created<?', (now - 900,))
    db.execute('DELETE FROM admin_audit WHERE created<?', (now - 90 * 86400,))
    db.execute('DELETE FROM device_bans WHERE until<=?', (now,))


def handle(service, environ, start_response):
    path = environ.get('PATH_INFO', '')
    method = environ.get('REQUEST_METHOD', '')
    headers = [('Cache-Control', 'no-store'), ('X-Content-Type-Options', 'nosniff'),
               ('X-Frame-Options', 'DENY'), ('Referrer-Policy', 'no-referrer'),
               ('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")]

    def respond(status, body, content_type='application/json; charset=utf-8'):
        labels = {200: 'OK', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
                  404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict',
                  413: 'Payload Too Large', 429: 'Too Many Requests', 503: 'Service Unavailable'}
        headers.append(('Content-Type', content_type))
        start_response(f'{status} {labels[status]}', headers)
        return [body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()]

    def error(status, code):
        return respond(status, {'success': False, 'code': code})

    with service.connect() as db:
        if not current_password_hash(service, db):
            return error(503, 'admin_not_configured')
    # Explicit origin is mandatory for writes, including login (login CSRF).
    if method == 'POST' and environ.get('HTTP_ORIGIN') != service.config.get('ADMIN_ORIGIN', 'https://www.kennyspan.xyz'):
        return error(403, 'origin_denied')
    assets = {PREFIX: ('admin.html', 'text/html; charset=utf-8'),
              PREFIX + '/': ('admin.html', 'text/html; charset=utf-8'),
              PREFIX + '/admin.js': ('admin.js', 'text/javascript; charset=utf-8'),
              PREFIX + '/admin.css': ('admin.css', 'text/css; charset=utf-8')}
    if path in assets and method == 'GET':
        filename, mime = assets[path]
        return respond(200, Path(__file__).with_name(filename).read_bytes(), mime)
    if method not in ('GET', 'POST'):
        return error(405, 'method_not_allowed')
    body = {}
    if method == 'POST':
        if environ.get('CONTENT_TYPE', '').split(';')[0] != 'application/json':
            return error(400, 'json_required')
        try:
            length = int(environ.get('CONTENT_LENGTH') or 0)
            if length > 4096:
                return error(413, 'body_too_large')
            if length < 1:
                raise ValueError()
            raw = environ['wsgi.input'].read(length)
            if len(raw) != length:
                raise ValueError()
            body = json.loads(raw)
            if not isinstance(body, dict):
                raise ValueError()
        except (ValueError, TypeError, UnicodeError, RecursionError):
            return error(400, 'invalid_json')
    now = time.time()
    with service.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        purge(db, now)
        db.execute('DELETE FROM reports WHERE created<?', (now - 30 * 86400,))
        if path == PREFIX + '/login' and method == 'POST':
            ip_hash = service.keyed_hash('admin-ip', service.client_ip(environ))
            if db.execute('SELECT COUNT(*) FROM admin_logins WHERE ip_hash=?', (ip_hash,)).fetchone()[0] >= 5:
                headers.append(('Retry-After', '900'))
                return error(429, 'login_rate_limited')
            password = body.get('password')
            if not isinstance(password, str) or len(password) > 256 or not verify_password(password, current_password_hash(service, db)):
                db.execute('INSERT INTO admin_logins VALUES(?,?)', (ip_hash, now))
                return error(401, 'invalid_credentials')
            token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
            db.execute('INSERT INTO admin_sessions VALUES(?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), csrf, now + 8 * 3600))
            headers.append(('Set-Cookie', f'kv_admin={token}; Path={PREFIX}; HttpOnly; Secure; SameSite=Strict; Max-Age=28800'))
            return respond(200, {'success': True, 'csrf_token': csrf})
        cookie = SimpleCookie()
        try:
            cookie.load(environ.get('HTTP_COOKIE', ''))
            token = cookie['kv_admin'].value if 'kv_admin' in cookie else ''
        except Exception:
            token = ''
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        session = db.execute('SELECT * FROM admin_sessions WHERE token_hash=?', (token_hash,)).fetchone()
        if not session:
            return error(401, 'login_required')
        if method == 'POST' and not hmac.compare_digest(environ.get('HTTP_X_CSRF_TOKEN', ''), session['csrf']):
            return error(403, 'csrf_failed')
        if path == PREFIX + '/session' and method == 'GET':
            return respond(200, {'success': True, 'csrf_token': session['csrf']})
        if path == PREFIX + '/password' and method == 'POST':
            ip_hash = service.keyed_hash('password-change-ip', service.client_ip(environ))
            if db.execute('SELECT COUNT(*) FROM admin_logins WHERE ip_hash=?', (ip_hash,)).fetchone()[0] >= 5:
                headers.append(('Retry-After', '900'))
                return error(429, 'password_rate_limited')
            old, new = body.get('current_password'), body.get('new_password')
            if not isinstance(old, str) or len(old) > 256 or not verify_password(old, current_password_hash(service, db)):
                db.execute('INSERT INTO admin_logins VALUES(?,?)', (ip_hash, now))
                return error(400, 'current_password_incorrect')
            if not isinstance(new, str) or not 6 <= len(new) <= 256 or not new.strip():
                return error(400, 'invalid_new_password')
            db.execute("INSERT INTO admin_settings VALUES('password_hash',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (password_hash(new),))
            db.execute('DELETE FROM admin_sessions')
            db.execute('INSERT INTO admin_audit(created,action,target,detail) VALUES(?,?,?,?)', (now, 'password_change', 'administrator', '管理员修改密码，全部会话已退出'))
            headers.append(('Set-Cookie', f'kv_admin=; Path={PREFIX}; HttpOnly; Secure; SameSite=Strict; Max-Age=0'))
            return respond(200, {'success': True, 'login_required': True})
        if path == PREFIX + '/logout' and method == 'POST':
            db.execute('DELETE FROM admin_sessions WHERE token_hash=?', (token_hash,))
            headers.append(('Set-Cookie', f'kv_admin=; Path={PREFIX}; HttpOnly; Secure; SameSite=Strict; Max-Age=0'))
            return respond(200, {'success': True})
        if path == PREFIX + '/reports' and method == 'GET':
            try:
                page = int(parse_qs(environ.get('QUERY_STRING', '')).get('page', ['1'])[0])
                if not 1 <= page <= 100000:
                    raise ValueError()
            except ValueError:
                return error(400, 'invalid_page')
            rows = db.execute('SELECT * FROM reports ORDER BY created DESC,id DESC LIMIT 20 OFFSET ?', ((page - 1) * 20,)).fetchall()
            reports = []
            for row in rows:
                data = json.loads(row['body'])
                data.pop('device_id', None)
                reports.append({**data, 'id': row['id'], 'created': row['created'], 'state': row['state'],
                                'source_ip': row['source_ip'], 'device': row['device_hash'][:12] if row['device_hash'] else None,
                                'category': row['category']})
            return respond(200, {'success': True, 'reports': reports, 'page': page,
                                 'total': db.execute('SELECT COUNT(*) FROM reports').fetchone()[0]})
        if path == PREFIX + '/bans' and method == 'GET':
            rows = db.execute('SELECT * FROM device_bans ORDER BY created DESC LIMIT 500').fetchall()
            return respond(200, {'success': True, 'bans': [{'id': r['id'], 'device': r['device_hash'][:12], 'until': r['until'], 'reason': r['reason']} for r in rows]})
        if path == PREFIX + '/audit' and method == 'GET':
            rows = db.execute('SELECT created,action,target,detail FROM admin_audit ORDER BY id DESC LIMIT 100').fetchall()
            return respond(200, {'success': True, 'audit': [dict(r) for r in rows]})
        if method == 'POST' and path in (PREFIX + '/review', PREFIX + '/ban'):
            report_id = body.get('report_id')
            if not isinstance(report_id, str):
                return error(400, 'report_id_required')
            report = db.execute('SELECT * FROM reports WHERE id=?', (report_id,)).fetchone()
            if not report:
                return error(404, 'report_not_found')
            if path.endswith('/review'):
                category = body.get('category')
                if not isinstance(category, str) or category not in CATEGORIES:
                    return error(400, 'invalid_category')
                db.execute('UPDATE reports SET category=? WHERE id=?', (category, report_id))
                detail = category
                action = 'review'
            else:
                days, reason = body.get('days'), body.get('reason')
                if type(days) is not int or not 1 <= days <= 365 or not isinstance(reason, str) or not 1 <= len(reason.strip()) <= 300:
                    return error(400, 'invalid_ban')
                if not report['device_hash']:
                    return error(409, 'legacy_device_unavailable')
                ban_id = secrets.token_hex(16)
                db.execute('INSERT INTO device_bans VALUES(?,?,?,?,?) ON CONFLICT(device_hash) DO UPDATE SET until=excluded.until,reason=excluded.reason,created=excluded.created',
                           (ban_id, report['device_hash'], now + days * 86400, reason.strip(), now))
                detail, action = f'{days} 天：{reason.strip()}', 'ban'
            db.execute('INSERT INTO admin_audit(created,action,target,detail) VALUES(?,?,?,?)', (now, action, report_id, detail))
            return respond(200, {'success': True})
        if path == PREFIX + '/unban' and method == 'POST':
            identifier = body.get('ban_id')
            if not isinstance(identifier, str):
                return error(400, 'ban_id_required')
            if not db.execute('DELETE FROM device_bans WHERE id=?', (identifier,)).rowcount:
                return error(404, 'ban_not_found')
            db.execute('INSERT INTO admin_audit(created,action,target,detail) VALUES(?,?,?,?)', (now, 'unban', identifier, '解除禁用'))
            return respond(200, {'success': True})
    return error(404, 'not_found')
