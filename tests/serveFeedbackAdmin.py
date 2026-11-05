"""Ephemeral local management fixture; no production secrets or SMTP worker."""
import json
import sys
import tempfile
import uuid
from pathlib import Path
from wsgiref.simple_server import make_server, WSGIRequestHandler

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server/feedback'))
from feedback import Feedback
from admin import password_hash


class Quiet(WSGIRequestHandler):
    def log_message(self, *args): pass


with tempfile.TemporaryDirectory() as directory:
    password = 'local-preview-password-only'
    config = dict(SMTP_USER='sender@example.test', SMTP_PASSWORD='not-a-real-secret', FEEDBACK_TO='maintainer@example.test',
                  IP_HASH_KEY='f'*64, FEEDBACK_DB=str(Path(directory)/'fixture.sqlite3'), ADMIN_PASSWORD_HASH=password_hash(password))
    service = Feedback(config)
    server = make_server('127.0.0.1', 0, service.application, handler_class=Quiet)
    origin = f'http://127.0.0.1:{server.server_port}'
    service.config['ADMIN_ORIGIN'] = origin
    service.origins.add(origin)
    report = dict(request_id=str(uuid.uuid4()), title='全屏播放时进度条偶尔不显示', description='进入全屏后，移动鼠标时未出现进度条。退出全屏后可恢复。',
                  steps='打开影片 → 点击全屏 → 移动鼠标', version='1.1.17', platform='Windows', reply_email='preview@example.test', device_id=str(uuid.uuid4()), privacy_version=2)
    service.enqueue(report, '203.0.113.25')
    service.enqueue({**report,'request_id':str(uuid.uuid4()),'device_id':str(uuid.uuid4()),'title':'<img src=x onerror="window.xssExecuted=true">','description':'这是用于验证安全渲染的测试内容。'}, '198.51.100.32')
    print(json.dumps(dict(origin=origin, password=password, report=report)), flush=True)
    server.serve_forever()
