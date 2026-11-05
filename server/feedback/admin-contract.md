# 反馈管理接口（实现前契约）

所有管理路由均位于 `/feedback-admin`，通过同一 HTTPS 域名访问，不开放跨域。管理员密码用 PBKDF2-SHA256 哈希保存；登录建立 8 小时服务端会话，Cookie 为 Secure、HttpOnly、SameSite=Strict。所有写请求除登录外要求会话 CSRF token，登录和写请求要求精确 Origin 匹配 ADMIN_ORIGIN。未配置管理员密码时管理路由返回 503。

- GET `/feedback-admin`：登录页/管理页静态外壳，不含反馈数据。
- POST `/feedback-admin/login`：JSON password，成功返回 csrf_token，并设置会话 Cookie。错误 401；同 IP 15 分钟最多 5 次失败，超出 429。
- GET `/feedback-admin/session`：返回当前 csrf_token。
- POST `/feedback-admin/logout`：撤销会话。
- POST `/feedback-admin/password`：current_password、new_password（6–256 字符且非全空白），验证当前密码后保存 PBKDF2 哈希至 SQLite，撤销所有会话，要求重新登录。当前密码错误返回 400 current_password_incorrect，同 IP 15 分钟最多 5 次失败。密码或哈希不写入审计详情。
- GET `/feedback-admin/reports?page=1`：每页 20 条，最多保留 30 天；返回内容、来源 IP（若已告知并记录）、随机安装标识摘要、邮件发送状态及处理分类。
- POST `/feedback-admin/review`：report_id、category（unreviewed/actionable/spam/abuse/duplicate/other），管理员人工判断，不自动判断情绪。
- POST `/feedback-admin/ban`：report_id、days（整数 1–365）、reason（1–300 字）；根据该报告的安装标识禁用，旧版无标识返回 409；不封同 IP 的其他设备。
- GET `/feedback-admin/bans`：有效禁用列表。
- POST `/feedback-admin/unban`：ban_id，撤销禁用。
- GET `/feedback-admin/audit`：最近 100 条操作，最多保存 90 天。

错误响应统一 `{success:false,code:string}`，未登录 401，CSRF/来源错误 403，校验失败 400，不存在 404。管理响应 no-store，页面禁止嵌入并采用同源 CSP；前端使用 textContent 渲染用户输入。

便捷访问入口 `http://kennyspan.xyz:4132` 仅返回跳转到 `https://www.kennyspan.xyz/feedback-admin`，该端口不承载登录或反馈数据，也不公开 Gunicorn 端口。需要域名解析正确，并在云安全组和主机防火墙允许入站 TCP 4132。

公开报告新增可选 `device_id`（随机 UUID）及 `privacy_version:2`，同时出现；客户端持久保存安装标识，不读取硬件信息。服务端仅在声明 privacy_version:2 时保存来源 IP，设备标识只保存带密钥摘要。公开接口不返回 IP 或设备标识。被禁用返回 423 `{success:false,code:"device_blocked",blocked_until:unix_seconds}`，不入队、不发送邮件；到期自动恢复。安装标识可被清除或修改，不声称不可绕过的硬件封禁。

报告及原始 IP 保留 30 天，过期禁用会在清理中删除；有效禁用最多 365 天，操作记录 90 天。旧客户端仍可反馈，但无安装标识无法设备封禁。
