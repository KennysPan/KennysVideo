"""KennysVideo fixed-recipient feedback API and durable SMTP delivery worker."""
import hashlib
import hmac
import ipaddress
import json
import logging
import os
import re
import smtplib
import sqlite3
import ssl
import sys
import time
import uuid
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path
from contextlib import contextmanager
from email_template import render_feedback

LOG = logging.getLogger('kennysvideo.feedback')
API_PATH = '/api/kennysvideo/feedback'
LIMIT_BYTES = 32768


class Feedback:
    def __init__(self, config=None, smtp_factory=None):
        self.config = dict(os.environ if config is None else config)
        for field in ('SMTP_USER', 'SMTP_PASSWORD', 'FEEDBACK_TO', 'IP_HASH_KEY'):
            if not self.config.get(field):
                raise RuntimeError('Missing server setting: ' + field)
        for field in ('SMTP_USER', 'FEEDBACK_TO'):
            if not self.valid_email(self.config[field]):
                raise RuntimeError('Invalid server mailbox setting')
        if len(self.config['IP_HASH_KEY']) < 32:
            raise RuntimeError('IP_HASH_KEY must have at least 32 characters')
        self.database = self.config.get('FEEDBACK_DB', '/var/lib/kennysvideo-feedback/feedback.sqlite3')
        self.origins = set(self.config.get('ALLOWED_ORIGINS', 'http://tauri.localhost,https://tauri.localhost,https://www.kennyspan.xyz').split(','))
        self.smtp_factory = smtp_factory or smtplib.SMTP_SSL
        logo = Path(__file__).with_name('brand-logo.jpg')
        self.logo = logo.read_bytes() if logo.is_file() else None
        Path(self.database).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS reports (
                    id TEXT PRIMARY KEY, digest TEXT NOT NULL, body TEXT NOT NULL,
                    ip_hash TEXT NOT NULL, created REAL NOT NULL, state TEXT NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0, next_attempt REAL NOT NULL,
                    lease_until REAL NOT NULL DEFAULT 0, error TEXT);
                CREATE INDEX IF NOT EXISTS reports_ip_created ON reports(ip_hash, created);
                CREATE INDEX IF NOT EXISTS reports_due ON reports(state, next_attempt);
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.database, timeout=5)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA busy_timeout=5000')
        try:
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def valid_email(value):
        return isinstance(value, str) and len(value) <= 254 and re.fullmatch(r'[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+', value) is not None

    @classmethod
    def validate(cls, body):
        expected = {'request_id', 'title', 'description', 'steps', 'reply_email', 'version', 'platform'}
        if not isinstance(body, dict) or set(body) - expected:
            raise ValueError('Invalid fields')
        result = {}
        for name, minimum, maximum in [('title', 1, 100), ('description', 1, 4000), ('steps', 0, 2000), ('reply_email', 0, 254), ('version', 1, 40), ('platform', 1, 80)]:
            value = body.get(name, '')
            if not isinstance(value, str) or '\x00' in value:
                raise ValueError('Invalid field')
            value = value.strip()
            if not minimum <= len(value) <= maximum:
                raise ValueError('Invalid length')
            if name in ('title', 'reply_email', 'version', 'platform') and any(char in value for char in '\r\n'):
                raise ValueError('Invalid line break')
            result[name] = value
        if result['reply_email'] and not cls.valid_email(result['reply_email']):
            raise ValueError('Invalid email')
        identifier = body.get('request_id')
        if not isinstance(identifier, str) or str(uuid.UUID(identifier)) != identifier:
            raise ValueError('Invalid request id')
        result['request_id'] = identifier
        return result

    def enqueue(self, body, ip):
        body = self.validate(body)
        now = time.time()
        encoded = json.dumps(body, ensure_ascii=False, sort_keys=True)
        digest = hashlib.sha256(encoded.encode()).hexdigest()
        ip_hash = hmac.new(self.config['IP_HASH_KEY'].encode(), str(ipaddress.ip_address(ip)).encode(), hashlib.sha256).hexdigest()
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM reports WHERE created < ?', (now - 30 * 86400,))
            previous = db.execute('SELECT digest, state FROM reports WHERE id=?', (body['request_id'],)).fetchone()
            if previous:
                if previous['digest'] != digest:
                    return 409, {'success': False, 'code': 'id_conflict'}
                return 200, {'success': True, 'report_id': body['request_id'], 'status': previous['state']}
            recent = db.execute('SELECT COUNT(*) FROM reports WHERE ip_hash=? AND created>?', (ip_hash, now - 900)).fetchone()[0]
            daily = db.execute('SELECT COUNT(*) FROM reports WHERE created>?', (now - 86400,)).fetchone()[0]
            pending = db.execute("SELECT COUNT(*) FROM reports WHERE state IN ('queued','sending')").fetchone()[0]
            if recent >= int(self.config.get('IP_LIMIT', '5')) or daily >= int(self.config.get('DAILY_LIMIT', '100')):
                return 429, {'success': False, 'code': 'rate_limited'}
            if pending >= 1000:
                return 503, {'success': False, 'code': 'queue_full'}
            db.execute('INSERT INTO reports(id,digest,body,ip_hash,created,state,next_attempt) VALUES(?,?,?,?,?,?,?)', (body['request_id'], digest, encoded, ip_hash, now, 'queued', now))
        return 202, {'success': True, 'report_id': body['request_id'], 'status': 'queued'}

    def application(self, environ, start_response):
        origin = environ.get('HTTP_ORIGIN', '')
        headers = [('Content-Type', 'application/json; charset=utf-8'), ('Cache-Control', 'no-store'), ('X-Content-Type-Options', 'nosniff'), ('Vary', 'Origin')]
        def respond(status, body):
            if origin in self.origins:
                headers.append(('Access-Control-Allow-Origin', origin))
            if status == 429:
                headers.append(('Retry-After', '900'))
            start_response(f'{status} ' + {200: 'OK', 202: 'Accepted', 204: 'No Content', 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict', 413: 'Payload Too Large', 415: 'Unsupported Media Type', 429: 'Too Many Requests', 503: 'Service Unavailable'}[status], headers)
            return [json.dumps(body, ensure_ascii=False).encode()] if status != 204 else [b'']
        if origin and origin not in self.origins:
            return respond(403, {'success': False, 'code': 'origin_not_allowed'})
        if environ.get('PATH_INFO') == API_PATH + '/health' and environ.get('REQUEST_METHOD') == 'GET':
            return respond(200, {'success': True, 'service': 'KennysVideo feedback', 'api_version': 1})
        if environ.get('PATH_INFO') != API_PATH:
            return respond(404, {'success': False})
        if environ.get('REQUEST_METHOD') == 'OPTIONS':
            if environ.get('HTTP_ACCESS_CONTROL_REQUEST_METHOD') != 'POST':
                return respond(405, {'success': False})
            requested = {item.strip().lower() for item in environ.get('HTTP_ACCESS_CONTROL_REQUEST_HEADERS', '').split(',') if item.strip()}
            if requested - {'content-type'}:
                return respond(403, {'success': False})
            headers.extend([('Access-Control-Allow-Methods', 'POST, OPTIONS'), ('Access-Control-Allow-Headers', 'Content-Type'), ('Access-Control-Max-Age', '600')])
            return respond(204, {})
        if environ.get('REQUEST_METHOD') != 'POST':
            return respond(405, {'success': False})
        if environ.get('CONTENT_TYPE', '').split(';')[0].strip().lower() != 'application/json':
            return respond(415, {'success': False})
        try:
            length = int(environ.get('CONTENT_LENGTH') or 0)
            if length < 1:
                return respond(400, {'success': False})
            if length > LIMIT_BYTES:
                return respond(413, {'success': False})
            data = environ['wsgi.input'].read(length)
            if len(data) != length:
                return respond(400, {'success': False})
            # Trust X-Real-IP only from the configured local reverse proxy.
            ip = environ.get('REMOTE_ADDR', '')
            if ip in ('127.0.0.1', '::1') and environ.get('HTTP_X_REAL_IP'):
                ip = environ['HTTP_X_REAL_IP']
            status, result = self.enqueue(json.loads(data), ip)
            return respond(status, result)
        except (ValueError, TypeError, UnicodeError, RecursionError):
            return respond(400, {'success': False, 'code': 'invalid_report'})
        except sqlite3.Error:
            LOG.error('Feedback storage unavailable')
            return respond(503, {'success': False, 'code': 'storage_unavailable'})

    def deliver_one(self):
        now = time.time()
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute("UPDATE reports SET state='queued', attempts=attempts+1, next_attempt=? WHERE state='sending' AND lease_until<?", (now, now))
            db.execute("UPDATE reports SET state='failed' WHERE state='queued' AND attempts>=5")
            report = db.execute("SELECT * FROM reports WHERE state='queued' AND next_attempt<=? ORDER BY created LIMIT 1", (now,)).fetchone()
            if not report:
                return False
            db.execute("UPDATE reports SET state='sending', lease_until=? WHERE id=?", (now + 300, report['id']))
        data = json.loads(report['body'])
        message = EmailMessage()
        message['From'] = formataddr(('KennysVideo BUG', self.config['SMTP_USER']))
        message['To'] = self.config['FEEDBACK_TO']
        message['Subject'] = '[KennysVideo BUG] ' + data['title']
        message['Message-ID'] = f"<kennysvideo.{report['id']}@www.kennyspan.xyz>"
        if data['reply_email']:
            message['Reply-To'] = data['reply_email']
        message.set_content(f"报告编号：{report['id']}\n问题：{data['title']}\n\n问题描述：\n{data['description']}\n\n复现步骤：\n{data['steps'] or '未填写'}\n\n软件版本：{data['version']}\n运行平台：{data['platform']}")
        message.add_alternative(render_feedback(data, report['id'], report['created'], bool(self.logo)), subtype='html')
        if self.logo:
            message.get_payload()[-1].add_related(self.logo, maintype='image', subtype='jpeg', cid='<kennysvideo-logo>', filename='KennysVideo.jpg', disposition='inline')
        try:
            with self.smtp_factory(self.config.get('SMTP_HOST', 'smtp.qq.com'), int(self.config.get('SMTP_PORT', '465')), context=ssl.create_default_context(), timeout=10) as smtp:
                smtp.login(self.config['SMTP_USER'], self.config['SMTP_PASSWORD'])
                refused = smtp.send_message(message, from_addr=self.config['SMTP_USER'], to_addrs=[self.config['FEEDBACK_TO']])
                if refused:
                    raise smtplib.SMTPRecipientsRefused(refused)
            with self.connect() as db:
                db.execute("UPDATE reports SET state='sent', error=NULL WHERE id=?", (report['id'],))
            LOG.info('Report delivered id=%s', report['id'])
        except (smtplib.SMTPException, OSError) as error:
            attempts = report['attempts'] + 1
            with self.connect() as db:
                db.execute('UPDATE reports SET state=?,attempts=?,next_attempt=?,error=? WHERE id=?', ('failed' if attempts >= 5 else 'queued', attempts, time.time() + min(3600, 30 * 2 ** attempts), type(error).__name__, report['id']))
            LOG.warning('SMTP delivery failed id=%s error=%s', report['id'], type(error).__name__)
        return True


_service = None
def application(environ, start_response):
    global _service
    if _service is None:
        try:
            _service = Feedback()
        except RuntimeError:
            start_response('503 Service Unavailable', [('Content-Type', 'application/json'), ('Cache-Control', 'no-store')])
            return [b'{"success":false,"code":"service_not_configured"}']
    return _service.application(environ, start_response)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    if sys.argv[1:] != ['worker']:
        raise SystemExit('Use gunicorn feedback:application for HTTP, or feedback.py worker')
    service = Feedback()
    while True:
        service.deliver_one()
        with service.connect() as db:
            db.execute('DELETE FROM reports WHERE created<?', (time.time() - 30 * 86400,))
        time.sleep(2)
