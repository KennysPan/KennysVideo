# KennysVideo 1.1.31 · Windows / Android

- 配置导出改为内置密钥 AES-256-GCM 加密的 `.KennysVideo` 文件；导入按内容自动识别、解密和校验，无需输入密码。
- 内部结构为 `name: KennysVideo-Settings`，保留 time、cfgVer、data、hash；时间和哈希自动生成，兼容旧版 LibreTV/KennysVideo JSON。
- 内置密钥可从软件提取，仅防止直接查看，不适合存放高敏感信息；文件损坏或验证失败不写入，导入仅恢复允许的设置项。
- 新增青蓝、翡翠、紫罗兰、玫瑰四种深色主题配色，即时切换并记住，支持首页、设置、播放器及配置迁移。
- Android 保存面板支持 `.KennysVideo` 后缀，沿用原安装签名。

Windows 搜索问题仍在排查，本版未包含该问题的修复。

附件：Windows 安装版、便携版、Android APK（手机更新包）、完整源码、双端更新清单与 SHA256；附 Mac/Linux 构建包。

基于 KeyRotate/LibreTV-App 修改，上游 LibreSpark/LibreTV；保留 LICENSE、NOTICE 和第三方许可。
