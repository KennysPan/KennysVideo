// Manual browser check: opening the page never sends a report automatically.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../public');
http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end('<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><title>KennysVideo 反馈检查</title><link rel="stylesheet" href="/css/bug_report.css"><body style="background:#101722;color:white;font-family:system-ui;padding:32px"><h1>KennysVideo 反馈检查</h1><p>仅用于检查当前待发布反馈功能；点击发送前不会提交任何数据。</p><button onclick="openBugReport()">反馈 BUG</button><script src="/js/config.js"></script><script src="/js/bug_report_config.js"></script><script src="/js/bug_report.js"></script></body></html>');
    }
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', ({ '.css': 'text/css', '.js': 'application/javascript' })[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
}).listen(3019, '127.0.0.1', () => console.log('Feedback preview: http://127.0.0.1:3019/; no automatic submission'));
