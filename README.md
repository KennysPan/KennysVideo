![KennysVideo 宣传横幅](KennysVideo-banner.png)

# KennysVideo

面向 Windows 的开源视频客户端，提供影视搜索、在线播放和观看历史管理功能，安装即可使用，无需本地部署服务。

KennysVideo 基于 [KeyRotate/LibreTV-App](https://github.com/KeyRotate/LibreTV-App) 二次开发，由 KennysPan 维护，围绕桌面窗口、播放体验、界面呈现与版本更新进行持续优化。

## 功能特点

- **桌面窗口体验**：支持自由调整窗口大小、最小化、最大化与单实例运行，重复启动时唤起已有窗口。
- **播放与浏览**：支持影视搜索、在线播放、观看历史、全屏播放及影片海报展示；海报加载失败时使用统一默认封面。
- **系统托盘**：关闭窗口时可选择退出程序或最小化至系统托盘，并可记住个人偏好。
- **统一视觉设计**：采用深色界面与 KennysVideo 品牌元素，提供横向影片浏览及返回顶部功能。
- **双源版本更新**：支持启动检查与手动检查更新，提供下载进度展示和安装包 SHA256 校验。

## 下载与安装

[国内下载（Gitee）](https://gitee.com/kennysPan/kennys-video/releases/latest) · [GitHub 下载](https://github.com/KennysPan/KennysVideo/releases/latest)

当前提供 Windows x64 构建，请在发行版页面按需选择：

| 文件 | 用途 |
| --- | --- |
| *-x64-setup.exe | 安装程序，适用于首次安装及覆盖升级；升级时保留设置和观看历史。 |
| *-x64.exe | 免安装程序，在 Gitee 发行版页面提供。 |
| *-source.zip | 带版本号的完整修改版源码，包含 LICENSE、NOTICE 和构建说明。 |

平台自动生成的 Source code 压缩包仅包含本发布仓库的文档；完整应用源码请下载带版本号的 source.zip。

## 版本更新

程序启动时自动检查新版本，也可在设置页手动检查。更新检查优先连接 GitHub，连接超时或请求失败时自动切换至 Gitee；安装包下载过程中，GitHub 连接超时、下载停滞或速度过低时，自动尝试 Gitee 的同版本安装包。

发现新版本后，用户可查看版本变化与下载进度。安装包通过 SHA256 校验后，由用户确认退出程序并安装。未发现新版本时不弹窗；更新服务暂时不可用时，不影响继续使用程序。

较早版本若无法完成在线更新，可从发行版页面下载安装程序并覆盖升级。

## 开源来源与许可

- 二次开发基础：[KeyRotate/LibreTV-App](https://github.com/KeyRotate/LibreTV-App)
- 上游项目：[LibreSpark/LibreTV](https://github.com/LibreSpark/LibreTV)
- 修改版维护者：[KennysPan](https://github.com/KennysPan)

感谢原作者与开源社区贡献者。本项目保留原项目的 Apache License 2.0、版权声明及第三方许可，具体内容请参阅完整源码包中的 LICENSE、NOTICE 和相关许可文件。

## 仓库说明

本仓库用于发布 KennysVideo 安装包、版本信息及项目文档，不存储或分发影视视频内容。

[GitHub 仓库](https://github.com/KennysPan/KennysVideo) · [Gitee 仓库](https://gitee.com/kennysPan/kennys-video)
