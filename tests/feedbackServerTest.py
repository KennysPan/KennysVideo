"""Real HTTP + SQLite checks; SMTP stand-in never connects to a mail provider."""
import importlib.util
import json
import smtplib
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from wsgiref.simple_server import make_server, WSGIRequestHandler

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server/feedback'))
spec = importlib.util.spec_from_file_location('feedback', Path(__file__).resolve().parents[1] / 'server/feedback/feedback.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Quiet(WSGIRequestHandler):
    def log_message(self, *args):
        pass


class SmtpFixture:
    messages = []
    failing = False
    def __init__(self, host, port, context, timeout):
        assert context.check_hostname and context.verify_mode == 2
        assert host == 'smtp.qq.com' and port == 465 and timeout <= 10
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def login(self, user, password):
        assert user == 'sender@example.test' and password == 'test-only-not-a-password'
        if self.failing:
            raise smtplib.SMTPAuthenticationError(535, b'test authentication failure')
    def send_message(self, message, from_addr, to_addrs):
        self.messages.append((message, from_addr, to_addrs))
        return {}


class FeedbackTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.config = dict(SMTP_USER='sender@example.test', SMTP_PASSWORD='test-only-not-a-password', FEEDBACK_TO='maintainer@example.test', IP_HASH_KEY='a' * 64, FEEDBACK_DB=str(Path(self.directory.name) / 'feedback.sqlite3'), ALLOWED_ORIGINS='http://tauri.localhost')
        self.service = module.Feedback(self.config, SmtpFixture)
        self.server = make_server('127.0.0.1', 0, self.service.application, handler_class=Quiet)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f'http://127.0.0.1:{self.server.server_port}' + module.API_PATH
        SmtpFixture.messages = []
        SmtpFixture.failing = False
    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.directory.cleanup()
    def report(self):
        return dict(request_id=str(uuid.uuid4()), title='测试标题', description='测试问题描述：点击播放后界面没有响应。', steps='打开影片', reply_email='reply@example.test', version='1.1.14', platform='Windows')
    def request(self, report=None, method='POST', origin='http://tauri.localhost', headers=None, raw=None):
        data = raw if raw is not None else json.dumps(report or self.report()).encode()
        req = urllib.request.Request(self.url, data=data if method=='POST' else None, method=method, headers={'Origin':origin, 'Content-Type':'application/json', **(headers or {})})
        try: response = urllib.request.urlopen(req, timeout=5)
        except urllib.error.HTTPError as error: response = error
        with response:
            body = response.read()
            return response.status, dict(response.headers), json.loads(body) if body else {}
    def test_acceptance_delivery_and_fixed_recipient(self):
        report = self.report()
        status, headers, body = self.request(report)
        self.assertEqual(status, 202)
        self.assertEqual(body['status'], 'queued')
        self.assertEqual(headers['Access-Control-Allow-Origin'], 'http://tauri.localhost')
        self.assertFalse(SmtpFixture.messages)
        self.assertTrue(self.service.deliver_one())
        message, sender, recipients = SmtpFixture.messages[0]
        self.assertEqual(sender, 'sender@example.test')
        self.assertEqual(recipients, ['maintainer@example.test'])
        self.assertEqual(message['Reply-To'], report['reply_email'])
        self.assertIn(report['description'], message.get_body(preferencelist=('plain',)).get_content())
        html = message.get_body(preferencelist=('html',)).get_content()
        self.assertIn('问题描述', html)
        self.assertIn('cid:kennysvideo-logo', html)
        self.assertTrue(any(part.get('Content-ID') == '<kennysvideo-logo>' for part in message.walk()))
        self.assertEqual(self.request(report)[2]['status'], 'sent')
        self.assertFalse(self.service.deliver_one())
    def test_restart_persistence_deduplication_and_conflict(self):
        report = self.report()
        self.assertEqual(self.request(report)[0], 202)
        restarted = module.Feedback(self.config, SmtpFixture)
        self.assertEqual(restarted.enqueue(report, '127.0.0.1')[0], 200)
        report['title'] += '不同内容'
        self.assertEqual(self.request(report)[0], 409)
        self.assertTrue(restarted.deliver_one())
        self.assertEqual(len(SmtpFixture.messages), 1)
    def test_concurrent_duplicates(self):
        report = self.report()
        with ThreadPoolExecutor(max_workers=6) as executor:
            statuses = list(executor.map(lambda _: self.service.enqueue(report, '127.0.0.1')[0], range(6)))
        self.assertEqual(statuses.count(202), 1)
        self.assertEqual(statuses.count(200), 5)
    def test_bad_inputs_never_queue(self):
        for change in [dict(description=' '), dict(title='bad\r\nBcc: other@example.test'), dict(reply_email='x\r\nBcc:y@example.test'), dict(request_id='not-a-uuid'), dict(to='other@example.test'), dict(description=['bad'])]:
            self.assertEqual(self.request({**self.report(), **change})[0], 400)
        self.assertEqual(self.request(raw=b'{invalid')[0], 400)
        self.assertEqual(self.request(raw=b'x' * 32769)[0], 413)
        self.assertEqual(self.request(headers={'Content-Type':'text/plain'})[0], 415)
        self.assertFalse(self.service.deliver_one())
    def test_single_character_description_is_accepted(self):
        report = self.report()
        report['description'] = '短'
        self.assertEqual(self.request(report)[0], 202)
    def test_cors_preflight(self):
        headers = {'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}
        self.assertEqual(self.request(method='OPTIONS', headers=headers)[0], 204)
        self.assertEqual(self.request(origin='https://untrusted.example')[0], 403)
        self.assertEqual(self.request(method='OPTIONS', headers={**headers,'Access-Control-Request-Headers':'authorization'})[0], 403)
    def test_html_mail_escapes_user_content_and_keeps_plain_text(self):
        report = self.report()
        report['title'] = '<img src=x onerror=alert(1)>'
        report['description'] = '<script>alert("x")</script>\n第二行 & 内容'
        self.request(report)
        self.service.deliver_one()
        message = SmtpFixture.messages[0][0]
        html = message.get_body(preferencelist=('html',)).get_content()
        self.assertNotIn('<script>', html)
        self.assertNotIn('<img src=x', html)
        self.assertIn('&lt;script&gt;', html)
        self.assertIn('<br>', html)
        self.assertIn('&amp;', html)
        self.assertIn(report['description'], message.get_body(preferencelist=('plain',)).get_content())
        self.assertEqual(message.get_content_type(), 'multipart/alternative')
    def test_rate_limits_and_private_ip_hash(self):
        for _ in range(5): self.assertEqual(self.request()[0], 202)
        self.assertEqual(self.request()[0], 429)
        with self.service.connect() as db:
            value = db.execute('SELECT ip_hash FROM reports LIMIT 1').fetchone()[0]
        self.assertEqual(len(value), 64)
        self.assertNotIn('127.0.0.1', value)
    def test_smtp_failure_keeps_report_and_stops_after_five_attempts(self):
        report = self.report()
        self.request(report)
        SmtpFixture.failing = True
        for _ in range(5):
            self.assertTrue(self.service.deliver_one())
            with self.service.connect() as db: db.execute('UPDATE reports SET next_attempt=0')
        result = self.request(report)[2]
        self.assertEqual(result['status'], 'failed')
        self.assertFalse(self.service.deliver_one())
        with self.service.connect() as db:
            row = db.execute('SELECT attempts,error,body FROM reports').fetchone()
        self.assertEqual(row['attempts'], 5)
        self.assertEqual(row['error'], 'SMTPAuthenticationError')
        self.assertIn(report['description'], row['body'])
        self.assertNotIn(self.config['SMTP_PASSWORD'], row['body'])


if __name__ == '__main__': unittest.main()
