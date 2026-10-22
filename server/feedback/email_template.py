"""Inline CSS, table layout, and escaped text for HTML email clients."""
from datetime import datetime, timedelta, timezone
from html import escape
from urllib.parse import quote


def render_feedback(data, identifier, created, has_logo=True):
    def text(value):
        return escape(str(value), quote=True)
    def paragraphs(value):
        return text(value).replace('\r\n', '\n').replace('\r', '\n').replace('\n', '<br>')
    created_text = datetime.fromtimestamp(created, timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M')
    logo = '<td width="64" style="width:64px;vertical-align:middle"><img src="cid:kennysvideo-logo" width="48" height="48" alt="KennysVideo" style="display:block;width:48px;height:48px;border:0;border-radius:12px"></td>' if has_logo else ''
    reply = data.get('reply_email') or ''
    reply_line = text(reply) if reply else '未提供回复邮箱'
    reply_action = f'<a href="mailto:{text(quote(reply, safe="@._+-"))}" style="display:inline-block;padding:11px 20px;background:#087f9b;border:1px solid #087f9b;border-radius:8px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">回复反馈者</a>' if reply else '<span style="font-size:13px;color:#64748b">反馈者未提供邮箱，无需回复。</span>'
    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KennysVideo · 用户反馈</title></head>
<body style="margin:0;padding:0;background:#eef3f8;color:#172638;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;color:#eef3f8">KennysVideo 收到一份新的用户反馈：{text(data['title'])}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#eef3f8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:680px;border:1px solid #dce5ee;border-radius:16px;background:#ffffff;overflow:hidden">
<tr><td style="padding:28px 28px 24px;background:#111e30;border-top:4px solid #23c8df">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>{logo}<td style="vertical-align:middle"><div style="font-size:24px;font-weight:700;letter-spacing:-0.5px;color:#67e8f9">KennysVideo</div><div style="font-size:12px;line-height:20px;color:#a6b8cb;letter-spacing:1px">用户反馈 · BUG REPORT</div></td></tr></table>
<div style="padding-top:24px;font-size:12px;line-height:20px;color:#92a9c0">收到一份新的反馈</div>
<h1 style="margin:6px 0 0;font-size:23px;line-height:1.5;font-weight:700;color:#ffffff;word-break:break-word;overflow-wrap:anywhere">{text(data['title'])}</h1>
</td></tr>
<tr><td style="padding:24px 28px 0">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f2f8fc;border:1px solid #e1edf4;border-radius:10px"><tr>
<td width="50%" style="padding:14px 16px;vertical-align:top"><div style="font-size:11px;line-height:18px;color:#60768b">软件版本</div><div style="font-size:15px;line-height:24px;color:#087f9b;font-weight:700;word-break:break-word">{text(data['version'])}</div></td>
<td width="50%" style="padding:14px 16px;vertical-align:top"><div style="font-size:11px;line-height:18px;color:#60768b">运行平台</div><div style="font-size:15px;line-height:24px;color:#172638;font-weight:600;word-break:break-word">{text(data['platform'])}</div></td>
</tr></table>
</td></tr>
<tr><td style="padding:26px 28px 0"><h2 style="margin:0 0 12px;font-size:16px;line-height:24px;color:#152c43">问题描述</h2><div style="font-size:15px;line-height:1.85;color:#34485d;word-break:break-word;overflow-wrap:anywhere">{paragraphs(data['description'])}</div></td></tr>
<tr><td style="padding:24px 28px 0"><h2 style="margin:0 0 12px;font-size:16px;line-height:24px;color:#152c43">复现步骤</h2><div style="border-left:3px solid #23bfd3;padding:14px 16px;background:#f1fafc;border-radius:0 8px 8px 0;font-size:14px;line-height:1.85;color:#34485d;word-break:break-word;overflow-wrap:anywhere">{paragraphs(data.get('steps') or '反馈者未填写复现步骤。')}</div></td></tr>
<tr><td style="padding:24px 28px"><div style="border-top:1px solid #e7edf3;padding-top:20px"><div style="font-size:11px;color:#60768b;line-height:18px">反馈者邮箱</div><div style="margin-top:3px;font-size:14px;color:#34485d;line-height:24px;word-break:break-all">{reply_line}</div><div style="padding-top:14px">{reply_action}</div></div></td></tr>
<tr><td style="padding:18px 28px;background:#f7f9fc;border-top:1px solid #e7edf3"><div style="font-size:12px;line-height:22px;color:#60768b">提交时间：{created_text}（北京时间）</div><div style="font-size:11px;line-height:20px;color:#74869a;word-break:break-all">报告编号：{text(identifier)}</div><div style="padding-top:10px;font-size:11px;line-height:19px;color:#74869a">此邮件由 KennysVideo 反馈服务自动发送。报告中的文字由用户填写，请结合实际情况排查。</div></td></tr>
</table>
<div style="padding:18px 8px 4px;font-size:11px;line-height:20px;color:#7a8da2">KennysVideo · 让每一份反馈都得到认真对待</div>
</td></tr></table>
</body></html>'''
