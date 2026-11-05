"""Local HTTP/SQLite management regression; no remote calls or mail delivery."""
import json
import sqlite3
import sys
import time
import unittest
import urllib.error
import urllib.request
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from feedbackServerTest import FeedbackTests, module
import admin


class AdminTests(unittest.TestCase):
    setUp = FeedbackTests.setUp
    tearDown = FeedbackTests.tearDown
    report = FeedbackTests.report

    @classmethod
    def setUpClass(cls):
        cls.password = 'local-test-password-not-used-in-production'
        cls.encoded = admin.password_hash(cls.password)

    def request(self, route, body=None, cookie='', csrf='', origin='https://www.kennyspan.xyz'):
        request = urllib.request.Request(self.url.split(module.API_PATH)[0] + '/feedback-admin' + route,
            data=None if body is None else json.dumps(body).encode(),
            headers={'Content-Type':'application/json', 'Origin':origin, 'Cookie':cookie, 'X-CSRF-Token':csrf})
        try:
            response = urllib.request.urlopen(request, timeout=10)
        except urllib.error.HTTPError as e:
            response = e
        with response:
            raw = response.read()
            data = json.loads(raw) if 'application/json' in response.headers.get('Content-Type','') else raw
            return response.status, dict(response.headers), data

    def login(self):
        self.service.config['ADMIN_PASSWORD_HASH'] = self.encoded
        status, headers, data = self.request('/login', {'password':self.password})
        self.assertEqual(status, 200)
        return headers['Set-Cookie'].split(';')[0], data['csrf_token']

    def new_report(self, device=None):
        report = self.report()
        report.update(device_id=device or str(uuid.uuid4()), privacy_version=2)
        return report

    def test_auth_csrf_cookie_and_logout(self):
        self.assertEqual(self.request('/reports')[0], 503)
        self.service.config['ADMIN_PASSWORD_HASH'] = self.encoded
        self.assertEqual(self.request('/reports')[0], 401)
        self.assertEqual(self.request('/login', {'password':self.password}, origin='https://evil.test')[0], 403)
        status, headers, data = self.request('/login', {'password':self.password})
        self.assertEqual(status, 200)
        for flag in ('Secure', 'HttpOnly', 'SameSite=Strict'):
            self.assertIn(flag, headers['Set-Cookie'])
        cookie = headers['Set-Cookie'].split(';')[0]
        csrf = data['csrf_token']
        self.assertEqual(self.request('/session', cookie=cookie)[0], 200)
        self.assertEqual(self.request('/logout', {}, cookie=cookie)[0], 403)
        self.assertEqual(self.request('/logout', {}, cookie=cookie, csrf=csrf, origin='https://evil.test')[0], 403)
        self.assertEqual(self.request('/logout', {}, cookie=cookie, csrf=csrf)[0], 200)
        self.assertEqual(self.request('/reports', cookie=cookie)[0], 401)

    def test_device_ban_same_ip_isolation_expiry_unban_and_audit(self):
        cookie, csrf = self.login()
        a, b = self.new_report(), self.new_report()
        for report in (a, b):
            self.assertEqual(self.service.enqueue(report, '203.0.113.8')[0], 202)
        status, _, result = self.request('/reports', cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(result['total'], 2)
        self.assertEqual(result['reports'][0]['source_ip'], '203.0.113.8')
        self.assertNotIn('device_id', result['reports'][0])
        ban = {'report_id':a['request_id'], 'days':7, 'reason':'重复滥发（测试）'}
        self.assertEqual(self.request('/ban', ban, cookie, csrf)[0], 200)
        blocked, result = self.service.enqueue({**a,'request_id':str(uuid.uuid4())}, '198.51.100.9')
        self.assertEqual(blocked, 423)  # Device blocked even after changing IP.
        self.assertGreater(result['blocked_until'], time.time() + 6 * 86400)
        self.assertEqual(self.service.enqueue({**b,'request_id':str(uuid.uuid4())}, '203.0.113.8')[0], 202)
        bans = self.request('/bans', cookie=cookie)[2]['bans']
        self.assertEqual(len(bans), 1)
        self.assertEqual(self.request('/unban', {'ban_id':bans[0]['id']}, cookie, csrf)[0], 200)
        self.assertEqual(self.service.enqueue({**a,'request_id':str(uuid.uuid4())}, '203.0.113.8')[0], 202)
        self.assertEqual(self.request('/ban', ban, cookie, csrf)[0], 200)
        with self.service.connect() as db:
            db.execute('UPDATE device_bans SET until=?', (time.time() - 1,))
        self.assertEqual(self.service.enqueue({**a,'request_id':str(uuid.uuid4())}, '198.51.100.9')[0], 202)
        self.assertEqual(len(self.request('/audit', cookie=cookie)[2]['audit']), 3)

    def test_legacy_migration_disclosure_retention_and_no_raw_device(self):
        cookie, csrf = self.login()
        legacy = self.report()
        modern = self.new_report()
        self.assertEqual(self.service.enqueue(legacy,'203.0.113.1')[0],202)
        self.assertEqual(self.service.enqueue(modern,'203.0.113.2')[0],202)
        self.assertEqual(self.service.enqueue(modern,'203.0.113.2')[0],200)
        with self.service.connect() as db:
            rows = db.execute('SELECT body,device_hash,source_ip FROM reports ORDER BY created').fetchall()
            self.assertIsNone(rows[0]['source_ip'])
            self.assertIsNone(rows[0]['device_hash'])
            self.assertEqual(rows[1]['source_ip'], '203.0.113.2')
            self.assertNotIn(modern['device_id'], rows[1]['body'])
            self.assertNotEqual(rows[1]['device_hash'], modern['device_id'])
            db.execute('UPDATE reports SET created=? WHERE id=?', (time.time() - 31*86400, modern['request_id']))
        self.assertEqual(self.request('/reports',cookie=cookie)[2]['total'],1)
        self.assertEqual(self.request('/ban',{'report_id':legacy['request_id'],'days':1,'reason':'test'},cookie,csrf)[0],409)
        bad = self.new_report(); bad.pop('privacy_version')
        with self.assertRaises(ValueError): self.service.enqueue(bad,'203.0.113.1')

    def test_validation_review_pagination_and_xss_safe_assets(self):
        cookie, csrf = self.login()
        r = self.new_report(); r['title'] = '<img src=x onerror=alert(1)>'
        self.service.enqueue(r,'203.0.113.8')
        for days in (0,366,True,1.5,'7'):
            self.assertEqual(self.request('/ban',{'report_id':r['request_id'],'days':days,'reason':'test'},cookie,csrf)[0],400)
        self.assertEqual(self.request('/review',{'report_id':r['request_id'],'category':'spam'},cookie,csrf)[0],200)
        self.assertEqual(self.request('/reports',cookie=cookie)[2]['reports'][0]['category'],'spam')
        self.assertEqual(self.request('/reports?page=-1',cookie=cookie)[0],400)
        status, headers, raw = self.request('')
        self.assertEqual(status,200)
        self.assertEqual(headers['X-Frame-Options'],'DENY')
        self.assertEqual(headers['Cache-Control'],'no-store')
        self.assertNotIn(r['title'].encode(),raw)

    def test_login_rate_limit_and_session_expiry(self):
        self.service.config['ADMIN_PASSWORD_HASH'] = self.encoded
        for _ in range(5): self.assertEqual(self.request('/login',{'password':'wrong'})[0],401)
        self.assertEqual(self.request('/login',{'password':self.password})[0],429)
        with self.service.connect() as db: db.execute('DELETE FROM admin_logins')
        cookie, csrf = self.login()
        with self.service.connect() as db: db.execute('UPDATE admin_sessions SET expires=?',(time.time()-1,))
        self.assertEqual(self.request('/reports',cookie=cookie)[0],401)

    def test_proxy_ip_spoofing(self):
        self.assertEqual(self.service.client_ip({'REMOTE_ADDR':'198.51.100.1','HTTP_X_REAL_IP':'203.0.113.1'}),'198.51.100.1')
        self.assertEqual(self.service.client_ip({'REMOTE_ADDR':'127.0.0.1','HTTP_X_REAL_IP':'203.0.113.1'}),'203.0.113.1')

    def test_password_change_revokes_sessions_and_survives_restart(self):
        cookie, csrf = self.login()
        other_cookie, _ = self.login()
        new_password = 'new-local-password-123'
        body = {'current_password':self.password,'new_password':new_password}
        self.assertEqual(self.request('/password',body,cookie,'bad-token')[0],403)
        self.assertEqual(self.request('/password',{**body,'current_password':'wrong'},cookie,csrf)[2]['code'],'current_password_incorrect')
        self.assertEqual(self.request('/password',{**body,'new_password':'12345'},cookie,csrf)[0],400)
        self.assertEqual(self.request('/password',body,cookie,csrf)[0],200)
        self.assertEqual(self.request('/session',cookie=cookie)[0],401)
        self.assertEqual(self.request('/session',cookie=other_cookie)[0],401)
        self.assertEqual(self.request('/login',{'password':self.password})[0],401)
        self.assertEqual(self.request('/login',{'password':new_password})[0],200)
        restarted = module.Feedback(self.service.config)
        with restarted.connect() as db:
            encoded = admin.current_password_hash(restarted,db)
            self.assertTrue(admin.verify_password(new_password,encoded))
            self.assertNotIn(new_password,encoded)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM admin_audit WHERE action='password_change'").fetchone()[0],1)

    def test_password_change_current_password_rate_limit(self):
        cookie, csrf = self.login()
        for _ in range(5):
            self.assertEqual(self.request('/password',{'current_password':'wrong','new_password':'test-password'},cookie,csrf)[0],400)
        self.assertEqual(self.request('/password',{'current_password':self.password,'new_password':'test-password'},cookie,csrf)[0],429)

    def test_upgrade_existing_schema_preserves_reports(self):
        path = str(Path(self.directory.name) / 'old-schema.sqlite3')
        report = self.report()
        import hashlib
        encoded = json.dumps(report,ensure_ascii=False,sort_keys=True)
        digest = hashlib.sha256(encoded.encode()).hexdigest()
        with sqlite3.connect(path) as db:
            db.execute('CREATE TABLE reports(id TEXT PRIMARY KEY,digest TEXT NOT NULL,body TEXT NOT NULL,ip_hash TEXT NOT NULL,created REAL NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_attempt REAL NOT NULL,lease_until REAL NOT NULL DEFAULT 0,error TEXT)')
            db.execute('INSERT INTO reports(id,digest,body,ip_hash,created,state,next_attempt) VALUES(?,?,?,?,?,?,?)', (report['request_id'],digest,encoded,'old-hash',time.time(),'sent',time.time()))
        db.close()
        upgraded = module.Feedback({**self.config,'FEEDBACK_DB':path})
        self.assertEqual(upgraded.enqueue(report,'203.0.113.1')[0],200)
        with upgraded.connect() as db:
            row = db.execute('SELECT * FROM reports').fetchone()
            self.assertEqual(row['body'],encoded)
            self.assertEqual(row['state'],'sent')
            self.assertIsNone(row['source_ip'])
            self.assertIsNone(row['device_hash'])
            self.assertEqual(row['category'],'unreviewed')


if __name__ == '__main__': unittest.main()
