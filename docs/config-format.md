# KennysVideo 配置容器

导出文件使用 `.KennysVideo` 后缀和 `application/octet-stream` MIME。解密后字段顺序为 name、time、cfgVer、data、hash；name 固定 KennysVideo-Settings，cfgVer 为 1.0.0，time 为导出时间毫秒字符串，hash 为 JSON.stringify(data) UTF-8 字节的 SHA256。数据包括原有设置、历史以及 kennysTheme，主题键采用已知配色白名单。

外层以 `KennysVideo-Config/1` 加换行开头，其后为包含 keyId、algorithm、iv、ciphertext 的 JSON。当前 keyId 为 builtin-1，AES-256-GCM 使用每次新生成的 12 字节随机 IV、128 位认证标签，以及文件头和 keyId 组成的 additionalData。密钥材料由管理员随代码维护，旧 keyId 对应材料不能随意更换，否则历史文件将无法解密。

此内置密钥方案经维护者确认用于自动导入。密钥可从客户端源码/软件提取，**不保证文件对掌握软件的人保密，也不证明文件来自可信作者**。请勿在配置中存储高敏感凭据。它不是用户密码加密，也不修改应用运行时 localStorage 的存储方式。配置加解密在设备本地完成，不为此向服务器发送配置。

导入按文件内容识别，因此改名或平台给出不同 MIME 不会阻止有效配置。兼容 name 为 LibreTV-Settings 或 KennysVideo-Settings 的旧版 JSON，导入先验证哈希、再验证值类型和主题白名单；仅恢复允许的键，绝不导入认证会话等任意内部存储键。解密/校验失败不写入；存储写入失败会回滚。最大文件为 10MiB，加密后超限会取消导出，不降级为明文。
