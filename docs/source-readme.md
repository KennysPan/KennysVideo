# KennysVideo

KennysVideo 是基于 [KeyRotate/LibreTV-App](https://github.com/KeyRotate/LibreTV-App) 修改的 Windows 客户端；其上游项目为 [LibreSpark/LibreTV](https://github.com/LibreSpark/LibreTV)。感谢原作者和贡献者。本修改版由 KennysPan 维护，保留原有版权声明和仓库内的 Apache License 2.0（见 [LICENSE](../LICENSE)）；修改说明见 [NOTICE](../NOTICE)。各第三方库保留各自的许可证。

修改内容：Windows 窗口和全屏、KennysVideo 主题、影片封面加载、横向滚动控制、安装覆盖升级和启动版本检查。

国内发布地址：https://gitee.com/kennysPan/kennys-video/releases/latest

GitHub 备份：https://github.com/KennysPan/KennysVideo/releases/latest

1.1.7 起优先通过 GitHub 检查新版，3 秒超时或请求失败自动切换 Gitee。程序内下载安装包时，GitHub 超时、卡住或持续低速也会自动切换 Gitee。SHA256 校验通过后，由用户点击安装，保留设置和观看历史。没有更新不弹窗，断网不影响使用。旧版请先安装 1.1.7。

发布页提供安装包、免安装版和本修改版的源代码压缩包；源码不包含 node_modules 和 Rust target，可按 BUILDING.md 编译。

---

以下保留原项目说明：

# LibreTV-App 📺

**一个免费、跨平台的在线视频搜索与观看应用。**

[![GitHub Stars](https://img.shields.io/github/stars/KeyRotate/LibreTV-App?style=social)](https://github.com/KeyRotate/LibreTV-App/stargazers)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/KeyRotate/LibreTV-App)](https://github.com/KeyRotate/LibreTV-App/releases/latest)
[![GitHub all releases](https://img.shields.io/github/downloads/KeyRotate/LibreTV-App/total)](https://github.com/KeyRotate/LibreTV-App/releases)
[![GitHub License](https://img.shields.io/github/license/KeyRotate/LibreTV-App)](../LICENSE)

LibreTV-App 是一个免费的开源在线视频搜索与观看平台，旨在提供简洁、高效、无广告的观影体验。作为经典 [LibreTV](https://github.com/LibreSpark/LibreTV) 项目的现代化重构版本，本项目采用 [Tauri 2.0](https://tauri.app/) 框架开发，实现了对 Windows, macOS, Linux, 以及 Android 的原生支持。无论您在哪个设备上，都可以轻松享受海量影视资源。

---

## ✨ 主要特性

- 🎬 **海量资源聚合**: 搜索来自多个在线视频源的电影、电视剧、动漫及综艺节目。
- 🖥️ **原生跨平台体验**: 基于 Tauri 2.0 构建，提供接近原生的性能和流畅体验。支持 Windows, macOS, Linux, 和 Android。
- 📱 **移动端优先设计**: UI 界面为移动设备深度优化，确保在手机和平板上也能舒适操作。
- 🔍 **强大的筛选功能**: 增强的豆瓣热门内容和高级类型筛选，帮助您快速发现高分好评的影视作品。
- 🚀 **开箱即用**: 无需复杂的部署过程，直接下载安装包即可使用，告别配置烦恼。
- 🔐 **开源与安全**: 项目完全开源，代码透明，无任何跟踪或广告。

---

## 📸 应用截图

**桌面端:**

![LibreTV-App 桌面端主页](https://oss.keyrotate.com/public/images/dcef63b5-174c-4b6e-a9bc-15fefa86c9a0.jpg)
![LibreTV-App 桌面端搜索结果](https://oss.keyrotate.com/public/images/4b4ee048-7ba6-4136-94e4-3a6e2cd0c53d.jpg)
![LibreTV-App 桌面端视频详情](https://oss.keyrotate.com/public/images/4667f8e0-43ed-406c-9696-247c91bfa5a8.jpg)
![LibreTV-App 桌面端播放器](https://oss.keyrotate.com/public/images/e88d0dea-48d8-4699-b95b-8d3093146f29.jpg)

**移动端:**

<img src="https://oss.keyrotate.com/public/images/c209dbe4-820e-41c8-923a-4246d4005c33.jpg" alt="LibreTV-App 移动端主页" width="300" />
<img src="https://oss.keyrotate.com/public/images/ce2605d0-6f2c-4c5b-8b65-cdb7689e2091.jpg" alt="LibreTV-App 移动端筛选" width="300" />

---

## 🚀 快速开始

### 1. 直接安装 (推荐)

您可以直接从项目的 [**Releases 页面**](https://github.com/KeyRotate/LibreTV-App/releases) 下载适用于您操作系统的最新版本安装包。

安装后即可直接运行，无需额外配置或部署服务器。

### 2. 从源码编译

如果您是开发者，希望从源代码编译本项目，或者参与开发贡献，请参考我们的 [**构建指南 (BUILDING.md)**](BUILDING.md)。

---

## 🛠️ 技术栈

- **核心框架**: [Tauri 2.0](https://tauri.app/)
- **前端**: HTML, CSS, JavaScript (Vanilla JS)
- **UI**: [Tailwind CSS](https://tailwindcss.com/)


## ⚠️ 免责声明
LibreTV-App 仅作为视频搜索工具，不存储、上传或分发任何视频内容。所有视频均来自第三方 API 接口提供的搜索结果。如有侵权内容，请联系相应的内容提供方。

本项目开发者不对使用本项目产生的任何后果负责。使用本项目时，您必须遵守当地的法律法规。
