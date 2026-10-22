# Linux 反馈服务

浏览器/Windows 客户端以 JSON 请求 `POST /api/kennysvideo/feedback`，服务器先持久保存再通过 QQ SMTP SSL 465 发给固定维护者邮箱。客户端不含 SMTP 凭据。数据库保留报告最多 30 天；回复邮箱可选，用户不能指定收件人、发件人或 SMTP 服务器。

Debian 部署依赖：`apt-get install nginx gunicorn ca-certificates python3`。将本目录放在 `/opt/kennysvideo-feedback`，创建无登录权限的 `kennysvideo-feedback` 用户，将两个 systemd 单元复制至 `/etc/systemd/system/`。HTTP 仅监听 `127.0.0.1:18790`，由 Nginx HTTPS 反代；不能把 Gunicorn 端口公开。

将 `env.example` 复制为 `/etc/kennysvideo-feedback.env`，由 root 拥有并设置 0600。仅在服务器设置 SMTP 用户、邮箱 SMTP 授权码、固定收件邮箱和随机 IP 哈希密钥。不要使用邮箱登录密码，不要把真实 env、证书私钥或数据库加入源码包。用 `systemctl enable --now kennysvideo-feedback kennysvideo-feedback-worker` 启动。

`nginx.conf` 是独立域名示例：已有网站时应把两个精确路径 location 合并到现有域名配置，保留其他 location、证书与站点设置。证书和私钥路径分别为 `/etc/kennysvideo-feedback/tls/fullchain.pem` 和 `private.key`；私钥由 root 0600 保存。先执行 `nginx -t`，成功后 reload，不关闭证书验证。

接口契约见 `openapi.json`。202 只保证报告进入持久发送队列，不表示邮箱已送达。相同内容重试应复用 request_id；同一 ID 的不同内容返回 409。SMTP 异常最多重试 5 次，失败类型可在 worker 日志查询，报告内容和凭据不写入日志。进程在发送完成但记录完成前崩溃仍可能造成重复邮件，稳定 Message-ID 用于辅助去重，不承诺邮件恰好投递一次。

默认限制每 IP 15 分钟 5 条、全局每天 100 条，队列上限 1000。数据库只存 IP 的带密钥哈希；CORS 精确允许配置的来源。公开桌面接口无法保守客户端密钥，因此没有把共享密码当作鉴权；持续遭滥用时需在服务端增加验证码/封禁等措施。反代必须覆盖 X-Real-IP，不能信任来自公网的自报 IP。客户端 timeout 后可复用同一编号手动重试。

健康检查 `GET /api/kennysvideo/feedback/health` 仅证明 HTTP API 可用，不验证 SMTP。部署后需要真实客户端提交、worker sent 状态和收件邮箱确认；还需在国内无代理网络检查域名、HTTPS 和提交路径，不能以单台服务器可访问代替。

本地测试：`python tests/feedbackServerTest.py`。测试运行真实 WSGI HTTP 与 SQLite；邮件传输使用 SMTP 测试替身，不调用 QQ、不发送真实邮件。本机没有 Postman CLI，未把这些测试声称为 Postman simulation。

HTML 邮件由 `email_template.py` 渲染，表格布局和内联样式配合纯文本备用内容；`brand-logo.jpg` 通过 CID 内嵌，所有用户输入均转义。服务升级应同时复制这三个文件，保留原 env、证书和数据库；重启 HTTP 与 worker。`tests/previewFeedbackEmail.py` 与 `tests/renderFeedbackEmail.cjs` 可生成不发送邮件的电脑/手机预览。
