import base64
import sys
import time
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'server/feedback'))
from email_template import render_feedback

data = dict(title='播放全屏后，底部进度条没有显示', description='打开影片并进入全屏后，底部的播放进度条没有出现。\n希望移动鼠标时可以显示进度、音量和退出全屏按钮。', steps='1. 打开一部影片并开始播放\n2. 点击播放器右下角的全屏按钮\n3. 将鼠标移动到视频底部', version='1.1.14', platform='Windows 11', reply_email='viewer@example.com')
html = render_feedback(data, '7c2a4025-e5c2-46e5-bec8-fb02b81631c0', time.time())
image = base64.b64encode((root / 'server/feedback/brand-logo.jpg').read_bytes()).decode()
(root / 'dist-windows/feedback-email-preview.html').write_text(html.replace('cid:kennysvideo-logo', 'data:image/jpeg;base64,' + image), encoding='utf-8')
print('HTML preview generated; no email sent')
