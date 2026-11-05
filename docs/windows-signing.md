# Windows 开发者名称与代码签名

本项目在文件属性、安装器和安装记录中使用 KennysPan 作为开发者名称，并保留应用标识 `com.libretv.app` 及旧安装记录路径以支持升级。

文件属性的 CompanyName/作者字段是元数据，不提供身份认证。目前正式文件未使用受信任的 Authenticode 代码签名，Windows 智能应用控制仍可能阻止运行。网站的 HTTPS/SSL 证书不能替代代码签名证书。

要验证发布者身份，需要维护者取得受信任提供商签发的代码签名证书或符合要求的签名服务，并按其身份审核和密钥保护要求配置构建。签名应涵盖应用程序、安装器与卸载器；发布用 SHA256 必须在签名完成后计算。证书主体名称由签发机构核验，不由程序任意指定。

参考：[Microsoft 智能应用控制常见问题](https://support.microsoft.com/en-us/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions)、[Microsoft 代码签名说明](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control)。
