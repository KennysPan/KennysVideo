# Linux 反馈服务

浏览器/Windows 客户端以 JSON 请求 `POST /api/kennysvideo/feedback`，服务器先持久保存再通过 QQ SMTP SSL 465 发给固定维护者邮箱。客户端不含 SMTP 凭据。数据库保留报告最多 30 天；回复邮箱可选，用户不能指定收件人、发件人或 SMTP 服务器。

Debian 部署依赖：`apt-get install nginx gunicorn ca-certificates python3`。将本目录放在 `/opt/kennysvideo-feedback`，创建无登录权限的 `kennysvideo-feedback` 用户，将两个 systemd 单元复制至 `/etc/systemd/system/`。HTTP 仅监听 `127.0.0.1:18790`，由 Nginx HTTPS 反代；不能把 Gunicorn 端口公开。

将 `env.example` 复制为 `/etc/kennysvideo-feedback.env`，由 root 拥有并设置 0600。仅在服务器设置 SMTP 用户、邮箱 SMTP 授权码、固定收件邮箱和随机 IP 哈希密钥。不要使用邮箱登录密码，不要把真实 env、证书私钥或数据库加入源码包。用 `systemctl enable --now kennysvideo-feedback kennysvideo-feedback-worker` 启动。

`nginx.conf` 是独立域名示例：已有网站时应把两个精确路径 location 合并到现有域名配置，保留其他 location、证书与站点设置。证书和私钥路径分别为 `/etc/kennysvideo-feedback/tls/fullchain.pem` 和 `private.key`；私钥由 root 0600 保存。先执行 `nginx -t`，成功后 reload，不关闭证书验证。

接口契约见 `openapi.json`。202 只保证报告进入持久发送队列，不表示邮箱已送达。相同内容重试应复用 request_id；同一 ID 的不同内容返回 409。SMTP 异常最多重试 5 次，失败类型可在 worker 日志查询，报告内容和凭据不写入日志。进程在发送完成但记录完成前崩溃仍可能造成重复邮件，稳定 Message-ID 用于辅助去重，不承诺邮件恰好投递一次。

默认限制每 IP 15 分钟 5 条、全局每天 100 条，队列上限 1000。旧版仅保存 IP 带密钥哈希；已向用户说明数据用途的新版请求带 privacy_version:2 和随机 device_id，额外保存来源 IP 及安装标识摘要供管理员处理滥发。报告及 IP 保留最多 30 天，原始安装标识不持久保存。CORS 精确允许配置的来源。公开桌面接口无法保守客户端密钥，因此没有把共享密码当作鉴权。反代必须覆盖 X-Real-IP，不能信任来自公网的自报 IP。客户端 timeout 后可复用同一编号手动重试。

## 反馈后台

管理网页位于 `https://www.kennyspan.xyz/feedback-admin`，未配置 ADMIN_PASSWORD_HASH 或数据库密码时不可用。在服务器执行 `python3 /opt/kennysvideo-feedback/configure_admin.py`，交互设置至少 6 字符的密码，再 `systemctl restart kennysvideo-feedback`。也可登录网页后点击“修改密码”，验证当前密码后设置新密码；网页修改的 PBKDF2-SHA256 哈希持久保存在 SQLite，优先于环境变量的初始密码，全部会话随即退出。密码不放进源码或安装包。所有管理写操作要求同源 Origin 和会话 CSRF token；Cookie 为 Secure/HttpOnly/SameSite=Strict，8 小时过期，登录和当前密码验证失败均限流。管理端不开放 CORS。

`admin-entry-nginx.conf` 提供 `http://kennyspan.xyz:4132` 便捷入口，302 跳转至 HTTPS 管理页。合并或启用该配置前检查端口空闲，并在云安全组/主机防火墙允许入站 TCP 4132。该端口不承载登录表单或管理接口；保留 Gunicorn 仅监听 127.0.0.1。网页自行修改密码后，本地首次部署凭据文件不会自动同步。

支持报告分页、人工分类、查看来源 IP、按随机安装标识限制反馈 1–365 天、提前解除和操作记录。不按反馈情绪自动封禁；正常批评不应受限。限制只影响反馈接口，同 IP 其他设备不受影响。旧报告没有安装标识无法封禁；清除或伪造本机安装标识可以绕过限制，不属于硬件级封禁。操作记录保留 90 天，有效禁用保留至到期。完整契约见 `admin-contract.md`。

升级需复制整个服务目录（包括 admin.py、admin.html、admin.js、admin.css），合并 nginx.conf 的管理路径反代，保留 env、数据库和证书。先备份代码、配置与 SQLite，再重启 HTTP 和 worker；数据库升级仅增加列和表，保留旧数据。备份可能包含反馈隐私数据，必须 root 私有并在 30 天内清除；不上传到代码仓库。

健康检查 `GET /api/kennysvideo/feedback/health` 仅证明 HTTP API 可用，不验证 SMTP。部署后需要真实客户端提交、worker sent 状态和收件邮箱确认；还需在国内无代理网络检查域名、HTTPS 和提交路径，不能以单台服务器可访问代替。

本地测试：`python tests/feedbackAdminTest.py`（含原反馈回归），`node tests/feedbackAdminUI.cjs`，`node tests/bugReport.cjs`。测试运行真实 WSGI HTTP 与 SQLite；原邮件传输回归使用 SMTP 测试替身，不调用 QQ、不发送真实邮件。后台页面联动直接访问本地服务，不把这些测试声称为 Postman simulation。

HTML 邮件由 `email_template.py` 渲染，表格布局和内联样式配合纯文本备用内容；`brand-logo.jpg` 通过 CID 内嵌，所有用户输入均转义。服务升级应同时复制这三个文件，保留原 env、证书和数据库；重启 HTTP 与 worker。`tests/previewFeedbackEmail.py` 与 `tests/renderFeedbackEmail.cjs` 可生成不发送邮件的电脑/手机预览。
