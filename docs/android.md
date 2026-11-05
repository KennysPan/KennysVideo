# KennysVideo Android 首版

Android 工程使用现有 Tauri 2 / Rust / HTML、CSS、JavaScript 与 DPlayer、HLS.js，主工程位于 `src-tauri/gen/android`。不另建服务器，也不把后台管理密码或 SMTP 凭据放进 APK。首次以 ARM64 手机和 x86_64 模拟器作为构建目标，最低声明 Android 7（API 24），目标 API 35；旧系统需更新 Android System WebView，首版尚未验证旧机型兼容性。

## 已接入功能

- 复用首页推荐、海报、搜索、自定义 API、影片详情、选集、历史记录、设置、启动提示与 BUG 反馈。
- 复用 KennysVideo 名称和用户提供的头像，生成 Android 各密度启动图标。
- 系统栏、挖孔和键盘区域由原生 Activity 处理，主页保留系统栏，播放器全屏时横屏并允许滑出系统栏。
- 水滴屏横屏全屏时，视频容器延伸至屏幕边缘，取消原生缺口区域的整页留白；进度条和播放按钮单独避让左右缺口。退出全屏后恢复普通页面安全边距。
- 返回键先处理弹窗、退出播放器全屏、返回影片列表或主页；主页无其他返回目标时将任务放入后台。
- 切到后台暂停视频；全屏时保持屏幕亮起。首版不提供后台音频播放或画中画。
- 配置导入使用系统文件选择器，配置导出使用 Android 系统保存对话框，不申请存储目录的广泛访问权限。
- Android 不注册 Windows 托盘或关闭偏好；1.1.18 起启动检查独立 Android 更新源，设置页可手动检查，下载 APK 显示进度并校验 SHA-256，由 Android 系统确认覆盖安装，不下载 EXE。
- 与桌面端共用自建反馈服务及已披露的随机安装标识，不读取设备硬件编号。

部分用户选择的视频源使用 HTTP，Android 网络配置允许明文视频请求；BUG 反馈始终使用 HTTPS。不同来源是否可播放还取决于源可用性、跨域策略及设备解码能力。

## 构建

准备 Node.js/npm、JDK 17、Android SDK（平台 35、Build Tools、Platform Tools）、NDK r30、Rust Android 标准库。设置 `JAVA_HOME`、`ANDROID_HOME`、`NDK_HOME`。本机可使用工作区 build-tools 中的 Rust 和 NDK，不改系统级环境变量。

```powershell
npm ci
rustup target add aarch64-linux-android x86_64-linux-android
npm run android:build
# 同时构建模拟器和 ARM64：
npm run android:build -- -Target both
```

源码已包含 Android Studio 工程，不需重复执行 `android init`；该命令可能重写 Gradle 的 CLI 调用任务。本工程已修正任务，使其从仓库的 node_modules 调用 Tauri CLI。构建工具固定为 Gradle 8.13、Android Gradle Plugin 8.13.2、JDK 17。

默认生成调试签名 APK，位于 `src-tauri/gen/android/app/build/outputs/apk/`；可直接用于手机安装测试。分发测试包默认剥离原生调试符号，设置 KENNYS_ANDROID_KEEP_SYMBOLS=true 可保留供原生断点调试。正式发布前需配置独立、妥善备份的发布签名；调试签名与未来正式签名不同，可能需要先导出配置再重新安装。私钥和签名密码不得进入 Git 或源码包。

## 验证范围

2026-10-25 已生成 `dist-android/KennysVideo-1.1.17-android-preview.apk`，46,371,559 字节，包含 arm64-v8a 和 x86_64；APK v2 签名校验通过。

同日水滴屏修复包为 `dist-android/KennysVideo-1.1.17-android-preview2.apk`，沿用相同版本号、包名和调试签名，可覆盖首版测试包。在启用 tall 显示缺口模拟的 Android 模拟器中，确认横屏 WebView 宽度覆盖完整物理屏幕；缺口左边距 48 CSS 像素时，控制条左边距为 68 像素，视频容器不再整体缩进。实际 HLS 播放、退出全屏、返回首页和原生导出取消均通过。仍需用户水滴屏真机复核。

- `node tests/androidFrontend.cjs`：手机布局、Windows 更新隔离、返回层级、原生导出路由及全屏返回通过；该测试使用浏览器和原生命令替身。
- `node tests/androidNativeSmoke.cjs <APK路径>`：已在真实运行的 Android 模拟器 APK / WebView / Activity 中通过原生 HTTP、设置页返回、实际 HLS 解码播放、原生横屏全屏、返回退出全屏、返回首页、首页退后台、原生保存文件对话框及取消结果。模拟器首次全屏系统引导需要先点击确认。
- 桌面回归：Rust 8 项测试通过（3 项外网测试默认忽略），影片点击、文字选择策略、多分辨率全屏通过。
- 仍需真机验证不同厂商手势、硬件解码、老版 WebView 和外部片源兼容性；没有把模拟器结果称为真机验收，也没有发送真实 BUG 邮件。

本地媒体测试只使用 FFmpeg 生成的测试图案与音频，不依赖外部影视资源；不自动发送真实 BUG 邮件。源码预览压缩包单独输出到 dist-android，避免覆盖 Windows 已发布源码包，且排除 jniLibs、构建缓存和签名私钥。

## Android 更新通道（1.1.18 起）

GitHub 使用独立 `android-latest` 预发布通道，避免改变 Windows 的 latest 发布。元数据地址为 `https://github.com/KennysPan/KennysVideo/releases/download/android-latest/android-update.json`。这是维护者发布的 JSON 清单，并非 GitHub Releases API 响应；字段沿用现有更新器契约：`tag_name` 为 `v` 加语义版本、`draft:false`、`prerelease:false` 表示通道中可安装的版本，`installer_sha256` 为 APK 校验值；`assets` 中须有 `KennysVideo-{版本}-android.apk`、`state:uploaded` 和该通道内精确的 `browser_download_url`。Android 和 Windows 元数据互不混用。

检查与下载沿用现有超时、低速回退及哈希校验；Gitee Android 备用地址为同名通道，只有上传对应 APK/清单后才能回退成功。Android 系统仍会要求用户确认安装，首次需授权安装来源；不会静默安装或关闭系统防护。1.1.17 Android 预览版未包含更新器，需手动覆盖安装一次。保留原包名与签名，安装前验证 APK 包名和更高版本号，系统继续校验签名。

## 功能对齐

Windows 和 Android 复用同一套推荐、搜索、筛选、影片详情、选集、播放、历史、自定义 API、配置导入导出、启动提示及 BUG 反馈页面。Android 补充触屏、安全边距、横屏全屏、系统返回及文件选择器；Windows 托盘和窗口关闭偏好由 Android 返回首页后退到后台替代。当前支持 ARM64 与 x86_64，未构建 32 位 ARM 安装包。

## 1.1.19 起统一发行版

Windows 与 Android 采用相同版本号，同一个 `v{版本}` 发行版提供两端安装包。Android 的 GitHub 清单改为 `releases/latest/download/android-update.json`，APK 地址使用清单中的版本标签；Gitee 使用现有 releases/latest API，在同一公告资产中选择 Android APK，并读取公告的 `KennysVideo-Android-SHA256:` 标记。Windows 保留 `update.json` 和 `KennysVideo-SHA256:`。两端哈希与包类型互不混用。

Android 1.1.18 已安装客户端仍读取旧 `android-latest` 地址，因此保留兼容索引和同版本 APK，供其升级至 1.1.19；新版本随后使用统一发行版。兼容索引属于旧客户端迁移用途，公开下载以统一版本公告为准。

参考：[Tauri Android 开发环境](https://v2.tauri.app/start/prerequisites/#android)、[APK 构建](https://v2.tauri.app/distribute/google-play/#build-apks)。
