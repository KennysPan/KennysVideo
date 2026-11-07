# KennysVideo 1.1.32 · Windows / Android

- 重新完整发布，保留四种主题配色及配置迁移功能。
- 配置导出为 AES-256-GCM 加密的 `.KennysVideo` 文件，不再导出明文 `.json`。
- 解密后的结构为 `name: KennysVideo-Settings`、`time`、`cfgVer: 1.0.0`、`data`、`hash`，时间和 SHA256 自动生成。
- 实测电脑版真实下载文件、自动识别导入、设置恢复、手机原生保存调用及旧版 JSON 兼容；篡改文件拒绝导入。
- 内置密钥可从程序提取，只防止直接查看，不适合保存高敏感信息。

Windows 搜索问题仍在排查，本版未包含该问题的修复。

附件包含 Windows 安装版、便携版、Android APK（手机更新包）、源码、更新清单及 SHA256；另附 Mac/Linux 构建包。

基于 KeyRotate/LibreTV-App，上游 LibreSpark/LibreTV；保留 LICENSE、NOTICE 和第三方许可。
