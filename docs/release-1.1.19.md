# KennysVideo 1.1.19 · Windows 与 Android 统一发布

## 本次更改

- Windows 和 Android 统一为 1.1.19，同一公告提供电脑安装版、电脑免安装版、手机 APK 和完整源码。
- Android 横屏视频按完整屏幕中心对齐；进度条与按钮使用左右相同的安全边距，同时避开水滴/挖孔区域，避免控制区偏向一侧。
- 首页、启动声明及观看前广告提醒弹窗增加“请勿宣传本软件”；保留“切勿相信视频中的广告”提醒。
- 两端保留推荐、搜索、筛选、选集、历史、自定义 API、配置导入导出与 BUG 反馈。Windows 保留单窗口、托盘和关闭偏好；Android 使用系统返回与后台操作。
- Windows 与 Android 各自检查和下载对应安装包，保留 GitHub 优先、超时/低速回退 Gitee、下载进度和 SHA-256 校验。手机安装需用户在系统界面确认。

Android 1.1.17 预览版没有更新器，需手动覆盖安装一次；1.1.18 起已接入更新检查。Android APK 继续使用同一包名和测试签名，支持 ARM64/x86_64，最低 Android 7，旧系统需更新 WebView。Windows 安装器保留原应用标识。两端当前均为未取得商业代码签名的分发包。

## English

- Unified Windows and Android version 1.1.19, with both platforms available in this release.
- Centered Android landscape playback and made control margins symmetric while avoiding display cutouts.
- Added “Please do not promote this software” to the home screen, startup notice and pre-playback advertising warning (displayed in Chinese in the app).
- Preserved the shared search, playback, episode, history, custom API, configuration and BUG-reporting features. Each platform downloads its own installer, with progress reporting and SHA-256 verification.
- Android installation requires system confirmation. Android 1.1.17 preview users must manually install once; 1.1.18 and later include update checks.

## 开源来源 / Attribution

基于 [KeyRotate/LibreTV-App](https://github.com/KeyRotate/LibreTV-App) 修改，上游为 [LibreSpark/LibreTV](https://github.com/LibreSpark/LibreTV)。保留 Apache License 2.0、原版权声明、NOTICE 及第三方许可。完整修改版源码在版本号 source.zip 附件中。
